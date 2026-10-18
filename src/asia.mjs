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

const BASE = new URL(BASE_URL);
const USE_TLS = BASE.protocol === 'https:';
const EXTRA_CA_FILE = path.join(DATA_DIR, 'extra-ca.pem');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const JSON_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/json;charset=UTF-8',
  Pragma: 'no-cache',
  'User-Agent': USER_AGENT
};

function isTransientStatus(status) {
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
let repairAttempted = false;

try {
  extraCaPem = (await readFile(EXTRA_CA_FILE, 'utf8')).trim();
} catch {
  extraCaPem = '';
}

function buildAgent() {
  if (!USE_TLS) return;
  const ca = [...tls.rootCertificates];
  if (extraCaPem) ca.push(extraCaPem);
  agent = new https.Agent({ keepAlive: true, maxSockets: 6, timeout: 30_000, ca });
}

function getAgent() {
  if (!USE_TLS) return undefined;
  if (!agent) buildAgent();
  return agent;
}

function toPem(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('latin1') : String(buffer);
  if (text.includes('-----BEGIN CERTIFICATE-----')) return text;
  const base64 = Buffer.from(buffer).toString('base64').match(/.{1,64}/g).join('\n');
  return `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----\n`;
}

function safeVerify(cert, publicKey) {
  try {
    return cert.verify(publicKey);
  } catch {
    return false;
  }
}

function extractAiaUrls(rawDer) {
  const text = Buffer.from(rawDer).toString('latin1');
  const matches = text.match(/https?:\/\/[^\x00-\x20\x80-\xff]+?\.crt/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/#+$/, '')))];
}

function getPeerLeafCertificate() {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: BASE.hostname,
        port: Number(BASE.port || 443),
        servername: BASE.hostname,
        rejectUnauthorized: false
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          socket.end();
          if (!cert || !cert.raw) reject(new Error('無法取得伺服器憑證'));
          else resolve(cert.raw);
        } catch (err) {
          reject(err);
        }
      }
    );
    socket.on('error', reject);
    socket.setTimeout(15_000, () => socket.destroy(new Error('讀取憑證逾時')));
  });
}

function downloadBinary(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: 15_000, headers: { 'User-Agent': USER_AGENT } }, (res) => {
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
 * @returns {Promise<boolean>} 是否成功修復
 */
async function repairTlsChain() {
  if (!USE_TLS) return false;
  try {
    const leafRaw = await getPeerLeafCertificate();
    const urls = extractAiaUrls(leafRaw);
    if (!urls.length) return false;

    const leafCert = new crypto.X509Certificate(toPem(leafRaw));
    const roots = tls.rootCertificates.map((pem) => new crypto.X509Certificate(pem));

    for (const url of urls) {
      let candidate;
      try {
        candidate = toPem(await downloadBinary(url));
      } catch {
        continue;
      }

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
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(EXTRA_CA_FILE, candidate, 'utf8');
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
    const options = {
      protocol: BASE.protocol,
      hostname: BASE.hostname,
      port: BASE.port || undefined,
      path: BASE.pathname + relativePath,
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

function isTlsChainError(err) {
  const code = String(err?.code || '');
  const message = String(err?.message || '');
  return (
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    /unable to verify the first certificate|unable to get local issuer|certificate chain/i.test(message)
  );
}

function toApiError(err) {
  const code = String(err?.code || '');
  if (code === 'ETIMEDOUT') return new ApiError('請求逾時（學校系統沒有回應）', { status: 0, transient: true });
  if (code === 'ENOTFOUND') return new ApiError('找不到主機（請確認網路或 DNS）', { status: 0, transient: true });
  if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ENETUNREACH')
    return new ApiError(`網路連線失敗（${code}）`, { status: 0, transient: true });
  if (/CERT|SSL|TLS/i.test(code + err?.message))
    return new ApiError(`TLS 憑證驗證失敗（${code || err?.message}）`, { status: 0, transient: true });
  return new ApiError(`網路連線失敗：${err?.message || err}`, { status: 0, transient: true });
}

async function request(method, relativePath, { body, token, timeoutMs = 25_000 } = {}) {
  const headers = { ...JSON_HEADERS };
  if (token) headers.Authorization = 'Bearer ' + token;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload !== undefined) headers['Content-Length'] = Buffer.byteLength(payload);

  let response;
  try {
    response = await rawRequest(method, relativePath, headers, payload, timeoutMs);
  } catch (err) {
    if (isTlsChainError(err) && !repairAttempted) {
      repairAttempted = true;
      const repaired = await repairTlsChain();
      if (repaired) {
        response = await rawRequest(method, relativePath, headers, payload, timeoutMs);
      } else {
        throw toApiError(err);
      }
    } else {
      throw toApiError(err);
    }
  }

  const text = String(response.body || '').replace(/^\uFEFF/, '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (response.status < 200 || response.status >= 300) {
    const message = json?.message || json?.Message || `HTTP ${response.status} ${method} ${relativePath}`;
    throw new ApiError(message, {
      status: response.status,
      payload: json ?? text.slice(0, 800),
      transient: isTransientStatus(response.status)
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
  const json = await request('GET', `api/Cfd01/GetRes?eid01=${encodeURIComponent(eid01)}`, { token });
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
  const json = await request('POST', 'api/Cfd10/Save', {
    token,
    body: { std_info, eid01, reseid },
    timeoutMs: 20_000
  });
  const message = String(json?.message ?? json?.Message ?? '').trim();
  const ok = json?.success !== false && /成功/.test(message) && !/未成功|失敗|錯誤|不正確|已滿|額滿/.test(message);
  return { ok, message: message || '（系統未回傳訊息）', raw: json };
}

/** 退選。 */
export async function cancelLecture(token, reseid) {
  return request('POST', `api/cfd10/DeleteData?reseid=${encodeURIComponent(reseid)}`, { token, body: {} });
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
