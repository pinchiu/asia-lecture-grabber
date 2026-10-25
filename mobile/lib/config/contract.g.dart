// 本檔由 scripts/generate-contract.mjs 從 src/contract.mjs 產生，請勿手動編輯。
// 修改契約後請執行：npm run contract
library;

/// 校方退選成功時可能回傳的字串。
const List<String> cancelSuccessTexts = ["","\"\""];

/// 缺少結束時間時的預設長度（毫秒）。
const int missingEndFallbackMs = 7200000;

/// 畢業總場次門檻。
const int graduationTotalThreshold = 8;

/// 單一素養畢業門檻。
const int graduationLiteracyThreshold = 2;

/// 判斷校方退選回應是否代表成功。
bool isCancelSuccessText(String text) => cancelSuccessTexts.contains(text.trim());
