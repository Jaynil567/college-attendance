# College Classroom Attendance - Mobile App (Android & iOS)

This directory contains the cross-platform mobile application built with React Native / Expo.

## Features
- **Student Authentication**: Login via unique college enrollment number (Self-registration strictly blocked).
- **BLE Physical Presence Verification**: Scans for the classroom ESP32 service UUID.
- **Cryptographic Challenge-Response**: Generates a 32-byte secure random nonce, exchanges HMAC with the ESP32 hardware node, and validates with the Neon PostgreSQL backend.
- **High Concurrency Support**: Client-side exponential backoff jitter handles 200+ students in the room simultaneously without BLE GATT collisions.
- **Attendance History & Statistics**: Instant visual feedback (Present / Rejected) and percentage tracking.
- **Integrated Hardware Simulator**: Allows testing full end-to-end attendance workflows anywhere, even without physical ESP32 hardware powered on.

---

## Running the App

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Expo Development Server
```bash
npx expo start
```
From the interactive terminal:
- Press `a` to open on an Android emulator or connected Android device.
- Press `i` to open on an iOS simulator (macOS).
- Press `w` to run in web preview mode.
- Scan the QR code with the **Expo Go** app on your physical iPhone or Android phone.

---

## Testing on Physical Devices over LAN

When testing with a physical phone and the backend running on your computer:
1. Ensure your phone and computer are on the same Wi-Fi network.
2. In the mobile app, navigate to the **Profile** tab.
3. Under **Backend Server URL**, enter your computer's local network IP address:
   ```
   http://192.168.1.XX:5000/api
   ```
4. Tap **Update Server URL**.

---

## Native Bluetooth Low Energy Permissions

The app comes pre-configured with all necessary Bluetooth permissions in `app.json`:

### Android (`android/app/src/main/AndroidManifest.xml`)
- `BLUETOOTH` & `BLUETOOTH_ADMIN`: Legacy BLE communication.
- `BLUETOOTH_SCAN`: Discovers nearby classroom ESP32 devices without location permissions on Android 12+.
- `BLUETOOTH_CONNECT`: Connects to the ESP32 GATT service to exchange cryptographic nonces.
- `ACCESS_FINE_LOCATION`: Required for BLE beacon discovery on Android 11 and below.

### iOS (`ios/Runner/Info.plist`)
- `NSBluetoothAlwaysUsageDescription`: "College Attendance uses Bluetooth Low Energy to cryptographically verify physical classroom presence."
- `NSBluetoothPeripheralUsageDescription`: "Required to exchange cryptographic challenges with classroom ESP32 hardware beacons."
