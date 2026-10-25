/**
 * Node 與 Flutter 共用的校方行為契約。
 *
 * 這些規則必須在兩個執行環境保持一致，避免各自複製常數後逐漸漂移：
 * 1. DeleteData 成功回應：空字串或 JSON 的雙引號字串。
 * 2. 缺少結束時間時，以開始時間加 2 小時作為預設長度。
 * 3. 四大素養與總場次畢業門檻。
 *
 * `scripts/generate-contract.mjs` 會將本檔內容產生為
 * `mobile/lib/config/contract.g.dart`；修改本檔後請執行 `npm run contract`。
 */

export const CANCEL_SUCCESS_TEXTS = ['', '""'];

export const MISSING_END_FALLBACK_MS = 7_200_000;

export const GRADUATION_THRESHOLDS = {
  total: 8,
  health: 2,
  care: 2,
  innovation: 2,
  excellence: 2
};

/**
 * 判斷校方退選回應是否代表成功。
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCancelSuccessText(value) {
  return CANCEL_SUCCESS_TEXTS.includes(String(value ?? '').trim());
}
