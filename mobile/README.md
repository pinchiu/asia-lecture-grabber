# 亞洲大學講座報名助手 — Flutter 行動端 App

本目錄為專案的 Flutter 原生行動應用程式封裝，提供 Android 與 iOS 雙平台的原生 App 體驗。

---

## 特色與架構說明

- **雙平台原生支援**：支援 Android 與 iOS 系統，具備流暢原生標題列、連線狀態指示與鍵盤適配。
- **WebView 整合**：採用官方 `webview_flutter` 核心，具備硬體加速、高更新率與即時資料載入能力。
- **動態伺服器位址切換**：內建「伺服器連線設定」面板，支援切換本機電腦區域網路 IP（如 `http://192.168.1.50:5199`）、Android 模擬器專用位址（`10.0.2.2:5199`）或自訂伺服器域名。
- **斷線重試機制**：伺服器未連通時提供清楚的排查說明與重試按鈕，無縫協助使用者建立連線。
- **本地設定持久化**：使用 `shared_preferences` 自動保存使用者輸入的伺服器位址，下次開啟自動記憶。

---

## 開發與建置需求

1. **Flutter SDK**：版本 >= 3.10.0。
2. **Android 開發環境**：Android Studio（含 Android SDK 與 Platform Tools）。
3. **iOS 開發環境**（僅限 macOS）：Xcode 與 CocoaPods。

---

## 快速開始

### 1. 安裝套件相依

進入 `mobile/` 目錄並執行套件下載：

```bash
cd mobile
flutter pub get
```

### 2. 本地執行與除錯

請先確保根目錄下的 Node.js 伺服器正在執行（`npm start`）。

- **Android 模擬器**：
  ```bash
  flutter run
  ```
  預設連線網址為 `http://10.0.2.2:5199`。

- **實體手機（需透過同一個 Wi-Fi 連線）**：
  1. 查詢電腦的區域網路 IP（Windows 請執行 `ipconfig`，macOS / Linux 請執行 `ifconfig`）。
  2. 執行 `flutter run`。
  3. 進入 App 後點擊右上角「設定」圖示，輸入電腦的 IP（例如 `http://192.168.1.100:5199`）並點擊「儲存並重新連線」。

---

## 打包發布指令

### 打包 Android APK 安裝檔

```bash
flutter build apk --release
```
建置完成後，APK 安裝檔位於：
`build/app/outputs/flutter-apk/app-release.apk`

### 打包 Android App Bundle (Google Play 上架格式)

```bash
flutter build appbundle --release
```

### 打包 iOS 應用程式

```bash
flutter build ipa --release
```

---

## 目錄結構

```
mobile/
├ pubspec.yaml               Flutter 專案相依設定檔
├ assets/                    圖示與靜態資源
├ lib/
│  ├ main.dart               程式進入點與主題配置
│  ├ config/
│  │  └ constants.dart       色彩主題與連線常數
│  └ screens/
│     ├ webview_screen.dart  主介面 WebView 控制器與錯誤畫面
│     └ settings_modal.dart  伺服器位址切換設定視窗
├ android/                   Android 原生專案代碼與配置
└ ios/                       iOS 原生專案代碼與配置
```
