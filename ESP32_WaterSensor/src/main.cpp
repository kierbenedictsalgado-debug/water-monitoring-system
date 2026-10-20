
#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
// 1. HOME WI-FI
// Replace these with your actual home Wi-Fi details.
// Use a 2.4 GHz Wi-Fi network.
// =====================================================
const char* HOME_WIFI_SSID = "2.4G_SalgadoFamily";
const char* HOME_WIFI_PASSWORD = "Lydict5121";

// =====================================================
// 2. ESP32 BACKUP HOTSPOT
// Connect your phone/laptop to this if router Wi-Fi
// is unavailable.
// =====================================================
const char* LOCAL_AP_NAME = "WATER-SENSOR-LOCAL";
const char* LOCAL_AP_PASSWORD = "ChangeMe456";

// Hotspot dashboard address: http://192.168.4.1

// =====================================================
// 3. BACKEND SERVER
// Change this if your backend computer uses another IP.
// =====================================================
const char* SERVER_URL =
    "http://192.168.0.107:4000/api/sensor/reading";

const char* DEVICE_ID = "ESP32-001";

// =====================================================
// 4. YF-S201 FLOW SENSOR
// 450 pulses/L is a starting value; calibrate it.
// =====================================================
const int FLOW_SENSOR_PIN = 27;
const float PULSES_PER_LITER = 450.0f;

// =====================================================
// 5. OLED
// =====================================================
const int OLED_SDA_PIN = 21;
const int OLED_SCL_PIN = 22;
const int OLED_ADDRESS = 0x3C;

Adafruit_SSD1306 display(128, 64, &Wire, -1);
bool oledReady = false;

// =====================================================
// 6. MICROSD
// =====================================================
const int SD_CS_PIN = 5;
const int SD_SCK_PIN = 18;
const int SD_MISO_PIN = 19;
const int SD_MOSI_PIN = 23;

bool sdReady = false;
const char* CSV_FILE = "/water_log.csv";

// =====================================================
// 7. LOCAL PERSISTENT STORAGE
// =====================================================
Preferences preferences;
const char* PREF_NAMESPACE = "waterMeter";
const char* PREF_TOTAL_KEY = "totalLiters";

// =====================================================
// 8. WEB SERVER AND CONNECTION STATE
// =====================================================
WebServer server(80);

bool webServerStarted = false;
bool localAPStarted = false;

// =====================================================
// 9. TIMERS
// =====================================================
const unsigned long MEASUREMENT_INTERVAL = 1000;
const unsigned long SAVE_INTERVAL = 60000;
const unsigned long SD_LOG_INTERVAL = 60000;
const unsigned long BACKEND_INTERVAL = 10000;
const unsigned long WIFI_RETRY_INTERVAL = 15000;
const unsigned long OLED_INTERVAL = 1000;

unsigned long previousMeasurementMillis = 0;
unsigned long previousSaveMillis = 0;
unsigned long previousSDMillis = 0;
unsigned long previousBackendMillis = 0;
unsigned long previousWiFiRetryMillis = 0;
unsigned long previousOLEDMillis = 0;

// =====================================================
// 10. MEASUREMENT DATA
// =====================================================
volatile uint32_t pulseCount = 0;
portMUX_TYPE pulseMux = portMUX_INITIALIZER_UNLOCKED;

float flowRate = 0.0f;
float totalLiters = 0.0f;
float lastIntervalLiters = 0.0f;

// =====================================================
// FLOW SENSOR INTERRUPT
// =====================================================
void IRAM_ATTR flowPulseISR() {
    portENTER_CRITICAL_ISR(&pulseMux);
    pulseCount++;
    portEXIT_CRITICAL_ISR(&pulseMux);
}

// =====================================================
// SAVE TOTAL TO ESP32 FLASH
// =====================================================
void saveTotalConsumption() {
    preferences.putFloat(PREF_TOTAL_KEY, totalLiters);

    Serial.print("Saved total: ");
    Serial.print(totalLiters, 3);
    Serial.println(" L");
}

// =====================================================
// RESTORE PREVIOUS TOTAL
// =====================================================
void restoreTotalConsumption() {
    totalLiters = preferences.getFloat(PREF_TOTAL_KEY, 0.0f);

    Serial.print("Restored total: ");
    Serial.print(totalLiters, 3);
    Serial.println(" L");
}

// =====================================================
// OLED UPDATE
// =====================================================
void updateOLED() {
    if (!oledReady) return;

    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);

    display.println("WATER MONITOR");
    display.println("----------------");

    display.print("Flow: ");
    display.print(flowRate, 2);
    display.println(" L/min");

    display.print("Total: ");
    display.print(totalLiters, 3);
    display.println(" L");

    display.print("WiFi: ");
    display.println(
        WiFi.status() == WL_CONNECTED ? "Connected" : "Offline"
    );

    display.print("Hotspot: ");
    display.println(localAPStarted ? "Active" : "Off");

    display.print("SD: ");
    display.println(sdReady ? "Ready" : "Unavailable");

    display.display();
}

// =====================================================
// INITIALIZE OLED
// =====================================================
void initializeOLED() {
    Serial.println("Initializing OLED...");

    Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);

    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
        Serial.println("OLED initialization FAILED.");
        return;
    }

    oledReady = true;
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("WATER MONITOR");
    display.println("Starting...");
    display.display();

    Serial.println("OLED initialized successfully.");
}

// =====================================================
// INITIALIZE MICROSD
// =====================================================
void initializeSDCard() {
    Serial.println("Initializing microSD...");

    SPI.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);

    if (!SD.begin(SD_CS_PIN, SPI)) {
        Serial.println("microSD initialization FAILED.");
        Serial.println("Continuing without microSD.");
        sdReady = false;
        return;
    }

    sdReady = true;
    Serial.println("microSD initialized successfully.");

    if (!SD.exists(CSV_FILE)) {
        File file = SD.open(CSV_FILE, FILE_WRITE);

        if (file) {
            file.println("Uptime_ms,Flow_L_min,Interval_L,Total_L");
            file.close();
        }
    }
}

// =====================================================
// WRITE MEASUREMENTS TO MICROSD
// =====================================================
void logToSD() {
    if (!sdReady) return;

    File file = SD.open(CSV_FILE, FILE_APPEND);

    if (!file) {
        Serial.println("Could not open microSD log file.");
        return;
    }

    file.print(millis());
    file.print(",");
    file.print(flowRate, 4);
    file.print(",");
    file.print(lastIntervalLiters, 5);
    file.print(",");
    file.println(totalLiters, 5);
    file.close();

    Serial.println("Measurement logged to microSD.");
}

// =====================================================
// DASHBOARD PAGE
// =====================================================
void handleDashboard() {
    String html = R"HTML(
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>ESP32 Water Monitor</title>
<style>
body {
  font-family: Arial, sans-serif;
  margin: 20px;
  background: #f1f5f9;
  color: #172033;
}
.card {
  background: white;
  padding: 18px;
  margin-bottom: 15px;
  border-radius: 10px;
}
.value {
  font-size: 26px;
  font-weight: bold;
}
button {
  padding: 12px;
  background: #b91c1c;
  color: white;
  border: none;
  border-radius: 6px;
}
</style>
</head>
<body>
<h2>Household Water Monitoring</h2>

<div class="card">
  <h3>Current Flow Rate</h3>
  <div class="value" id="flow">Loading...</div>
</div>

<div class="card">
  <h3>Total Consumption</h3>
  <div class="value" id="total">Loading...</div>
</div>

<div class="card">
  <h3>Connection Status</h3>
  <p id="wifi">Loading...</p>
  <p id="hotspot">Loading...</p>
  <p id="sd">Loading...</p>
  <p id="ip">Loading...</p>
</div>

<div class="card">
  <h3>Reset Total</h3>
  <p>Reset the accumulated total to zero.</p>
  <button onclick="resetTotal()">Reset Total</button>
</div>

<script>
async function refreshStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();

    document.getElementById('flow').textContent =
      Number(data.flowRate).toFixed(2) + ' L/min';

    document.getElementById('total').textContent =
      Number(data.totalLiters).toFixed(3) + ' L';

    document.getElementById('wifi').textContent =
      'Home Wi-Fi: ' + data.wifiStatus;

    document.getElementById('hotspot').textContent =
      'ESP32 hotspot: ' + data.hotspotStatus;

    document.getElementById('sd').textContent =
      'microSD: ' + data.sdStatus;

    document.getElementById('ip').textContent =
      'Device IP: ' + data.ipAddress;
  } catch (error) {
    console.log('Unable to load status:', error);
  }
}

async function resetTotal() {
  if (!confirm('Reset total consumption to zero?')) return;

  try {
    const response = await fetch('/api/reset', { method: 'POST' });
    const result = await response.json();
    alert(result.message);
    refreshStatus();
  } catch (error) {
    alert('Reset request failed.');
  }
}

refreshStatus();
</script>
</body>
</html>
)HTML";

    server.send(200, "text/html", html);
}

// =====================================================
// STATUS API
// =====================================================
void handleStatus() {
    String wifiStatus =
        WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected";

    String hotspotStatus =
        localAPStarted ? "Active" : "Off";

    String sdStatus = sdReady ? "Ready" : "Unavailable";

    // Report the correct IP for the interface being used.
    String ipAddress;

    if (WiFi.status() == WL_CONNECTED) {
        ipAddress = WiFi.localIP().toString();
    } else if (localAPStarted) {
        ipAddress = WiFi.softAPIP().toString();
    } else {
        ipAddress = "Unavailable";
    }

    String json = "{";
    json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    json += "\"flowRate\":" + String(flowRate, 4) + ",";
    json += "\"intervalLiters\":" + String(lastIntervalLiters, 5) + ",";
    json += "\"totalLiters\":" + String(totalLiters, 5) + ",";
    json += "\"wifiStatus\":\"" + wifiStatus + "\",";
    json += "\"hotspotStatus\":\"" + hotspotStatus + "\",";
    json += "\"sdStatus\":\"" + sdStatus + "\",";
    json += "\"ipAddress\":\"" + ipAddress + "\"";
    json += "}";

    server.send(200, "application/json", json);
}

// =====================================================
// MANUAL RESET API
// =====================================================
void handleResetTotal() {
    totalLiters = 0.0f;
    flowRate = 0.0f;
    lastIntervalLiters = 0.0f;

    saveTotalConsumption();

    server.send(
        200,
        "application/json",
        "{\"success\":true,\"message\":\"Total consumption reset to zero.\"}"
    );

    updateOLED();
}

// =====================================================
// START WEB SERVER
// Works on home Wi-Fi or the ESP32 hotspot.
// =====================================================
void startWebServer() {
    if (webServerStarted) return;

    server.on("/", HTTP_GET, handleDashboard);
    server.on("/api/status", HTTP_GET, handleStatus);
    server.on("/api/reset", HTTP_POST, handleResetTotal);

    server.begin();
    webServerStarted = true;

    Serial.println("Web server started.");
}

// =====================================================
// START BACKUP HOTSPOT
// =====================================================
void startLocalHotspot() {
    if (localAPStarted) return;

    Serial.println();
    Serial.println("Starting ESP32 backup hotspot...");

    // AP+STA allows the hotspot and router connection
    // to operate together when the router is available.
    WiFi.mode(WIFI_AP_STA);

    bool started = WiFi.softAP(
        LOCAL_AP_NAME,
        LOCAL_AP_PASSWORD
    );

    if (started) {
        localAPStarted = true;

        Serial.println("Backup hotspot started.");
        Serial.print("Hotspot name: ");
        Serial.println(LOCAL_AP_NAME);

        Serial.print("Hotspot password: ");
        Serial.println(LOCAL_AP_PASSWORD);

        Serial.print("Local dashboard: http://");
        Serial.println(WiFi.softAPIP());

        startWebServer();
    } else {
        Serial.println("ERROR: Could not start backup hotspot.");
    }
}

// =====================================================
// CONNECT TO HOME WI-FI FIRST
// If unavailable, start the backup hotspot.
// =====================================================
void setupWiFi() {
    Serial.println();
    Serial.println("Connecting to home Wi-Fi...");

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);

    WiFi.begin(HOME_WIFI_SSID, HOME_WIFI_PASSWORD);

    unsigned long startAttempt = millis();

    while (WiFi.status() != WL_CONNECTED &&
           millis() - startAttempt < 20000) {
        delay(500);
        Serial.print(".");
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("SUCCESS: Home Wi-Fi connected.");

        Serial.print("ESP32 home-network IP: ");
        Serial.println(WiFi.localIP());

        startWebServer();

        // No hotspot is needed while home Wi-Fi works.
        Serial.println("Backup hotspot will start if Wi-Fi is lost.");
    } else {
        Serial.println("Home Wi-Fi unavailable.");
        Serial.println("Switching to backup hotspot.");

        startLocalHotspot();
    }

    updateOLED();
}

// =====================================================
// MONITOR AND RETRY HOME WI-FI
// Start hotspot if connection is lost.
// Keep hotspot active once started.
// =====================================================
void maintainWiFi(unsigned long now) {
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }

    // If router Wi-Fi is lost, provide local access.
    if (!localAPStarted) {
        Serial.println("Home Wi-Fi lost.");
        startLocalHotspot();
    }

    if (now - previousWiFiRetryMillis <
        WIFI_RETRY_INTERVAL) {
        return;
    }

    previousWiFiRetryMillis = now;

    Serial.println("Retrying home Wi-Fi...");
    WiFi.begin(HOME_WIFI_SSID, HOME_WIFI_PASSWORD);
}

// =====================================================
// MEASURE WATER CONSUMPTION
// =====================================================
void measureWaterConsumption() {
    uint32_t pulses;

    portENTER_CRITICAL(&pulseMux);
    pulses = pulseCount;
    pulseCount = 0;
    portEXIT_CRITICAL(&pulseMux);

    lastIntervalLiters =
        (float)pulses / PULSES_PER_LITER;

    flowRate = lastIntervalLiters * 60.0f;

    totalLiters += lastIntervalLiters;

    Serial.print("Pulses: ");
    Serial.print(pulses);

    Serial.print(" | Flow: ");
    Serial.print(flowRate, 3);
    Serial.print(" L/min");

    Serial.print(" | Interval: ");
    Serial.print(lastIntervalLiters, 5);
    Serial.print(" L");

    Serial.print(" | Total: ");
    Serial.print(totalLiters, 3);
    Serial.println(" L");
}

// =====================================================
// SEND DATA TO BACKEND
// =====================================================
void sendToBackend() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Backend skipped: home Wi-Fi unavailable.");
        return;
    }

    HTTPClient http;
    WiFiClient client;

    http.setConnectTimeout(3000);
    http.setTimeout(3000);

    if (!http.begin(client, SERVER_URL)) {
        Serial.println("Backend HTTP initialization failed.");
        return;
    }

    http.addHeader("Content-Type", "application/json");

    String payload = "{";
    payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
    payload += "\"consumption\":" + String(totalLiters, 5) + ",";
    payload += "\"flowRate\":" + String(flowRate, 5) + ",";
    payload += "\"intervalLiters\":" + String(lastIntervalLiters, 5);
    payload += "}";

    Serial.print("Sending to backend: ");
    Serial.println(payload);

    int httpCode = http.POST(payload);

    if (httpCode > 0) {
        Serial.print("Backend HTTP response: ");
        Serial.println(httpCode);

        String response = http.getString();

        if (response.length() > 0) {
            Serial.println(response);
        }
    } else {
        Serial.print("Backend request failed: ");
        Serial.println(http.errorToString(httpCode));
    }

    http.end();
}

// =====================================================
// SERIAL COMMANDS
// R = reset total
// S = save total immediately
// P = print status
// =====================================================
void handleSerialCommands() {
    while (Serial.available() > 0) {
        char command = Serial.read();

        if (command == 'R' || command == 'r') {
            totalLiters = 0.0f;
            flowRate = 0.0f;
            lastIntervalLiters = 0.0f;

            saveTotalConsumption();
            updateOLED();

            Serial.println("Total reset to zero.");
        } else if (command == 'S' || command == 's') {
            saveTotalConsumption();
            Serial.println("Total saved.");
        } else if (command == 'P' || command == 'p') {
            Serial.println("----- WATER STATUS -----");
            Serial.print("Flow: ");
            Serial.print(flowRate, 3);
            Serial.println(" L/min");

            Serial.print("Total: ");
            Serial.print(totalLiters, 3);
            Serial.println(" L");

            Serial.print("Home Wi-Fi: ");
            Serial.println(
                WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected"
            );

            Serial.print("Backup hotspot: ");
            Serial.println(localAPStarted ? "Active" : "Off");

            Serial.print("microSD: ");
            Serial.println(sdReady ? "Ready" : "Unavailable");

            Serial.println("------------------------");
        }
    }
}

// =====================================================
// SETUP
// =====================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("================================");
    Serial.println("ESP32 WATER MONITORING SYSTEM");
    Serial.println("================================");

    preferences.begin(PREF_NAMESPACE, false);
    restoreTotalConsumption();

    initializeOLED();
    initializeSDCard();

    pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);

    portENTER_CRITICAL(&pulseMux);
    pulseCount = 0;
    portEXIT_CRITICAL(&pulseMux);

    attachInterrupt(
        digitalPinToInterrupt(FLOW_SENSOR_PIN),
        flowPulseISR,
        FALLING
    );

    Serial.println("Flow sensor interrupt enabled.");

    setupWiFi();

    previousMeasurementMillis = millis();
    previousSaveMillis = millis();
    previousSDMillis = millis();
    previousBackendMillis = millis();
    previousWiFiRetryMillis = millis();
    previousOLEDMillis = millis();

    Serial.println("System setup complete.");
    Serial.println("R=reset total, S=save, P=status");
}

// =====================================================
// MAIN LOOP
// =====================================================
void loop() {
    unsigned long now = millis();

    if (webServerStarted) {
        server.handleClient();
    }

    if (now - previousMeasurementMillis >=
        MEASUREMENT_INTERVAL) {
        previousMeasurementMillis += MEASUREMENT_INTERVAL;
        measureWaterConsumption();
    }

    if (now - previousSaveMillis >= SAVE_INTERVAL) {
        previousSaveMillis = now;
        saveTotalConsumption();
    }

    if (now - previousSDMillis >= SD_LOG_INTERVAL) {
        previousSDMillis = now;
        logToSD();
    }

    if (now - previousBackendMillis >= BACKEND_INTERVAL) {
        previousBackendMillis = now;
        sendToBackend();
    }

    maintainWiFi(now);

    if (now - previousOLEDMillis >= OLED_INTERVAL) {
        previousOLEDMillis = now;
        updateOLED();
    }

    handleSerialCommands();

    delay(2);
}
