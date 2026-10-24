import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import crypto from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ApiError,
  isTransientStatus,
  toApiError,
  STATUS_LABEL,
  setBaseUrl,
  resetBaseUrl,
  isTlsChainError,
  toPem,
  extractAiaUrls,
  safeVerify,
  getPeerLeafCertificate,
  downloadBinary,
  repairTlsChain,
  _setRepairFnForTest,
  request,
  login,
  listLectures,
  getLecture,
  verifyIdentity,
  registerLecture,
  cancelLecture,
  listRegistered
} from '../src/asia.mjs';

// 用於本地端 HTTPS 憑證測試之自簽 PFX 二進位資料（密碼：testpass）
const TEST_PFX_BASE64 =
  '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' +
  'FlJy4CAgfQ';

function createMockServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const url = `http://127.0.0.1:${port}/cfd2020/`;
      resolve({
        server,
        port,
        url,
        close: () => new Promise((res) => server.close(res))
      });
    });
  });
}

describe('asia.mjs 校方通訊錯誤與狀態測試', () => {
  after(() => {
    resetBaseUrl();
  });

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

    const dnsAgain = new Error('getaddrinfo EAI_AGAIN');
    dnsAgain.code = 'EAI_AGAIN';
    const apiDnsAgain = toApiError(dnsAgain);
    assert.ok(apiDnsAgain.message.includes('DNS 查詢失敗'));

    const connReset = new Error('read ECONNRESET');
    connReset.code = 'ECONNRESET';
    const apiReset = toApiError(connReset);
    assert.ok(apiReset.message.includes('ECONNRESET'));

    const hostUnreach = new Error('connect EHOSTUNREACH');
    hostUnreach.code = 'EHOSTUNREACH';
    assert.ok(toApiError(hostUnreach).message.includes('EHOSTUNREACH'));

    const tlsCertErr = new Error('CERT_HAS_EXPIRED');
    assert.ok(toApiError(tlsCertErr).message.includes('TLS 憑證驗證失敗'));

    // 原本即為 ApiError 應直接原樣回傳
    const original = new ApiError('原本的錯誤', { status: 403 });
    assert.equal(toApiError(original), original);

    // 未知錯誤與空錯誤防護
    assert.ok(toApiError(null).message.includes('網路連線失敗'));
    assert.ok(toApiError(new Error('特殊異常')).message.includes('特殊異常'));
  });

  test('STATUS_LABEL 狀態代碼對照表', () => {
    assert.equal(STATUS_LABEL.Y, '可報名');
    assert.equal(STATUS_LABEL.F, '已額滿');
    assert.equal(STATUS_LABEL.N1, '未開放');
    assert.equal(STATUS_LABEL.N2, '已截止');
    assert.equal(STATUS_LABEL.C, '現場報名');
    assert.equal(STATUS_LABEL.D, '其他方式');
  });

  test('isTlsChainError 憑證鏈錯誤代碼與訊息辨識', () => {
    // 代碼匹配
    assert.equal(isTlsChainError({ code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }), true);
    assert.equal(isTlsChainError({ code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' }), true);
    assert.equal(isTlsChainError({ code: 'SELF_SIGNED_CERT_IN_CHAIN' }), true);
    assert.equal(isTlsChainError({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }), true);
    assert.equal(isTlsChainError({ code: 'CERT_UNTRUSTED' }), true);

    // 訊息匹配
    assert.equal(isTlsChainError({ message: 'unable to verify the first certificate' }), true);
    assert.equal(isTlsChainError({ message: 'unable to get issuer certificate' }), true);
    assert.equal(isTlsChainError({ message: 'unable to get local issuer certificate' }), true);
    assert.equal(isTlsChainError({ message: 'broken certificate chain' }), true);
    assert.equal(isTlsChainError({ message: 'self signed certificate in certificate chain' }), true);

    // 非 TLS 鏈路錯誤應回傳 false
    assert.equal(isTlsChainError({ code: 'ECONNREFUSED' }), false);
    assert.equal(isTlsChainError({ code: 'ETIMEDOUT' }), false);
    assert.equal(isTlsChainError(new Error('general error')), false);
    assert.equal(isTlsChainError(null), false);
  });

  test('toPem 憑證編碼轉換與空值容錯', () => {
    // 空值安全回傳空字串
    assert.equal(toPem(null), '');
    assert.equal(toPem(undefined), '');
    assert.equal(toPem(''), '');
    assert.equal(toPem(Buffer.alloc(0)), '');

    // 原生 PEM 直接回傳
    const pem = '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----\n';
    assert.equal(toPem(pem), pem);

    // 二進位 DER 轉 PEM
    const der = Buffer.from('hello-cert-binary-data');
    const converted = toPem(der);
    assert.ok(converted.startsWith('-----BEGIN CERTIFICATE-----\n'));
    assert.ok(converted.endsWith('-----END CERTIFICATE-----\n'));
  });

  test('extractAiaUrls 網址提取與規範化', () => {
    // 空值防護
    assert.deepEqual(extractAiaUrls(null), []);
    assert.deepEqual(extractAiaUrls(undefined), []);
    assert.deepEqual(extractAiaUrls(Buffer.alloc(0)), []);

    // 提取含 .crt 與 .cer 之 URL，且正確去除 hash 與重複項目
    const raw = Buffer.from(
      'some binary prefix http://cacerts.geotrust.com/ca.crt# ' +
        'http://pki.asia.edu.tw/subca.cer?ver=1 ' +
        'http://cacerts.geotrust.com/ca.crt ' +
        'unrelated text https://example.com/notcert'
    );
    const urls = extractAiaUrls(raw);
    assert.equal(urls.length, 2);
    assert.ok(urls.includes('http://cacerts.geotrust.com/ca.crt'));
    assert.ok(urls.includes('http://pki.asia.edu.tw/subca.cer?ver=1'));
  });

  test('downloadBinary 下載二進位中繼憑證與 HTTP 重導向處理', async () => {
    let redirectCount = 0;
    const mockServer = await createMockServer((req, res) => {
      if (req.url === '/cfd2020/redirect') {
        redirectCount++;
        res.writeHead(302, { Location: '/cfd2020/target.crt' });
        res.end();
      } else if (req.url === '/cfd2020/target.crt') {
        res.writeHead(200, { 'Content-Type': 'application/pkix-cert' });
        res.end(Buffer.from('binary-certificate-content'));
      } else if (req.url === '/cfd2020/loop') {
        res.writeHead(302, { Location: '/cfd2020/loop' });
        res.end();
      } else if (req.url === '/cfd2020/404') {
        res.writeHead(404);
        res.end();
      } else if (req.url === '/cfd2020/stalling') {
        // 不發送回應以測試逾時
      }
    });

    try {
      // 1) 正常下載（經 302 重導向）
      const data = await downloadBinary(`${mockServer.url}redirect`);
      assert.equal(data.toString(), 'binary-certificate-content');
      assert.equal(redirectCount, 1);

      // 2) 404 錯誤
      await assert.rejects(
        () => downloadBinary(`${mockServer.url}404`),
        (err) => err.message.includes('HTTP 404')
      );

      // 3) 重導向次數過多
      await assert.rejects(
        () => downloadBinary(`${mockServer.url}loop`, 2),
        (err) => err.message.includes('重導向次數過多')
      );
    } finally {
      await mockServer.close();
    }
  });

  test('repairTlsChain 憑證修補邏輯分支覆蓋', async () => {
    // 1) 非 TLS 協議直接回傳 false
    setBaseUrl('http://127.0.0.1:8080/cfd2020/');
    const noTlsResult = await repairTlsChain();
    assert.equal(noTlsResult, false);

    // 切換回 HTTPS 測試內部修補邏輯
    setBaseUrl('https://webap.asia.edu.tw/cfd2020/');

    // 2) getLeaf 讀取失敗
    const failedLeaf = await repairTlsChain({
      getLeaf: async () => {
        throw new Error('socket timeout');
      }
    });
    assert.equal(failedLeaf, false);

    // 3) getLeaf 回傳空值
    const emptyLeaf = await repairTlsChain({
      getLeaf: async () => null
    });
    assert.equal(emptyLeaf, false);

    // 4) 葉憑證無 AIA 網址
    const rootCert = new crypto.X509Certificate(tls.rootCertificates[0]);
    const noAiaLeaf = await repairTlsChain({
      getLeaf: async () => Buffer.from(rootCert.toString(), 'latin1')
    });
    assert.equal(noAiaLeaf, false);

    // 5) 下載中繼憑證失敗（拋出例外）
    const downloadFail = await repairTlsChain({
      getLeaf: async () => Buffer.from(`${rootCert.toString()}\nhttp://dummy.com/ca.crt`),
      download: async () => {
        throw new Error('download failed');
      }
    });
    assert.equal(downloadFail, false);

    // 6) 下載之中繼憑證非合法 X509 格式
    const badCert = await repairTlsChain({
      getLeaf: async () => Buffer.from(`${rootCert.toString()}\nhttp://dummy.com/ca.crt`),
      download: async () => Buffer.from('not-a-certificate')
    });
    assert.equal(badCert, false);

    // 7) 中繼憑證之 subject 與葉憑證之 issuer 不吻合
    const rootCert2 = new crypto.X509Certificate(tls.rootCertificates[1]);
    const mismatchSubject = await repairTlsChain({
      getLeaf: async () => Buffer.from(`${rootCert.toString()}\nhttp://dummy.com/ca.crt`),
      download: async () => Buffer.from(rootCert2.toString()),
      rootCerts: [rootCert, rootCert2]
    });
    assert.equal(mismatchSubject, false);

    // 8) 中繼憑證非由本機受信任之根憑證簽署
    const untrustedRoot = await repairTlsChain({
      getLeaf: async () => Buffer.from(`${rootCert.toString()}\nhttp://dummy.com/ca.crt`),
      download: async () => Buffer.from(rootCert.toString()),
      rootCerts: [rootCert2] // 排除 rootCert
    });
    assert.equal(untrustedRoot, false);

    // 9) 完整驗證通過並成功快取中繼憑證
    const tempDir = await mkdtemp(path.join(tmpdir(), 'asia-test-ca-'));
    const tempCaPath = path.join(tempDir, 'sub-dir', 'extra-ca.pem');
    try {
      const success = await repairTlsChain({
        getLeaf: async () => Buffer.from(`${rootCert.toString()}\nhttp://dummy.com/ca.crt`),
        download: async () => Buffer.from(rootCert.toString()),
        rootCerts: [rootCert],
        caFilePath: tempCaPath
      });
      assert.equal(success, true);
      const savedPem = await readFile(tempCaPath, 'utf8');
      assert.ok(savedPem.includes('BEGIN CERTIFICATE'));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test('safeVerify 驗證失敗安全防護', () => {
    const rootCert = new crypto.X509Certificate(tls.rootCertificates[0]);
    assert.equal(safeVerify(rootCert, {}), false);
    assert.equal(safeVerify(rootCert, null), false);
  });

  test('getPeerLeafCertificate 本機 HTTPS 伺服器葉憑證擷取測試', async () => {
    const pfxBuffer = Buffer.from(TEST_PFX_BASE64, 'base64');
    const httpsServer = https.createServer({ pfx: pfxBuffer, passphrase: 'testpass' }, (req, res) => {
      res.end('ok');
    });

    await new Promise((resolve) => httpsServer.listen(0, '127.0.0.1', resolve));
    const port = httpsServer.address().port;

    try {
      setBaseUrl(`https://localhost:${port}/cfd2020/`);
      const rawDer = await getPeerLeafCertificate();
      assert.ok(rawDer && Buffer.isBuffer(rawDer));
      const parsed = new crypto.X509Certificate(toPem(rawDer));
      assert.equal(parsed.subject, 'CN=localhost');
    } finally {
      await new Promise((res) => httpsServer.close(res));
      resetBaseUrl();
    }
  });

  test('getPeerLeafCertificate 連線異常防護', async () => {
    setBaseUrl('https://127.0.0.1:59999/cfd2020/');
    await assert.rejects(
      () => getPeerLeafCertificate(),
      (err) => Boolean(err)
    );
    resetBaseUrl();
  });

  test('request 請求方法、標頭、UTF-8 BOM 與錯誤狀態碼解析', async () => {
    let capturedMethod = '';
    let capturedHeaders = null;
    let capturedBody = '';

    const mockServer = await createMockServer((req, res) => {
      capturedMethod = req.method;
      capturedHeaders = req.headers;

      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        capturedBody = Buffer.concat(chunks).toString('utf8');

        if (req.url.includes('/api/test/bom')) {
          // 附帶 UTF-8 BOM 字符
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('\uFEFF{"success":true,"val":123}');
        } else if (req.url.includes('/api/test/raw')) {
          res.writeHead(200);
          res.end('raw-plain-text');
        } else if (req.url.includes('/api/test/html500')) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<html><head><title>校務系統維護中</title></head><body>500 Internal Error</body></html>');
        } else if (req.url.includes('/api/test/bizfail')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '名額已滿無法報名' }));
        } else if (req.url.includes('/api/test/nonjson')) {
          res.writeHead(200);
          res.end('Database Timeout Error in plain text');
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, echo: capturedBody }));
        }
      });
    });

    try {
      setBaseUrl(mockServer.url);

      // 1) POST 請求與 Bearer Token 標頭校驗
      const postRes = await request('POST', 'api/test/echo', {
        token: 'secret-token-xyz',
        body: { test: 'value' }
      });
      assert.equal(capturedMethod, 'POST');
      assert.equal(capturedHeaders.authorization, 'Bearer secret-token-xyz');
      assert.equal(capturedHeaders['content-type'], 'application/json;charset=UTF-8');
      assert.equal(postRes.success, true);

      // 2) 自動濾除 UTF-8 BOM
      const bomRes = await request('GET', 'api/test/bom');
      assert.equal(bomRes.val, 123);

      // 3) rawText: true 模式直接回傳字串
      const rawRes = await request('GET', 'api/test/raw', { rawText: true });
      assert.equal(rawRes.text, 'raw-plain-text');
      assert.equal(rawRes.status, 200);

      // 4) IIS HTML 500 錯誤擷取 title 標籤為錯誤訊息
      await assert.rejects(
        () => request('GET', 'api/test/html500'),
        (err) => {
          assert.equal(err.status, 500);
          assert.equal(err.transient, true);
          assert.equal(err.message, '校務系統維護中');
          return true;
        }
      );

      // 5) HTTP 200 回應非 JSON 格式
      await assert.rejects(
        () => request('GET', 'api/test/nonjson'),
        (err) => {
          assert.equal(err.status, 200);
          assert.equal(err.transient, true);
          assert.ok(err.message.includes('非 JSON 格式'));
          return true;
        }
      );

      // 6) HTTP 200 且 success: false 拋出業務異常
      await assert.rejects(
        () => request('POST', 'api/test/bizfail'),
        (err) => {
          assert.equal(err.status, 200);
          assert.equal(err.message, '名額已滿無法報名');
          return true;
        }
      );
    } finally {
      await mockServer.close();
      resetBaseUrl();
    }
  });

  test('request 連線逾時與伺服器無回應處理', async () => {
    const mockServer = await createMockServer((req, res) => {
      // 刻意不結束連線
    });

    try {
      setBaseUrl(mockServer.url);
      await assert.rejects(
        () => request('GET', 'api/stalling', { timeoutMs: 80 }),
        (err) => {
          assert.equal(err.status, 0);
          assert.equal(err.transient, true);
          assert.ok(err.message.includes('請求逾時'));
          return true;
        }
      );
    } finally {
      await mockServer.close();
      resetBaseUrl();
    }
  });

  test('request 遭遇 TLS 憑證鏈錯誤時自動觸發修復並無感重試', async () => {
    const pfxBuffer = Buffer.from(TEST_PFX_BASE64, 'base64');
    let requestCount = 0;
    const httpsServer = https.createServer({ pfx: pfxBuffer, passphrase: 'testpass' }, (req, res) => {
      requestCount++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, count: requestCount }));
    });

    await new Promise((resolve) => httpsServer.listen(0, '127.0.0.1', resolve));
    const port = httpsServer.address().port;

    let repairCalls = 0;
    try {
      setBaseUrl(`https://localhost:${port}/cfd2020/`);

      // 第一次修復失敗時，應拋出 TLS 錯誤
      _setRepairFnForTest(async () => {
        repairCalls++;
        return false;
      });

      await assert.rejects(
        () => request('GET', 'api/test/tls-fail'),
        (err) => err.message.includes('TLS 憑證驗證失敗')
      );
      assert.equal(repairCalls, 1);

      // 當修復成功時，應自動重試並成功取得結果；同時多個請求應共享同一個 repairPromise
      let sharedRepairCount = 0;
      _setRepairFnForTest(async () => {
        sharedRepairCount++;
        const raw = await getPeerLeafCertificate();
        const cert = new crypto.X509Certificate(toPem(raw));
        await repairTlsChain({
          getLeaf: async () => Buffer.from(`${cert.toString()}\nhttp://dummy.com/ca.crt`),
          download: async () => Buffer.from(cert.toString()),
          rootCerts: [cert]
        });
        return true;
      });

      const [res1, res2] = await Promise.all([
        request('GET', 'api/test/retry-1'),
        request('GET', 'api/test/retry-2')
      ]);

      assert.equal(res1.success, true);
      assert.equal(res2.success, true);
      assert.equal(sharedRepairCount, 1);
    } finally {
      _setRepairFnForTest(null);
      await new Promise((res) => httpsServer.close(res));
      resetBaseUrl();
    }
  });

  describe('業務 API 功能測試', () => {
    let mockServer;

    before(async () => {
      mockServer = await createMockServer((req, res) => {
        const url = req.url;
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const bodyStr = Buffer.concat(chunks).toString('utf8');
          let body = null;
          try {
            body = JSON.parse(bodyStr);
          } catch {}

          if (url.includes('api/Login/Auth')) {
            if (body?.username === '11000001' && body?.password === 'correct') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: true,
                  res: { token: 'jwt-token-123', emp_id: '11000001', emp_nm: '王小明', emp_rl: 'Student' }
                })
              );
            } else if (body?.password === 'notoken') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, res: {} }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: '帳號或密碼錯誤' }));
            }
          } else if (url.includes('api/Cfd01/Load?op=X01F00')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                data: [
                  { eid01: 'L01', rescnm: '人工智慧倫理講座', canapp: 'Y' },
                  { eid01: 'L02', rescnm: '創新創業實務講座', canapp: 'N1' }
                ]
              })
            );
          } else if (url.includes('api/Cfd01/GetRes?eid01=')) {
            const eid = new URL(url, 'http://localhost').searchParams.get('eid01');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (eid === 'L01') {
              res.end(JSON.stringify({ data: [{ eid01: 'L01', rescnm: '人工智慧倫理講座', canapp: 'Y' }] }));
            } else {
              res.end(JSON.stringify({ data: [] }));
            }
          } else if (url.includes('api/PersonInfo/GetPInfo')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (body?.p_id === '5678') {
              res.end(
                JSON.stringify({
                  data: [{ chi_name: '王小明', dept_name_s: '資工系', email: 'test@asia.edu.tw' }]
                })
              );
            } else if (body?.p_id === 'err') {
              res.end(JSON.stringify({ data: [{ errmsg: '查無學生身分資料' }] }));
            } else {
              res.end(JSON.stringify({ data: [] }));
            }
          } else if (url.includes('api/Cfd10/Save')) {
            if (body?.eid01 === 'ERR500') {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ message: '資料庫寫入超時' }));
            } else if (body?.eid01 === 'L01') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: '報名成功' }));
            } else if (body?.eid01 === 'FULL') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: '該場次名額已額滿' }));
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: '此講座已截止或非開放時段' }));
            }
          } else if (url.includes('api/cfd10/DeleteData')) {
            const reseid = new URL(url, 'http://localhost').searchParams.get('reseid');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (reseid === 'REG01') {
              // 成功取消時回傳空字串
              res.end('');
            } else if (reseid === 'REG_QUOTED') {
              // ASP.NET JSON 格式回傳空字串 ""
              res.end('""');
            } else if (reseid === 'REG_JSON_ERR') {
              res.end(JSON.stringify({ Message: '超過退選期限' }));
            } else {
              res.end('超過退選截止時間或非本人報名');
            }
          } else if (url.includes('api/Cfd01/Load_del?op=X01F00DEL')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: [{ reseid: 'REG01', rescnm: '已報名講座' }] }));
          } else {
            res.writeHead(404);
            res.end();
          }
        });
      });
      setBaseUrl(mockServer.url);
    });

    after(async () => {
      await mockServer.close();
      resetBaseUrl();
    });

    test('login 登入驗證與例外處理', async () => {
      // 缺少帳號密碼拋出 400
      await assert.rejects(() => login('', ''), (err) => err.status === 400);

      // 密碼錯誤回傳 200 且 success: false，轉為 ApiError
      await assert.rejects(
        () => login('11000001', 'wrong'),
        (err) => err.message.includes('帳號或密碼錯誤')
      );

      // 登入成功取得 token
      const user = await login('11000001', 'correct');
      assert.equal(user.emp_id, '11000001');
      assert.equal(user.token, 'jwt-token-123');

      // 伺服器未回傳 token
      await assert.rejects(
        () => login('11000001', 'notoken'),
        (err) => err.status === 401 && err.message.includes('未取得憑證')
      );
    });

    test('listLectures 講座清單查詢', async () => {
      const lectures = await listLectures('token-123');
      assert.equal(lectures.length, 2);
      assert.equal(lectures[0].eid01, 'L01');
    });

    test('getLecture 單場講座查詢', async () => {
      const lecture = await getLecture('token-123', 'L01');
      assert.equal(lecture.eid01, 'L01');
      assert.equal(lecture.rescnm, '人工智慧倫理講座');

      const notFound = await getLecture('token-123', 'NOT_EXIST');
      assert.equal(notFound, null);
    });

    test('verifyIdentity 身分驗證換取學生資訊', async () => {
      const info = await verifyIdentity('token-123', { p_no: '11000001', p_id: '5678' });
      assert.equal(info.chi_name, '王小明');
      assert.equal(info.dept_name_s, '資工系');

      // 伺服器回傳 errmsg
      await assert.rejects(
        () => verifyIdentity('token-123', { p_no: '11000001', p_id: 'err' }),
        (err) => err.status === 400 && err.message.includes('查無學生身分資料')
      );

      // 查無資料
      await assert.rejects(
        () => verifyIdentity('token-123', { p_no: '11000001', p_id: 'none' }),
        (err) => err.status === 400 && err.message.includes('沒有回應')
      );
    });

    test('registerLecture 送出報名與結果判定', async () => {
      const std = { chi_name: '王小明' };

      // 1) 報名成功
      const successRes = await registerLecture('token-123', { std_info: std, eid01: 'L01', reseid: 'RES01' });
      assert.equal(successRes.ok, true);
      assert.equal(successRes.message, '報名成功');

      // 2) 額滿字樣判定為失敗
      const fullRes = await registerLecture('token-123', { std_info: std, eid01: 'FULL', reseid: 'RES02' });
      assert.equal(fullRes.ok, false);
      assert.ok(fullRes.message.includes('額滿'));

      // 3) 伺服器 success: false
      const bizFailRes = await registerLecture('token-123', { std_info: std, eid01: 'CLOSED', reseid: 'RES03' });
      assert.equal(bizFailRes.ok, false);
      assert.ok(bizFailRes.message.includes('已截止'));

      // 4) 伺服器 500 內部錯誤應原樣向外拋出
      await assert.rejects(
        () => registerLecture('token-123', { std_info: std, eid01: 'ERR500', reseid: 'RES04' }),
        (err) => err.status === 500 && err.message.includes('資料庫寫入超時')
      );
    });

    test('cancelLecture 退選處理與空字串回應判定', async () => {
      // 缺少 token
      await assert.rejects(() => cancelLecture('', 'REG01'), (err) => err.status === 401);
      // 缺少代號
      await assert.rejects(() => cancelLecture('token-123', ''), (err) => err.status === 400);

      // 校方成功回傳空字串
      const res1 = await cancelLecture('token-123', 'REG01');
      assert.equal(res1.ok, true);
      assert.equal(res1.message, '已成功取消報名');

      // 校方回傳 JSON 引號空字串
      const res2 = await cancelLecture('token-123', 'REG_QUOTED');
      assert.equal(res2.ok, true);
      assert.equal(res2.message, '已成功取消報名');

      // 退選失敗錯誤訊息
      await assert.rejects(
        () => cancelLecture('token-123', 'EXPIRED'),
        (err) => err.status === 400 && err.message.includes('超過退選截止時間')
      );

      // 校方回傳 JSON 格式錯誤訊息
      await assert.rejects(
        () => cancelLecture('token-123', 'REG_JSON_ERR'),
        (err) => err.status === 400 && err.message.includes('超過退選期限')
      );
    });

    test('listRegistered 已報名與已退選清單查詢', async () => {
      const list = await listRegistered('token-123');
      assert.equal(list.length, 1);
      assert.equal(list[0].reseid, 'REG01');
    });
  });
});
