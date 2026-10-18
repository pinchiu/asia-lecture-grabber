# AGENTS.md

亞洲大學「講座自動報名助手與素養門檻追蹤系統」：零依賴 Node.js（>=20）ESM 服務 + 無框架前端 + Flutter 原生行動端 App。
功能、API 逆向結果與引擎策略見 `README.md`；本檔只記錄容易踩雷、看檔案不易發現的事實與架構規範。

## 指令

### 電腦網頁版與伺服器
- 啟動後端與介面：`npm start`（= `node src/server.mjs`），或雙擊 `start.bat`。
- 開發模式（後端檔變更自動重啟）：`npm run dev`（`node --watch`）。
- 桌面視窗喚起：`npm run desktop`（啟動後端並以 Chrome App 視窗模式或預設瀏覽器開啟）。
- 產生 PWA 圖示：`npm run icons`。
- 語法檢查：`node --check <file>`；功能驗證＝實際執行伺服器（打 JSON API）或以瀏覽器驅動。
- 服務位置預設 `http://127.0.0.1:5199`；可用 `PORT`、`HOST` 環境變數覆寫。
- **已有實例在跑時（常見）會 `EADDRINUSE`**，測試請換埠：`$env:PORT=5299; node src/server.mjs`。切勿直接強制關閉使用者正在執行的 5199 實例（可能持有登入中的 session）。

### Flutter 原生行動端 (`mobile/`)
- 安裝相依：`cd mobile && flutter pub get`
- 執行行動端 App：`npm run mobile:flutter:run`（或進入 `mobile/` 執行 `flutter run`）。
- 打包 Android 原生 APK：`npm run mobile:flutter:build:apk`（產出於 `mobile/build/app/outputs/flutter-apk/app-release.apk`）。
- 打包 Android App Bundle：`npm run mobile:flutter:build:bundle`。
- 檢查 Flutter 環境：`npm run mobile:flutter:doctor`。

## 架構

- **後端單一鏈路**：`src/server.mjs`（HTTP、JSON API、靜態資源路由、路徑穿透隔離）→ `src/engine.mjs`（搶課狀態機、爆速與退避輪詢、快取防空保護）→ `src/asia.mjs`（校方 API 客戶端、AIA 中繼憑證修補、IIS 錯誤頁面防護）。
- **輔助模組**：
  - `src/schedule.mjs`：排程器（開放前 N 秒、特定時刻、每週時段三種模式）。
  - `src/calendar.mjs`：已報名講座轉行事曆事件、四大素養標籤提取（`chk4`..`chk7` 與 `chk4_flg`..`chk7_flg` 相容）與民國年轉換。
  - `src/ai.mjs`：AI 挑課代理（OpenAI 相容 API）與本機素養規則解析引擎。
  - `src/storage.mjs`：`config.json`（設定、排程、帳密、歷年素養）與 `state.json`（搶課目標）之本地持久化。
- **前端介面**：
  - `public/index.html` / `app.js` / `style.css`：原生 JavaScript（Vanilla JS），曜石黑 Neo-Brutalist 美學，無框架、無打包建置。
  - `app.js` 每 1.2 秒向 `/api/state` 輪詢後重繪畫面，包含四大基本素養（四力）門檻進度條與歷年累計補登計算。
- **Flutter 行動端**：
  - `mobile/lib/main.dart`：入口點與黑底終端風格主題配置。
  - `mobile/lib/screens/webview_screen.dart`：基於 `webview_flutter` 核心，具備硬體加速、連線失敗重試畫面與下拉重新整理。
  - `mobile/lib/screens/settings_modal.dart`：伺服器位址動態切換面板，並透過 `shared_preferences` 自動記憶主機 IP。
  - `mobile/android/` 與 `mobile/ios/`：原生工程配置，已設定 `INTERNET` 權限與 `usesCleartextTraffic="true"`（支援 Wi-Fi 區網 HTTP 呼叫）。

## 改動時最容易出錯的地方

- **前端綁定為隱性**：`app.js` 以固定 `id` 與 `data-action` 屬性（單一 delegated click listener）操作 DOM。動到 `index.html` 的 id 或 `data-action` 必須同步更新 `app.js`，否則會靜默失效。
- **靜態檔案動態讀取**：`public/` 每次請求均自磁碟即時讀取並帶有 `Cache-Control: no-store`，修改前端檔案無須重啟伺服器；但**修改 `src/*` 後端程式碼必須重啟伺服器**。
- **TLS 憑證修復機制**：校方 IIS 只提供葉憑證、缺乏中繼 CA。`asia.mjs` 依據 AIA 規範自動抓取中繼憑證並快取至 `data/extra-ca.pem`。**嚴禁透過「關閉 TLS 驗證」方式處理**。
- **報名權限安全封閉**：AI 模組與排程模組均無權限直接發起報名請求；報名動作必須由本機引擎（`engine.mjs`）或使用者主動點擊觸發。
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
  - 四大基本素養旗標：`chk4`/`chk4_flg`（健康力）、`chk5`/`chk5_flg`（關懷力）、`chk6`/`chk6_flg`（創新力）、`chk7`/`chk7_flg`（卓越力）。
  - 畢業門檻：四大素養各須 >= 2 次，累積總場次須 >= 8 場。單場多素養時，各素養指標累計但總場次僅計算 1 場。

## 文件與維護

- `README.md` 包含完整校方 API 逆向表格、畢業素養門檻、電腦網頁版與 Flutter 行動端建置手冊；對外介面或指令異動時請同步更新。
