// 本檔由 scripts/generate-contract.mjs 從 src/contract.mjs 產生，請勿手動編輯。
// 修改契約後請執行：npm run contract
library;

/// 校方退選成功時可能回傳的字串。
const List<String> cancelSuccessTexts = ["","\"\""];

/// 缺少結束時間時的預設長度（毫秒）。
const int missingEndFallbackMs = 7200000;

/// 畢業總場次門檻。
const int graduationTotalThreshold = 8;

/// 健康力畢業門檻。
const int graduationHealthThreshold = 2;

/// 關懷力畢業門檻。
const int graduationCareThreshold = 2;

/// 創新力畢業門檻。
const int graduationInnovationThreshold = 2;

/// 卓越力畢業門檻。
const int graduationExcellenceThreshold = 2;

/// 判斷校方退選回應是否代表成功。
bool isCancelSuccessText(String text) => cancelSuccessTexts.contains(text.trim());
