# 亞洲大學講座報名助手 — Flutter 原生行動端

本目錄為專案的 Flutter 原生行動應用程式，提供 Android 與 iOS 雙平台體驗。App 採用 Cupertino 介面，並以純 Dart 實作校方 API 客戶端、搶課引擎與行事曆邏輯；不是 WebView 包裝，也不依賴電腦端的 Node.js 伺服器。

---

## 特色與架構

- **原生獨立運作**：手機直接連線校方系統，登入、講座查詢、報名、退選與排程監控均在 App 內完成。
- **Cupertino 原生介面**：包含講座情報、搶課排程、個人行程與系統設定四個主要分頁。
- **雙語國際化**：支援跟隨系統語言、繁體中文與英文，並保存使用者偏好。
- **本機設定持久化**：依使用者設定保存帳密、歷年素養與搶課目標。
- **版本更新**：支援檢查新版本，以及在 Android App 內下載與安裝 APK 更新。

---

## 開發與建置需求

1. **Flutter SDK**：版本 >= 3.10.0。
2. **Android 開發環境**：Android Studio（含 Android SDK 與 Platform Tools）。
3. **iOS 開發環境**（僅限 macOS）：Xcode 與 CocoaPods。

可先執行 `flutter doctor` 檢查開發環境。

---

## 快速開始

### 1. 安裝套件相依

```bash
cd mobile
flutter pub get
```

### 2. 執行 App

```bash
flutter run
```

或由專案根目錄執行：

```bash
npm run mobile:flutter:run
```

行動端會直接連線校方系統，**不需先執行 `npm start`，也不需設定電腦的區域網路 IP**。

### 3. 登入與設定

開啟「系統設定」分頁，輸入校園入口帳號、密碼與身分證字號末四碼。此處也可調整語言、記住帳密、歷年素養補登與更新偏好，並查看引擎日誌。

---

## 測試與靜態分析

```bash
cd mobile
flutter test
flutter analyze --no-fatal-infos
```

也可由專案根目錄執行 `npm run mobile:flutter:test`。

---

## 打包發布

### Android APK

```bash
cd mobile
flutter build apk --release
```

建置完成後，APK 位於 `build/app/outputs/flutter-apk/app-release.apk`。

### Android App Bundle

```bash
cd mobile
flutter build appbundle --release
```

### iOS 應用程式

在 macOS 環境執行：

```bash
cd mobile
flutter build ipa --release
```

---

## 目錄結構

```text
mobile/
├ pubspec.yaml                  Flutter 專案與相依設定
├ assets/                       圖示與靜態資源
├ lib/
│  ├ main.dart                  App 根元件、主題、分頁與更新提示
│  ├ config/
│  │  ├ constants.dart          色彩、尺寸與共用常數
│  │  ├ i18n.dart               雙語國際化與語言偏好
│  │  └ school_certs.dart       校方 AIA 中繼憑證（TLS 信任錨點）
│  ├ backend/
│  │  ├ asia_api.dart           校方 API 原生客戶端
│  │  ├ grab_engine.dart        搶課狀態機與本機持久化
│  │  ├ calendar_helper.dart    民國年、素養與行事曆輔助邏輯
│  │  └ update_service.dart     版本檢查與 APK 更新
│  └ screens/
│     ├ lectures_screen.dart    講座情報與素養門檻
│     ├ targets_screen.dart     搶課目標與引擎狀態
│     ├ calendar_screen.dart    已報名行程與退選
│     └ settings_screen.dart    登入、偏好、補登與系統設定
├ test/                         Flutter 單元測試
├ android/                      Android 原生專案
└ ios/                          iOS 原生專案
```

---

## 資料安全

登入資料會依「記住帳密」設定保存在裝置本機。請妥善保管裝置，不要分享含有個人資料的設定或除錯輸出；登入憑證與個人身分資料不應寫入提交紀錄或上傳至公開倉庫。
