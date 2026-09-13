# College Classroom Attendance System - Production Deployment Guide

This guide covers the deployment of all 5 system components into a live college production environment.

---

## 1. Neon PostgreSQL Database Deployment

1. Create a free or paid account at [Neon.tech](https://neon.tech).
2. Create a new PostgreSQL Project (e.g. `college-attendance`).
3. Under **Dashboard** -> **Connection Details**, select **Connection String** and copy the URI:
   ```
   postgres://username:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Run the database migration script:
   - Open your Neon SQL Editor console or connect via `psql`.
   - Execute the schema DDL from `backend/src/db/schema.sql`.
   - Run `npm run db:init` from the `backend/` directory to seed initial admin accounts and demo classes.

---

## 2. Backend API Production Deployment

### Option A: Direct VM / Ubuntu Server with PM2
1. Install Node.js 20+ and PM2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   ```
2. Clone repository into `/var/www/attendance-backend`:
   ```bash
   cd /var/www/attendance-backend
   npm install --omit=dev
   npm run build
   ```
3. Configure environment variables in `.env`:
   ```env
   PORT=5000
   NODE_ENV=production
   DATABASE_URL=postgres://your-neon-url?sslmode=require
   JWT_SECRET=use_a_strong_64_character_random_string
   MIN_RSSI_DBM=-85
   ```
4. Start with PM2:
   ```bash
   pm2 start dist/server.js --name "attendance-api" -i max
   pm2 save
   pm2 startup
   ```

### Option B: Docker Deployment
Create a `Dockerfile` in `backend/`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/server.js"]
```

---

## 3. Teacher & Admin Dashboard Deployment

1. Build static production assets:
   ```bash
   cd dashboard
   npm install
   npm run build
   ```
   The production build is written to `dashboard/dist/`.

2. Deploy using Nginx:
   ```nginx
   server {
       listen 80;
       server_name attendance.college.edu;

       location / {
           root /var/www/dashboard/dist;
           index index.html;
           try_files $uri $uri/ /index.html;
       }

       location /api/ {
           proxy_pass http://localhost:5000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
3. Obtain free SSL with Certbot:
   ```bash
   sudo certbot --nginx -d attendance.college.edu
   ```

---

## 4. ESP32 Hardware Deployment

### Recommended Hardware
- ESP32-WROOM-32 or ESP32-S3 DevKit.
- Standard 5V 1A USB wall power adapter.
- Wall-mounting 3D printed enclosure.

### Placement Guidelines
- Mount the ESP32 on the classroom wall or ceiling, near the center of the room, at a height of 2 to 2.5 meters.
- Avoid placing behind thick metal cabinets to ensure uniform BLE signal dispersion.
- The -85 dBm RSSI threshold ensures students outside the room door cannot mark attendance.

### Flashing Procedure
1. Register the device on the Web Dashboard under **ESP32 Hardware Nodes**.
2. Click **Copy Arduino Config** to copy the generated credentials.
3. Paste into `esp32-firmware/classroom_esp32/config.h`.
4. Connect the ESP32 via USB and upload the firmware in Arduino IDE at 115200 or 921600 baud.
5. Verify that the onboard LED blinks steadily (Advertising state).

---

## 5. Mobile App Production Deployment

### Android APK Build (Standalone)
1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. In `mobile-app/`, run:
   ```bash
   eas build -p android --profile preview
   ```
   This generates a downloadable `.apk` file that students can install directly on Android phones.

### iOS App Store / TestFlight
1. Configure your Apple Developer Team ID in `app.json`.
2. Build iOS IPA:
   ```bash
   eas build -p ios --profile production
   ```
3. Submit to TestFlight for distribution to students' iPhones.
