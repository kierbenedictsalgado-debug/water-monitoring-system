#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <Preferences.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <math.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// =====================================================
// WIFI CONFIGURATION
// =====================================================

const char* HOME_WIFI_SSID = "2.4G_SalgadoFamily";
const char* HOME_WIFI_PASSWORD = "Lydict5121";

const char* LOCAL_AP_NAME = "WaterMonitor-ESP32";
const char* LOCAL_AP_PASSWORD = "ChangeThis123";

const char* SERVER_URL =
    "http://192.168.0.100:4000/api/sensor/reading";

const char* DEVICE_ID = "ESP32-001";

// =====================================================
// WATER FLOW SENSOR
// =====================================================

const int FLOW_SENSOR_PIN = 27;
const float PULSES_PER_LITER = 450.0f;

#define SENSOR_INTERRUPT_EDGE RISING

// =====================================================
// OLED CONFIGURATION
// =====================================================

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

const int OLED_SDA_PIN = 21;
const int OLED_SCL_PIN = 22;

Adafruit_SSD1306 display(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    OLED_RESET
);

// =====================================================
// SD CARD CONFIGURATION
// =====================================================

const int SD_CS_PIN = 5;
const int SD_SCK_PIN = 18;
const int SD_MISO_PIN = 19;
const int SD_MOSI_PIN = 23;

const char* LOG_FILE = "/water_log.csv";
const char* QUEUE_FILE = "/pending.jsonl";
const char* TEMP_FILE = "/pending.tmp";
const char* BACKUP_FILE = "/pending.bak";

// =====================================================
// TIMING
// =====================================================

const unsigned long MEASURE_INTERVAL_MS = 1000;
const unsigned long QUEUE_INTERVAL_MS = 10000;
const unsigned long SAVE_TOTAL_INTERVAL_MS = 10000;
const unsigned long WIFI_RETRY_INTERVAL_MS = 15000;
const unsigned long UPLOAD_RETRY_INTERVAL_MS = 3000;
const unsigned long OLED_INTERVAL_MS = 1000;
const unsigned long HTTP_TIMEOUT_MS = 5000;

// =====================================================
// GLOBAL VARIABLES
// =====================================================

WebServer server(80);
Preferences preferences;

portMUX_TYPE pulseMux = portMUX_INITIALIZER_UNLOCKED;

volatile unsigned long pulseCount = 0;

float flowRateLMin = 0.0f;
float intervalLiters = 0.0f;
float totalLiters = 0.0f;
float reportingWindowLiters = 0.0f;

unsigned long reportingWindowStartMs = 0;

unsigned long lastMeasureMs = 0;
unsigned long lastQueueMs = 0;
unsigned long lastSaveMs = 0;
unsigned long lastWiFiRetryMs = 0;
unsigned long lastUploadAttemptMs = 0;
unsigned long lastOLEDUpdateMs = 0;

unsigned long readingSequence = 0;

bool oledReady = false;
bool sdReady = false;
bool hotspotStarted = false;
bool webServerStarted = false;
bool homeWiFiConnected = false;

String lastUploadStatus = "Not attempted";

// Forward declaration
bool postJsonLine(const String& jsonLine);

// =====================================================
// SENSOR INTERRUPT
// =====================================================

void IRAM_ATTR onFlowPulse() {
    portENTER_CRITICAL_ISR(&pulseMux);
    pulseCount++;
    portEXIT_CRITICAL_ISR(&pulseMux);
}

// =====================================================
// SAVE AND RESTORE TOTAL CONSUMPTION
// =====================================================

void saveTotalLiters() {
    preferences.putFloat("totalLiters", totalLiters);
}

void restoreTotalLiters() {
    totalLiters = preferences.getFloat(
        "totalLiters",
        0.0f
    );

    readingSequence = preferences.getULong(
        "readingSeq",
        0
    );

    if (!isfinite(totalLiters) || totalLiters < 0.0f) {
        totalLiters = 0.0f;
    }

    Serial.print("Restored total consumption: ");
    Serial.print(totalLiters, 3);
    Serial.println(" L");
}

String makeReadingId() {
    readingSequence++;

    preferences.putULong(
        "readingSeq",
        readingSequence
    );

    return String(DEVICE_ID) + "-" + String(readingSequence);
}

// =====================================================
// OLED INITIALIZATION
// =====================================================

void initializeOLED() {
    Wire.begin(
        OLED_SDA_PIN,
        OLED_SCL_PIN
    );

    if (!display.begin(
            SSD1306_SWITCHCAPVCC,
            OLED_ADDRESS)) {
        Serial.println(
            "OLED initialization failed. Continuing without OLED."
        );

        oledReady = false;
        return;
    }

    oledReady = true;

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);

    display.println("Water Monitor");
    display.println("Initializing...");

    display.display();

    Serial.println("OLED initialized.");
}

// =====================================================
// SD CARD INITIALIZATION
// =====================================================

void initializeSDCard() {
    SPI.begin(
        SD_SCK_PIN,
        SD_MISO_PIN,
        SD_MOSI_PIN,
        SD_CS_PIN
    );

    if (!SD.begin(
            SD_CS_PIN,
            SPI,
            4000000)) {
        Serial.println(
            "SD card initialization failed. Logging and offline queue unavailable."
        );

        sdReady = false;
        return;
    }

    sdReady = true;

    if (!SD.exists(LOG_FILE)) {
        File file = SD.open(
            LOG_FILE,
            FILE_WRITE
        );

        if (file) {
            file.println(
                "Uptime_ms,Flow_L_min,Interval_L,Total_L"
            );

            file.close();
        }
    }

    if (!SD.exists(QUEUE_FILE)) {
        File file = SD.open(
            QUEUE_FILE,
            FILE_WRITE
        );

        if (file) {
            file.close();
        }
    }

    Serial.println("SD card initialized.");
}

// =====================================================
// CSV LOGGING
// =====================================================

void logMeasurementToCSV() {
    if (!sdReady) {
        return;
    }

    File file = SD.open(
        LOG_FILE,
        FILE_APPEND
    );

    if (!file) {
        Serial.println(
            "Unable to open CSV log file."
        );

        return;
    }

    file.print(millis());
    file.print(",");
    file.print(flowRateLMin, 4);
    file.print(",");
    file.print(intervalLiters, 6);
    file.print(",");
    file.println(totalLiters, 6);

    file.close();
}

// =====================================================
// COUNT PENDING QUEUE RECORDS
// =====================================================

unsigned long pendingQueueCount() {
    if (!sdReady || !SD.exists(QUEUE_FILE)) {
        return 0;
    }

    File file = SD.open(
        QUEUE_FILE,
        FILE_READ
    );

    if (!file) {
        return 0;
    }

    unsigned long count = 0;

    while (file.available()) {
        String line = file.readStringUntil('\n');
        line.trim();

        if (line.length() > 0) {
            count++;
        }
    }

    file.close();

    return count;
}

// =====================================================
// ADD READING TO QUEUE OR UPLOAD DIRECTLY
// =====================================================

bool enqueueReading() {
    JsonDocument document;

    document["readingId"] = makeReadingId();
    document["deviceId"] = DEVICE_ID;
    document["consumption"] = totalLiters;
    document["flowRate"] = flowRateLMin;
    document["intervalLiters"] = intervalLiters;
    document["uptimeMs"] = millis();

    String jsonLine;

    serializeJson(
        document,
        jsonLine
    );

    // Preserve the original queue behavior when SD works.
    if (sdReady) {
        File file = SD.open(
            QUEUE_FILE,
            FILE_APPEND
        );

        if (file) {
            file.println(jsonLine);
            file.flush();
            file.close();

            Serial.println("Reading added to offline queue:");
            Serial.println(jsonLine);

            return true;
        }

        Serial.println(
            "Unable to open pending queue. Trying direct upload."
        );
    } else {
        Serial.println(
            "SD card unavailable. Trying direct upload."
        );
    }

    // Without SD, send the current reading directly.
    if (WiFi.status() == WL_CONNECTED) {
        bool uploaded = postJsonLine(jsonLine);

        if (uploaded) {
            Serial.println("Direct upload successful.");
            return true;
        }

        Serial.println(
            "Direct upload failed. Reading was not saved."
        );
    } else {
        lastUploadStatus = "Wi-Fi disconnected";

        Serial.println(
            "Cannot upload: home Wi-Fi is disconnected."
        );
    }

    return false;
}

// =====================================================
// REMOVE FIRST QUEUED READING
// =====================================================

bool removeFirstQueuedReading() {
    if (!sdReady || !SD.exists(QUEUE_FILE)) {
        return false;
    }

    File source = SD.open(
        QUEUE_FILE,
        FILE_READ
    );

    if (!source) {
        return false;
    }

    String firstLine = source.readStringUntil('\n');
    firstLine.trim();

    if (firstLine.length() == 0) {
        source.close();
        return false;
    }

    SD.remove(TEMP_FILE);

    File temporary = SD.open(
        TEMP_FILE,
        FILE_WRITE
    );

    if (!temporary) {
        source.close();
        return false;
    }

    while (source.available()) {
        String line = source.readStringUntil('\n');
        line.trim();

        if (line.length() > 0) {
            temporary.println(line);
        }
    }

    source.close();
    temporary.flush();
    temporary.close();

    SD.remove(BACKUP_FILE);

    if (SD.exists(QUEUE_FILE)) {
        if (!SD.rename(QUEUE_FILE, BACKUP_FILE)) {
            SD.remove(TEMP_FILE);
            return false;
        }
    }

    if (!SD.rename(TEMP_FILE, QUEUE_FILE)) {
        if (SD.exists(BACKUP_FILE)) {
            SD.rename(BACKUP_FILE, QUEUE_FILE);
        }

        return false;
    }

    SD.remove(BACKUP_FILE);

    return true;
}

// =====================================================
// SEND READING TO BACKEND
// =====================================================

bool postJsonLine(const String& jsonLine) {
    if (WiFi.status() != WL_CONNECTED) {
        lastUploadStatus = "Wi-Fi disconnected";
        return false;
    }

    WiFiClient client;
    HTTPClient http;

    http.setTimeout(HTTP_TIMEOUT_MS);

    if (!http.begin(client, SERVER_URL)) {
        lastUploadStatus = "HTTP initialization failed";

        Serial.println(lastUploadStatus);
        return false;
    }

    http.addHeader(
        "Content-Type",
        "application/json"
    );

    int httpCode = http.POST(
        (uint8_t*)jsonLine.c_str(),
        jsonLine.length()
    );

    bool success =
        httpCode >= 200 && httpCode < 300;

    if (success) {
        lastUploadStatus = "HTTP " + String(httpCode);
    } else {
        lastUploadStatus = "HTTP error " + String(httpCode);
    }

    Serial.print("Upload result: ");
    Serial.println(lastUploadStatus);

    if (httpCode > 0) {
        Serial.print("Server response: ");
        Serial.println(http.getString());
    }

    http.end();

    return success;
}

// =====================================================
// UPLOAD PENDING READINGS
// =====================================================

void uploadPendingReadings() {
    unsigned long now = millis();

    if (now - lastUploadAttemptMs <
        UPLOAD_RETRY_INTERVAL_MS) {
        return;
    }

    lastUploadAttemptMs = now;

    if (!sdReady ||
        WiFi.status() != WL_CONNECTED ||
        !SD.exists(QUEUE_FILE)) {
        return;
    }

    File file = SD.open(
        QUEUE_FILE,
        FILE_READ
    );

    if (!file) {
        return;
    }

    String firstLine = file.readStringUntil('\n');
    file.close();
    firstLine.trim();

    if (firstLine.length() == 0) {
        return;
    }

    if (postJsonLine(firstLine)) {
        if (removeFirstQueuedReading()) {
            Serial.println(
                "Uploaded and removed queued reading."
            );
        } else {
            Serial.println(
                "Upload succeeded, but queue removal failed."
            );
        }
    } else {
        Serial.println(
            "Upload failed. Reading remains queued."
        );
    }
}

// =====================================================
// DASHBOARD
// =====================================================

const char DASHBOARD_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ESP32 Water Monitor</title>
<style>
body {
    font-family: Arial, sans-serif;
    background: #f1f5f9;
    margin: 0;
    padding: 18px;
    color: #1e293b;
}
.container {
    max-width: 650px;
    margin: auto;
}
h1 { text-align: center; }
.card {
    background: white;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.label { color: #64748b; font-size: 14px; }
.value {
    font-size: 22px;
    font-weight: bold;
    margin-top: 7px;
    overflow-wrap: anywhere;
}
button {
    background: #b91c1c;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 16px;
}
</style>
</head>
<body>
<div class="container">
<h1>Household Water Monitor</h1>

<div class="card">
<div class="label">Flow Rate</div>
<div class="value" id="flow">--</div>
</div>

<div class="card">
<div class="label">Last 10-Second Window</div>
<div class="value" id="interval">--</div>
</div>

<div class="card">
<div class="label">Total Consumption</div>
<div class="value" id="total">--</div>
</div>

<div class="card">
<div class="label">Home Wi-Fi</div>
<div class="value" id="wifi">--</div>
</div>

<div class="card">
<div class="label">Dashboard IP</div>
<div class="value" id="ip">--</div>
</div>

<div class="card">
<div class="label">SD Card</div>
<div class="value" id="sd">--</div>
</div>

<div class="card">
<div class="label">Pending Uploads</div>
<div class="value" id="pending">--</div>
</div>

<div class="card">
<div class="label">Last Upload</div>
<div class="value" id="upload">--</div>
</div>

<div class="card">
<button onclick="resetTotal()">Reset Total Consumption</button>
</div>
</div>

<script>
async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        document.getElementById('flow').textContent =
            Number(data.flowRate).toFixed(3) + ' L/min';

        document.getElementById('interval').textContent =
            Number(data.intervalLiters).toFixed(4) + ' L';

        document.getElementById('total').textContent =
            Number(data.totalLiters).toFixed(3) + ' L';

        document.getElementById('wifi').textContent =
            data.wifiConnected ? 'Connected' : 'Disconnected';

        document.getElementById('ip').textContent = data.ip;

        document.getElementById('sd').textContent =
            data.sdReady ? 'Available' : 'Unavailable';

        document.getElementById('pending').textContent =
            data.pending;

        document.getElementById('upload').textContent =
            data.lastUpload;
    } catch (error) {
        console.error('Dashboard update failed:', error);
    }
}

async function resetTotal() {
    if (!confirm('Reset total water consumption to zero?')) {
        return;
    }

    try {
        const response = await fetch('/api/reset', {
            method: 'POST'
        });

        const data = await response.json();
        alert(data.message);
        updateStatus();
    } catch (error) {
        alert('Unable to reset total consumption.');
    }
}

updateStatus();
setInterval(updateStatus, 3000);
</script>
</body>
</html>
)HTML";

// =====================================================
// API: STATUS
// =====================================================

void handleStatus() {
    JsonDocument document;

    document["deviceId"] = DEVICE_ID;
    document["flowRate"] = flowRateLMin;
    document["intervalLiters"] = intervalLiters;
    document["totalLiters"] = totalLiters;

    document["wifiConnected"] =
        WiFi.status() == WL_CONNECTED;

    document["sdReady"] = sdReady;
    document["hotspotStarted"] = hotspotStarted;
    document["pending"] = pendingQueueCount();
    document["lastUpload"] = lastUploadStatus;

    if (WiFi.status() == WL_CONNECTED) {
        document["ip"] = WiFi.localIP().toString();
    } else if (hotspotStarted) {
        document["ip"] = WiFi.softAPIP().toString();
    } else {
        document["ip"] = "Unavailable";
    }

    String response;
    serializeJson(document, response);

    server.send(
        200,
        "application/json",
        response
    );
}

// =====================================================
// API: RESET TOTAL
// =====================================================

void handleResetTotal() {
    totalLiters = 0.0f;
    reportingWindowLiters = 0.0f;

    saveTotalLiters();

    JsonDocument document;

    document["success"] = true;
    document["message"] =
        "Total consumption reset to zero.";

    String response;
    serializeJson(document, response);

    server.send(
        200,
        "application/json",
        response
    );

    Serial.println("Total consumption reset.");
}

// =====================================================
// WEB SERVER
// =====================================================

void startWebServer() {
    if (webServerStarted) {
        return;
    }

    server.on("/", HTTP_GET, []() {
        server.send_P(
            200,
            "text/html",
            DASHBOARD_HTML
        );
    });

    server.on(
        "/api/status",
        HTTP_GET,
        handleStatus
    );

    server.on(
        "/api/reset",
        HTTP_POST,
        handleResetTotal
    );

    server.onNotFound([]() {
        server.send(
            404,
            "text/plain",
            "Not found"
        );
    });

    server.begin();
    webServerStarted = true;

    Serial.println("Web server started.");
}

// =====================================================
// LOCAL HOTSPOT
// =====================================================

void startLocalHotspot() {
    if (hotspotStarted) {
        return;
    }

    bool success = WiFi.softAP(
        LOCAL_AP_NAME,
        LOCAL_AP_PASSWORD
    );

    if (success) {
        hotspotStarted = true;

        Serial.println("Local hotspot started.");

        Serial.print("Hotspot SSID: ");
        Serial.println(LOCAL_AP_NAME);

        Serial.print("Dashboard URL: http://");
        Serial.println(WiFi.softAPIP());
    } else {
        Serial.println(
            "ERROR: Local hotspot failed to start."
        );
    }

    startWebServer();
}

// =====================================================
// HOME WI-FI SETUP
// =====================================================

void setupWiFi() {
    WiFi.mode(WIFI_AP_STA);
    WiFi.persistent(false);
    WiFi.setAutoReconnect(true);
    WiFi.setSleep(false);

    startLocalHotspot();

    Serial.println();
    Serial.println("Connecting to configured Wi-Fi...");
    Serial.print("SSID: ");
    Serial.println(HOME_WIFI_SSID);

    WiFi.begin(
        HOME_WIFI_SSID,
        HOME_WIFI_PASSWORD
    );

    unsigned long startTime = millis();

    while (
        WiFi.status() != WL_CONNECTED &&
        millis() - startTime < 20000
    ) {
        delay(500);
        Serial.print(".");
    }

    Serial.println();

    homeWiFiConnected =
        WiFi.status() == WL_CONNECTED;

    if (homeWiFiConnected) {
        Serial.println("HOME WI-FI CONNECTED!");

        Serial.print("ESP32 LAN IP: ");
        Serial.println(WiFi.localIP());

        Serial.print("Gateway: ");
        Serial.println(WiFi.gatewayIP());

        Serial.print("RSSI: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
    } else {
        Serial.println("HOME WI-FI CONNECTION FAILED.");

        Serial.print("Wi-Fi status code: ");
        Serial.println((int)WiFi.status());

        Serial.println(
            "Check the 2.4 GHz SSID, password, router security, and signal."
        );

        Serial.print("Hotspot IP remains: ");
        Serial.println(WiFi.softAPIP());
    }
}

// =====================================================
// MAINTAIN WI-FI
// =====================================================

void maintainWiFi(unsigned long now) {
    homeWiFiConnected =
        WiFi.status() == WL_CONNECTED;

    if (!hotspotStarted) {
        startLocalHotspot();
    }

    if (homeWiFiConnected) {
        return;
    }

    if (now - lastWiFiRetryMs <
        WIFI_RETRY_INTERVAL_MS) {
        return;
    }

    lastWiFiRetryMs = now;

    Serial.println("Retrying home Wi-Fi...");

    WiFi.begin(
        HOME_WIFI_SSID,
        HOME_WIFI_PASSWORD
    );
}

// =====================================================
// MEASURE WATER CONSUMPTION
// =====================================================

void measureWaterConsumption(unsigned long elapsedMs) {
    unsigned long currentPulses = 0;

    portENTER_CRITICAL(&pulseMux);
    currentPulses = pulseCount;
    pulseCount = 0;
    portEXIT_CRITICAL(&pulseMux);

    if (elapsedMs == 0) {
        elapsedMs = MEASURE_INTERVAL_MS;
    }

    float measuredLiters =
        (float)currentPulses / PULSES_PER_LITER;

    totalLiters += measuredLiters;
    reportingWindowLiters += measuredLiters;

    flowRateLMin =
        measuredLiters * 60000.0f /
        (float)elapsedMs;

    Serial.printf(
        "Pulses: %lu | Flow: %.3f L/min | Added: %.6f L | Total: %.3f L\n",
        currentPulses,
        flowRateLMin,
        measuredLiters,
        totalLiters
    );
}

// =====================================================
// FINALIZE REPORTING WINDOW
// =====================================================

void finalizeReportingWindow() {
    unsigned long now = millis();

    unsigned long elapsedMs =
        now - reportingWindowStartMs;

    if (elapsedMs == 0) {
        return;
    }

    intervalLiters = reportingWindowLiters;

    flowRateLMin =
        intervalLiters * 60000.0f /
        (float)elapsedMs;

    Serial.println();
    Serial.println("===== 10-SECOND REPORTING WINDOW =====");

    Serial.print("Elapsed: ");
    Serial.print(elapsedMs);
    Serial.println(" ms");

    Serial.print("Window volume: ");
    Serial.print(intervalLiters, 6);
    Serial.println(" L");

    Serial.print("Average flow: ");
    Serial.print(flowRateLMin, 4);
    Serial.println(" L/min");

    Serial.print("Total: ");
    Serial.print(totalLiters, 4);
    Serial.println(" L");

    Serial.println("======================================");
    Serial.println();

    reportingWindowLiters = 0.0f;
    reportingWindowStartMs = now;
}

// =====================================================
// UPDATE OLED
// =====================================================

void updateOLED() {
    if (!oledReady) {
        return;
    }

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);

    display.setCursor(0, 0);
    display.println("WATER MONITOR");

    display.setCursor(0, 12);
    display.print("Flow: ");
    display.print(flowRateLMin, 2);
    display.println(" L/min");

    display.setCursor(0, 23);
    display.print("Window: ");
    display.print(intervalLiters, 3);
    display.println(" L");

    display.setCursor(0, 34);
    display.print("Total: ");
    display.print(totalLiters, 2);
    display.println(" L");

    display.setCursor(0, 45);
    display.print("WiFi:");
    display.print(
        WiFi.status() == WL_CONNECTED ? "ON " : "OFF "
    );

    display.print("SD:");
    display.print(sdReady ? "ON" : "OFF");

    display.setCursor(0, 56);
    display.print("Queue: ");
    display.print(pendingQueueCount());

    display.display();
}

// =====================================================
// SERIAL COMMANDS
// =====================================================

void processSerialCommands() {
    if (!Serial.available()) {
        return;
    }

    char command = Serial.read();

    if (command == 'R' || command == 'r') {
        totalLiters = 0.0f;
        reportingWindowLiters = 0.0f;

        saveTotalLiters();

        Serial.println("Total consumption reset.");
    } else if (command == 'S' || command == 's') {
        saveTotalLiters();

        Serial.println("Total consumption saved.");
    } else if (command == 'P' || command == 'p') {
        Serial.println();
        Serial.println("===== SYSTEM STATUS =====");

        Serial.printf(
            "Total: %.4f L\n",
            totalLiters
        );

        Serial.printf(
            "Window: %.6f L\n",
            intervalLiters
        );

        Serial.printf(
            "Flow: %.4f L/min\n",
            flowRateLMin
        );

        Serial.printf(
            "Wi-Fi: %s\n",
            WiFi.status() == WL_CONNECTED
                ? "Connected"
                : "Disconnected"
        );

        Serial.printf(
            "Hotspot: %s\n",
            hotspotStarted ? "Started" : "Not started"
        );

        Serial.printf(
            "SD: %s\n",
            sdReady ? "Available" : "Unavailable"
        );

        Serial.printf(
            "Pending: %lu\n",
            pendingQueueCount()
        );

        Serial.println(
            "Last upload: " + lastUploadStatus
        );

        Serial.println("=========================");
        Serial.println();
    }
}

// =====================================================
// SETUP
// =====================================================

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("==============================");
    Serial.println("ESP32 WATER MONITOR");
    Serial.println("==============================");

    preferences.begin(
        "waterMeter",
        false
    );

    restoreTotalLiters();

    initializeOLED();
    initializeSDCard();

    pinMode(
        FLOW_SENSOR_PIN,
        INPUT_PULLUP
    );

    attachInterrupt(
        digitalPinToInterrupt(FLOW_SENSOR_PIN),
        onFlowPulse,
        SENSOR_INTERRUPT_EDGE
    );

    unsigned long now = millis();

    lastMeasureMs = now;
    lastQueueMs = now;
    lastSaveMs = now;
    lastWiFiRetryMs = now;
    lastOLEDUpdateMs = now;

    lastUploadAttemptMs =
        now - UPLOAD_RETRY_INTERVAL_MS;

    reportingWindowStartMs = now;

    setupWiFi();

    Serial.println();
    Serial.println("Setup complete.");
    Serial.println("R = Reset total");
    Serial.println("S = Save total");
    Serial.println("P = Print status");
    Serial.println(
        "Sensor and local features continue if home Wi-Fi is unavailable."
    );
}

// =====================================================
// MAIN LOOP
// =====================================================

void loop() {
    unsigned long now = millis();

    if (webServerStarted) {
        server.handleClient();
    }

    if (now - lastMeasureMs >= MEASURE_INTERVAL_MS) {
        unsigned long elapsedMs =
            now - lastMeasureMs;

        lastMeasureMs = now;

        measureWaterConsumption(elapsedMs);
        logMeasurementToCSV();
    }

    if (now - lastSaveMs >= SAVE_TOTAL_INTERVAL_MS) {
        lastSaveMs = now;
        saveTotalLiters();
    }

    if (now - lastQueueMs >= QUEUE_INTERVAL_MS) {
        lastQueueMs = now;

        finalizeReportingWindow();
        saveTotalLiters();
        enqueueReading();
    }

    maintainWiFi(now);
    uploadPendingReadings();

    if (now - lastOLEDUpdateMs >= OLED_INTERVAL_MS) {
        lastOLEDUpdateMs = now;
        updateOLED();
    }

    processSerialCommands();

    delay(2);
}