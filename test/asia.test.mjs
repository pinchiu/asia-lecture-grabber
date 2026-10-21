import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, isTransientStatus, toApiError, STATUS_LABEL } from '../src/asia.mjs';

describe('asia.mjs 校方通訊錯誤與狀態測試', () => {
  test('ApiError 應完整記錄狀態碼與暫態標記', () => {
    const err500 = new ApiError('伺服器錯誤', { status: 500, payload: { detail: 'crash' } });
    assert.equal(err500.name, 'ApiError');
    assert.equal(err500.message, '伺服器錯誤');
    assert.equal(err500.status, 500);
    assert.equal(err500.transient, true);
    assert.deepEqual(err500.payload, { detail: 'crash' });

    const err400 = new ApiError('參數不合法', { status: 400, transient: false });
    assert.equal(err400.status, 400);
    assert.equal(err400.transient, false);
  });

  test('isTransientStatus 暫態 HTTP 狀態判定', () => {
    assert.equal(isTransientStatus(0), true);
    assert.equal(isTransientStatus(408), true);
    assert.equal(isTransientStatus(425), true);
    assert.equal(isTransientStatus(429), true);
    assert.equal(isTransientStatus(500), true);
    assert.equal(isTransientStatus(502), true);
    assert.equal(isTransientStatus(503), true);

    assert.equal(isTransientStatus(200), false);
    assert.equal(isTransientStatus(400), false);
    assert.equal(isTransientStatus(401), false);
    assert.equal(isTransientStatus(404), false);
  });

  test('toApiError 應能將系統錯誤轉為友善的 ApiError', () => {
    const timeoutErr = new Error('connect ETIMEDOUT');
    timeoutErr.code = 'ETIMEDOUT';
    const apiTimeout = toApiError(timeoutErr);
    assert.equal(apiTimeout.status, 0);
    assert.equal(apiTimeout.transient, true);
    assert.ok(apiTimeout.message.includes('請求逾時'));

    const notFoundErr = new Error('getaddrinfo ENOTFOUND webap.asia.edu.tw');
    notFoundErr.code = 'ENOTFOUND';
    const apiNotFound = toApiError(notFoundErr);
    assert.equal(apiNotFound.status, 0);
    assert.equal(apiNotFound.transient, true);
    assert.ok(apiNotFound.message.includes('找不到主機'));

    const connRefused = new Error('connect ECONNREFUSED');
    connRefused.code = 'ECONNREFUSED';
    const apiRefused = toApiError(connRefused);
    assert.ok(apiRefused.message.includes('網路連線失敗（ECONNREFUSED）'));

    // 若本來就是 ApiError 應直接回傳
    const original = new ApiError('原本的錯誤', { status: 403 });
    assert.equal(toApiError(original), original);
  });

  test('STATUS_LABEL 狀態代碼對照表', () => {
    assert.equal(STATUS_LABEL.Y, '可報名');
    assert.equal(STATUS_LABEL.F, '已額滿');
    assert.equal(STATUS_LABEL.N1, '未開放');
    assert.equal(STATUS_LABEL.N2, '已截止');
    assert.equal(STATUS_LABEL.C, '現場報名');
    assert.equal(STATUS_LABEL.D, '其他方式');
  });
});
