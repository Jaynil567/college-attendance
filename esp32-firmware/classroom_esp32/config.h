#ifndef CONFIG_H
#define CONFIG_H

// ====================================================================
// ESP32 Classroom Attendance Device - Configuration
// ====================================================================

// Device & Classroom Identity
#define ESP32_DEVICE_ID     "CLASSROOM_01"
#define CLASSROOM_ID        "ROOM_302"
#define DEVICE_FRIENDLY_NAME "ESP32 Classroom 01"
#define FIRMWARE_VERSION    "1.0.0"

// Status LED Pin (GPIO 2 is built-in blue LED on most ESP32 boards)
#define STATUS_LED_PIN      2

// BLE Service & Characteristic UUIDs (Standard 128-bit UUIDs)
// Matched with Backend Database Registration
#define SERVICE_UUID            "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_CHALLENGE_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_RESPONSE_UUID      "beb5483f-36e1-4688-b7f5-ea07361b26a9"
#define CHAR_INFO_UUID          "beb54840-36e1-4688-b7f5-ea07361b26aa"

// 256-Bit Cryptographic Device Secret Key (64 Hexadecimal Characters)
// Stored in Flash / NVS to guarantee physical hardware authenticity.
// NEVER reveal or publish this key.
#define DEFAULT_SECRET_KEY_HEX  "E9B489601E852DDE34B76AE93D8967484B6F3E103E9946C3AE852DDE34B76AE9"

// NVS Namespace for storing persistent device credentials
#define NVS_NAMESPACE           "attendance"
#define NVS_KEY_SECRET          "sec_key"

// Performance tuning for 200+ students concurrency
// Fast GATT disconnect delay in milliseconds after response delivery
#define AUTO_DISCONNECT_DELAY_MS 100

#endif // CONFIG_H
