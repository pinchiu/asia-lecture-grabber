# AGENTS.md

亞洲大學「講座自動報名助手與素養門檻追蹤系統」：零依賴 Node.js（>=20）ESM 服務 + 曜石黑蘋果磨砂玻璃與原生四力配色無框架前端 + Flutter 純 Cupertino 原生行動端 App + Model Context Protocol (MCP 2026-07-28 最新無狀態架構) AI 代理調用模組。
功能、API 逆向成果與引擎策略詳見 `README.md`；本檔記錄全專案之最新架構規範、設計約束與容易踩雷之核心事實。

## 指令

### 電腦網頁版、伺服器與 AI Agent 模組
- 啟動後端與介面：`npm start`（= `node src/server.mjs`），或雙擊 `start.bat`。
- 開發模式（後端檔變更自動重啟）：`npm run dev`（`node --watch`）。
- 執行自動化單元測試：`npm test`（基於 Node.js 內建 `node:test` 與 `node:assert`，共 102 項測試，覆蓋率達 90%~100%）。
- 重新產生 Flutter 共用契約常數：`npm run contract`（來源為 `src/contract.mjs`，輸出 `mobile/lib/config/contract.g.dart`）。
- 啟動 MCP stdio 伺服器：`npm run mcp`（= `node src/mcp.mjs`，供 Claude Desktop、Cursor、Antigravity 調用）。
- 桌面視窗喚起：`npm run desktop`（啟動後端並以 Chrome App 視窗模式或預設瀏覽器開啟）。
- 產生 PWA 圖示：`npm run icons`。
- 語法檢查：`node --check <file>`；功能驗證＝實際執行伺服器（打 JSON API）或以瀏覽器驅動。
- 服務位置預設 `http://127.0.0.1:5199`，預設只綁定 loopback；可用 `PORT` 覆寫埠號。需要手機或區網連線時必須明確設定 `HOST=0.0.0.0`，此舉會讓同網段裝置可存取 API，請自行評估風險。
- **已有實例在跑時（常見）會 `EADDRINUSE`**，測試請換埠：`$env:PORT=5299; node src/server.mjs`。切勿直接強制關閉使用者正在執行的 5199 實例（可能持有登入中的 session）。

### Flutter 原生行動端 (`mobile/`)
- 安裝相依：`cd mobile && flutter pub get`
- 執行行動端 App：`npm run mobile:flutter:run`（或進入 `mobile/` 執行 `flutter run`）。
- 執行行動端單元測試：`npm run mobile:flutter:test`（或進入 `mobile/` 執行 `flutter test`）。
- 打包 Android 原生 APK：`npm run mobile:flutter:build:apk`（產出於 `mobile/build/app/outputs/flutter-apk/app-release.apk`）。
- 打包 Android App Bundle：`npm run mobile:flutter:build:bundle`。
- 檢查 Flutter 環境：`npm run mobile:flutter:doctor`。

## 架構

- **後端單一鏈路**：
  - `src/server.mjs`：HTTP 服務、JSON API 路由、靜態資源路由、路徑穿透隔離、開機自動登入調度、`POST /api/mcp` 與 `GET /api/mcp` 協定端點。所有變更狀態的 API 一律檢查 Origin 與 `application/json`，避免任意網頁在使用者登入狀態下代為報名、退選或修改設定。
  - `src/engine.mjs`：搶課狀態機核心、爆速輪詢（0.8s）與禮貌間隔（2.5s）動態切換、請求最小間隔節流（600ms）、校方快取防空保護、手動快報與退選交易處理、日誌隊列與清除封裝。
  - `src/asia.mjs`：校方 API 客戶端、AIA 中繼憑證自動修補調度、KeepAlive 連線池、IIS 錯誤頁面與 BOM 字符過濾、OpenSSL 錯誤代碼相容、重導向容錯與退選二引號相容處理。
  - `src/tls.mjs`：TLS 憑證鏈輔助（DER／PEM 轉換、AIA 網址提取、葉憑證讀取、中繼憑證下載與鏈路驗證、KeepAlive agent 建立），以明確參數操作、不依賴模組全域狀態。
- **AI 代理與 MCP 調用模組 (MCP 2026-07-28 最新規格)**：
  - `src/mcp.mjs`：遵循 2026-07-28 無狀態架構規格，支援 stdio 與 HTTP 雙調用模式、8 項核心 Tools、Tasks 標準生命週期原語（`tasks/list`, `tasks/get`, `tasks/cancel`）、HTTP Header 路由導向（`Mcp-Method` 與 `Mcp-Name`）與快取中繼（`ttlMs`, `cacheScope`）。stdio 進入點會載入本機設定、建立引擎並以記住帳密於背景自動登入；登入完成後 8 項工具在兩種傳輸模式下皆可運作，完成前需要授權的工具會回報尚未登入。授權憑證以 `getToken` 動態取得。
  - `src/runtime.mjs`：伺服器與 stdio MCP 共用的執行期組裝（載入設定／目標、建立引擎、自動登入、目標去抖動持久化）。
  - `src/contract.mjs`：Node 與 Flutter 共用的校方行為契約（退選成功字串、缺少結束時間的 2 小時預設、畢業門檻）。修改後必須執行 `npm run contract` 產生 Dart 常數。
  - `skills/asia-lecture-assistant/SKILL.md`：現代 Agent Skills 規格檔，提供外部 AI 代理完整標準決策樹、最佳選課路徑演算法與 100% 清單存在性防幻覺護欄。
- **輔助模組**：
  - `src/schedule.mjs`：排程器（開放瞬間提前 N 秒、特定時刻、每週時段三種模式，支援邊緣觸發與跨午夜運算，且不強制覆寫使用者之全域停用開關）。
  - `src/calendar.mjs`：已報名講座轉行事曆事件、四大素養標籤提取、民國年轉換與時間戳記排序。
  - `src/ai.mjs`：智慧選課代理（OpenAI 相容 API，相容結尾帶有 `/chat/completions` 或缺少協定標頭之自訂 Base URL）與本機離線規則解析雙引擎，具備 100% 清單存在性防幻覺校驗。
  - `src/storage.mjs`：`config.json`（設定、排程、帳密、歷年素養）與 `state.json`（搶課目標）之本地持久化，內建 Promise 寫入串列佇列防範並行競爭。
- **前端介面（原生 iOS 深色磨砂玻璃無框架介面）**：
  - `public/index.html` / `app.js` / `style.css`：原生 JavaScript（Vanilla JS），採**曜石黑底、蘋果液態磨砂玻璃與 Flutter 原生版一致的四力／狀態配色**，具備大標題層級、圓角化分層導覽、液態滑動指示器、點按與拖曳雙模式與 iOS 原生級觸控手勢。
  - 內建進階特色：
    - **中英文雙語介面（i18n）**：支援繁體中文與英文即時切換，設定區全數覆蓋 `data-i18n` 標籤，持久化存於 localStorage。
    - **DOM 簽名快取比對**：大廳、搶課目標與行事曆共用 `signatures` 快取與 `unchanged(...)` 輔助函式，避免每 1.2 秒輪詢撕毀 DOM 節點導致按鈕點擊事件被瀏覽器中斷。
    - **歷年累計補登輸入鎖定保護**：展開補登面板編輯時，輪詢略過輸入框數值覆寫，防止使用者輸入期間數值被強制還原。
    - **XSS 安全防護**：時段衝突等動態 HTML 屬性完整使用 `esc(...)` 跳脫。
    - **最速畢業選課路線推薦**：分析四大素養缺額與彼此衝堂關係，演算法自動推薦最少場次達標路線。
    - **iCal 行事曆匯出與衝堂預警**：自動交叉比對講座上課時段，標示衝突警告。
    - **Service Worker (PWA)**：`public/sw.js` 採現代 Network-First 快取架構，非 GET 請求自然放行，避免舊快取鎖死更新。
- **Flutter 行動端（純 Cupertino 100% 原生架構）**：
  - **核心哲學**：淘汰 WebView 包裝與孤立代碼，全介面以 Apple 官方標準設計語言 `flutter/cupertino.dart` 建構，具備 iOS 物理彈簧阻尼（BouncingScrollPhysics）、CupertinoSliverRefreshControl 下拉齒輪回彈、CupertinoTabBar 貼合底緣。
  - `mobile/lib/main.dart`：App 根元件 `CupertinoApp`、曜石黑深色主題、CupertinoTabScaffold 根導覽與在線更新管線。
  - `mobile/lib/config/i18n.dart`：雙語國際化狀態機，預設依手機作業系統語言自動適配，並支援三段切換。
  - `mobile/lib/screens/`：四大 Screen（`lectures`, `targets`, `calendar`, `settings`），非同步操作後呼叫對話框均具備 `if (!mounted) return;` 生命週期保護。
  - `mobile/lib/backend/`：純 Dart 實現之亞大 API 客戶端（`asia_api.dart`，退選成功字串來自 `contract.g.dart`，TLS 驗證維持開啟並以 `mobile/lib/config/school_certs.dart` 的校方 AIA 中繼憑證作為額外信任錨點，嚴禁使用 `badCertificateCallback` 放行網域）、搶課狀態機（`grab_engine.dart`，手動快報快取未命中時自動重拉清單，`seq` 安全轉型）、民國年與素養輔助器（`calendar_helper.dart`，衝堂優先比對數值時間戳，結束時間缺失使用共用契約的 2 小時預設）。

## 改動時最容易出錯的地方

- **前端綁定為隱性**：`app.js` 以固定 `id` 與 `data-action` 屬性（單一 delegated click listener）操作 DOM。動到 `index.html` 的 id 或 `data-action` 必須同步更新 `app.js`，否則會靜默失效。
- **靜態檔案動態讀取**：`public/` 每次請求均自磁碟即時讀取並帶有 `Cache-Control: no-store`，修改前端檔案無須重啟伺服器；但**修改 `src/*` 後端程式碼必須重啟伺服器**。
- **TLS 憑證修復機制**：校方 IIS 只提供葉憑證、缺乏中繼 CA。Node 端由 `asia.mjs` 調度、`tls.mjs` 依據 AIA 規範抓取並驗證中繼憑證，成功後快取至 `data/extra-ca.pem`；Flutter 端則以 `school_certs.dart` 內已驗證的中繼憑證作為額外信任錨點，憑證輪替時兩端必須同步更新。**嚴禁透過「關閉 TLS 驗證」或 `badCertificateCallback` 放行網域的方式處理**。
- **退選加密識別碼與空字串回應防護**：
  - 校方 `POST api/cfd10/DeleteData?reseid=` 端點必須傳入校方生成的加密流水碼（格式為 `ID...`）。
  - 校方 DeleteData 端點成功時會回傳空字串 `""` 或 JSON 雙引號 `""`，**嚴禁只檢查 `.isEmpty`**，必須同時檢查 `text.isEmpty || text == '""'`，且在清冊尚未匹配到加密代碼前，**嚴禁在未成功呼叫校方 API 的情況下擅自將本機標記為退選成功**。
- **雙語拆字串陷阱**：嚴禁在 UI 或邏輯中依賴中文全形標點（如 `，` 或特定漢字）做 `split`，英文介面無該字符會引發溢出破版或文字截斷錯誤；所有文案必須透過 `i18n.dart` 或 `app.js` 的 I18N 字典提供獨立鍵。
- **衝堂檢驗必須具備時間戳**：進行衝堂檢測時，比較之事件物件必須優先具備 `startAt` 與 `endAt` 數值時間戳記，不可直接拿未經解析的原始資料物件比對；若缺少結束時間，依通識規範預設以開始時間補 2 小時。
- **MCP 2026-07-28 無狀態調用**：2026-07-28 規範下移除 protocol-level stateful session 與強制握手要求，客戶端可直接呼叫 `tools/list`、`tools/call` 或 `tasks/*`，伺服器必須支援自包含請求與標頭導向（`Mcp-Method` / `Mcp-Name`）。stdio 模式必須透過 `createStdioContext()` 載入引擎，`runStdioMcpServer()` 會拒絕沒有 engine 的 context；HTTP 模式與 stdio 共用 `createMcpContext()`，授權憑證一律以 `getToken` 動態取得。stdio 的自動登入在背景執行，登入完成前需要授權的工具會回報尚未登入。
- **手動報名與圖形驗證碼特性**：校方伺服器端報名端點（`api/Cfd10/Save`）根本未校驗圖形驗證碼，因此後端通訊無需任何 OCR，零秒延遲且無驗證碼錯誤風險。
- **排程依賴**：排程器由伺服器內部 10 秒計時器驅動；若伺服器未運行或電腦處於睡眠狀態，排程將不會觸發。
- **嚴格規範**：
  - 全專案所有代碼、日誌、介面、文件及提交紀錄中，**嚴格禁止使用任何表情符號（Emoji）**。
  - 所有註解、文件與使用者溝通一律使用**繁體中文（台灣用語）**。
  - **Git 提交訊息（Commit Messages）一律強制使用英文（English），包含標題與內文**，並遵循 Conventional Commits 規範（例如 `feat:`, `fix:`, `docs:`, `refactor:` 等）；不得使用中文或中英混合。

## 資料與版本控制

- 本專案已託管於 GitHub：`https://github.com/pinchiu/asia-lecture-grabber.git`。
- `data/` 資料夾已被 `.gitignore` 嚴格排除：
  - `data/config.json`：儲存學生學號、身分證末四碼及密碼（若勾選記住密碼），絕不得推送到遠端倉庫。
  - `data/state.json`：儲存本機搶課目標與暫存狀態。
- 校方欄位定義：
  - `canapp`：`Y`（可報名）、`F`（額滿待補）、`N1`（未開放）、`N2`（已截止）、`C`（現場報名）、`D`（其他）。
  - `bfree`：無障礙空間需求（`Y` 有需求、`N` 無需求；系統與報名請求預設一律為 `N`，支援使用者自訂切換與官方油猴秒填腳本自動點選）。
  - 四大基本素養旗標：`chk4`/`chk4_flg`（健康力）、`chk5`/`chk5_flg`（關懷力）、`chk6`/`chk6_flg`（創新力）、`chk7`/`chk7_flg`（卓越力）。
  - 畢業門檻：四大素養各須 >= 2 次，累積總場次須 >= 8 場。單場多素養時，各素養指標累計但總場次僅計算 1 場。

## 文件與維護

- `README.md`（繁體中文）與 `README.en.md`（英文）包含完整校方 API 逆向表格、畢業素養門檻、電腦網頁版與 Flutter 行動端建置手冊；對外介面或指令異動時請同步更新。
