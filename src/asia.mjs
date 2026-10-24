/**
 * 亞洲大學「講座暨通識課程線上報名系統」API client。
 *
 * 所有端點皆相對於 https://webap.asia.edu.tw/cfd2020/
 * 認證方式：登入取得 token 後，以 `Authorization: Bearer <token>` 呼叫。
 *
 * 逆向來源（前端 SPA）：
 *   - Views/Login.vue           -> POST api/Login/Auth
 *   - component/DataTableZZ.vue -> POST api/Cfd01/Load?op=..&eid01=..
 *   - Views/X01/X01F00EDT.vue   -> GET  api/Cfd01/GetRes?eid01=..
 *                               -> POST api/PersonInfo/GetPInfo
 *                               -> POST api/Cfd10/Save
 *   - Views/X01/X01F00DEL.vue   -> POST api/cfd10/DeleteData?reseid=..
 *
 * TLS 備註：
 *   該伺服器只回傳葉憑證、未附中繼 CA，Node 預設信任庫無法補鏈
 *   （瀏覽器會透過 AIA 自動下載）。這裡會從憑證內的 AIA 網址抓取中繼憑證，
 *   並確認「中繼憑證由受信任根簽發」且「確實簽發了這張葉憑證」後才加入信任，
 *   因此仍然維持完整的憑證驗證，而不是關閉 TLS 檢查。
 */

import https from 'node:https';
import http from 'node:http';
import tls from 'node:tls';
import net from 'node:net';
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './storage.mjs';

const DEFAULT_BASE = 'https://webap.asia.edu.tw/cfd2020/';

export const BASE_URL = (() => {
  const raw = process.env.CFD_BASE_URL;
  if (!raw) return DEFAULT_BASE;
  return raw.endsWith('/') ? raw : raw + '/';
})();

let currentBaseUrl = BASE_URL;
let BASE = new URL(currentBaseUrl);
let USE_TLS = BASE.protocol === 'https:';
const EXTRA_CA_FILE = path.join(DATA_DIR, 'extra-ca.pem');

export function setBaseUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return;
  const normalized = raw.endsWith('/') ? raw : raw + '/';
  currentBaseUrl = normalized;
  BASE = new URL(currentBaseUrl);
  USE_TLS = BASE.protocol === 'https:';
  buildAgent();
}

export function resetBaseUrl() {
  currentBaseUrl = BASE_URL;
  BASE = new URL(currentBaseUrl);
  USE_TLS = BASE.protocol === 'https:';
  buildAgent();
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const JSON_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json;charset=UTF-8',
  Pragma: 'no-cache',
  'User-Agent': USER_AGENT
};

export function isTransientStatus(status) {
  return status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
}

export class ApiError extends Error {
  constructor(message, { status = 0, payload = null, transient = isTransientStatus(status) } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.transient = transient;
  }
}

/* ------------------------------------------------------------------ */
/* TLS 代理：自動補中繼憑證                                             */
/* ------------------------------------------------------------------ */

let extraCaPem = '';
let agent = null;
let repairPromise = null;
let currentRepairFn = repairTlsChain;

export function _setRepairFnForTest(fn) {
  currentRepairFn = fn || repairTlsChain;
}

try {
  extraCaPem = (await readFile(EXTRA_CA_FILE, 'utf8')).trim();
} catch {
  extraCaPem = '';
}

function buildAgent() {
  if (!USE_TLS) {
    if (agent) {
      try {
        agent.destroy();
      } catch {}
      agent = null;
    }
    return;
  }
  if (agent) {
    try {
      agent.destroy();
    } catch {}
  }
  const ca = [...tls.rootCertificates];
  if (extraCaPem) ca.push(extraCaPem);
  agent = new https.Agent({ keepAlive: true, maxSockets: 6, timeout: 30_000, ca });
}

function getAgent() {
  if (!USE_TLS) return undefined;
  if (!agent) buildAgent();
  return agent;
}

export function toPem(buffer) {
  if (!buffer) return '';
  const text = Buffer.isBuffer(buffer) ? buffer.toString('latin1') : String(buffer);
  if (text.includes('-----BEGIN CERTIFICATE-----')) return text;
  const rawBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(String(buffer));
  if (rawBuf.length === 0) return '';
  const base64 = rawBuf.toString('base64');
  const lines = base64.match(/.{1,64}/g);
  if (!lines || lines.length === 0) return '';
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

export function safeVerify(cert, publicKey) {
  try {
    return cert.verify(publicKey);
  } catch {
    return false;
  }
}

export function extractAiaUrls(rawDer) {
  if (!rawDer) return [];
  const buf = Buffer.isBuffer(rawDer) ? rawDer : Buffer.from(rawDer);
  const text = buf.toString('latin1');
  const matches = text.match(/https?:\/\/[^\x00-\x20\x80-\xff]+?\.(?:crt|cer)(?:\?[^\x00-\x20\x80-\xff]*)?/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/#+$/, '')))];
}

export function getPeerLeafCertificate() {
  return new Promise((resolve, reject) => {
    let timer = null;
    const isIp = net.isIP(BASE.hostname);
    const socket = tls.connect(
      {
        host: BASE.hostname,
        port: Number(BASE.port || 443),
        servername: isIp ? undefined : BASE.hostname,
        rejectUnauthorized: false
      },
      () => {
        try {
          if (timer) clearTimeout(timer);
          const cert = socket.getPeerCertificate(true);
          socket.end();
          if (!cert || !cert.raw) reject(new Error('無法取得伺服器憑證'));
          else resolve(cert.raw);
        } catch (err) {
          if (timer) clearTimeout(timer);
          socket.destroy();
          reject(err);
        }
      }
    );
    socket.on('error', (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    timer = setTimeout(() => {
      socket.destroy(new Error('讀取憑證逾時'));
    }, 15_000);
  });
}

export function downloadBinary(url, maxRedirects = 3) {
  return new Promise((resolve, reject) => {
    if (maxRedirects < 0) {
      reject(new Error('下載中繼憑證失敗：重導向次數過多'));
      return;
    }
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: 15_000, headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const redirectUrl = new URL(res.headers.location, url).toString();
        downloadBinary(redirectUrl, maxRedirects - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`下載中繼憑證失敗：HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('下載中繼憑證逾時')));
    req.on('error', reject);
  });
}

/**
 * 修復憑證鏈：抓取 AIA 中繼憑證，驗證其鏈路後加入信任並快取。
 * 支援透過參數注入自訂獲取邏輯以利單元測試。
 * @returns {Promise<boolean>} 是否成功修復
 */
export async function repairTlsChain({
  getLeaf = getPeerLeafCertificate,
  download = downloadBinary,
  rootCerts = tls.rootCertificates,
  caFilePath = EXTRA_CA_FILE
} = {}) {
  if (!USE_TLS) return false;
  try {
    const leafRaw = await getLeaf();
    if (!leafRaw) return false;
    const urls = extractAiaUrls(leafRaw);
    if (!urls.length) return false;

    const leafCert = new crypto.X509Certificate(toPem(leafRaw));
    const roots = rootCerts.map((pem) => (pem instanceof crypto.X509Certificate ? pem : new crypto.X509Certificate(pem)));

    for (const url of urls) {
      let candidate;
      try {
        candidate = toPem(await download(url));
      } catch {
        continue;
      }
      if (!candidate) continue;

      let interCert;
      try {
        interCert = new crypto.X509Certificate(candidate);
      } catch {
        continue;
      }

      // 1) 中繼憑證必須確實簽發了這張葉憑證
      if (leafCert.issuer !== interCert.subject) continue;
      if (!safeVerify(leafCert, interCert.publicKey)) continue;

      // 2) 中繼憑證本身必須由受信任根憑證簽發
      const trustedRoot = roots.some(
        (root) => root.subject === interCert.issuer && safeVerify(interCert, root.publicKey)
      );
      if (!trustedRoot) continue;

      extraCaPem = candidate;
      buildAgent();
      try {
        await mkdir(path.dirname(caFilePath), { recursive: true });
        await writeFile(caFilePath, candidate, 'utf8');
      } catch {}
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

function rawRequest(method, relativePath, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const lib = USE_TLS ? https : http;
    const basePath = BASE.pathname.endsWith('/') ? BASE.pathname : BASE.pathname + '/';
    const cleanRelative = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
    const options = {
      protocol: BASE.protocol,
      hostname: BASE.hostname,
      port: BASE.port || undefined,
      path: basePath + cleanRelative,
      method,
      headers,
      agent: getAgent(),
      timeout: timeoutMs
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      const err = new Error('請求逾時');
      err.code = 'ETIMEDOUT';
      req.destroy(err);
    });
    if (body !== undefined) req.write(body);
    req.end();
  });
}

export function isTlsChainError(err) {
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  return (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    code === 'CERT_UNTRUSTED' ||
    /unable to verify the first certificate|unable to get (?:local )?issuer|certificate chain|self[- ]signed certificate/i.test(message)
  );
}

export function toApiError(err) {
  if (err instanceof ApiError) return err;
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  if (code === 'ETIMEDOUT') return new ApiError('請求逾時（學校系統沒有回應）', { status: 0, transient: true });
  if (code === 'ENOTFOUND') return new ApiError('找不到主機（請確認網路或 DNS）', { status: 0, transient: true });
  if (code === 'EAI_AGAIN') return new ApiError('DNS 查詢失敗（暫時無法解析校方網址）', { status: 0, transient: true });
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENETUNREACH' || code === 'EHOSTUNREACH')
    return new ApiError(`網路連線失敗（${code}）`, { status: 0, transient: true });
  if (/CERT|SSL|TLS/i.test(code + msg))
    return new ApiError(`TLS 憑證驗證失敗（${code || msg}）`, { status: 0, transient: true });
  return new ApiError(`網路連線失敗：${msg || err || '未知錯誤'}`, { status: 0, transient: true });
}

export async function request(method, relativePath, { body, token, timeoutMs = 25_000, rawText = false } = {}) {
  const headers = { ...JSON_HEADERS };
  if (token) headers.Authorization = 'Bearer ' + token;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload !== undefined) headers['Content-Length'] = Buffer.byteLength(payload);

  let response;
  let retried = false;

  while (true) {
    try {
      response = await rawRequest(method, relativePath, headers, payload, timeoutMs);
      break;
    } catch (err) {
      if (isTlsChainError(err) && !retried) {
        retried = true;
        if (!repairPromise) {
          repairPromise = currentRepairFn().finally(() => {
            repairPromise = null;
          });
        }
        const repaired = await repairPromise;
        if (repaired) {
          continue;
        }
      }
      throw toApiError(err);
    }
  }

  const text = String(response.body || '').replace(/^\uFEFF/, '').trim();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (response.status < 200 || response.status >= 300) {
    let message = json?.message || json?.Message;
    if (!message && text) {
      const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        message = titleMatch[1].trim();
      }
    }
    message = message || `HTTP ${response.status} ${method} ${relativePath}`;
    throw new ApiError(message, {
      status: response.status,
      payload: json ?? text.slice(0, 800),
      transient: isTransientStatus(response.status)
    });
  }

  if (rawText) {
    return { text, json, status: response.status };
  }

  if (!json && text.length > 0) {
    throw new ApiError('校方伺服器回應非 JSON 格式（可能正在維護或連線逾時）', {
      status: response.status,
      payload: text.slice(0, 800),
      transient: true
    });
  }

  const safe = json ?? {};
  if (safe.success === false) {
    throw new ApiError(safe.message || '伺服器回報失敗', { status: 200, payload: safe });
  }
  return safe;
}

/* ------------------------------------------------------------------ */
/* 業務 API                                                            */
/* ------------------------------------------------------------------ */

/**
 * 登入。
 * @returns {{token: string, emp_id: string, emp_nm: string, emp_dp?: string, emp_rl: string}}
 */
export async function login(username, password) {
  if (!username || !password) {
    throw new ApiError('請提供帳號與密碼', { status: 400 });
  }
  const json = await request('POST', 'api/Login/Auth', {
    body: { username: String(username), password: String(password) }
  });
  const user = json?.res;
  if (!user || !user.token) {
    throw new ApiError(json?.message || '登入失敗（未取得憑證）', { status: 401, payload: json });
  }
  return user;
}

/** 講座清單（學生視角 X01F00）。公開端點；帶 token 才能看到自己的報名狀態（cnt_10）。 */
export async function listLectures(token) {
  const json = await request('POST', 'api/Cfd01/Load?op=X01F00&eid01=', {
    token,
    body: { op: 'X01F00', sdate: '', edate: '', eid01: '' }
  });
  return Array.isArray(json?.data) ? json.data : [];
}

/** 單場講座明細。 */
export async function getLecture(token, eid01) {
  const json = await request('GET', `api/Cfd01/GetRes?eid01=${encodeURIComponent(eid01 || '')}`, { token });
  return Array.isArray(json?.data) ? json.data[0] || null : null;
}

/** 身份驗證：以身分證末四碼換取學生資料（即報名要帶的 std_info）。 */
export async function verifyIdentity(token, { p_no, p_id, p_type = 'S' }) {
  const json = await request('POST', 'api/PersonInfo/GetPInfo', {
    token,
    body: { p_no: String(p_no), p_id: String(p_id), p_type }
  });
  const info = Array.isArray(json?.data) ? json.data[0] : null;
  if (!info) throw new ApiError('身份驗證沒有回應', { status: 400, payload: json });
  if (info.errmsg) throw new ApiError(String(info.errmsg), { status: 400, payload: info });
  return info;
}

/** 送出報名（搶課核心）。 */
export async function registerLecture(token, { std_info, eid01, reseid }) {
  const safeStdInfo = std_info ? { ...std_info, bfree: std_info.bfree || 'N' } : std_info;
  let json;
  try {
    json = await request('POST', 'api/Cfd10/Save', {
      token,
      body: { std_info: safeStdInfo, eid01, reseid },
      timeoutMs: 20_000
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 200) {
      return { ok: false, message: err.message, raw: err.payload };
    }
    throw err;
  }
  const message = String(json?.message ?? json?.Message ?? '').trim();
  const ok = json?.success !== false && /成功/.test(message) && !/未成功|失敗|錯誤|不正確|已滿|額滿/.test(message);
  return { ok, message: message || '（系統未回傳訊息）', raw: json };
}

/** 退選（傳入校方加密退選代碼 regEid）。 */
export async function cancelLecture(token, regEid) {
  if (!token) throw new ApiError('請先登入', { status: 401 });
  if (!regEid) throw new ApiError('缺少退選代號', { status: 400 });

  const { text, json } = await request('POST', `api/cfd10/DeleteData?reseid=${encodeURIComponent(regEid)}`, {
    token,
    body: {},
    timeoutMs: 20_000,
    rawText: true
  });

  // 校方 DeleteData 成功時回傳空字串 "" 或 JSON 格式的 ""
  if (!text || text === '""' || json === '') {
    return { ok: true, message: '已成功取消報名' };
  }

  // 若回傳非空字串，為校方系統錯誤訊息（如 Base-64 錯誤、超過退選時間等）
  let message = text;
  if (json) {
    message = json?.message || json?.Message || text;
  }
  throw new ApiError(message || '退選失敗', { status: 400, payload: text });
}

/** 已報名 / 已退選清單。 */
export async function listRegistered(token) {
  const json = await request('POST', 'api/Cfd01/Load_del?op=X01F00DEL&eid01=', {
    token,
    body: { op: 'X01F00DEL', eid01: '', reseid: '' }
  });
  return Array.isArray(json?.data) ? json.data : [];
}

export const STATUS_LABEL = {
  Y: '可報名',
  F: '已額滿',
  N1: '未開放',
  N2: '已截止',
  C: '現場報名',
  D: '其他方式'
};
