# College Classroom Attendance System

A complete, production-ready, hardware-verified classroom attendance system engineered for high-concurrency college environments (~200+ students per lecture).

Physical classroom presence is authenticated via **Bluetooth Low Energy (BLE)** and **Hardware-Accelerated Cryptographic Challenge-Response (HMAC-SHA256)** using ESP32 microcontrollers, preventing proxy attendance, MAC spoofing, and replay attacks.

---

## 🏛️ System Architecture

```
+-----------------------------------------------------------------------------------------------+
|                                      CLASSROOM PRESENCE                                       |
|                                                                                               |
|   +---------------------------------+             +---------------------------------------+   |
|   |         ESP32 Hardware          |   BLE GATT  |        Mobile App (iOS/Android)       |   |
|   |   - Unique 256-bit NVS Key      |<----------->|   - 32-byte Random Challenge Nonce    |   |
|   |   - Hardware mbedTLS HMAC       |             |   - Jittered Backoff for 200 Students |   |
|   |   - Fast Auto-Disconnect (<100ms|             |   - Proximity RSSI >= -85 dBm         |   |
|   +---------------------------------+             +---------------------------------------+   |
+-------------------------------------------------------------------|---------------------------+
                                                                    | HTTPS REST
                                                                    v
+-----------------------------------------------------------------------------------------------+
|                                     CLOUD INFRASTRUCTURE                                      |
|                                                                                               |
|   +---------------------------------+             +---------------------------------------+   |
|   |     Teacher / Admin Portal      |             |         Backend REST API              |   |
|   |   - Live Session Monitor        |   HTTP/API  |   - Express + TypeScript              |   |
|   |   - Student Registry & Search   |<----------->|   - Cryptographic Timing-Safe Verify  |   |
|   |   - Provision ESP32 Hardware    |             |   - ExcelJS Report Generator          |   |
|   |   - Export Excel (.XLSX)        |             |   - Rate Limiting & JWT Auth          |   |
|   +---------------------------------+             +-------------------+-------------------+   |
|                                                                       |                       |
|                                                                       v Connection Pooling    |
|                                                   +---------------------------------------+   |
|                                                   |        Neon PostgreSQL Database       |   |
|                                                   |   - Relational schema + Indexes       |   |
|                                                   |   - Single-use challenge_nonces       |   |
|                                                   |   - Audit logs & session records      |   |
|                                                   +---------------------------------------+   |
+-----------------------------------------------------------------------------------------------+
```

---

## 📦 Project Structure

```
e:\Attendence\
├── backend/                  # Node.js + Express + TypeScript Backend API
│   ├── src/
│   │   ├── config/           # Database pool, env, Neon connection & fallback
│   │   ├── controllers/      # Auth, Classes, Students, Devices, Sessions, Attendance
│   │   ├── middleware/       # JWT Auth, Role Guards, Rate Limiter
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # Crypto verification, Replay defense, Excel generator
│   │   ├── db/               # PostgreSQL schema migrations (schema.sql) & seeders
│   │   └── server.ts         # App entrypoint
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── dashboard/                # Teacher & Admin Web Dashboard
│   ├── src/
│   │   ├── components/       # Navbar, Sidebar, StatCards, Modals
│   │   ├── pages/            # Login, Overview, Live Session, Classes, Students, Devices, Reports
│   │   ├── services/         # Axios API client
│   │   ├── context/          # Auth context & session management
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── mobile-app/               # Cross-Platform Student App (Android & iOS)
│   ├── src/
│   │   ├── screens/          # Login, Mark Attendance (BLE Radar), History, Profile
│   │   ├── services/         # BLE Scanner, Cryptographic Handshake & Hardware Simulator
│   │   └── context/          # Student AuthContext
│   ├── app.json              # Expo config with iOS & Android BLE permissions
│   ├── package.json
│   └── App.tsx
├── esp32-firmware/           # Arduino IDE C++ Firmware
│   ├── classroom_esp32/
│   │   ├── classroom_esp32.ino   # Main sketch: BLE GATT server, mbedTLS HMAC
│   │   ├── crypto_engine.h       # Hardware-accelerated HMAC-SHA256 calculations
│   │   └── config.h              # UUIDs, secret keys, LED status pins
│   └── README.md                 # Flashing guide, board setup, partition table
└── docs/                     # Architectural, deployment, and security specifications
    ├── ARCHITECTURE.md       # Protocol specification & 200-student concurrency math
    ├── DEPLOYMENT.md         # Production deployment (Neon DB, VM, Docker, Nginx, EAS)
    └── SECURITY_AUDIT.md     # Threat model analysis and mitigations
```

---

## ⚡ Quick Start Guide

### 1. Start Backend API
```bash
cd backend
npm install
npm run db:init      # Seeds default classes, students, admin, and ESP32 device
npm run test:crypto  # Runs cryptographic test suite (HMAC, replay, drift, RSSI)
npm run dev          # Starts backend on http://localhost:5000
```

### 2. Start Teacher / Admin Web Dashboard
```bash
cd dashboard
npm install
npm run dev          # Starts Vite dev server on http://localhost:3000
```
Open **http://localhost:3000** in your browser.

### 3. Start Student Mobile App (Android & iOS)
```bash
cd mobile-app
npm install
npm start            # Starts Expo development server
```
- Press `a` for Android Emulator or `i` for iOS Simulator.
- Scan QR code with the **Expo Go** app on your physical smartphone.

### 4. Flash ESP32 Hardware (Arduino IDE)
1. Open `esp32-firmware/classroom_esp32/classroom_esp32.ino` in Arduino IDE.
2. Select **ESP32 Dev Module** under **Tools** -> **Board**.
3. Set Upload Speed to `921600` and baud rate to `115200`.
4. Click **Upload** (Ctrl + U).
5. The onboard LED will blink to indicate active BLE advertising.

---

## 🔐 Default Demo Accounts

| Role | Identifier / Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@college.edu` | `Admin@123` | Full system control, all classes & devices |
| **Teacher** | `teacher@college.edu` | `Teacher@123` | Department faculty, session management, Excel export |
| **Student** | `EN2024CS001` | `Student@123` | Alice Sharma (Sem 5, Div A - Computer Networks) |
| **ESP32 Node** | `CLASSROOM_01` | *(256-bit Key)* | Room 302 Hardware Presence Beacon |

*Note: Self-registration for students is strictly blocked by design. All students are registered and assigned to classes directly by teachers or department administrators.*

---

## 🛡️ Cryptographic & Concurrency Features

1. **Hardware Presence Authentication**:
   - The phone does NOT need to connect to ESP32 Wi-Fi.
   - The phone does NOT need to pair with the ESP32 in OS Bluetooth settings.
   - The phone writes a 32-byte cryptographic challenge nonce ($C$) over BLE GATT.
   - The ESP32 signs $C \parallel \text{Enrollment} \parallel T \parallel \text{DeviceID}$ using hardware-accelerated HMAC-SHA256 with its internal key.
2. **Replay Attack Immunity**:
   - Every challenge nonce is single-use and logged in the `challenge_nonces` table.
   - Timestamps must fall within $\pm 60$ seconds of server time.
3. **High Concurrency (200 Students per Classroom)**:
   - Handshake completes in $< 250$ms.
   - ESP32 automatically disconnects the client within 100ms of response delivery to immediately free the GATT connection slot for the next student.
   - Mobile app uses exponential backoff with randomized jitter (150ms–500ms) to eliminate connection collisions during simultaneous check-in bursts.
4. **Attendance Reporting & Excel Export**:
   - Live real-time check-in stream in the web dashboard.
   - Single-click **Download Attendance (.XLSX)** formatted with student names, enrollment IDs, dates, and percentages.
