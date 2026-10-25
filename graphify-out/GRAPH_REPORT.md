# Graph Report - lecture-grabber  (2026-10-25)

## Corpus Check
- 79 files · ~66,864 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .xml 6, (none) 2, .properties 2)

## Summary
- 940 nodes · 1787 edges · 46 communities (34 shown, 12 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- HTTP API and MCP Server
- Web Dashboard Frontend
- Bundled Web App Copy
- School API Client and TLS
- Flutter Backend Layer
- App Constants and Updates
- Grabbing Engine Runtime
- Flutter i18n and Tests
- Cupertino App Root
- AI Planning Agent
- Schedule Scheduler
- Settings Screen
- Dart Asia API Client
- Project Documentation
- MCP Tools and Agent Skill
- MCP Protocol Module
- npm Package Manifest
- Dashboard View Panels
- Cross-Platform Architecture
- Lectures Screen
- Calendar and Literacy Helper
- Feature Overview Ties
- Calendar Screen
- Home Shell and Glass Nav
- Targets Screen
- School Certificate Anchors
- PWA and UI Behaviors
- Android Main Activity
- Cancellation Safety Guards
- Shared Contract Constants
- Flutter Native Architecture
- iOS App Delegate
- Graduation Literacy Thresholds
- PNG Icon Generator
- Login and Local Privacy
- Dart API Tests
- Desktop Launcher
- Dart Constants Tests
- CAPTCHA Autofill Userscript
- Bundled Service Worker
- Public Service Worker

## God Nodes (most connected - your core abstractions)
1. `Engine` - 35 edges
2. `createApp()` - 17 edges
3. `src/engine.mjs Grabbing State Machine` - 16 edges
4. `request()` - 15 edges
5. `handleApi()` - 14 edges
6. `render()` - 14 edges
7. `Traditional Chinese README Manual` - 14 edges
8. `Web Dashboard UI Surface` - 14 edges
9. `renderLectures()` - 13 edges
10. `render()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `src/ai.mjs Smart Course-Selection Agent` --semantically_similar_to--> `100 Percent List-Existence Anti-Hallucination Guardrail`  [INFERRED] [semantically similar]
  AGENTS.md → skills/asia-lecture-assistant/SKILL.md
- `Mobile Embedded Web View Asset` --semantically_similar_to--> `Web Dashboard HTML View`  [INFERRED] [semantically similar]
  mobile/assets/web/index.html → public/index.html
- `Execution Log Card` --shares_data_with--> `src/engine.mjs Grabbing State Machine`  [INFERRED]
  public/index.html → AGENTS.md
- `grab-engine-poller Background Task` --references--> `src/engine.mjs Grabbing State Machine`  [INFERRED]
  skills/asia-lecture-assistant/SKILL.md → AGENTS.md
- `MCP 2026-07-28 Protocol Integration` --semantically_similar_to--> `MCP 2026-07-28 Stateless Architecture`  [INFERRED] [semantically similar]
  skills/asia-lecture-assistant/SKILL.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **MCP 2026-07-28 Stateless Invocation Stack** — agents_mcp_stateless, agents_mcp_mjs, skill_mcp_protocol, skill_http_mode, skill_header_routing [INFERRED 0.85]
- **Four-Literacy Graduation Threshold Tracking Flow** — readme_four_literacies, agents_graduation_threshold, agents_multi_literacy_counting, public_index_grad_dashboard, skill_graduation_rules, skill_tool_check_graduation [INFERRED 0.85]
- **Frontend Attribute Contract for Views, Actions and i18n** — public_index_ui, public_index_data_action_contract, public_index_i18n_contract, public_index_nav_segments, public_index_lecture_hall, agents_frontend_implicit_binding, agents_bilingual_i18n [INFERRED 0.85]

## Communities (46 total, 12 thin omitted)

### Community 0 - "HTTP API and MCP Server"
Cohesion: 0.05
Nodes (74): buildContractSource(), target, buildCalendar(), checkConflict(), escapeIcsText(), eventFromRow(), extractLiteracies(), findConflicts() (+66 more)

### Community 1 - "Web Dashboard Frontend"
Cohesion: 0.09
Nodes (62): applyGradRecommend(), applyLanguage(), applySnapshot(), beep(), boot(), checkScheduleConflict(), cleanHtml(), computeGraduationStats() (+54 more)

### Community 2 - "Bundled Web App Copy"
Cohesion: 0.10
Nodes (53): applyGradRecommend(), applySnapshot(), beep(), boot(), checkScheduleConflict(), cleanHtml(), computeGraduationStats(), copyScheduleText() (+45 more)

### Community 3 - "School API Client and TLS"
Cohesion: 0.11
Nodes (37): ApiError, BASE, BASE_URL, buildAgent(), cancelLecture(), downloadBinary(), EXTRA_CA_FILE, extractAiaUrls() (+29 more)

### Community 4 - "Flutter Backend Layer"
Cohesion: 0.04
Nodes (38): activeTargets, addTargets, api, _attemptRegister, autoLoginIfRemembered, cancelTarget, clearTargets, computeGraduationProgress (+30 more)

### Community 5 - "App Constants and Updates"
Cohesion: 0.05
Nodes (39): apkSize, apkUrl, body, _channel, checkUpdate, currentVersion, downloadApk, hasUpdate (+31 more)

### Community 6 - "Grabbing Engine Runtime"
Cohesion: 0.12
Nodes (11): clamp(), Engine, normalizeSettings(), normalizeTarget(), parseOpenAt(), sleep(), TERMINAL, autoLoginEngine() (+3 more)

### Community 7 - "Flutter i18n and Tests"
Cohesion: 0.05
Nodes (22): currentLang, currentMode, detectSystemLanguage, _en, I18n, init, isEn, isSystemMode (+14 more)

### Community 8 - "Cupertino App Root"
Cohesion: 0.05
Nodes (28): activeIcon, AsiaLectureGrabberApp, _availableUpdate, build, child, createState, _currentIndex, dispose (+20 more)

### Community 9 - "AI Planning Agent"
Cohesion: 0.12
Nodes (35): AGENT_SYSTEM, aiSummary(), applyPeriod(), atTime(), chat(), clampNumber(), CN_DIGITS, cnNumber() (+27 more)

### Community 10 - "Schedule Scheduler"
Cohesion: 0.13
Nodes (9): clampInt(), DAY_LABELS, describeEntry(), formatStamp(), makeId(), MODES, normalizeEntry(), normalizeTime() (+1 more)

### Community 11 - "Settings Screen"
Cohesion: 0.08
Nodes (23): build, _buildLitInput, _careCtrl, createState, dispose, engine, _excellCtrl, _handleCheckUpdate (+15 more)

### Community 12 - "Dart Asia API Client"
Cohesion: 0.08
Nodes (20): ApiError, AsiaApi, baseUrl, cancelLecture, _client, _createVerifiedClient, defaultBaseUrl, getLecture (+12 more)

### Community 13 - "Project Documentation"
Cohesion: 0.13
Nodes (10): Mobile Dart Analysis Options, Mobile Flutter Pubspec Configuration, AGENTS.md Developer Guidelines, Mobile Flutter App Documentation, Asia Lecture Grabber English Documentation, Asia Lecture Grabber Chinese Documentation, Mobile Embedded Web View Asset, Asia Lecture Assistant Agent Skill (+2 more)

### Community 14 - "MCP Tools and Agent Skill"
Cohesion: 0.14
Nodes (14): Manual Quick Registration Bar, GET api/Cfd01/GetRes Lecture Detail, POST api/Cfd01/Load Lecture List, POST api/Cfd10/Save Registration, Tampermonkey CAPTCHA Autofill Script, English README Manual, Eight MCP Tool Catalog, Asia Lecture Assistant Agent Skill (+6 more)

### Community 15 - "MCP Protocol Module"
Cohesion: 0.14
Nodes (16): npm Command Suite (start, dev, test, contract, mcp, desktop), src/mcp.mjs MCP Server (stdio and HTTP), Asia University Lecture Grabber System Overview, src/runtime.mjs Shared Runtime Assembly, src/server.mjs HTTP Server, 102 Built-in Node Test Suite, Dedicated Agent Skill Reference, MCP AI Agent Invocation Module (+8 more)

### Community 16 - "npm Package Manifest"
Cohesion: 0.10
Nodes (20): description, engines, node, name, private, scripts, contract, desktop (+12 more)

### Community 17 - "Dashboard View Panels"
Cohesion: 0.14
Nodes (11): mobile/lib/config/i18n.dart Bilingual State Machine, Language Preference Card, Lecture Hall Table and Filters, Execution Log Card, Mobile Bottom Dock Navigation, Segmented Four-View Navigation, Grabbing Settings and Barrier-Free Card, Toast Notification Container (+3 more)

### Community 18 - "Cross-Platform Architecture"
Cohesion: 0.18
Nodes (11): asia_api.dart Pure Dart School API Client, src/asia.mjs School API Client, calendar_helper.dart ROC Year and Literacy Helper, src/calendar.mjs Calendar and Literacy Converter, src/contract.mjs Shared School Behaviour Contract, mobile/lib/backend Dart Backend Layer, grab_engine.dart Dart Grabbing State Machine, school_certs.dart AIA Intermediate Trust Anchors (+3 more)

### Community 19 - "Lectures Screen"
Cohesion: 0.12
Nodes (15): build, _buildGraduationHeaderCard, _buildLectureCard, _buildMetricChip, createState, engine, _filterKeys, initState (+7 more)

### Community 20 - "Calendar and Literacy Helper"
Cohesion: 0.12
Nodes (15): buildCalendar, CalendarHelper, detectLiteracies, detectLiteraciesFromTitle, escapeIcsText, extractLiteracies, extractTitle, findConflicts (+7 more)

### Community 21 - "Feature Overview Ties"
Cohesion: 0.17
Nodes (11): src/ai.mjs Smart Course-Selection Agent, src/engine.mjs Grabbing State Machine, src/schedule.mjs Scheduler, Quick Planning Command Console, LLM Connection Settings Card, Scheduled Auto-Start Form, Target Queue Table, Engine Telemetry Grid (+3 more)

### Community 22 - "Calendar Screen"
Cohesion: 0.14
Nodes (13): build, _buildRegisteredCard, CalendarScreen, _CalendarScreenState, _confirmCancel, createState, engine, _errorMsg (+5 more)

### Community 23 - "Home Shell and Glass Nav"
Cohesion: 0.21
Nodes (10): HomeScreen, _HomeScreenState, _IosTransparentGlassNavBar, _IosTransparentGlassNavBarState, _KeepAlivePage, _KeepAlivePageState, SettingsScreen, _SettingsScreenState (+2 more)

### Community 24 - "Targets Screen"
Cohesion: 0.15
Nodes (8): GrabEngine, build, _buildStatItem, _buildTargetItem, createState, engine, _isActionInProgress, _showDialog

### Community 25 - "School Certificate Anchors"
Cohesion: 0.17
Nodes (6): buildSchoolSecurityContext, context, dXN0LmNvbS9VU0VSVHJ1c3RSU0FBZGRUcnVzdENBLmNydDAlBggrBgEFBQcwAYYZ, MTAyMDAwMDAwWhcNMzAxMjMxMjM1OTU5WjCBlTELMAkGA1UEBhMCR0IxGzAZBgNV, schoolIntermediatePem, YXRpb24gVmFsaWRhdGlvbiBTZWN1cmUgU2VydmVyIENBMIIBIjANBgkqhkiG9w0B

### Community 26 - "PWA and UI Behaviors"
Cohesion: 0.18
Nodes (4): Obsidian Black Frosted-Glass Vanilla JS Frontend, Historical Backfill Panel, Smart Deficiency Recommendation Panel, PWA Manifest and Install Button

### Community 28 - "Cancellation Safety Guards"
Cohesion: 0.27
Nodes (5): Calendar Grid and Upcoming List, Calendar View Panel, POST api/cfd10/DeleteData Cancellation, POST api/Cfd01/Load_del Registered History, asia_cancel_lecture Tool

### Community 29 - "Shared Contract Constants"
Cohesion: 0.20
Nodes (8): cancelSuccessTexts, graduationCareThreshold, graduationExcellenceThreshold, graduationHealthThreshold, graduationInnovationThreshold, graduationTotalThreshold, isCancelSuccessText, missingEndFallbackMs

### Community 30 - "Flutter Native Architecture"
Cohesion: 0.31
Nodes (5): mobile/lib/main.dart CupertinoApp Root, Four Flutter Native Screens, Flutter Mobile README, Flutter Test and Analyze Commands, Flutter Native Mobile App Distribution

### Community 31 - "iOS App Delegate"
Cohesion: 0.22
Nodes (3): Flutter, AppDelegate, UIKit

### Community 33 - "PNG Icon Generator"
Cohesion: 0.32
Nodes (6): crc32(), crcTable, createPng(), HERE, makeChunk(), publicDir

### Community 34 - "Login and Local Privacy"
Cohesion: 0.40
Nodes (4): src/storage.mjs Local Persistence with Write Queue, Student Login and Identity Form, POST api/Login/Auth, POST api/PersonInfo/GetPInfo Identity Verification

### Community 36 - "Desktop Launcher"
Cohesion: 0.40
Nodes (3): openBrowser(), serverProcess, waitForServer()

## Knowledge Gaps
- **238 isolated node(s):** `RFC-5545`, `RFC-5545`, `build`, `_buildLitInput`, `_careCtrl` (+233 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 378 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GrabEngine` connect `Targets Screen` to `Flutter Backend Layer`, `Cupertino App Root`, `Settings Screen`, `Lectures Screen`, `Calendar Screen`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createApp()` (e.g. with `autoLogin()` and `snapshot()`) actually correct?**
  _`createApp()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-5545`, `RFC-5545`, `build` to the rest of the system?**
  _238 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `HTTP API and MCP Server` be split into smaller, more focused modules?**
  _Cohesion score 0.0504950495049505 - nodes in this community are weakly interconnected._
- **Why does `Engine` connect `Grabbing Engine Runtime` to `HTTP API and MCP Server`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `Web Dashboard Frontend` be split into smaller, more focused modules?**
  _Cohesion score 0.0890937019969278 - nodes in this community are weakly interconnected._
- **Why does `Traditional Chinese README Manual` connect `Feature Overview Ties` to `Graduation Literacy Thresholds`, `Login and Local Privacy`, `MCP Tools and Agent Skill`, `MCP Protocol Module`, `PWA and UI Behaviors`, `Cancellation Safety Guards`, `Flutter Native Architecture`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._