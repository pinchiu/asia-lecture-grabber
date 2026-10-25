# 亞洲大學講座自動報名助手與素養門檻追蹤系統

[English Documentation](README.en.md) | [繁體中文文件](README.md)

亞洲大學「講座暨通識課程線上報名系統」（`https://webap.asia.edu.tw/cfd2020/`）之本機自動搶課工具、通識畢業門檻追蹤儀表板，以及基於 Model Context Protocol (MCP 2026-07-28 最新無狀態架構) 的 AI 代理調用模組。

> 專為亞洲大學學生設計的個人輔助工具：追蹤通識講座四大基本素養進度，監控名額開放與退選釋出瞬間自動報名。
> **請遵守校方使用規範，僅供個人合法學術與修課輔助使用。**

---

## 核心功能與特色

### 1. 通識講座四大基本素養畢業門檻追蹤
依據亞洲大學通識教育畢業規定，學生在學期間必須參與學校認可之通識講座，累積至少 8 場次，且須平均符合四大素養（四力）：
- **健康力 (Health)**：至少 2 次
- **關懷力 (Care)**：至少 2 次
- **創新力 (Innovation)**：至少 2 次
- **卓越力 (Excellence)**：至少 2 次

系統提供即時門檻計算儀表板：
- **自動加總**：即時讀取學生已報名／已選場次，依素養類別自動歸納。
- **歷年補登**：支援手動輸入前幾學期已取得之場次，自動與當期報名加總，且面板展開編輯時具備輸入鎖定保護，防止輪詢重設。
- **單場多素養精確計算**：單場講座若同時標註多項素養，各素養指標分別累計 1 次，但總場次精準計算為 1 場。
- **最速畢業路線推薦**：內建智慧演算法，自動比對各場次素養涵蓋度與彼此時間衝堂關係，計算最少場次達標推薦清單。
- **缺額專屬篩選**：支援「只看我缺少的素養」一鍵過濾，精準鎖定尚未達標之項目。

### 2. 即時搶課狀態機引擎
- **即時監控**：自動追蹤「可報名 / 已額滿 / 未開放 / 已截止 / 現場報名 / 其他方式」狀態。
- **候補搶票**：額滿（F）場次持續守候，一旦有其他同學退選釋出名額，瞬間自動送出報名。
- **爆速輪詢**：報名開放瞬間或名額釋出瞬間，自動切換至高速輪詢模式（預設 0.8 秒）。
- **禮貌退避**：平時維持 2.5 秒禮貌間隔，連線異常時自動指數退避，不對校方伺服器造成負擔。
- **自動身份驗證**：登入時以身分證字號末四碼換取校方報名所需憑證，全程自動化。
- **TLS 憑證鏈自動修復**：校方 IIS 伺服器缺少中繼 CA，後端依據 AIA 規範自動下載並驗證中繼憑證；Flutter 端以已驗證的中繼憑證作為額外信任錨點，兩端皆維持完整 TLS 驗證，嚴禁關閉驗證或放行任意網域。
- **定時自動啟動**：排程器支援三種模式（開放前 N 秒、特定日期時間一次性、每週重複時段），具備邊緣觸發與跨午夜處理，且不覆寫使用者的全域停用開關。排程由伺服器內部 10 秒計時器驅動，服務停止或電腦睡眠時不會觸發。

### 3. 多端支援與雙語國際化：Flutter 原生 App、PWA 行動版與電腦網頁版
- **中英文介面即時切換（i18n）**：網頁版與 Flutter 行動端全面支援繁體中文與英文（English）雙語切換。行動端預設跟隨作業系統語言，並支援手動切換與即時持久化。
- **Flutter 原生 App (`mobile/`)**：採用 Google Flutter 純 Cupertino 原生架構開發，具備 iOS 原生物理彈簧阻尼、毛玻璃導覽列、在線更新檢查與 App 內 APK 一鍵下載安裝升級。
- **手機 App 版本 (PWA)**：完整支援 Progressive Web App，可直接透過瀏覽器「加入主畫面」或「安裝應用程式」，具備獨立視窗、離線快取（Network-First Service Worker）與觸控優化卡片視圖。
- **電腦網頁版**：支援快速啟動（`start.bat` / `start.sh`），自動以獨立 App 視窗或預設瀏覽器開啟儀表板。
- **個人行事曆與衝堂防護**：自動解析民國年與上課時段，一鍵匯出標準 `.ics` 檔；嚴格以開始與結束時間戳比對各場次衝突。

### 4. AI 代理調用模組 (MCP 2026-07-28 最新無狀態架構規範)
- **Model Context Protocol (MCP)**：全面遵循 2026-07-28 最新標準，支援無狀態核心、HTTP Header 路由與 Tasks 原語。
- **支援兩種接入模式**：
  - 本機 stdio 管道（供 Claude Desktop、Cursor、Antigravity 調用）
  - 本機 HTTP 端點（`POST /api/mcp` 與 `GET /api/mcp`）
- **標準 Tasks 原語**：將背景搶課狀態機封裝為標準 Task（`tasks/list`, `tasks/get`, `tasks/cancel`），支援 AI 代理即時追蹤進度與控制任務。
- **專屬 Agent Skill**：位於 `skills/asia-lecture-assistant/SKILL.md`，提供完整工作流指引與 100% 清單存在性防幻覺護欄。

---

## 快速開始

### 系統需求
- Node.js 20 或以上版本（本系統採 ESM 原生開發，零外部第三方依賴）。
- Git（用於複製原始碼倉庫）。

### 下載與安裝

開啟終端機執行：
```bash
git clone https://github.com/pinchiu/asia-lecture-grabber.git
cd asia-lecture-grabber
```

### 啟動指令

#### Windows 使用者
進入專案資料夾後，直接雙擊 `start.bat`，或在命令提示字元／PowerShell 執行：
```bat
npm start
```

#### macOS / Linux 使用者
在終端機中執行：
```bash
chmod +x start.sh
./start.sh
```
或直接執行：
```bash
npm start
```

啟動後服務預設運行於 `http://127.0.0.1:5199`，且只綁定 loopback，瀏覽器會自動開啟。若需要手機或同網段裝置連線，必須明確設定 `HOST=0.0.0.0`，並自行評估區網暴露風險。

### 執行單元測試
專案包含 101 項基於 Node.js 內建測試模組的自動化測試：
```bash
npm test
```

---

## 使用步驟說明

1. **帳號與身份驗證**：
   - 於設定區塊輸入學號、密碼及身分證字號末四碼，點擊「登入校方系統並驗證身份」。
   - 身分證字號末四碼為校方 API 報名必要之驗證依據。
2. **通識素養門檻檢視**：
   - 儀表板頂端顯示四大素養目前進度與總場次。
   - 若過去學期已有已完成場次，點擊「歷年累計補登」並輸入過去已取得場次，系統即刻重新計算門檻。
3. **挑選講座並加入目標**：
   - 瀏覽「講座情報大廳」，可依「基本素養」、「報名狀態」或關鍵字進行過濾。
   - 勾選「只看我缺少的素養」可快速篩選出有助於達成畢業門檻的場次。
   - 點擊「＋加入目標」加入即時監控佇列。
4. **啟動搶課監控**：
   - 點擊頂端「開始搶課」，系統即進入監控輪詢狀態。
   - 搶到講座後會發送桌面通知與提示音，並在「我的目標」與「我的行事曆」即時顯示。
5. **純手動報名（完全不經 AI）與校方圖形驗證碼機制**：
   - **完全不靠 AI 的手動搶課**：
     - 針對「可報名」講座，直接點擊清單右側「手動報名」綠色按鈕，由本機直接向校方伺服器送出報名，全程不需 AI 參與。
     - 支援「手動快報輸入列」：直接輸入課程代號（如 `1151074`），一鍵秒速直報。
     - 針對「已額滿」講座點擊「＋候補搶票」，本機引擎持續守候名額釋出，純本地毫秒級搶票。
   - **4 位數圖形驗證碼（數字辨識）機制**：
     - 校方官方網頁上的 4 位數驗證碼係由前端 Vue.js 本地隨機產生並繪製於 Canvas，主要用途為前端介面防呆。
     - 校方後端核心端點（`POST api/Cfd10/Save`）在接收報名請求時，**完全不檢查亦不接收圖形驗證碼欄位**。
     - 本專案工具直接與後端 API 通訊，具備 0 毫秒辨識延遲、100% 避開驗證碼錯誤。
     - 若需要在校方官方網頁操作，專案亦提供 `scripts/asia-captcha-autofill.user.js` 油猴腳本，自動偵測並秒填驗證碼。
6. **安全退選機制**：
   - 退選已報名場次時，校方端點 `POST api/cfd10/DeleteData?reseid=` 必須傳入校方生成的加密流水代號（格式為 `ID...`）。
   - 系統自動解析並傳入加密代碼，並在確認校方 API 成功（回傳空字串 `""` 或二引號）後才更新狀態，嚴禁前端偽造成功，防止學生因曠課受罰。

---

## AI Agent 調用模組 (MCP 2026-07-28 最新規格與 Agent Skills)

本專案原生支援 2026-07-28 Model Context Protocol (MCP) 無狀態規範，提供標準 JSON-RPC 2.0 介面與專用 Agent Skill，供 Claude Desktop、Cursor、Antigravity 等現代 AI 終端代理直接調用：

### 1. 調用渠道
- **啟動本機 MCP stdio 伺服器**：
  ```bash
  npm run mcp
  ```
  或直接以 Node.js 執行：
  ```bash
  node src/mcp.mjs
  ```
  stdio 進入點會載入 `data/config.json` 與 `data/state.json`、建立本機搶課引擎；若已記住帳密會於背景自動登入。登入完成前，需要授權的工具會回報尚未登入，完成後 8 項工具皆可運作。
- **本機 HTTP 端點**：
  - 探索端點：`GET /api/mcp`（回傳工具清冊與快取中繼標頭）
  - 調用端點：`POST /api/mcp`（支援 `Mcp-Method` 與 `Mcp-Name` HTTP 標頭導向）
  - 安全限制：所有變更狀態的 API（含 `/api/mcp`、報名、退選與設定）僅接受 loopback／同源區網 Origin 與 `Content-Type: application/json`；跨站瀏覽器請求會回傳 `403`，非 JSON 請求會回傳 `415`。伺服器預設只綁定 `127.0.0.1`。

### 2. 核心工具目錄 (Tool Catalog)
| 工具名稱 | 功能職責 | 關鍵參數 |
| :--- | :--- | :--- |
| `asia_list_lectures` | 查詢當期講座清冊，支援多維度篩選 | `keyword`, `literacy`, `status`, `refresh`, `limit` |
| `asia_get_lecture` | 查詢單場講座詳細資料與素養規格 | `eid01`（必填，如 `L01`） |
| `asia_check_graduation` | 分析四大素養畢業門檻達成率與缺額 | 無 |
| `asia_register_lecture` | 秒速直報指定講座（零延遲） | `eid01`（必填）, `bfree`（無障礙空間需求 Y/N） |
| `asia_cancel_lecture` | 退選已報名講座（自動對齊校方加密代碼） | `eid01`（必填） |
| `asia_get_calendar` | 取得個人行程清冊並交叉檢驗時段重疊衝堂 | 無 |
| `asia_manage_targets` | 操作搶課引擎目標佇列（加入、移除、清空） | `action`（add/remove/clear_finished/list）, `eid01` |
| `asia_get_engine_status` | 取得即時輪詢狀態、計數器與最近日誌 | `logLimit`（預設 20） |

### 3. Tasks 標準擴展原語 (Tasks Lifecycle)
- `tasks/list`：列出所有執行中之背景任務（如搶課引擎輪詢器 `grab-engine-poller`）。
- `tasks/get`：依 `taskId` 查詢任務執行進度、輪詢統計與已搶到場次。
- `tasks/cancel`：安全停止搶課狀態機運作。

### 4. 專屬 Agent Skill
技能規格檔位於 [`skills/asia-lecture-assistant/SKILL.md`](skills/asia-lecture-assistant/SKILL.md)，包含完整 YAML frontmatter（`version: 2.0.0`、`protocol: mcp-2026-07-28`）、決策流程與 100% 清單存在性防幻覺防護規範。

---

## 手機 App 版本：Flutter 原生打包與安裝

專案提供完整的 Flutter 原生行動端工程（位於 `mobile/` 目錄），支援編譯為 Android 原生 APK 安裝檔或 iOS 應用程式：

### 1. 執行環境需求
- 已安裝 Flutter SDK（版本 >= 3.10.0）
- Android Studio（含 Android SDK 與 Platform-Tools）或 Xcode（iOS）

### 2. 本地執行與除錯
Flutter App 內建原生校方 API 客戶端與搶課引擎，會直接連線校方系統，**不需啟動電腦端的 Node.js 伺服器**。

由專案根目錄執行：
```bash
npm run mobile:flutter:run
```
或直接進入行動端目錄：
```bash
cd mobile
flutter pub get
flutter run
```

### 3. 打包 Android 原生 APK 安裝檔
執行以下指令直接建置可安裝於 Android 手機的 APK 檔案：
```bash
npm run mobile:flutter:build:apk
```
或手動執行：
```bash
cd mobile
flutter build apk --release
```
建置完成後之 APK 檔案路徑位於：
`mobile/build/app/outputs/flutter-apk/app-release.apk`
將該 APK 傳送至 Android 手機即可直接安裝使用。

### 4. 行動端登入與設定
開啟 Flutter App 的「系統設定」分頁，輸入校園入口帳號、密碼與身分證字號末四碼，即可由手機直接登入校方系統。設定頁亦提供語言偏好、記住帳密、歷年素養補登、版本更新檢查與 App 內直接安裝更新；無須設定電腦 IP，也不依賴電腦保持開機。

---

## 免安裝行動版本：瀏覽器 PWA 加入主畫面

除了 Flutter 原生 App 外，本系統亦具備標準 PWA 規格，可免安裝直接透過瀏覽器開啟：

1. **同網域連線**：
   - 確保手機與運行本程式的電腦處於同一個 Wi-Fi 區域網路。
   - 查詢電腦的區域網路 IP（例如 `192.168.1.100`），並以 `$env:HOST="0.0.0.0"; npm start` 啟動。
2. **iPhone / iPad (Safari)**：
   - 以 Safari 開啟網址，點擊瀏覽器下方「分享」按鈕，選擇「加入主畫面」。
3. **Android (Chrome / Edge)**：
   - 開啟網址後，點擊網址列右方或畫面上的「安裝 App」按鈕，即可將 App 捷徑新增至應用程式抽屜與桌面。

---

## 技術架構與校方 API 逆向結果

校方系統為 Vue SPA（`http-vue-loader`），API 端點基底為 `https://webap.asia.edu.tw/cfd2020/`：

| 功能 | HTTP 方法與路徑 | 說明與欄位 |
| --- | --- | --- |
| 登入認證 | `POST api/Login/Auth` | 傳送 `{username, password}`，取得 Bearer Token |
| 講座清單 | `POST api/Cfd01/Load?op=X01F00&eid01=` | 請求內容 `{op, sdate, edate, eid01}`；公開端點，帶 Token 可取得個人 `cnt_10`（是否已報名） |
| 講座明細 | `GET api/Cfd01/GetRes?eid01=` | 包含基本素養、主辦單位、UCAN、SDGs 等詳細資料 |
| 身分驗證 | `POST api/PersonInfo/GetPInfo` | 傳送 `{p_no, p_id, p_type}`（`p_id` 為身分證末四碼） |
| 送出報名 | `POST api/Cfd10/Save` | 搶課核心端點，需帶 Token 與 `std_info` 物件（含 `bfree` 無障礙需求，預設 `N`） |
| 取消退選 | `POST api/cfd10/DeleteData?reseid=` | 退選已報名場次（需傳入校方加密流水號） |
| 已選查詢 | `POST api/Cfd01/Load_del?op=X01F00DEL` | 查詢已報名與已退選紀錄 |

### 基本素養欄位對照
校方資料庫中透過 `chk1` 至 `chk8` 旗標紀錄素養屬性：
- `chk4 = 'Y'`：**健康力 (Health)**
- `chk5 = 'Y'`：**關懷力 (Care)**
- `chk6 = 'Y'`：**創新力 (Innovation)**
- `chk7 = 'Y'`：**卓越力 (Excellence)**

### 狀態碼對照
- `canapp = 'Y'`：可報名
- `canapp = 'F'`：已額滿（持續輪詢等待名額釋出）
- `canapp = 'N1'`：未開放
- `canapp = 'N2'`：已截止
- `canapp = 'C'`：現場報名
- `canapp = 'D'`：其他外部報名管道

---

## 專案目錄結構

```
asia-lecture-grabber/
├ package.json                   專案配置、啟動腳本與 MCP CLI 指令
├ start.bat                      Windows 啟動捷徑
├ start.sh                       macOS / Linux 啟動腳本
├ AGENTS.md                      架構規範與開發注意事項
├ README.md                      繁體中文使用手冊與技術文件
├ README.en.md                   英文使用手冊與技術文件
├ skills/
│  └ asia-lecture-assistant/     AI 代理專用技能規格目錄
│     └ SKILL.md                 遵循 MCP 2026-07-28 規範之 Agent Skill
├ src/
│  ├ asia.mjs                    校方 API 客戶端（含 AIA 中繼憑證自動修補調度與連線池）
│  ├ tls.mjs                     TLS 憑證鏈輔助（AIA 提取、中繼憑證下載與驗證）
│  ├ contract.mjs                Node 與 Flutter 共用的校方行為契約
│  ├ runtime.mjs                 共用執行期組裝（引擎、自動登入、狀態持久化）
│  ├ engine.mjs                  搶課核心引擎（狀態機、突發輪詢、退避機制）
│  ├ mcp.mjs                     Model Context Protocol 2026-07-28 無狀態伺服器（stdio 與 HTTP）
│  ├ schedule.mjs                定時排程器（開放前 N 秒、特定時刻、每週時段）
│  ├ calendar.mjs                行事曆轉換、四大素養提取與衝堂檢驗
│  ├ ai.mjs                      智慧選課代理與本機離線規則解析器
│  ├ storage.mjs                 組態與狀態本地持久化（寫入佇列防競爭）
│  └ server.mjs                  HTTP 伺服器、JSON API 與 /api/mcp 端點
├ test/
│  ├ asia.test.mjs               校方通訊錯誤、憑證鏈重試與 API 業務測試
│  ├ mcp.test.mjs                MCP 2026-07-28 無狀態協定與 Tasks 整合測試
│  ├ contract.test.mjs           Node／Flutter 契約一致性與憑證固定測試
│  ├ calendar.test.mjs           時間戳解析、民國年轉換與衝堂檢驗測試
│  ├ engine.test.mjs             狀態機輪詢、手動快報與退選邏輯測試
│  ├ schedule.test.mjs           定時排程三模式與全域開關約束測試
│  ├ server.test.mjs             HTTP 路由、靜態穿透防護與 API 整合測試
│  ├ storage.test.mjs            持久化、數值約束與並行寫入競爭測試
│  └ ai.test.mjs                 智慧解析、Markdown 提詞與防幻覺測試
├ public/
│  ├ index.html                  主介面（極簡包浩斯與毛玻璃視覺設計）
│  ├ style.css                   黑白灰與磨砂毛玻璃高質感樣式表
│  ├ app.js                      前端邏輯控制（Vanilla JS，具備 i18n 與簽名快取）
│  ├ manifest.webmanifest        PWA 應用程式清單
│  ├ sw.js                       Service Worker（Network-First 現代離線快取）
│  ├ icon.svg                    向量應用程式圖示
│  ├ icon-192.png                PWA 192x192 圖示
│  └ icon-512.png                PWA 512x512 圖示
├ mobile/
│  ├ pubspec.yaml                Flutter 純 Cupertino 原生專案相依配置
│  ├ README.md                   Flutter 原生打包指南
│  ├ assets/                     行動端圖示資產
│  ├ lib/                        Flutter Dart 原始碼
│  │  ├ main.dart                CupertinoApp 根元件與在線更新管線
│  │  ├ config/i18n.dart         雙語國際化狀態機（系統語言自動適配）
│  │  ├ config/contract.g.dart   由 src/contract.mjs 產生的共用契約常數
│  │  ├ config/school_certs.dart 校方 AIA 中繼憑證（TLS 信任錨點）
│  │  ├ backend/                 純 Dart 校方 API 客戶端與狀態機引擎
│  │  └ screens/                 四大原生 Screen（講座情報、搶課排程、個人行程、系統設定）
│  ├ android/                    Android 原生建置專案（含權限與 Gradle 設定）
│  └ ios/                        iOS 原生建置專案（含 Info.plist 與權限）
└ scripts/
   ├ asia-captcha-autofill.user.js 官方網頁驗證碼秒填與無障礙需求自動化腳本
   ├ desktop-launcher.mjs        桌面視窗喚起與孤兒進程清理腳本
   ├ generate-contract.mjs       產生 Flutter 共用契約常數
   └ generate-icons.mjs          原生 PNG 圖示生成器
```

---

## 資料安全性與個人隱私說明

- 電腦網頁版由本機伺服器與校方系統通訊；Flutter 行動端則由手機直接連線校方系統，皆未架設外部中繼伺服器。
- 電腦網頁版之學生帳號、密碼及身分證末四碼儲存於本地 `data/config.json`（若未勾選記住密碼則僅暫存於記憶體中）；Flutter 行動端則依「記住帳密」設定保存在行動裝置本機。
- 電腦網頁版的 `data/` 資料夾已被 `.gitignore` 排除，不應上傳至 GitHub 或對外分享。
- 請妥善保管個人電腦、行動裝置與組態檔，切勿將包含帳密之 `config.json` 或除錯資料交付他人。

---

## 開發者與版本資訊

- 原始碼倉庫：[https://github.com/pinchiu/asia-lecture-grabber.git](https://github.com/pinchiu/asia-lecture-grabber.git)
- 版本號：1.4.1
- 授權類型：個人修課輔助使用
