#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==================== PIN CONFIGURATION ====================
#define FLOW_SENSOR_PIN 27
#define OLED_SDA 21
#define OLED_SCL 22

// ==================== OLED CONFIGURATION ====================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);

// ==================== WATER SENSOR CONFIGURATION ====================
const float PULSES_PER_LITER = 450.0;

const unsigned long MEASUREMENT_INTERVAL = 1000;
const unsigned long SAVE_INTERVAL = 60000;
// Backend connection
const char* SERVER_URL =
  "http://192.168.0.107:4000/api/sensor/reading";

const char* DEVICE_ID = "ESP32-001";

const unsigned long SERVER_SEND_INTERVAL = 10000;
unsigned long previousServerMillis = 0;

// ==================== VARIABLES ====================
volatile unsigned long pulseCount = 0;

unsigned long previousMillis = 0;
unsigned long previousSaveMillis = 0;

float flowRate = 0.0;
float totalLiters = 0.0;

Preferences preferences;

bool oledReady = false;

// ==================== FLOW SENSOR INTERRUPT ====================
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

// ==================== OLED DISPLAY ====================
void updateOLED() {
  if (!oledReady) {
    return;
  }

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println("WATER CONSUMPTION");

  display.drawLine(0, 11, 127, 11, SSD1306_WHITE);

  display.setCursor(0, 17);
  display.print("Flow: ");
  display.print(flowRate, 2);
  display.println(" L/min");

  display.setCursor(0, 30);
  display.print("Total: ");
  display.print(totalLiters, 3);
  display.println(" L");

  display.setCursor(0, 43);
  display.print("WiFi: ");

  if (WiFi.status() == WL_CONNECTED) {
    display.println("Connected");
  } else {
    display.println("Offline");
  }

  display.setCursor(0, 55);
  display.println("Sensor: GPIO 27");

  display.display();
}

// ==================== SAVE CONSUMPTION ====================
void saveTotalConsumption() {
  preferences.putFloat("totalLiters", totalLiters);

  Serial.println();
  Serial.println("Water consumption saved.");
  Serial.print("Saved total: ");
  Serial.print(totalLiters, 3);
  Serial.println(" L");
}
// ==================== SEND READING TO SERVER ====================
void sendReadingToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Server upload skipped: Wi-Fi disconnected.");
    return;
  }

  WiFiClient client;
  HTTPClient http;

  if (!http.begin(client, SERVER_URL)) {
    Serial.println("Could not initialize HTTP connection.");
    return;
  }

  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\"deviceId\":\"";
  payload += DEVICE_ID;
  payload += "\",\"consumption\":";
  payload += String(totalLiters, 3);
  payload += "}";

  int httpCode = http.POST(payload);

  if (httpCode > 0) {
    Serial.print("Server response code: ");
    Serial.println(httpCode);

    Serial.println(http.getString());
  } else {
    Serial.print("Server connection failed: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

// ==================== RESET CONSUMPTION ====================
void resetTotalConsumption() {
  totalLiters = 0.0;
  flowRate = 0.0;

  noInterrupts();
  pulseCount = 0;
  interrupts();

  preferences.putFloat("totalLiters", 0.0);

  Serial.println();
  Serial.println("TOTAL CONSUMPTION RESET");
  Serial.println("Total water consumption: 0.000 L");

  updateOLED();
}

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("TEST: MY NEW CODE IS RUNNING");
  Serial.println();
  Serial.println("==============================");
  Serial.println("ESP32 WATER MONITORING SYSTEM");
  Serial.println("==============================");
  

  // Initialize OLED
  Wire.begin(OLED_SDA, OLED_SCL);

  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    oledReady = true;

    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("WATER MONITOR");
    display.println();
    display.println("Starting system...");
    display.display();

    Serial.println("OLED initialized.");
  } else {
    Serial.println("OLED not detected.");
    Serial.println("Check OLED wiring and I2C address.");
  }

  // Restore saved consumption
  preferences.begin("waterMeter", false);

  totalLiters = preferences.getFloat("totalLiters", 0.0);

  Serial.print("Previous total: ");
  Serial.print(totalLiters, 3);
  Serial.println(" L");

  // Initialize YF-S201
  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);

  attachInterrupt(
    digitalPinToInterrupt(FLOW_SENSOR_PIN),
    pulseCounter,
    FALLING
  );

  // Automatically reconnect to saved Wi-Fi.
  // If no credentials are saved, WiFiManager opens setup mode.
  Serial.println();
  Serial.println("Connecting to Wi-Fi...");

  WiFi.mode(WIFI_STA);

  WiFiManager wifiManager;
  wifiManager.setConnectTimeout(30);

  bool connected = wifiManager.autoConnect(
    "WATER-SENSOR-001",
    "12345678"
  );

  if (connected) {
    Serial.println("Wi-Fi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection failed.");
    Serial.println("The water sensor can still measure locally.");
  }

  Serial.println();
  Serial.println("System ready.");
  Serial.println("Type RESET in Serial Monitor to clear total.");
  Serial.println("==============================");

  previousMillis = millis();
  previousSaveMillis = millis();

  updateOLED();
}

// ==================== MAIN LOOP ====================
void loop() {
  unsigned long currentMillis = millis();

  // Read Serial Monitor commands
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command.equalsIgnoreCase("RESET")) {
      resetTotalConsumption();
    }
  }

  // Measure water consumption every second
  if (currentMillis - previousMillis >= MEASUREMENT_INTERVAL) {
    previousMillis = currentMillis;

    unsigned long pulses;

    noInterrupts();
    pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    // Convert pulses to liters
    float litersUsed = pulses / PULSES_PER_LITER;

    // Calculate flow rate in liters per minute
    flowRate = litersUsed * 60.0;

    // Update cumulative consumption
    totalLiters += litersUsed;

    // Serial Monitor output
    Serial.println("------------------------------");

    Serial.print("Pulses: ");
    Serial.println(pulses);

    Serial.print("Flow rate: ");
    Serial.print(flowRate, 2);
    Serial.println(" L/min");

    Serial.print("Total consumption: ");
    Serial.print(totalLiters, 3);
    Serial.println(" L");

    Serial.print("Wi-Fi: ");

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Connected");
    } else {
      Serial.println("Disconnected");
    }

    // Update OLED
    updateOLED();
  }
    // Save consumption to ESP32 flash every minute
  if (currentMillis - previousSaveMillis >= SAVE_INTERVAL) {
    previousSaveMillis = currentMillis;
    saveTotalConsumption();
  }

  // Send consumption to backend every 10 seconds
  if (currentMillis - previousServerMillis >= SERVER_SEND_INTERVAL) {
    previousServerMillis = currentMillis;
    sendReadingToServer();
  }
}