# 亞洲大學講座自動報名助手與素養門檻追蹤系統

亞洲大學「講座暨通識課程線上報名系統」（`https://webap.asia.edu.tw/cfd2020/`）之本機自動搶課工具與通識畢業門檻追蹤儀表板。

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
- **歷年補登**：支援手動輸入前幾學期已取得之場次，自動與當期報名加總。
- **素養標籤**：清單中每一場講座皆清楚標示所屬之四大基本素養標籤與顏色。
- **缺額專屬篩選**：支援「只看我缺少的素養」一鍵過濾，精準鎖定尚未達標之項目。

### 2. 即時搶課引擎
- **即時監控**：自動追蹤「可報名 / 已額滿 / 未開放 / 已截止 / 現場報名 / 其他方式」狀態。
- **候補搶票**：額滿（F）場次持續守候，一旦有其他同學退選釋出名額，瞬間自動送出報名。
- **爆速輪詢**：報名開放瞬間或名額釋出瞬間，自動切換至高速輪詢模式（預設 0.8 秒）。
- **禮貌退避**：平時維持 2.5 秒禮貌間隔，連線異常時自動指數退避，不對校方伺服器造成負擔。
- **自動身份驗證**：登入時以身分證字號末四碼換取校方報名所需憑證，全程自動化。

### 3. 多端支援：Flutter 原生 App、PWA 行動版與電腦網頁版
- **Flutter 原生 App (`mobile/`)**：採用 Google Flutter 跨平台原生框架開發，內建伺服器位址快速切換、斷線自動重試與硬體加速 WebView，可直接編譯為 Android 原生 APK 安裝檔或 iOS App。
- **手機 App 版本 (PWA)**：完整支援 Progressive Web App，可直接透過瀏覽器「加入主畫面」或「安裝應用程式」，具備獨立視窗、離線快取（Service Worker）與觸控優化卡片視圖。
- **電腦網頁版**：支援快速啟動（`start.bat` / `start.sh`），自動以獨立 App 視窗或預設瀏覽器開啟儀表板。

### 4. 智慧排程與 AI 挑課代理
- **三種排程模式**：
  - 開放瞬間（依報名開放時間自動提前 N 秒啟動）
  - 指定日期時間（單次執行）
  - 每週固定時段（每週循環自啟與自動停止）
- **AI / 本機素養挑課**：以自然語言輸入需求（如「我想補 2 場創新力跟 1 場健康力講座」），系統可由 OpenAI 相容模型或本機規則解析挑課與排程，經確認後才加入監控。

---

## 快速開始

### 系統需求
- Node.js 20 或以上版本（本系統採 ESM 原生開發，零外部第三方依賴）。
- Git（用於複製原始碼倉庫）。

### 下載與安裝

開啟終端機（CMD / PowerShell / 終端機）執行：
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

啟動後服務預設運行於 `http://127.0.0.1:5199`，瀏覽器會自動開啟。

---

## 使用步驟說明

1. **帳號與身份驗證**：
   - 於側邊欄輸入學號、密碼及身分證字號末四碼，點擊「登入校方系統並驗證身份」。
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

---

## 手機 App 版本：Flutter 原生打包與安裝

專案提供完整的 Flutter 原生行動端工程（位於 `mobile/` 目錄），支援編譯為 Android 原生 APK 安裝檔或 iOS 應用程式：

### 1. 執行環境需求
- 已安裝 Flutter SDK（版本 >= 3.10.0）
- Android Studio（含 Android SDK 與 Platform-Tools）或 Xcode（iOS）

### 2. 本地執行與除錯
```bash
# 確保根目錄 Node.js 服務已啟動：npm start
# 接著執行 Flutter App
npm run mobile:flutter:run
```
或直接進入目錄：
```bash
cd mobile
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

### 4. 伺服器連線設定
開啟 Flutter App 後，App 預設連線至 `http://10.0.2.2:5199`（Android 模擬器專用位址）。
若在實體手機上使用：
1. 確保手機與電腦連線至相同的 Wi-Fi 區域網路。
2. 點擊 App 頂端右上角「設定」按鈕。
3. 輸入電腦之區域網路 IP（例如 `http://192.168.1.100:5199`），點擊「儲存並重新連線」即可。

---

## 免安裝行動版本：瀏覽器 PWA 加入主畫面

除了 Flutter 原生 App 外，本系統亦具備標準 PWA 規格，可免安裝直接透過瀏覽器開啟：

1. **同網域連線**：
   - 確保手機與運行本程式的電腦處於同一個 Wi-Fi 區域網路。
   - 查詢電腦的區域網路 IP（例如 `192.168.1.100`），並以 `HOST=0.0.0.0 npm start` 啟動。
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
| 講座清單 | `POST api/Cfd01/Load?op=X01F00` | 公開端點；帶 Token 可取得個人 `cnt_10`（是否已報名） |
| 講座明細 | `GET api/Cfd01/GetRes?eid01=` | 包含基本素養、主辦單位、UCAN、SDGs 等詳細資料 |
| 身分驗證 | `POST api/PersonInfo/GetPInfo` | 傳送 `{p_no, p_id, p_type}`（`p_id` 為身分證末四碼） |
| 送出報名 | `POST api/Cfd10/Save` | 搶課核心端點，需帶 Token 與 `std_info` 物件 |
| 取消退選 | `POST api/cfd10/DeleteData?reseid=` | 退選已報名場次 |
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
├ package.json                   專案配置與啟動腳本
├ start.bat                      Windows 啟動捷徑
├ start.sh                       macOS / Linux 啟動腳本
├ capacitor.config.json          行動端原生封裝配置
├ AGENTS.md                      架構規範與開發注意事項
├ README.md                      使用手冊與技術文件
├ src/
│  ├ asia.mjs                    校方 API 客戶端（含 AIA 中繼憑證自動修復）
│  ├ engine.mjs                  搶課核心引擎（輪詢狀態機、退避機制）
│  ├ schedule.mjs                定時排程器（三種啟動模式）
│  ├ calendar.mjs                行事曆事件轉換與素養提取
│  ├ ai.mjs                      AI 代理與本機素養規則解析器
│  ├ storage.mjs                 組態與狀態本地持久化
│  └ server.mjs                  HTTP 伺服器與 JSON API
├ public/
│  ├ index.html                  主介面（素養門檻、講座情報、行事曆）
│  ├ style.css                   Neo-Brutalist 曜石黑終端美學樣式表
│  ├ app.js                      前端邏輯控制（無外部建置依賴）
│  ├ manifest.webmanifest        PWA 應用程式清單
│  ├ sw.js                       Service Worker 離線快取
│  ├ icon.svg                    向量應用程式圖示
│  ├ icon-192.png                PWA 192x192 圖示
│  └ icon-512.png                PWA 512x512 圖示
├ mobile/
│  ├ pubspec.yaml                Flutter 專案相依配置
│  ├ README.md                   Flutter 原生打包指南
│  ├ assets/                     行動端圖示資產
│  ├ lib/                        Flutter Dart 原始碼（WebView、設定面板、主題）
│  ├ android/                    Android 原生建置專案（含權限與 Gradle 設定）
│  └ ios/                        iOS 原生建置專案（含 Info.plist 與權限）
└ scripts/
   ├ desktop-launcher.mjs        桌面視窗喚起腳本
   └ generate-icons.mjs          原生 PNG 圖示生成器
```

---

## 資料安全性與個人隱私說明

- 本系統所有操作均於本機伺服器完成，未架設任何外部中繼伺服器。
- 學生帳號、密碼及身分證末四碼儲存於本地 `data/config.json`（若未勾選記住密碼則僅暫存於記憶體中）。
- `data/` 資料夾已被 `.gitignore` 排除，絕不會上傳至 GitHub 或向外洩漏。
- 請妥善保管個人電腦與組態檔，切勿將包含帳密之 `config.json` 交付他人。

---

## 開發者與版本資訊

- 原始碼倉庫：[https://github.com/pinchiu/asia-lecture-grabber.git](https://github.com/pinchiu/asia-lecture-grabber.git)
- 版本號：1.0.0
- 授權類型：個人修課輔助使用
