import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  CANCEL_SUCCESS_TEXTS,
  GRADUATION_THRESHOLDS,
  MISSING_END_FALLBACK_MS,
  isCancelSuccessText
} from '../src/contract.mjs';
import { buildContractSource } from '../scripts/generate-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Node 與 Flutter 共用契約', () => {
  test('Dart 契約檔與 Node 契約來源一致', async () => {
    const actual = await readFile(path.join(ROOT, 'mobile/lib/config/contract.g.dart'), 'utf8');
    assert.equal(actual, buildContractSource());
  });

  test('退選成功字串契約', () => {
    assert.deepEqual(CANCEL_SUCCESS_TEXTS, ['', '""']);
    assert.equal(isCancelSuccessText(''), true);
    assert.equal(isCancelSuccessText('""'), true);
    assert.equal(isCancelSuccessText('   '), true);
    assert.equal(isCancelSuccessText('退選失敗'), false);
    assert.equal(MISSING_END_FALLBACK_MS, 7_200_000);
  });

  test('畢業門檻契約與 AGENTS.md 一致', () => {
    assert.deepEqual(GRADUATION_THRESHOLDS, {
      total: 8,
      health: 2,
      care: 2,
      innovation: 2,
      excellence: 2
    });
  });

  test('Flutter 端固定之中繼憑證仍由 USERTrust 根憑證簽發', async () => {
    const dart = await readFile(path.join(ROOT, 'mobile/lib/config/school_certs.dart'), 'utf8');
    const match = dart.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/);
    assert.ok(match, 'school_certs.dart 應包含 PEM 憑證');

    const cert = new crypto.X509Certificate(match[0]);
    assert.match(cert.subject, /Sectigo RSA Organization Validation Secure Server CA/);
    assert.match(cert.issuer, /USERTrust RSA Certification Authority/);
    assert.ok(new Date(cert.validTo).getUTCFullYear() >= 2030, '憑證有效期不應早於 2030 年');
  });

  test('Flutter API 客戶端不得使用 badCertificateCallback 放行網域', async () => {
    const dart = await readFile(path.join(ROOT, 'mobile/lib/backend/asia_api.dart'), 'utf8');
    assert.doesNotMatch(dart, /badCertificateCallback\s*=/);
    assert.match(dart, /buildSchoolSecurityContext\(\)/);
  });
});
