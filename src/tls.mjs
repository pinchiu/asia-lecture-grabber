/**
 * TLS 憑證鏈輔助模組。
 *
 * 校方 IIS 只回傳葉憑證、未附中繼 CA，Node 預設信任庫無法補鏈。本模組提供：
 * 1. 憑證編碼轉換與 AIA 網址提取（toPem、extractAiaUrls）
 * 2. 葉憑證讀取與中繼憑證下載（getPeerLeafCertificate、downloadBinary）
 * 3. 中繼憑證鏈路驗證（由 repairTlsChain 於 asia.mjs 組合使用）
 * 4. TLS 鏈路錯誤辨識與連線池建立
 *
 * 所有函式皆以明確參數操作，不依賴模組全域狀態，方便獨立測試與重用。
 */

import https from 'node:https';
import http from 'node:http';
import tls from 'node:tls';
import net from 'node:net';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * 將 DER 或 PEM 憑證轉為標準 PEM 字串。
 * @param {Buffer|string|null|undefined} buffer
 * @returns {string}
 */
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

/**
 * 安全驗證憑證簽章；任何例外皆視為驗證失敗。
 * @param {object} cert
 * @param {object} publicKey
 * @returns {boolean}
 */
export function safeVerify(cert, publicKey) {
  try {
    return cert.verify(publicKey);
  } catch {
    return false;
  }
}

/**
 * 從 DER 憑證中提取 AIA（Authority Information Access）中繼憑證網址。
 * @param {Buffer|string|null|undefined} rawDer
 * @returns {string[]}
 */
export function extractAiaUrls(rawDer) {
  if (!rawDer) return [];
  const buf = Buffer.isBuffer(rawDer) ? rawDer : Buffer.from(rawDer);
  const text = buf.toString('latin1');
  const matches = text.match(/https?:\/\/[^\x00-\x20\x80-\xff]+?\.(?:crt|cer)(?:\?[^\x00-\x20\x80-\xff]*)?/gi) || [];
  return [...new Set(matches.map((url) => url.replace(/#+$/, '')))];
}

/**
 * 讀取指定 HTTPS 伺服器的葉憑證（DER）。
 * 僅用於取得憑證以進行 AIA 補鏈，不涉及任何應用程式資料。
 * @param {string} baseUrl
 * @returns {Promise<Buffer>}
 */
export function getPeerLeafCertificate(baseUrl) {
  return new Promise((resolve, reject) => {
    const base = new URL(baseUrl);
    let timer = null;
    const isIp = net.isIP(base.hostname);
    const socket = tls.connect(
      {
        host: base.hostname,
        port: Number(base.port || 443),
        servername: isIp ? undefined : base.hostname,
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

/**
 * 下載二進位憑證內容，支援有限次數重導向。
 * @param {string} url
 * @param {number} maxRedirects
 * @returns {Promise<Buffer>}
 */
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
 * 判斷錯誤是否屬於 TLS 憑證鏈問題（可透過 AIA 補鏈修復）。
 * @param {Error|null|undefined} err
 * @returns {boolean}
 */
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

/**
 * 建立帶有額外中繼憑證的 KeepAlive 連線池。
 * 根憑證仍使用 Node 內建信任庫，額外憑證只作為補充，不取代原始驗證。
 * @param {string} caPem
 * @returns {https.Agent}
 */
export function createTlsAgent(caPem = '') {
  const ca = [...tls.rootCertificates];
  if (caPem) ca.push(caPem);
  return new https.Agent({ keepAlive: true, maxSockets: 6, timeout: 30_000, ca });
}
