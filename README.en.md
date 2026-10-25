# Asia University Lecture Auto-Grabber & Literacy Graduation Threshold Tracker

[English Documentation](README.en.md) | [繁體中文文件](README.md)

A local auto-registration tool, general education graduation threshold dashboard, and AI agent invocation module built on the latest Model Context Protocol (MCP 2026-07-28 stateless architecture) for Asia University's "Online Lecture and General Education Course Registration System" (`https://webap.asia.edu.tw/cfd2020/`).

> A personal assistant designed for Asia University students: track progress across the four core general education literacies, monitor seat openings and cancellation drops, and register automatically the moment a seat appears.
> **Please comply with the school's usage rules. Use this tool only for lawful personal academic and course-selection assistance.**

---

## Core Features & Highlights

### 1. Four Core Literacy Graduation Threshold Tracking

According to Asia University's general education graduation regulations, students must attend school-recognized general education lectures during their studies, accumulate at least 8 sessions in total, and meet the threshold in each of the four core literacies (the "four forces"):
- **Health**: at least 2 sessions
- **Care**: at least 2 sessions
- **Innovation**: at least 2 sessions
- **Excellence**: at least 2 sessions

The system provides a real-time threshold dashboard:
- **Automatic aggregation**: reads your registered or selected sessions and groups them by literacy automatically.
- **Historical backfill**: lets you enter sessions completed in previous semesters manually and merges them with current registrations. While the backfill panel is open for editing, input locking prevents background polling from resetting the values you are typing.
- **Accurate counting for multi-literacy lectures**: if a lecture carries several literacy tags, each tagged literacy receives 1 credit, but the lecture adds only 1 to the total session count.
- **Fastest graduation route**: a built-in algorithm compares each lecture's literacy coverage and time conflicts to recommend the minimum set of sessions needed to meet all thresholds.
- **Missing-literacy filtering**: one click on "Only Missing Literacies" narrows the list to the requirements you have not met.

### 2. Real-Time Grabbing State Machine Engine

- **Live status monitoring**: tracks Open, Full, Upcoming, Closed, On-site Registration, and Other Channels.
- **Waitlist sniping**: keeps watching full (F) sessions and submits a registration instantly when another student drops and a seat is released.
- **Burst polling**: switches to high-frequency polling (0.8 seconds by default) the moment registration opens or a seat is released.
- **Polite backoff**: maintains a 2.5-second polite interval during normal operation and applies exponential backoff on connection errors, avoiding unnecessary load on school servers.
- **Automatic identity verification**: at login, exchanges the last four digits of your national ID for the credential required by the school's registration API, fully automated.
- **Automatic TLS certificate chain repair**: the school's IIS server does not send the intermediate CA. The backend follows the AIA extension to download and verify the intermediate certificate; the Flutter app pins the same verified intermediate as an extra trust anchor. Both keep full TLS verification enabled. Disabling verification or allowing arbitrary hosts through `badCertificateCallback` is strictly forbidden.
- **Scheduled start**: the scheduler supports three modes: start N seconds before registration opens, a specific date and time (one-time), and a recurring weekly time window. It uses edge triggering and handles windows that cross midnight, and it never overrides your global scheduler disable switch. The scheduler runs on the server's internal 10-second timer, so it will not fire if the server is stopped or the computer is asleep.

### 3. Multi-Platform Support and Bilingual i18n: Flutter Native App, PWA Mobile, and Desktop Web

- **Instant Traditional Chinese / English switching (i18n)**: both the web dashboard and the Flutter mobile app support Traditional Chinese and English. The mobile app follows the operating system language by default and also supports manual switching with immediate persistence.
- **Flutter native app (`mobile/`)**: built with Google Flutter in a pure Cupertino native architecture, with iOS physical spring damping, a frosted-glass navigation bar, online update checks, and one-click in-app APK download, installation, and upgrade.
- **PWA mobile app**: full Progressive Web App support. Add it to the home screen or install it from a browser. It provides a standalone window, Network-First Service Worker offline caching, and a touch-optimized card view.
- **Desktop web version**: quick launch (`start.bat` / `start.sh`) opens the dashboard in a dedicated app window or your default browser.
- **Personal calendar and conflict protection**: parses ROC (Minguo) years and class periods automatically and exports a standard `.ics` file in one click. Conflicts between sessions are checked strictly against numeric start and end timestamps.

### 4. AI Agent Invocation Module (MCP 2026-07-28 Latest Stateless Architecture Specification)

- **Model Context Protocol (MCP)**: fully follows the 2026-07-28 standard, including the stateless core, HTTP header routing, and Tasks primitives.
- **Two access modes**:
  - Local stdio pipe (for Claude Desktop, Cursor, and Antigravity)
  - Local HTTP endpoints (`POST /api/mcp` and `GET /api/mcp`)
- **Standard Tasks primitives**: exposes the background grabbing state machine as standard Tasks (`tasks/list`, `tasks/get`, `tasks/cancel`), so AI agents can follow progress and control tasks in real time.
- **Dedicated Agent Skill**: located at `skills/asia-lecture-assistant/SKILL.md`, with complete workflow guidance and a 100% list-existence anti-hallucination guardrail.

---

## Quick Start

### Requirements

- Node.js 20 or newer (native ESM, zero third-party dependencies).
- Git (to clone the repository).

### Download and Installation

Open a terminal and run:
```bash
git clone https://github.com/pinchiu/asia-lecture-grabber.git
cd asia-lecture-grabber
```

### Launch Commands

#### Windows Users
Open the project folder and double-click `start.bat`, or run this in Command Prompt or PowerShell:
```bat
npm start
```

#### macOS / Linux Users
In a terminal:
```bash
chmod +x start.sh
./start.sh
```
Or run directly:
```bash
npm start
```

The service runs at `http://127.0.0.1:5199` by default and binds to loopback only; the browser opens automatically. Set `HOST=0.0.0.0` explicitly if you need access from a phone or another device on the LAN, and review the exposure risk first.

### Running Unit Tests

The project includes 101 automated tests built on Node.js's built-in test module:
```bash
npm test
```

---

## User Guide

1. **Account and identity verification**:
   - In the settings area, enter your student ID, password, and the last four digits of your national ID, then click "Login & Verify Identity".
   - The last four digits of the national ID are the identity proof required by the school API for registration.
2. **Review general education literacy progress**:
   - The top of the dashboard shows current progress in the four literacies and the total number of sessions.
   - If you completed sessions in previous semesters, click "Past Credits" and enter them; the system recalculates the thresholds immediately.
3. **Choose lectures and add targets**:
   - Browse the "Lecture Hall" and filter by literacy, registration status, or keyword.
   - Enable "Only Missing Literacies" to quickly find sessions that help you meet graduation requirements.
   - Click "+ Add Target" to add a lecture to the live monitoring queue.
4. **Start the grabbing monitor**:
   - Click "Start Engine" at the top to begin polling.
   - When a seat is grabbed, the system sends a desktop notification and plays a sound, and updates "My Targets" and "My Schedule" immediately.
   - To start automatically, use "Scheduled Auto-Trigger". It offers three trigger modes: At Opening (based on start time, with a configurable lead in seconds), Specific Date & Time (one-time), and Weekly Time Window. Schedules are evaluated by the server's internal timer, so they do not run while the service is stopped or the computer is asleep.
5. **Manual registration without AI, and the school CAPTCHA mechanism**:
   - **Manual grabbing without AI**:
     - For an open lecture, click the green "Register" button on the right side of the row to submit a registration directly from your machine to the school server; no AI is involved.
     - Use the "Quick Action" input bar to enter a course code (for example `1151074`) and submit a registration instantly with one click.
     - For a full lecture, click "+ Waitlist". The local engine keeps waiting for a seat to be released and grabs it locally in milliseconds.
   - **Four-digit graphical CAPTCHA (digit recognition)**:
     - The four-digit CAPTCHA on the official school website is generated randomly on the client by Vue.js and drawn on a Canvas. Its main purpose is a frontend input-sanity check.
     - The core backend registration endpoint (`POST api/Cfd10/Save`) does not check or accept a CAPTCHA field at all.
     - This tool communicates directly with the backend API, so recognition latency is 0 ms and CAPTCHA errors are avoided entirely.
     - If you need to work on the official school website, the project also provides the Tampermonkey script `scripts/asia-captcha-autofill.user.js`, which detects and fills the CAPTCHA instantly.
6. **Safe cancellation**:
   - To drop a registered session, the school endpoint `POST api/cfd10/DeleteData?reseid=` requires the encrypted serial code generated by the school (format `ID...`).
   - The system parses and sends the encrypted code automatically. It updates local state only after the school API confirms success by returning an empty string `""` (or a JSON string `""`). A successful response must be checked for both an empty body and the two-character string `""` (the guard must be equivalent to `text.isEmpty || text == '""'`); checking only `.isEmpty` is not sufficient.
   - The frontend must never fake success, because an incorrect local state could cause a student to be penalized for absence. Until the encrypted code has been matched from the school records, the tool must not mark a cancellation as successful without an actual successful call to the school API.

---

## AI Agent Invocation Module (MCP 2026-07-28 Latest Specification and Agent Skills)

This project natively supports the 2026-07-28 Model Context Protocol (MCP) stateless specification. It provides a standard JSON-RPC 2.0 interface and a dedicated Agent Skill that modern AI terminal agents such as Claude Desktop, Cursor, and Antigravity can call directly.

### 1. Invocation Channels

- **Start the local MCP stdio server**:
  ```bash
  npm run mcp
  ```
  Or run it directly with Node.js:
  ```bash
  node src/mcp.mjs
  ```
  The stdio entry point loads `data/config.json` and `data/state.json`, creates the local grabbing engine, and signs in automatically in the background when credentials are saved. Until sign-in completes, tools that need authorization report that you are not logged in; afterwards all eight tools work over stdio.
- **Local HTTP endpoints**:
  - Discovery endpoint: `GET /api/mcp` (returns the tool catalog and cache relay headers)
  - Invocation endpoint: `POST /api/mcp` (supports routing through the `Mcp-Method` and `Mcp-Name` HTTP headers)
  - Security limits: every state-changing API (including `/api/mcp`, registration, cancellation, and settings) accepts only loopback or same-origin LAN origins and `Content-Type: application/json`. Cross-site browser requests receive `403`, and non-JSON requests receive `415`. The server binds to `127.0.0.1` by default.

### 2. Core Tool Catalog

| Tool name | Responsibility | Key arguments |
| :--- | :--- | :--- |
| `asia_list_lectures` | Query the current lecture catalog with multi-dimensional filters | `keyword`, `literacy`, `status`, `refresh`, `limit` |
| `asia_get_lecture` | Fetch details and literacy specification for one lecture | `eid01` (required, for example `L01`) |
| `asia_check_graduation` | Analyze completion rates and deficits for the four literacy graduation thresholds | None |
| `asia_register_lecture` | Register for a specified lecture instantly (zero delay) | `eid01` (required), `bfree` (barrier-free space request, Y/N) |
| `asia_cancel_lecture` | Drop a registered lecture (aligns with the school's encrypted code automatically) | `eid01` (required) |
| `asia_get_calendar` | Get the personal schedule and cross-check overlapping time slots | None |
| `asia_manage_targets` | Operate the grabbing engine target queue (add, remove, clear finished, list) | `action` (add/remove/clear_finished/list), `eid01` |
| `asia_get_engine_status` | Get live polling status, counters, and recent logs | `logLimit` (default 20) |

### 3. Standard Tasks Primitives (Tasks Lifecycle)

- `tasks/list`: lists all running background tasks (for example the grabbing engine poller `grab-engine-poller`).
- `tasks/get`: returns task progress, polling statistics, and grabbed sessions for a `taskId`.
- `tasks/cancel`: safely stops the grabbing state machine.

### 4. Dedicated Agent Skill

The skill specification is at [`skills/asia-lecture-assistant/SKILL.md`](skills/asia-lecture-assistant/SKILL.md). It includes complete YAML frontmatter (`version: 2.0.0`, `protocol: mcp-2026-07-28`), decision flows, and the 100% list-existence anti-hallucination rules.

---

## Mobile App: Flutter Native Build and Installation

The project includes a complete Flutter native mobile project under `mobile/`, which can be compiled into an installable Android APK or an iOS app:

### 1. Environment Requirements

- Flutter SDK (version >= 3.10.0)
- Android Studio (including Android SDK and Platform-Tools) or Xcode (iOS)

### 2. Local Run and Debugging

The Flutter app includes a native school API client and grabbing engine. It connects directly to the school system and **does not require the Node.js server on your computer**.

From the project root:
```bash
npm run mobile:flutter:run
```
Or enter the mobile directory:
```bash
cd mobile
flutter pub get
flutter run
```

### 3. Build the Android Native APK

Run the following command to build an APK that can be installed on an Android phone:
```bash
npm run mobile:flutter:build:apk
```
Or manually:
```bash
cd mobile
flutter build apk --release
```
After the build, the APK is located at:
`mobile/build/app/outputs/flutter-apk/app-release.apk`
Transfer the APK to an Android phone to install and use it directly.

### 4. Mobile Login and Settings

Open the "Settings" tab in the Flutter app and enter your campus portal account, password, and the last four digits of your national ID to log in to the school system directly from your phone. The settings page also provides language preference, remember credentials, historical literacy backfill, version update checks, and in-app update installation. No computer IP address is needed, and the phone does not depend on the computer being powered on.

---

## No-Install Mobile Version: Add the Browser PWA to the Home Screen

In addition to the Flutter native app, the system also implements the standard PWA specification, so it can be opened directly in a browser without installation:

1. **Same-network connection**:
   - Make sure the phone and the computer running this program are on the same Wi-Fi local network.
   - Find the computer's LAN IP address (for example `192.168.1.100`) and start the server with `$env:HOST="0.0.0.0"; npm start`.
2. **iPhone / iPad (Safari)**:
   - Open the URL in Safari, tap the "Share" button at the bottom, then choose "Add to Home Screen".
3. **Android (Chrome / Edge)**:
   - Open the URL and tap "Install App" to the right of the address bar or on the page. The app shortcut is added to the app drawer and home screen.

---

## Technical Architecture and School API Reverse Engineering

The school system is a Vue SPA (`http-vue-loader`), and the API base is `https://webap.asia.edu.tw/cfd2020/`:

| Function | HTTP method and path | Description and fields |
| --- | --- | --- |
| Login authentication | `POST api/Login/Auth` | Sends `{username, password}` and receives a Bearer Token |
| Lecture list | `POST api/Cfd01/Load?op=X01F00&eid01=` | Public endpoint; with a Token it returns your personal `cnt_10` (whether you are already registered). The request body also carries `op`, `sdate`, `edate`, and `eid01`. |
| Lecture detail | `GET api/Cfd01/GetRes?eid01=` | Includes literacies, organizer, UCAN, SDGs, and other details |
| Identity verification | `POST api/PersonInfo/GetPInfo` | Sends `{p_no, p_id, p_type}` (`p_id` is the last four digits of the national ID) |
| Submit registration | `POST api/Cfd10/Save` | Core grabbing endpoint; requires a Token and a `std_info` object (including `bfree` barrier-free need, default `N`) |
| Cancel registration | `POST api/cfd10/DeleteData?reseid=` | Drops a registered session (requires the encrypted school serial number) |
| Registered list | `POST api/Cfd01/Load_del?op=X01F00DEL` | Queries registered and dropped records |

### Literacy Flag Reference

The school database records literacy attributes with the flags `chk1` through `chk8`:
- `chk4 = 'Y'`: **Health**
- `chk5 = 'Y'`: **Care**
- `chk6 = 'Y'`: **Innovation**
- `chk7 = 'Y'`: **Excellence**

### Status Code Reference

- `canapp = 'Y'`: Open for registration
- `canapp = 'F'`: Full (keep polling for a released seat)
- `canapp = 'N1'`: Not yet open
- `canapp = 'N2'`: Closed
- `canapp = 'C'`: On-site registration
- `canapp = 'D'`: Other external registration channel

---

## Project Directory Structure

```
asia-lecture-grabber/
├ package.json                   Project configuration, launch scripts, and MCP CLI commands
├ start.bat                      Windows launch shortcut
├ start.sh                       macOS / Linux launch script
├ AGENTS.md                      Architecture constraints and developer guidelines
├ README.md                      Traditional Chinese user manual and technical documentation
├ README.en.md                   English user manual and technical documentation
├ skills/
│  └ asia-lecture-assistant/     AI agent skill specification directory
│     └ SKILL.md                 Agent Skill following the MCP 2026-07-28 specification
├ src/
│  ├ asia.mjs                    School API client (AIA intermediate certificate repair orchestration and connection pool)
│  ├ tls.mjs                     TLS chain helpers (AIA extraction, intermediate download and verification)
│  ├ contract.mjs                Shared school behaviour contract for Node and Flutter
│  ├ runtime.mjs                 Shared runtime assembly (engine, auto-login, state persistence)
│  ├ engine.mjs                  Core grabbing engine (state machine, burst polling, backoff)
│  ├ mcp.mjs                     Model Context Protocol 2026-07-28 stateless server (stdio and HTTP)
│  ├ schedule.mjs                Scheduler (N seconds before opening, specific time, weekly window)
│  ├ calendar.mjs                Calendar conversion, four-literacy extraction, and conflict checks
│  ├ ai.mjs                      Smart course-selection agent and local offline rule parser
│  ├ storage.mjs                 Local configuration and state persistence (write queue against races)
│  └ server.mjs                  HTTP server, JSON API, and /api/mcp endpoints
├ test/
│  ├ asia.test.mjs               School communication errors, certificate chain retry, and API business tests
│  ├ mcp.test.mjs                MCP 2026-07-28 stateless protocol and Tasks integration tests
│  ├ contract.test.mjs           Node/Flutter contract parity and certificate pin tests
│  ├ calendar.test.mjs           Timestamp parsing, ROC year conversion, and conflict tests
│  ├ engine.test.mjs             State machine polling, manual quick registration, and cancellation tests
│  ├ schedule.test.mjs           Three scheduler modes and global switch constraint tests
│  ├ server.test.mjs             HTTP routing, static path traversal protection, and API integration tests
│  ├ storage.test.mjs            Persistence, numeric constraints, and concurrent write race tests
│  └ ai.test.mjs                 Smart parsing, Markdown prompts, and anti-hallucination tests
├ public/
│  ├ index.html                  Main interface (minimalist Bauhaus and frosted-glass visual design)
│  ├ style.css                   Monochrome and frosted-glass high-quality stylesheet
│  ├ app.js                      Frontend logic controller (Vanilla JS with i18n and signature caching)
│  ├ manifest.webmanifest        PWA application manifest
│  ├ sw.js                       Service Worker (Network-First modern offline caching)
│  ├ icon.svg                    Vector application icon
│  ├ icon-192.png                PWA 192x192 icon
│  └ icon-512.png                PWA 512x512 icon
├ mobile/
│  ├ pubspec.yaml                Flutter pure Cupertino native project dependency configuration
│  ├ README.md                   Flutter native build guide
│  ├ assets/                     Mobile icon assets
│  ├ lib/                        Flutter Dart source code
│  │  ├ main.dart                CupertinoApp root widget and online update pipeline
│  │  ├ config/i18n.dart         Bilingual i18n state machine (automatic system language adaptation)
│  │  ├ backend/                 Pure Dart school API client and state machine engine
│  │  └ screens/                 Four native screens (lectures, targets, schedule, settings)
│  ├ android/                    Android native build project (permissions and Gradle configuration)
│  └ ios/                        iOS native build project (Info.plist and permissions)
└ scripts/
   ├ asia-captcha-autofill.user.js Official website CAPTCHA auto-fill and barrier-free requirement automation script
   ├ desktop-launcher.mjs         Desktop window launcher and orphan process cleanup script
   └ generate-icons.mjs           Native PNG icon generator
```

---

## Data Security and Personal Privacy Notice

- The desktop web version communicates with the school system through a local server; the Flutter mobile app connects to the school system directly from the phone. Neither uses an external relay server.
- For the desktop web version, the student account, password, and last four digits of the national ID are stored locally in `data/config.json` (or kept in memory only if "Remember Credentials" is unchecked). The Flutter mobile app stores them on the device according to its "remember credentials" setting.
- The desktop `data/` directory is excluded by `.gitignore` and must not be uploaded to GitHub or shared publicly.
- Keep your computer, mobile device, and configuration files secure. Never give `config.json` or debug data containing credentials to anyone else.

---

## Developer and Version Information

- Repository: [https://github.com/pinchiu/asia-lecture-grabber.git](https://github.com/pinchiu/asia-lecture-grabber.git)
- Version: 1.4.1
- License: For personal course-selection assistance use
