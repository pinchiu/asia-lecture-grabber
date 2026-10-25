/**
 * 將 src/contract.mjs 的共用契約產生為 Flutter 常數檔。
 *
 * 使用方式：`npm run contract`
 * 測試會比對產生結果與已提交的 `mobile/lib/config/contract.g.dart`，
 * 若忘記重新產生，`npm test` 會失敗。
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  CANCEL_SUCCESS_TEXTS,
  MISSING_END_FALLBACK_MS,
  GRADUATION_THRESHOLDS
} from '../src/contract.mjs';

/**
 * 產生 Dart 契約常數內容。
 * @returns {string}
 */
export function buildContractSource() {
  return `// 本檔由 scripts/generate-contract.mjs 從 src/contract.mjs 產生，請勿手動編輯。
// 修改契約後請執行：npm run contract
library;

/// 校方退選成功時可能回傳的字串。
const List<String> cancelSuccessTexts = ${JSON.stringify(CANCEL_SUCCESS_TEXTS)};

/// 缺少結束時間時的預設長度（毫秒）。
const int missingEndFallbackMs = ${MISSING_END_FALLBACK_MS};

/// 畢業總場次門檻。
const int graduationTotalThreshold = ${GRADUATION_THRESHOLDS.total};

/// 健康力畢業門檻。
const int graduationHealthThreshold = ${GRADUATION_THRESHOLDS.health};

/// 關懷力畢業門檻。
const int graduationCareThreshold = ${GRADUATION_THRESHOLDS.care};

/// 創新力畢業門檻。
const int graduationInnovationThreshold = ${GRADUATION_THRESHOLDS.innovation};

/// 卓越力畢業門檻。
const int graduationExcellenceThreshold = ${GRADUATION_THRESHOLDS.excellence};

/// 判斷校方退選回應是否代表成功。
bool isCancelSuccessText(String text) => cancelSuccessTexts.contains(text.trim());
`;
}

const target = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'mobile',
  'lib',
  'config',
  'contract.g.dart'
);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await writeFile(target, buildContractSource(), 'utf8');
  console.log(`已產生 ${target}`);
}
