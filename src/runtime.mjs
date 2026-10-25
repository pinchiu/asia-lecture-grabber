/**
 * 共用執行期組裝模組。
 *
 * HTTP 服務（server.mjs）與 stdio MCP 伺服器（mcp.mjs）都需要：
 * 1. 載入設定與已儲存目標
 * 2. 建立搶課引擎
 * 3. 以記住的帳密自動登入校方系統
 * 4. 將目標變更去抖動後寫回 storage
 *
 * 這些流程集中在本模組，避免兩個進入點各自複製一份而逐漸漂移。
 */

import { Engine } from './engine.mjs';
import * as defaultApi from './asia.mjs';
import { defaultStorage } from './storage.mjs';

/**
 * 建立引擎執行期。
 * @param {object} options
 * @param {object} [options.storage]
 * @param {object} [options.api]
 * @returns {Promise<{engine: Engine, config: object}>}
 */
export async function createRuntime({ storage = defaultStorage, api = defaultApi } = {}) {
  const config = await storage.loadConfig();
  const savedState = await storage.loadState();
  const engine = new Engine({
    settings: config.engine,
    targets: savedState.targets,
    api
  });
  return { engine, config };
}

/**
 * 將引擎目標變更去抖動後持久化，並回傳可立即沖寫的函式。
 *
 * 注意：本函式會覆寫 `engine.onChange`；同一個 Engine 僅能綁定一次。
 *
 * @param {Engine} engine
 * @param {object} storage
 * @param {number} delayMs
 * @returns {() => Promise<void>}
 */
export function bindStatePersistence(engine, storage, delayMs = 800) {
  let timer = null;

  const flush = async () => {
    clearTimeout(timer);
    timer = null;
    await storage.saveState({ targets: engine.targets });
  };

  engine.onChange = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      flush().catch((err) => console.error('[state] 保存失敗：', err.message));
    }, delayMs);
  };

  return flush;
}

/**
 * 使用設定的帳號密碼自動登入；失敗只記錄警告，不阻斷服務啟動。
 * @param {object} options
 * @param {Engine} options.engine
 * @param {object} options.api
 * @param {object} options.config
 * @returns {Promise<boolean>} 是否成功登入
 */
export async function autoLoginEngine({ engine, api, config }) {
  const username = String(config.account?.username || '').trim();
  const password = String(config.account?.password || '');
  const idLast4 = String(config.account?.idLast4 || '').trim();

  if (!username || !password) return false;

  try {
    engine.log('info', `正在使用已記住的帳號（${username}）自動登入校方系統…`);
    const user = await api.login(username, password);
    engine.setSession({
      token: user.token,
      emp_id: String(user.emp_id || username),
      emp_nm: String(user.emp_nm || ''),
      emp_rl: String(user.emp_rl || ''),
      idLast4,
      username,
      password
    });
    engine.log('success', `[自動登入成功] 歡迎回來，${user.emp_nm || username}`);

    if (idLast4) {
      try {
        await engine.ensureIdentity();
      } catch (err) {
        engine.log('warn', `身分驗證失敗：${err.message}`);
      }
    }

    try {
      const rows = await api.listLectures(engine.session.token);
      engine.applyRows(rows);
      engine.stats.lastSyncAt = Date.now();
    } catch {}

    engine.emit('state');
    return true;
  } catch (err) {
    engine.log('warn', `自動登入失敗（可能密碼已變更）：${err.message}`);
    return false;
  }
}
