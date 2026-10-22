# AGENTS.md

亞洲大學「講座自動報名助手與素養門檻追蹤系統」：零依賴 Node.js（>=20）ESM 服務 + 極簡包浩斯與磨砂毛玻璃無框架前端 + Flutter 原生行動端 App。
功能、API 逆向成果與引擎策略詳見 `README.md`；本檔記錄全專案之最新架構規範、設計約束與容易踩雷之核心事實。

## 指令

### 電腦網頁版與伺服器
- 啟動後端與介面：`npm start`（= `node src/server.mjs`），或雙擊 `start.bat`。
- 開發模式（後端檔變更自動重啟）：`npm run dev`（`node --watch`）。
- 執行自動化單元測試：`npm test`（基於 Node.js 內建 `node:test` 與 `node:assert`）。
- 桌面視窗喚起：`npm run desktop`（啟動後端並以 Chrome App 視窗模式或預設瀏覽器開啟）。
- 產生 PWA 圖示：`npm run icons`。
- 語法檢查：`node --check <file>`；功能驗證＝實際執行伺服器（打 JSON API）或以瀏覽器驅動。
- 服務位置預設 `http://127.0.0.1:5199`；可用 `PORT`、`HOST` 環境變數覆寫。
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
  - `src/server.mjs`：HTTP 服務、JSON API 路由、靜態資源路由、路徑穿透隔離、開機自動登入調度。
  - `src/engine.mjs`：搶課狀態機核心、爆速輪詢（0.8s）與禮貌間隔（2.5s）動態切換、請求最小間隔節流（600ms）、校方快取防空保護、手動快報與退選交易處理。
  - `src/asia.mjs`：校方 API 客戶端、AIA 中繼憑證自動修補鏈路、KeepAlive 連線池、IIS 錯誤頁面與 BOM 字符過濾。
- **輔助模組**：
  - `src/schedule.mjs`：排程器（開放瞬間提前 N 秒、特定時刻、每週時段三種模式，支援邊緣觸發與跨午夜運算，且不強制覆寫使用者之全域停用開關）。
  - `src/calendar.mjs`：已報名講座轉行事曆事件、四大素養標籤提取、民國年轉換與時間戳記排序。
  - `src/ai.mjs`：智慧選課代理（OpenAI 相容 API）與本機離線規則解析雙引擎，具備 100% 清單存在性防幻覺校驗。
  - `src/storage.mjs`：`config.json`（設定、排程、帳密、歷年素養）與 `state.json`（搶課目標）之本地持久化，內建 Promise 寫入串列佇列防範並行競爭。
- **前端介面（新版本視覺與互動架構）**：
  - `public/index.html` / `app.js` / `style.css`：原生 JavaScript（Vanilla JS），採**極簡包浩斯黑白灰（Bauhaus Less-is-more Monochrome）與蘋果液態磨砂毛玻璃（Apple Frosted Glass）美學**，具備圓角化分層導覽、液態滑動指示器與 iOS 原生級觸控拖曳手勢。
  - 內建進階特色：
    - **中英文雙語介面（i18n）**：支援繁體中文與英文即時切換，包含網頁版頂部按鈕切換與設定頁面語言偏好，持久化存於 localStorage。
    - **最速畢業選課路線推薦**：分析四大素養缺額與彼此衝堂關係，演算法自動推薦最少場次達標路線。
    - **iCal 行事曆匯出**：一鍵產生標準 `.ics` 檔，支援 Apple Calendar 與 Google 日曆即時同步。
    - **衝堂時間衝突預警**：自動交叉比對講座上課時段，標示衝突警告。
    - **全域快捷鍵系統**：支援 `1`~`4` 切換分頁、`/` 聚焦搜尋、`R` 快速重新整理。
    - **自動登入復原**：前端重整時若本機記住密碼，自動無感換證並復原身分。
  - `app.js` 每 1.2 秒向 `/api/state` 輪詢後重繪畫面，包含四大基本素養（健康力、關懷力、創新力、卓越力）門檻進度條與歷年累計補登計算。
- **Flutter 行動端（路線 B：終極 Native 化，純 Cupertino 100% 原生架構）**：
  - **核心哲學**：徹底淘汰 WebView 包裝與中介代理，全介面直接以 Apple 官方標準設計語言 `flutter/cupertino.dart` 建構，具備 iOS 物理彈簧阻尼（BouncingScrollPhysics）、CupertinoSliverRefreshControl 下拉齒輪回彈、CupertinoTabBar 底部貼合（精準適配 safe-area）、零縮放、零左右晃動，達到 120Hz/60Hz GPU 直接繪製之原生質感。
  - `mobile/lib/main.dart`：App 根元件 `CupertinoApp`、曜石黑深色主題（`CupertinoThemeData.dark`）、`CupertinoTabScaffold` 根導覽控制器，以及主畫面底部在線更新提示與 App 內 APK 自動安裝管線。
  - `mobile/lib/config/i18n.dart`：雙語國際化狀態機（`I18n`），支援預設依手機作業系統語言（System Language）自動適配是否為英文，並支援使用者在系統設定中手動切換（跟隨系統 / 繁體中文 / English 三段控制器）與即時持久化。
  - `mobile/lib/screens/lectures_screen.dart`：講座情報 Screen（雙語大標題導覽列、四大素養畢業門檻即時儀表板、CupertinoSearchTextField 搜尋、素養過濾晶片、卡片化講座清冊、一鍵秒報與加入排程）。
  - `mobile/lib/screens/targets_screen.dart`：搶課排程 Screen（狀態機監控儀表板、800ms 突發輪詢指示燈、輪詢/搶課計數器、目標清單佇列與清理）。
  - `mobile/lib/screens/calendar_screen.dart`：個人行程 Screen（已報名講座清冊、衝堂交叉比對預警、二段式確認彈窗、校方加密代碼退選）。
  - `mobile/lib/screens/settings_screen.dart`：系統設定 Screen（中英文語言切換器、校園入口帳密、身分證末四碼驗證、記住帳密自動登入開關、歷年四力補登手動輸入、在線版本檢查與 App 內直接安裝更新、引擎即時執行日誌 Console）。
  - `mobile/lib/backend/`：純 Dart 實現之亞大 API 逆向客戶端（`asia_api.dart`）、搶課狀態機引擎（`grab_engine.dart`）、民國年與素養輔助器（`calendar_helper.dart`），手機端原生獨立自足，完全不依賴電腦伺服器。
  - `mobile/android/` 與 `mobile/ios/`：原生工程配置，已設定 `INTERNET` 權限。

## 改動時最容易出錯的地方

- **前端綁定為隱性**：`app.js` 以固定 `id` 與 `data-action` 屬性（單一 delegated click listener）操作 DOM。動到 `index.html` 的 id 或 `data-action` 必須同步更新 `app.js`，否則會靜默失效。
- **靜態檔案動態讀取**：`public/` 每次請求均自磁碟即時讀取並帶有 `Cache-Control: no-store`，修改前端檔案無須重啟伺服器；但**修改 `src/*` 後端程式碼必須重啟伺服器**。
- **TLS 憑證修復機制**：校方 IIS 只提供葉憑證、缺乏中繼 CA。`asia.mjs` 依據 AIA 規範自動抓取中繼憑證並快取至 `data/extra-ca.pem`。**嚴禁透過「關閉 TLS 驗證」方式處理**。
- **退選加密識別碼防護**：校方 `POST api/cfd10/DeleteData?reseid=` 端點必須傳入校方生成的加密流水碼（格式為 `ID...`）。在清冊尚未匹配到加密代碼前，**嚴禁在未成功呼叫校方 API 的情況下擅自將本機標記為退選成功**，以防學生面臨實體曠課處分。
- **衝堂檢驗必須具備時間戳**：進行衝堂檢測時，比較之事件物件必須具備 `startAt` 與 `endAt` 數值時間戳記，不可直接拿未經解析的原始資料物件比對。
- **手動報名與圖形驗證碼特性**：本系統完全支援「不靠 AI 手動搶課」（在網頁清單直接點「手動報名」或於輸入列輸入課程代號即送出）。校方伺服器端報名端點（`api/Cfd10/Save`）根本未校驗圖形驗證碼，因此後端通訊無需任何 OCR，零秒延遲且無驗證碼錯誤風險。
- **排程依賴**：排程器由伺服器內部 10 秒計時器驅動；若伺服器未運行或電腦處於睡眠狀態，排程將不會觸發。
- **嚴格規範**：
  - 全專案所有代碼、日誌、介面、文件及提交紀錄中，**嚴格禁止使用任何表情符號（Emoji）**。
  - 所有註解、文件與使用者溝通一律使用**繁體中文（台灣用語）**。

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

- `README.md` 包含完整校方 API 逆向表格、畢業素養門檻、電腦網頁版與 Flutter 行動端建置手冊；對外介面或指令異動時請同步更新。
