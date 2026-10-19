# Graph Report - lecture-grabber  (2026-10-19)

## Corpus Check
- Corpus is ~24,850 words - fits in a single context window. You may not need a graph.

## Summary
- 370 nodes · 711 edges · 20 communities (14 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- 模組社群 0
- 模組社群 1
- 模組社群 2
- 模組社群 3
- 模組社群 4
- 模組社群 5
- 模組社群 6
- 模組社群 7
- 模組社群 8
- 模組社群 9
- 模組社群 10
- 模組社群 11
- 模組社群 12
- 模組社群 13
- 模組社群 14
- 模組社群 15
- 模組社群 16

## God Nodes (most connected - your core abstractions)
1. `Engine` - 28 edges
2. `Scheduler` - 25 edges
3. `render()` - 13 edges
4. `request()` - 13 edges
5. `parseScheduleText()` - 11 edges
6. `normalizeEntry()` - 11 edges
7. `handleApi()` - 11 edges
8. `scripts` - 10 edges
9. `esc()` - 10 edges
10. `renderLectures()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `chat()` --calls--> `ApiError`  [EXTRACTED]
  src/ai.mjs → src/asia.mjs
- `parseJsonObject()` --calls--> `ApiError`  [EXTRACTED]
  src/ai.mjs → src/asia.mjs
- `describePlan()` --calls--> `describeEntry()`  [EXTRACTED]
  src/ai.mjs → src/schedule.mjs
- `describePlan()` --calls--> `normalizeEntry()`  [EXTRACTED]
  src/ai.mjs → src/schedule.mjs
- `normalizeTarget()` --calls--> `extractLiteracies()`  [EXTRACTED]
  src/engine.mjs → src/calendar.mjs

## Import Cycles
- None detected.

## Communities (20 total, 6 thin omitted)

### Community 0 - "模組社群 0"
Cohesion: 0.11
Nodes (52): applyGradRecommend(), applySnapshot(), beep(), boot(), checkScheduleConflict(), cleanHtml(), computeGraduationStats(), copyScheduleText() (+44 more)

### Community 1 - "模組社群 1"
Cohesion: 0.07
Nodes (39): crc32(), crcTable, createPng(), HERE, makeChunk(), publicDir, api_calendarRows(), engine (+31 more)

### Community 2 - "模組社群 2"
Cohesion: 0.10
Nodes (29): openBrowser(), serverProcess, waitForServer(), ApiError, BASE, BASE_URL, buildAgent(), cancelLecture() (+21 more)

### Community 3 - "模組社群 3"
Cohesion: 0.12
Nodes (35): AGENT_SYSTEM, aiSummary(), applyPeriod(), atTime(), chat(), clampNumber(), CN_DIGITS, cnNumber() (+27 more)

### Community 4 - "模組社群 4"
Cohesion: 0.12
Nodes (10): clampInt(), DAY_LABELS, describeEntry(), formatStamp(), makeId(), MODES, normalizeEntry(), normalizeTime() (+2 more)

### Community 5 - "模組社群 5"
Cohesion: 0.15
Nodes (7): clamp(), Engine, normalizeSettings(), normalizeTarget(), parseOpenAt(), sleep(), TERMINAL

### Community 6 - "模組社群 6"
Cohesion: 0.09
Nodes (18): accentCyan, accentGreen, AppColors, AppConstants, appTitle, background, defaultAndroidEmulatorHost, defaultLocalHost (+10 more)

### Community 7 - "模組社群 7"
Cohesion: 0.11
Nodes (14): build, _buildErrorView, _controller, createState, _currentUrl, _errorDescription, _handleWillPop, _hasError (+6 more)

### Community 8 - "模組社群 8"
Cohesion: 0.11
Nodes (17): description, engines, node, name, private, scripts, desktop, dev (+9 more)

### Community 9 - "模組社群 9"
Cohesion: 0.13
Nodes (11): _applyPreset, build, createState, currentUrl, dispose, _errorMessage, initState, onSaveUrl (+3 more)

### Community 10 - "模組社群 10"
Cohesion: 0.15
Nodes (6): AsiaLectureGrabberApp, build, initialUrl, main, prefs, savedUrl

### Community 11 - "模組社群 11"
Cohesion: 0.44
Nodes (9): buildCalendar(), eventFromRow(), extractLiteracies(), isChecked(), pad(), parseHm(), parseYmd(), WEEKDAY (+1 more)

### Community 12 - "模組社群 12"
Cohesion: 0.22
Nodes (3): Flutter, AppDelegate, UIKit

### Community 13 - "模組社群 13"
Cohesion: 0.40
Nodes (4): SettingsModal, _SettingsModalState, WebViewScreen, _WebViewScreenState

## Knowledge Gaps
- **50 isolated node(s):** `UIKit`, `Flutter`, `AppColors`, `AppConstants`, `background` (+45 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 124 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Engine` connect `模組社群 5` to `模組社群 1`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **What connects `UIKit`, `Flutter`, `AppColors` to the rest of the system?**
  _50 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `模組社群 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10595065312046444 - nodes in this community are weakly interconnected._
- **Why does `Scheduler` connect `模組社群 4` to `模組社群 1`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `模組社群 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07180851063829788 - nodes in this community are weakly interconnected._
- **Why does `ApiError` connect `模組社群 2` to `模組社群 3`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Should `模組社群 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0960960960960961 - nodes in this community are weakly interconnected._