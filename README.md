# OnTime - Prayer Times App

A mobile prayer times app built with React and Capacitor for Android and iOS.

## Features

- **Accurate Prayer Times** — Supports 12+ calculation methods (ISNA, Muslim World League, Umm Al-Qura, Egyptian, etc.) with Standard and Hanafi Asr options
- **Countdown Timer** — Live countdown to the next prayer with sunnah time info
- **Notifications** — Configurable reminders before each prayer and at-time alerts with athan sound support
- **Qibla Compass** — Built-in Qibla direction finder
- **Travel Mode** — Auto-detects travel (>88.7km from home) and shows shortened prayer (Qasr) badges
- **Jumu'ah Reminders** — Dedicated Friday prayer notifications with masjid name support
- **Themes** — Light, Dark, Desert, Rose, System, and Auto (switches at Fajr/Maghrib)
- **Location** — GPS auto-detection or manual city search via Nominatim

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4
- **Mobile:** Capacitor 8 (Android & iOS)
- **Prayer Calculation:** [adhan](https://github.com/batoulapps/adhan-js) npm package
- **Icons:** FontAwesome

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm)
- Android Studio (for Android builds)
- Xcode (for iOS builds)

### Development

```bash
pnpm install
pnpm run dev
```

### Build

```bash
# Web build
pnpm run build

# Android
pnpm run build:android
cd android && ./gradlew assembleDebug

# iOS
pnpm run build:ios
```

## License

All rights reserved.
