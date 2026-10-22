# Asia University Lecture Auto-Grabber & Literacy Graduation Threshold Tracker

[English Documentation](README.en.md) | [繁體中文文件](README.md)

A lightweight, zero-dependency local auto-registration tool and general education graduation threshold dashboard for Asia University's "Online Lecture & General Education Course Registration System" (`https://webap.asia.edu.tw/cfd2020/`).

> Designed for Asia University students: tracks 4 core general education competencies, monitors registration opening and cancellation drops, and executes instantaneous automated registration.
> **Please comply with school policies. For personal legal academic and course selection assistance only.**

---

## Core Features & Highlights

### 1. 4 Core Literacy Graduation Threshold Tracking
According to Asia University general education graduation regulations, undergraduate students must attend school-recognized general education lectures, accumulating at least 8 sessions and fulfilling 4 core competencies:
- **Health**: At least 2 sessions
- **Care**: At least 2 sessions
- **Innovation**: At least 2 sessions
- **Excellence**: At least 2 sessions

Real-time threshold calculation dashboard:
- **Automatic Aggregation**: Fetches registered and completed sessions directly from student portal records and categorizes them automatically.
- **Historical Credit Logging**: Supports manual entry of credits earned in prior semesters, seamlessly merged with current registrations.
- **Competency Badges**: Each lecture clearly displays its corresponding core literacy badges and color coding.
- **Deficit Filtering**: One-click "Only Show My Missing Literacies" to target sessions required for graduation.

### 2. Real-Time Grabbing Engine
- **Live Status Monitoring**: Monitors statuses including Open, Waitlist (Full), Upcoming, Closed, On-site Registration, and Other Channels.
- **Waitlist Spot Sniping**: Continually monitors full (F) sessions; instantly registers the millisecond another student drops.
- **Burst Mode Polling**: Automatically shifts to high-frequency polling (default 0.8s) when registration opens or when spots are released.
- **Polite Interval & Backoff**: Maintains a 2.5s polite polling interval normally, with exponential backoff on network anomalies to avoid server stress.
- **Automated Authentication**: Exchanges the last 4 digits of student ID for school registration tokens seamlessly.

### 3. Multi-Platform Support & Bilingual i18n: Flutter Native App, PWA, and Web
- **Bilingual Interface (i18n)**: Both web dashboard and Flutter mobile app support seamless switching between Traditional Chinese and English.
- **System Language Auto-Detection**: Mobile app defaults to matching device system language (English devices display English automatically) while providing a 3-way manual toggle (System / Traditional Chinese / English) with local persistence.
- **Flutter Native Mobile App (`mobile/`)**: Built with Google Flutter pure Cupertino framework, featuring iOS physical spring bounce physics, liquid frosted glass navigation bar, online GitHub update checks, and in-app APK download & installation.
- **Progressive Web App (PWA)**: Standard PWA support allows installation directly via mobile browser ("Add to Home Screen"), providing standalone windowing and Service Worker offline caching.
- **Desktop Web Version**: Quick-launch scripts (`start.bat` / `start.sh`) open the dashboard in dedicated Chrome App window or default browser.

### 4. Smart Scheduling & AI Selection Agent
- **Three Scheduling Modes**:
  - At Opening (starts N seconds before registration begins)
  - Specific Date & Time (one-time trigger)
  - Weekly Window (recurring automated start and stop)
- **AI / Local Rule Selection**: Enter requirements in natural language (e.g. "I need 2 innovation and 1 health lecture"), parsed by OpenAI-compatible models or offline rule engine into candidate queues.

---

## Quick Start

### Requirements
- Node.js 20 or higher (ESM native, zero third-party npm dependencies).
- Git (for cloning repository).

### Installation

Open terminal (CMD / PowerShell / Bash):
```bash
git clone https://github.com/pinchiu/asia-lecture-grabber.git
cd asia-lecture-grabber
```

### Launch Commands

#### Windows
Double-click `start.bat`, or run in PowerShell / Command Prompt:
```bat
npm start
```

#### macOS / Linux
Run in terminal:
```bash
chmod +x start.sh
./start.sh
```
Or directly:
```bash
npm start
```

The service runs at `http://127.0.0.1:5199` by default and will open in your default browser.

---

## User Guide

1. **Login & Identity Verification**:
   - In the sidebar or settings, enter Student ID, password, and the last 4 digits of your National ID, then click "Login & Verify Identity".
   - The last 4 digits of ID are required by the school API for registration authentication.
2. **Review Literacy Progress**:
   - The top dashboard displays progress across the 4 competencies and total sessions.
   - If you completed sessions in past semesters, click "Past Literacy Credits" to log them.
3. **Select Lectures & Queue Targets**:
   - Browse the lecture list, filtering by competency, status, or search query.
   - Toggle "Only Missing Literacies" to focus on needed competencies.
   - Click "+ Add Target" to add to the monitoring queue.
4. **Start the Grabbing Engine**:
   - Click "Start Engine" to begin polling.
   - When a session is grabbed, the system triggers sound and desktop notifications, updating targets and calendar immediately.
5. **Direct Manual Registration & CAPTCHA Bypass**:
   - **Manual Registration (No AI Required)**:
     - For "Open" lectures, click "Register" to submit an immediate registration directly to school servers.
     - Direct Code Input: Enter a course ID (e.g. `1151074`) in the quick-action input for instant submission.
     - For "Full" lectures, click "+ Waitlist" to keep waiting for dropped spots.
   - **4-Digit Graphical CAPTCHA Mechanism**:
     - The 4-digit CAPTCHA on the official school website is generated client-side by Vue.js on an HTML Canvas.
     - The backend registration API (`POST api/Cfd10/Save`) **does not inspect or require CAPTCHA validation fields**.
     - This tool connects directly to backend APIs with 0ms OCR latency and zero CAPTCHA errors.
     - For users operating directly on the official website, a Tampermonkey script (`scripts/asia-captcha-autofill.user.js`) is provided for auto-filling CAPTCHA.

---

## Flutter Native Mobile App

The `mobile/` directory contains the complete Flutter native mobile project, supporting compilation to Android release APK or iOS:

### 1. Environment Requirements
- Flutter SDK (>= 3.10.0)
- Android Studio (Android SDK & Build-Tools) or Xcode (iOS)

### 2. Local Run & Debug
```bash
# Ensure root Node.js server is running: npm start
npm run mobile:flutter:run
```
Or:
```bash
cd mobile
flutter run
```

### 3. Build Android Release APK
Build the release APK:
```bash
npm run mobile:flutter:build:apk
```
Or:
```bash
cd mobile
flutter build apk --release
```
Output path:
`mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## PWA Mobile Version (No Installation Required)

In addition to Flutter native app, standard PWA features allow direct browser access:
1. Ensure mobile device and computer are on the same Wi-Fi network.
2. Start server with `HOST=0.0.0.0 npm start`.
3. **iPhone / iPad (Safari)**: Open address, tap "Share" -> "Add to Home Screen".
4. **Android (Chrome / Edge)**: Tap "Install App" in menu or address bar banner.

---

## Technical Architecture & School API Reverse Engineering

The school portal is a Vue SPA (`http-vue-loader`) with API base `https://webap.asia.edu.tw/cfd2020/`:

| Function | HTTP Method & Path | Description |
| --- | --- | --- |
| Authentication | `POST api/Login/Auth` | Sends `{username, password}`, returns Bearer Token |
| Lecture List | `POST api/Cfd01/Load?op=X01F00` | Public list; with Token returns user `cnt_10` (registered flag) |
| Lecture Detail | `GET api/Cfd01/GetRes?eid01=` | Detailed metadata including competencies, organizer, UCAN, SDGs |
| Identity Verification | `POST api/PersonInfo/GetPInfo` | Sends `{p_no, p_id, p_type}` (`p_id` is last 4 ID digits) |
| Save Registration | `POST api/Cfd10/Save` | Core registration endpoint; requires Token and `std_info` (`bfree` accessibility requirement defaults to `N`) |
| Drop Registration | `POST api/cfd10/DeleteData?reseid=` | Drops registered session using encrypted school ID |
| Registered History | `POST api/Cfd01/Load_del?op=X01F00DEL` | Queries active and dropped registration records |

### Core Literacy Flags
The database tracks competencies using flags `chk1` through `chk8`:
- `chk4 = 'Y'`: **Health**
- `chk5 = 'Y'`: **Care**
- `chk6 = 'Y'`: **Innovation**
- `chk7 = 'Y'`: **Excellence**

### Registration Status Codes
- `canapp = 'Y'`: Open
- `canapp = 'F'`: Full (Waitlist mode polls for dropped spots)
- `canapp = 'N1'`: Upcoming
- `canapp = 'N2'`: Closed
- `canapp = 'C'`: On-site registration
- `canapp = 'D'`: Other channels

---

## Directory Structure

```
asia-lecture-grabber/
├ package.json                   Project configuration and scripts
├ start.bat                      Windows launch shortcut
├ start.sh                       macOS / Linux launch script
├ AGENTS.md                      Architecture constraints and developer guidelines
├ README.md                      Traditional Chinese documentation
├ README.en.md                   English documentation
├ src/
│  ├ asia.mjs                    School API client with automated AIA intermediate CA repair
│  ├ engine.mjs                  Grabbing engine state machine and backoff
│  ├ schedule.mjs                Automated scheduler (3 modes)
│  ├ calendar.mjs                Calendar event parser and literacy extractor
│  ├ ai.mjs                      AI agent and offline rule parser
│  ├ storage.mjs                 Configuration and state local persistence
│  └ server.mjs                  HTTP server and JSON API
├ public/
│  ├ index.html                  Web interface (dashboard, hall, calendar, settings)
│  ├ style.css                   Bauhaus monochrome and Apple liquid frosted glass styling
│  ├ app.js                      Frontend state and controller (zero external build dependencies)
│  ├ manifest.webmanifest        PWA web manifest
│  ├ sw.js                       Service Worker offline cache
│  ├ icon.svg                    Vector app icon
│  ├ icon-192.png                PWA 192x192 icon
│  └ icon-512.png                PWA 512x512 icon
├ mobile/
│  ├ pubspec.yaml                Flutter project configuration
│  ├ README.md                   Flutter build guidelines
│  ├ assets/                     Mobile icon assets
│  ├ lib/                        Flutter Dart source (Cupertino native UI, engine, i18n)
│  ├ android/                    Android native build project
│  └ ios/                        iOS native build project
└ scripts/
   ├ asia-captcha-autofill.user.js Official web portal CAPTCHA auto-filler script
   ├ desktop-launcher.mjs        Desktop window launcher
   └ generate-icons.mjs          Native PNG icon generator
```

---

## Security & Privacy Notice

- All network operations communicate directly between your machine and school servers; no third-party intermediary proxy is involved.
- Student ID, password, and the last 4 digits of National ID are stored locally in `data/config.json` (or memory-only if "remember password" is unchecked).
- The `data/` directory is strictly excluded in `.gitignore` and is never pushed to GitHub.
- Keep your personal device and configuration secure. Do not share your `config.json` file.

---

## Developer & Version Information

- Repository: [https://github.com/pinchiu/asia-lecture-grabber.git](https://github.com/pinchiu/asia-lecture-grabber.git)
- Version: 1.4.1
- License: For personal course and academic assistance use
