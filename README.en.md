# Asia University Lecture Auto-Grabber & Literacy Graduation Threshold Tracker

[English Documentation](README.en.md) | [繁體中文文件](README.md)

A lightweight, zero-dependency local auto-registration tool, general education graduation threshold dashboard, and AI Agent integration module built on the latest Model Context Protocol (MCP 2026-07-28 stateless specification) for Asia University's "Online Lecture & General Education Course Registration System" (`https://webap.asia.edu.tw/cfd2020/`).

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
- **Historical Credit Logging**: Supports manual entry of credits earned in prior semesters, seamlessly merged with current registrations (protected from background polling overwrite during editing).
- **Multi-Literacy Lecture Computation**: Sessions with multiple literacy tags count 1 toward each tagged category, but strictly 1 toward total session count.
- **Optimal Graduation Route Recommendation**: Algorithmic planner calculates the minimum session path to satisfy all missing requirements while avoiding time conflicts.
- **Deficit Filtering**: One-click "Only Show My Missing Literacies" to target sessions required for graduation.

### 2. Real-Time Grabbing Engine
- **Live Status Monitoring**: Monitors statuses including Open, Waitlist (Full), Upcoming, Closed, On-site Registration, and Other Channels.
- **Waitlist Spot Sniping**: Continually monitors full (F) sessions; instantly registers the millisecond another student drops.
- **Burst Mode Polling**: Automatically shifts to high-frequency polling (default 0.8s) when registration opens or when spots are released.
- **Polite Interval & Backoff**: Maintains a 2.5s polite polling interval normally, with exponential backoff on network anomalies to avoid server stress.
- **Automated Authentication**: Exchanges the last 4 digits of student ID for school registration tokens seamlessly.
- **AIA Intermediate Certificate Auto-Repair**: Asia University IIS server lacks intermediate CA certificates; the engine automatically discovers and repairs intermediate chains locally without disabling TLS verification.

### 3. Multi-Platform Support & Bilingual i18n: Flutter Native App, PWA, and Web
- **Bilingual Interface (i18n)**: Both web dashboard and Flutter mobile app support seamless switching between Traditional Chinese and English.
- **System Language Auto-Detection**: Mobile app defaults to matching device system language (English devices display English automatically) while providing a 3-way manual toggle (System / Traditional Chinese / English) with local persistence.
- **Flutter Native Mobile App (`mobile/`)**: Built with Google Flutter pure Cupertino framework, featuring iOS physical spring bounce physics, liquid frosted glass navigation bar, online GitHub update checks, and in-app APK download & installation.
- **Progressive Web App (PWA)**: Standard PWA support allows installation directly via mobile browser ("Add to Home Screen"), providing standalone windowing and Network-First Service Worker offline caching.
- **Desktop Web Version**: Quick-launch scripts (`start.bat` / `start.sh`) open the dashboard in dedicated Chrome App window or default browser.
- **Schedule Conflict Prevention**: Strict integer-timestamp conflict checking ensures lectures do not overlap.

### 4. AI Agent Module (MCP 2026-07-28 Specification & Agent Skills)
- **Model Context Protocol (MCP)**: Native compliance with the 2026-07-28 stateless core protocol specification.
- **Dual Transport**: Supports stdio CLI pipes (Claude Desktop, Cursor, Antigravity) and stateless HTTP (`POST /api/mcp` and `GET /api/mcp`).
- **Tasks Lifecycle Primitives**: Native `tasks/list`, `tasks/get`, and `tasks/cancel` primitives for asynchronous background grabbing engine monitoring.
- **Dedicated Agent Skill**: Standardized workflow guidelines and anti-hallucination safeguards in `skills/asia-lecture-assistant/SKILL.md`.

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

### Automated Unit Testing
Run the 92 built-in Node.js tests:
```bash
npm test
```

---

## AI Agent Module (MCP 2026-07-28 Specification)

### 1. Invocation Channels
- **Local Stdio MCP Server**:
  ```bash
  npm run mcp
  ```
  Or directly:
  ```bash
  node src/mcp.mjs
  ```
- **Local HTTP Endpoint**:
  - Discovery: `GET /api/mcp`
  - JSON-RPC Invocation: `POST /api/mcp` (Supports `Mcp-Method` and `Mcp-Name` routing headers)

### 2. Tool Catalog
| Tool Name | Purpose | Key Arguments |
| :--- | :--- | :--- |
| `asia_list_lectures` | Query lecture catalog with literacy/status filters | `keyword`, `literacy`, `status`, `limit` |
| `asia_get_lecture` | Fetch detailed lecture metadata | `eid01` (required) |
| `asia_check_graduation` | Audit 4-literacy progress and deficiencies | None |
| `asia_register_lecture` | Direct instantaneous registration | `eid01` (required), `bfree` (default N) |
| `asia_cancel_lecture` | Secure cancellation using school encrypted code | `eid01` (required) |
| `asia_get_calendar` | Fetch schedule and cross-verify time conflicts | None |
| `asia_manage_targets` | Manipulate grab target queue | `action`, `eid01` |
| `asia_get_engine_status` | Telemetry, polling statistics, and logs | `logLimit` |

---

## Mobile App: Flutter Native Build & Installation

The project provides a pure Cupertino Flutter native app under `mobile/`:

### 1. Requirements
- Flutter SDK (>= 3.10.0)
- Android Studio / Xcode

### 2. Local Run
```bash
npm run mobile:flutter:run
```
Or:
```bash
cd mobile
flutter pub get
flutter run
```

### 3. Build Android Release APK
```bash
npm run mobile:flutter:build:apk
```
Output path: `mobile/build/app/outputs/flutter-apk/app-release.apk`.

---

## Directory Structure

```
asia-lecture-grabber/
├ package.json                   Project configuration, scripts, and MCP entrypoint
├ start.bat                      Windows launch shortcut
├ start.sh                       macOS / Linux launch script
├ AGENTS.md                      Architecture constraints and developer guidelines
├ README.md                      Traditional Chinese documentation
├ README.en.md                   English documentation
├ skills/
│  └ asia-lecture-assistant/     AI Agent Skill definition
│     └ SKILL.md                 Skill specification complying with MCP 2026-07-28
├ src/
│  ├ asia.mjs                    School API client with automated AIA intermediate CA repair
│  ├ engine.mjs                  Grabbing engine state machine and backoff
│  ├ mcp.mjs                     Model Context Protocol 2026-07-28 stateless server
│  ├ schedule.mjs                Automated scheduler (3 modes)
│  ├ calendar.mjs                Calendar event parser and literacy extractor
│  ├ ai.mjs                      AI agent and offline rule parser
│  ├ storage.mjs                 Configuration and state local persistence
│  └ server.mjs                  HTTP server, JSON API, and /api/mcp endpoint
├ test/
│  ├ asia.test.mjs               TLS repair and school API business logic tests
│  ├ mcp.test.mjs                MCP 2026-07-28 stateless protocol & Tasks tests
│  ├ calendar.test.mjs           Timestamp parsing and conflict detection tests
│  ├ engine.test.mjs             State machine and manual registration tests
│  ├ schedule.test.mjs           Scheduler modes and global switch constraint tests
│  ├ server.test.mjs             HTTP router and path traversal security tests
│  ├ storage.test.mjs            Persistence and concurrent write safety tests
│  └ ai.test.mjs                 Natural language schedule and prompt parsing tests
├ public/
│  ├ index.html                  Web interface (dashboard, hall, calendar, settings)
│  ├ style.css                   Bauhaus monochrome and Apple liquid frosted glass styling
│  ├ app.js                      Frontend state and controller (Vanilla JS with i18n)
│  ├ manifest.webmanifest        PWA web manifest
│  ├ sw.js                       Service Worker (Network-First modern offline caching)
│  ├ icon.svg                    Vector app icon
│  ├ icon-192.png                PWA 192x192 icon
│  └ icon-512.png                PWA 512x512 icon
├ mobile/
│  ├ pubspec.yaml                Flutter pure Cupertino native dependencies
│  ├ README.md                   Flutter build guidelines
│  ├ assets/                     Mobile icon assets
│  ├ lib/                        Flutter Dart source (Cupertino native UI, engine, i18n)
│  ├ android/                    Android native build project
│  └ ios/                        iOS native build project
└ scripts/
   ├ asia-captcha-autofill.user.js Official web portal CAPTCHA auto-filler script
   ├ desktop-launcher.mjs        Desktop window launcher and process lifecycle manager
   └ generate-icons.mjs          Native PNG icon generator
```

---

## Security & Privacy Notice

- The desktop web version communicates with school servers through your local server; the Flutter app connects directly from your phone. Neither uses a third-party intermediary proxy.
- For the desktop web version, the student ID, password, and last 4 National ID digits are stored locally in `data/config.json` (or memory-only if "remember password" is unchecked). The Flutter app stores credentials on the device according to its "remember credentials" setting.
- The desktop `data/` directory is excluded in `.gitignore` and must not be uploaded or shared.
- Keep your computer, mobile device, and configuration secure. Do not share `config.json` or debug output containing personal data.

---

## Developer & Version Information

- Repository: [https://github.com/pinchiu/asia-lecture-grabber.git](https://github.com/pinchiu/asia-lecture-grabber.git)
- Version: 1.4.1
- License: For personal course and academic assistance use
