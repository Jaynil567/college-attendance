# Complete Step-by-Step Online Production Deployment Guide
## कॉलेज अटेंडेंस सिस्टम को पूरी तरह ऑनलाइन (Live Internet) ले जाने की पूरी गाइड

यह गाइड आपको पूरे सिस्टम को Localhost से हटाकर 100% Live Cloud पर ले जाने के सभी Steps आसान भाषा में समझाती है।

---

## 1. Database Status (✅ ALREADY LIVE & CLEANED)

आपकी **Neon PostgreSQL Database** पहले से ही Cloud पर Live और Connected है:
- **Cloud Host**: AWS Asia-Pacific (Singapore) via Neon Serverless
- **Status**: सारा डमी डेटा (Fake Students, Classes, Records) पूरी तरह Clear कर दिया गया है।
- **Active Accounts**:
  - **Admin**: `admin@college.edu` / `Admin@123`
  - **Teacher**: `teacher@college.edu` / `Teacher@123`
- Database बिल्कुल साफ है और असली कॉलेज के डेटा के लिए तैयार है।

---

## 2. Step-by-Step Online Architecture

```
[Student Phone (Android App APK)]
       |
       | 1. BLE Handshake (No Internet needed for ESP32)
       v
[ESP32 Hardware (Room Wall Plug 5V)]
       |
       | 2. Phone sends Signed Proof via 4G/5G/Wi-Fi
       v
[Backend API on Cloud (Render / Railway) - HTTPS]
       |
       +---> [Neon PostgreSQL Database (Live)]
       |
       +---> [Teacher/Admin Dashboard (Vercel) - HTTPS]
```

---

## 3. STEP 1: Code को GitHub पर Push करना

Backend और Dashboard को Cloud पर 1-Click में Deploy करने के लिए पहले अपने Project को GitHub पर डालें:

1. [github.com](https://github.com) पर जाएं और एक नया **Private** या **Public Repository** बनाएं (जैसे `college-attendance-system`).
2. अपने कंप्यूटर पर टर्मिनल में `E:\Attendence` में यह कमांड चलाएं:
   ```bash
   git init
   git add .
   git commit -m "Production attendance system ready for deployment"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

---

## 4. STEP 2: Backend API को Live करना (Render.com - 100% Free)

Render एक फ्री क्लाउड प्लेटफॉर्म है जो आपके Node.js Express API को 24/7 Live HTTPS URL देता है।

1. [render.com](https://render.com) पर जाकर **Sign Up** करें (GitHub से लॉगिन करें).
2. **New +** बटन दबाएं और **Web Service** चुनें.
3. अपनी GitHub Repository को Connect करें.
4. निम्नलिखित सेटिंग्स भरें:
   - **Name**: `attendance-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. नीचे **Environment Variables** सेक्शन में ये 3 Variables जोड़ें:
   - `DATABASE_URL`:
     ```
     postgresql://neondb_owner:npg_UBD6HgbY2XMe@ep-bitter-glitter-azqe7m88-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
     ```
   - `JWT_SECRET`:
     ```
     super_secret_classroom_jwt_attendance_key_2026
     ```
   - `NODE_ENV`: `production`
6. **Create Web Service** पर क्लिक करें।
7. 2 मिनट में आपका Backend Live हो जाएगा और आपको एक URL मिलेगा:
   👉 **`https://attendance-backend-XXXX.onrender.com`**

---

## 5. STEP 3: Teacher/Admin Web Dashboard को Live करना (Vercel.com - 100% Free)

Vercel आपके React Dashboard को सुपर-फास्ट CDN पर Live करता है।

1. [vercel.com](https://vercel.com) पर जाएं और GitHub से Sign in करें.
2. **Add New...** -> **Project** पर क्लिक करें.
3. अपनी GitHub Repository को Import करें.
4. **Root Directory**: `dashboard` सेलेक्ट करें.
5. **Framework Preset**: `Vite` (ऑटोमैटिक डिटेक्ट हो जाएगा).
6. **Deploy** पर क्लिक करें.
7. 1 मिनट में आपका Teacher Dashboard Live हो जाएगा:
   👉 **`https://attendance-dashboard-XXXX.vercel.app`**

*अब टीचर्स या प्रिंसिपल्स दुनिया के किसी भी कंप्यूटर, लैपटॉप या फोन से इस URL को खोलकर लॉगिन कर सकते हैं!*

---

## 6. STEP 4: Mobile App का Android APK बनाना (ताकि 200 स्टूडेंट्स इंस्टॉल कर सकें)

अब आपको लैपटॉप पर Expo चालू रखने की जरूरत नहीं होगी। हम एक असली `.apk` फाइल बनाएंगे जिसे छात्र WhatsApp या कॉलेज वेबसाइट से डाउनलोड करके सीधे इंस्टॉल कर सकते हैं:

1. `E:\Attendence\mobile-app\src\services\api.ts` फाइल में `DEFAULT_API_URL` को अपने Render Backend URL से बदलें:
   ```ts
   export const DEFAULT_API_URL = 'https://attendance-backend-XXXX.onrender.com/api';
   ```
2. अपने टर्मिनल में `mobile-app` फोल्डर में जाएं:
   ```bash
   cd E:\Attendence\mobile-app
   ```
3. Expo Application Services (EAS) से 1-कमांड में APK बनाएं:
   ```bash
   npx eas-cli login
   npx eas-cli build -p android --profile preview
   ```
4. EAS क्लाउड में APK बिल्ड करेगा और टर्मिनल में आपको एक **Download Link** देगा (जैसे `https://expo.dev/artifacts/eas/...apk`).
5. इस APK लिंक को छात्रों को भेज दें। छात्र इसे सीधे अपने फोन पर इंस्टॉल कर लेंगे!

---

## 7. STEP 5: Classroom में ESP32 Hardware लगाना

1. **Power Supply**: ESP32 को क्लासरूम में किसी भी 5V 1A या 2A मोबाइल चार्जर से बिजली दें।
2. **No Wi-Fi Needed**: ESP32 को क्लासरूम में इंटरनेट या Wi-Fi से कनेक्ट करने की कोई जरूरत नहीं है! यह सिर्फ BLE सिग्नल ब्रॉडकास्ट करता है।
3. **Flashing**: Arduino IDE में `classroom_esp32.ino` खोलें और Upload करें।
4. **Placement**: ESP32 को क्लासरूम की दीवार पर 2 से 2.5 मीटर की ऊंचाई पर लगाएं।
   - `-85 dBm` थ्रेशोल्ड यह सुनिश्चित करता है कि क्लासरूम के अंदर बैठे छात्र ही अटेंडेंस लगा सकें, बाहर कॉरिडोर में खड़े छात्र नहीं।

---

## 8. Real Classroom Workflows (दैनिक उपयोग कैसे होगा)

### सुबह लेक्चर शुरू होने पर (Teacher):
1. टीचर अपने फोन या लैपटॉप पर Vercel लिंक खोलता है: `https://attendance-dashboard-XXXX.vercel.app`
2. लॉगिन करता है: `teacher@college.edu` / `Teacher@123`
3. **Live Session** टैब में जाकर अपनी क्लास चुनता है (उदा: Sem 5 Div A) और **Start Session** दबाता है।

### क्लासरूम में छात्रों द्वारा (Students):
1. क्लासरूम में बैठे छात्र अपने फोन में **College Attendance** ऐप खोलते हैं।
2. लॉगिन करते हैं (टीचर द्वारा दिया गया Enrollment Number और Password).
3. **Mark Attendance** बटन दबाते हैं।
4. फोन क्लासरूम के ESP32 को ब्लूटूथ (BLE) से डिटेक्ट करता है, 32-बाइट क्रिप्टोग्राफिक चैलेंज एक्सचेंज करता है।
5. फोन अपने 4G/5G इंटरनेट से सीधे Render Cloud Backend और Neon Database में वेरीफिकेशन भेजता है।
6. छात्र के फोन पर तुरंत **"Attendance Recorded! (PRESENT)"** का ग्रीन टिक आ जाता है।
7. टीचर के डैशबोर्ड पर लाइव उस छात्र का नाम और रोल नंबर तुरंत जुड़ जाता है!
