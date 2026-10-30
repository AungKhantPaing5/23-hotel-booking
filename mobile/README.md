# 23 Hotel & Residence — Expo App

This folder contains the Android/iOS customer app. It calls the local Next.js API; PostgreSQL runs in Docker and must not be exposed directly to a phone.

## Setup on Windows

1. Start the Docker PostgreSQL database from the root folder: `npm run db:up`.
2. Start the web/API server from the root folder: `npm run dev`.
3. In this `mobile` folder run:

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npx expo install --fix
npx expo start
```

Set `EXPO_PUBLIC_API_URL` in `.env`:

- Android Emulator: `http://10.0.2.2:3000`
- Physical Android/iPhone on same Wi-Fi: `http://YOUR_WINDOWS_PC_LAN_IP:3000`
- Expo web on the same PC: `http://localhost:3000`

Find your PC IP using `ipconfig`. Use its Wi-Fi IPv4 address, not `localhost`, when running on a physical phone. Windows Firewall must permit port 3000 on the private network for local device tests.

## Local phone login

In development, request a phone OTP and enter `123456`. This is only a development shortcut, not production authentication. The production server must set `AUTH_OTP_MODE=production` and configure a real SMS provider.

## Features

- Rooms list and details from the hotel's local API
- Booking requests and payment-history view
- Kitchen/Deals/other hotel services and order requests
- Customer profile and support requests
- Google Maps road directions

PostgreSQL credentials and server secrets stay in the root `.env.local` and are never added to the mobile app. Only the public hotel labels/location and API URL belong in `mobile/.env`.
