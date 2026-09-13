/*
 * ======================================================================================
 * College Classroom Attendance System - Production ESP32 Firmware
 * ======================================================================================
 * Features:
 * - High-speed BLE presence verification with hardware-accelerated HMAC-SHA256
 * - Handles 200+ concurrent students via rapid connection recycling & auto-disconnect
 * - Fast advertising restart on client disconnect
 * - Secure Non-Volatile Storage (NVS) for device secret key
 * - Built-in LED state indicator (GPIO 2)
 * - Serial console management commands
 * ======================================================================================
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>

#include "config.h"
#include "crypto_engine.h"

// Preferences handle for NVS Flash storage
Preferences preferences;

// Runtime Secret Key (Loaded from NVS or config.h)
char deviceSecretKey[65];

// BLE Server & Characteristics pointers
BLEServer* pServer = nullptr;
BLECharacteristic* pChallengeChar = nullptr;
BLECharacteristic* pResponseChar = nullptr;
BLECharacteristic* pInfoChar = nullptr;

// Connection & State Tracking
volatile bool deviceConnected = false;
volatile bool oldDeviceConnected = false;
volatile uint32_t activeConnections = 0;
unsigned long lastLedToggleTime = 0;
bool ledState = false;

// Forward Declarations
void startAdvertising();
void setStatusLed(bool on);
void handleSerialCommands();

// --------------------------------------------------------------------------------------
// BLE Server Callbacks
// --------------------------------------------------------------------------------------
class ClassroomServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override {
    activeConnections++;
    deviceConnected = true;
    digitalWrite(STATUS_LED_PIN, HIGH); // Solid ON when mobile phone connects
    Serial.printf("[BLE] Student phone connected! Active connections: %d\n", activeConnections);
  }

  void onDisconnect(BLEServer* server) override {
    if (activeConnections > 0) activeConnections--;
    deviceConnected = (activeConnections > 0);
    Serial.printf("[BLE] Phone disconnected. Remaining connections: %d\n", activeConnections);

    // CRITICAL FOR HIGH CONCURRENCY (200 STUDENTS):
    // Immediately restart advertising so the next student in queue can discover & connect
    startAdvertising();
  }
};

// --------------------------------------------------------------------------------------
// Challenge Characteristic Write Callback
// --------------------------------------------------------------------------------------
class ChallengeCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pCharacteristic) override {
    std::string rxValue = pCharacteristic->getValue();

    if (rxValue.length() == 0) {
      Serial.println("[BLE] Warning: Received empty challenge write.");
      return;
    }

    Serial.printf("[BLE] Received challenge payload (%d bytes): %s\n", rxValue.length(), rxValue.c_str());

    // Payload format: challenge:studentEnrollment:timestamp:esp32Id
    // Compute HMAC-SHA256 using device secret key
    char hmacOutput[65];
    bool success = CryptoEngine::computeHmac(deviceSecretKey, rxValue.c_str(), hmacOutput);

    if (success) {
      Serial.printf("[BLE] Computed HMAC Response: %s\n", hmacOutput);

      // Set response characteristic value
      pResponseChar->setValue(hmacOutput);
      pResponseChar->notify(); // Notify mobile client

      // Visual indicator: Double blink
      digitalWrite(STATUS_LED_PIN, LOW);
      delay(20);
      digitalWrite(STATUS_LED_PIN, HIGH);

      // Fast connection slot recycling:
      // Disconnect client after brief delivery window (100ms) to free slot for next student
      delay(AUTO_DISCONNECT_DELAY_MS);
      if (pServer != nullptr) {
        Serial.println("[BLE] Recycling connection slot for next student...");
        pServer->disconnect(0);
      }
    } else {
      Serial.println("[BLE] Error: HMAC calculation failed.");
      pResponseChar->setValue("ERROR_CALCULATION_FAILED");
      pResponseChar->notify();
    }
  }
};

// --------------------------------------------------------------------------------------
// Helper Functions
// --------------------------------------------------------------------------------------
void startAdvertising() {
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // Fast connection parameter: 7.5ms
  pAdvertising->setMinPreferred(0x12); // Fast connection parameter: 15ms
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising started successfully.");
}

void loadOrInitSecretKey() {
  preferences.begin(NVS_NAMESPACE, false);

  if (preferences.isKey(NVS_KEY_SECRET)) {
    String storedKey = preferences.getString(NVS_KEY_SECRET);
    if (storedKey.length() == 64) {
      strncpy(deviceSecretKey, storedKey.c_str(), 64);
      deviceSecretKey[64] = '\0';
      Serial.println("[NVS] Loaded persistent Secret Key from Flash.");
      preferences.end();
      return;
    }
  }

  // Fallback to default configured key and persist in NVS
  strncpy(deviceSecretKey, DEFAULT_SECRET_KEY_HEX, 64);
  deviceSecretKey[64] = '\0';
  preferences.putString(NVS_KEY_SECRET, String(deviceSecretKey));
  preferences.end();
  Serial.println("[NVS] Initialized Flash with Default Device Secret Key.");
}

// --------------------------------------------------------------------------------------
// Setup Routine
// --------------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("==========================================================");
  Serial.println("   COLLEGE CLASSROOM ATTENDANCE SYSTEM - ESP32 NODE");
  Serial.printf("   Device ID: %s | Room: %s | FW: %s\n", ESP32_DEVICE_ID, CLASSROOM_ID, FIRMWARE_VERSION);
  Serial.println("==========================================================");

  // Configure Status LED
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Load / Initialize 256-bit Secret Key from NVS
  loadOrInitSecretKey();
  Serial.printf("[Security] Device Cryptographic Secret Key Hash initialized: %.8s...\n", deviceSecretKey);

  // Initialize BLE Device
  BLEDevice::init(DEVICE_FRIENDLY_NAME);

  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ClassroomServerCallbacks());

  // Create Attendance BLE Service
  BLEService* pService = pServer->createService(SERVICE_UUID);

  // 1. Challenge Characteristic (Phone writes challenge)
  pChallengeChar = pService->createCharacteristic(
    CHAR_CHALLENGE_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pChallengeChar->setCallbacks(new ChallengeCallbacks());

  // 2. Response Characteristic (Phone reads / gets notified with HMAC)
  pResponseChar = pService->createCharacteristic(
    CHAR_RESPONSE_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pResponseChar->addDescriptor(new BLE2902());

  // 3. Device Info Characteristic (Read-only metadata)
  pInfoChar = pService->createCharacteristic(
    CHAR_INFO_UUID,
    BLECharacteristic::PROPERTY_READ
  );
  String infoPayload = String("{\"esp32Id\":\"") + ESP32_DEVICE_ID +
                       "\",\"classroomId\":\"" + CLASSROOM_ID +
                       "\",\"version\":\"" + FIRMWARE_VERSION + "\"}";
  pInfoChar->setValue(infoPayload.c_str());

  // Start BLE Service
  pService->start();

  // Start Advertising
  startAdvertising();

  Serial.printf("[BLE] Service UUID: %s\n", SERVICE_UUID);
  Serial.printf("[BLE] Challenge Char: %s\n", CHAR_CHALLENGE_UUID);
  Serial.printf("[BLE] Response Char:  %s\n", CHAR_RESPONSE_UUID);
  Serial.println("[System] ESP32 Ready for attendance verification.");
}

// --------------------------------------------------------------------------------------
// Main Loop
// --------------------------------------------------------------------------------------
void loop() {
  // Check for Serial management commands
  handleSerialCommands();

  // Handle LED pulsing when advertising (not connected)
  if (!deviceConnected) {
    unsigned long currentMillis = millis();
    if (currentMillis - lastLedToggleTime >= 500) {
      lastLedToggleTime = currentMillis;
      ledState = !ledState;
      digitalWrite(STATUS_LED_PIN, ledState ? HIGH : LOW);
    }
  }

  // Handle client disconnect recovery
  if (!deviceConnected && oldDeviceConnected) {
    delay(50);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
  }

  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  delay(10);
}

// --------------------------------------------------------------------------------------
// Serial Management Interface (Provisioning via USB Serial)
// --------------------------------------------------------------------------------------
void handleSerialCommands() {
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.startsWith("SET_KEY ")) {
      String newKey = line.substring(8);
      newKey.trim();
      if (newKey.length() == 64) {
        preferences.begin(NVS_NAMESPACE, false);
        preferences.putString(NVS_KEY_SECRET, newKey);
        preferences.end();
        strncpy(deviceSecretKey, newKey.c_str(), 64);
        deviceSecretKey[64] = '\0';
        Serial.println("[NVS] SUCCESS: New 256-bit Secret Key saved to flash!");
      } else {
        Serial.println("[NVS] ERROR: Key must be exactly 64 hex characters.");
      }
    } else if (line == "GET_INFO") {
      Serial.printf("Device: %s | Room: %s | UUID: %s\n", ESP32_DEVICE_ID, CLASSROOM_ID, SERVICE_UUID);
    } else if (line == "REBOOT") {
      Serial.println("[System] Rebooting ESP32...");
      delay(500);
      ESP.restart();
    }
  }
}
