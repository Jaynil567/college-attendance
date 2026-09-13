# System Architecture & Cryptographic Protocol Specification

This document details the hardware, network, and cryptographic architecture of the College Classroom Attendance System.

---

## 1. The Core Physical Presence Problem

Standard mobile attendance systems rely on GPS geofencing or Wi-Fi SSID detection:
- **GPS Flaws**: Highly inaccurate indoors; trivial to spoof via Android Developer Options ("Mock Location").
- **Wi-Fi SSID Flaws**: Anyone who knows the router SSID or captures a beacon packet can host a hotspot outside the building and cheat attendance.
- **Static BLE Flaws**: If an ESP32 only advertises a static Bluetooth device name (e.g. `CLASSROOM_01`), a student can clone that advertisement on a secondary phone and spoof attendance from anywhere.

### The Solution: Hardware-Accelerated Cryptographic Challenge-Response

The classroom ESP32 is treated as a **Hardware Security Module (HSM)** that holds a unique 256-bit secret key ($K_{esp32}$) stored inside Non-Volatile Flash (`Preferences`/NVS). The mobile app and backend verify physical presence through dynamic cryptographic challenge-response:

```
+---------------------------------------------------------------------------------------------------+
|                                       CLASSROOM ATTENDANCE FLOW                                    |
+---------------------------------------------------------------------------------------------------+

     [Student Phone]                        [ESP32 Hardware]                         [Neon PostgreSQL]
            |                                       |                                        |
            | 1. Scan BLE Advertising               |                                        |
            |-------------------------------------->|                                        |
            |    (Service UUID match + RSSI check)  |                                        |
            |                                       |                                        |
            | 2. Connect & Write Challenge          |                                        |
            |-------------------------------------->|                                        |
            |    Payload M:                         |                                        |
            |    - 32-byte cryptographically secure |                                        |
            |      random nonce (C)                 |                                        |
            |    - Student enrollment (S)           |                                        |
            |    - High-res timestamp (T)           |                                        |
            |    - Target device ID                 |                                        |
            |                                       |                                        |
            |                                       | 3. Compute HMAC-SHA256:                |
            |                                       |    R = HMAC(K_esp32, M)                |
            |                                       |    (Hardware mbedTLS: < 1ms)           |
            |                                       |                                        |
            | 4. Notify Response (R)                |                                        |
            |<--------------------------------------|                                        |
            |                                       |                                        |
            | 5. Immediate Disconnect               |                                        |
            |- - - - - - - - - - - - - - - - - - - >| (Slot instantly freed for next student)|
            |                                                                                |
            | 6. POST /api/attendance/mark                                                   |
            |    { C, S, T, R, rssi, session_id }                                            |
            |------------------------------------------------------------------------------->|
            |                                                                                | 7. Validate:
            |                                                                                |    - Active session
            |                                                                                |    - Student in class
            |                                                                                |    - Time drift <= 60s
            |                                                                                |    - Nonce C not reused
            |                                                                                |    - Recompute HMAC
            |                                                                                |    - RSSI >= -85 dBm
            |                                                                                |
            | 8. Attendance Inserted (PRESENT)                                               |
            |<-------------------------------------------------------------------------------|
```

---

## 2. Cryptographic Construction

### Canonical Payload
The payload $M$ is structured deterministically:
$$\text{Payload } M = C \parallel \text{“:”} \parallel S \parallel \text{“:”} \parallel T \parallel \text{“:”} \parallel \text{DeviceID}$$
Where:
- $C$: 32-byte cryptographic random nonce (64 hex characters) generated by client.
- $S$: Normalized uppercase student enrollment number (e.g. `EN2024CS001`).
- $T$: Client epoch timestamp in milliseconds.
- $\text{DeviceID}$: Assigned hardware ID (e.g. `CLASSROOM_01`).

### HMAC Signature
$$\text{Signature } R = \text{HMAC-SHA256}(K_{esp32}, M)$$
On the ESP32, this is computed using hardware acceleration via ESP-IDF `mbedtls_md_hmac`.
On the Backend, Node.js `crypto.createHmac('sha256', secretKey)` calculates the expected signature and compares using `crypto.timingSafeEqual` to eliminate timing attacks.

---

## 3. High Concurrency Architecture (200 Students)

ESP32 hardware typically supports 4 to 9 concurrent GATT connections. If 200 students in a classroom attempt to connect simultaneously, traditional BLE architectures crash or hang.

Our system implements a **Three-Tier Concurrency Architecture**:

1. **Sub-250ms Connection Lifecycle**:
   - Connection established.
   - Challenge written via `PROPERTY_WRITE_NR` (Write without response) to save round-trips.
   - Response notified immediately.
   - ESP32 drops connection after 100ms and immediately triggers `startAdvertising()`.
2. **Client-Side Exponential Backoff with Random Jitter**:
   - If a student's phone encounters a connection timeout or busy slot, it backs off by a randomized interval:
     $$\text{Delay} = \text{Base} \times 2^{\text{attempt}} + \text{UniformRandom}(150\text{ms}, 500\text{ms})$$
   - This disperses connection attempts across time.
3. **Throughput Math**:
   - 4 concurrent hardware slots $\times$ (1000ms / 250ms per transaction) = **16 students/second**.
   - 200 students are fully serviced in **12.5 to 20 seconds**.

---

## 4. Replay Attack & Relay Attack Defenses

| Attack Vector | Defense Mechanism |
| :--- | :--- |
| **Nonce Replay** (Student captures an old valid response and replays it later) | Nonces ($C$) are single-use. The backend logs every used nonce in the `challenge_nonces` table with an expiration time. Duplicate nonces are immediately rejected. |
| **Delayed Submission** (Student saves handshake and submits from home hours later) | Server verifies timestamp drift: $|T_{\text{server}} - T_{\text{client}}| \le 60\text{ seconds}$. |
| **Credential Sharing** (Student A tries to give response to Student B) | Student enrollment number is bound inside the HMAC payload $M$. Student A's signature is invalid for Student B. |
| **Classroom Hopping** (Relaying signature from Lab 302 to Lab 304) | Device ID and session class ID are bound in the payload and session table. |
| **Hallway Check-in** (Attempting to check in from outside the classroom) | RSSI threshold enforcement (minimum -85 dBm) ensures physical proximity within the classroom walls. |
