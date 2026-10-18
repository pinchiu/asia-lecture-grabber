# AGENTS.md

亞洲大學「講座自動報名助手」：零依賴 Node.js（>=20）ESM 服務 + 無框架前端。
功能、API 逆向結果與引擎策略見 `README.md`；本檔只記錄容易踩雷、看檔案不易發現的事實。

## 指令

- 啟動：`npm start`（= `node src/server.mjs`），或雙擊 `start.bat`。
- 開發（後端檔變更自動重啟）：`npm run dev`（`node --watch`）。
- **沒有** lint / test / typecheck / 建置流程 —— 不要發明這些指令。
- 語法檢查：`node --check <file>`；功能驗證＝實際跑伺服器（打 JSON API）或用瀏覽器驅動。
- 服務位置 `http://127.0.0.1:5199`；可用 `PORT`、`HOST` 環境變數覆寫。
- **已有實例在跑時（常見）會 `EADDRINUSE`**，測試請換埠：`$env:PORT=5299; node src/server.mjs`。切勿直接砍掉使用者正在跑的 5199（可能持有登入 session）。

## 架構

- 後端只有一條線：`src/server.mjs`（HTTP、JSON API、靜態檔）→ `src/engine.mjs`（搶課狀態機）→ `src/asia.mjs`（校方 API）。
- 其餘模組：`src/schedule.mjs`（排程器）、`src/calendar.mjs`（已報名→行事曆事件）、`src/ai.mjs`（AI 代理／挑課）、`src/storage.mjs`（config/state 持久化）。
- 前端 `public/index.html` / `app.js` / `style.css` 是 vanilla JS，無框架、無建置；`app.js` 每 1.2 秒 poll `/api/state` 後整頁重繪。
- 前後端唯一的整合介面就是 JSON API，沒有共用型別或 schema。

## 改動時最容易出錯的地方

- **前端綁定是隱性的**：`app.js` 以固定 `id`、`data-action` 屬性（單一 delegated click listener）與表格欄數抓 DOM。動到 `index.html` 的 id／`data-action`／欄數就必須同步改 `app.js`，否則安靜地失效。改完請逐一比對「`app.js` 用到的 `#id` 都存在」且「每個 `data-action` 都有人處理」。
- **`public/` 每次請求都從磁碟讀取並帶 `Cache-Control: no-store`** → 改前端**不用**重啟；**改 `src/*` 一定要重啟伺服器**（跑著的實例仍是舊程式，新 API 會 404）。
- **TLS 特例**：校方只回葉憑證、缺中繼 CA。`asia.mjs` 會依 AIA 抓中繼憑證並快取到 `data/extra-ca.pem`。**不要用「關閉 TLS 驗證」來修**，那會破壞既有設計。
- **報名只能由本機引擎執行**：AI 與排程都不得直接呼叫報名 API；AI 只做挑選／解析。
- 排程器靠伺服器程序內的 10 秒 interval 觸發；程序沒跑、或電腦休眠，就不會自動搶。
- 註解與 UI 文案一律**繁體中文（台灣用語）**，維持現有風格。

## 資料與安全

- `data/config.json`（設定＋排程；勾「記住帳密」時含**明文帳密**）與 `data/state.json`（目標）都是執行後才產生的敏感檔。不要提交、同步或把內容列印出來。
- 校方欄位語意：`canapp` = `Y` 可報名／`F` 已額滿／`N1` 未開放／`N2` 已截止／`C` 現場／`D` 其他；`cnt_10` = 自己是否已報名（需 token 才有）。
- 日期時間欄位混雜：`rescsd`/`stime`/`etime` 是乾淨欄位，`resdat` 是含 `<br>` 的顯示字串（如 `2026/11/09<br>18:30-20:30`），排程相關的 `apptim` 常只有日期、無時刻。
- `listLectures()` 是公開端點（免 token）但走校網會慢（含 TLS 修復），不要在熱路徑重複呼叫。
- 本 repo **不是 git 工作區**（無 `.git`、無 `.gitignore`）；`data/` 的內容不要外流。

## 文件

- `README.md` 有完整 API 逆向表、引擎策略與功能說明；改動對外行為時請一併更新。
