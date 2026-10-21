/**
 * 本機設定與狀態持久化。
 *
 * data/config.json  使用者設定（帳號、輪詢參數、AI 金鑰）
 * data/state.json   目標清單（重啟後保留）
 *
 * 注意：config.json 若勾選「記住帳密」會以明文儲存於本機資料夾，
 * 請勿把 data/ 目錄同步到雲端或分享出去。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(HERE, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

export const DEFAULT_CONFIG = {
  account: { username: '', password: '', idLast4: '' },
  engine: {
    intervalMs: 2500,
    burstIntervalMs: 800,
    burstLeadMs: 120_000,
    postOpenBurstMs: 20_000,
    retryGapMs: 5000,
    minRequestGapMs: 600,
    stopWhenAllDone: false,
    bfree: 'N'
  },
  notify: { sound: true, desktop: true },
  schedule: { enabled: true, entries: [] },
  graduation: {
    history: {
      health: 0,
      care: 0,
      innovation: 0,
      excellence: 0,
      total: 0
    }
  },
  ai: {
    enabled: false,
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    maxTargets: 3
  }
};

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** 深度合併（僅一般物件；陣列直接取代）。 */
export function merge(base, patch) {
  if (!isPlainObject(patch)) return base;
  const out = isPlainObject(base) ? base : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject(out[key])) out[key] = merge(out[key], value);
    else out[key] = value;
  }
  return out;
}

export function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeConfig(config) {
  const c = isPlainObject(config) ? config : structuredClone(DEFAULT_CONFIG);
  if (c.engine) {
    c.engine.intervalMs = clampNumber(c.engine.intervalMs, 1000, 30_000, DEFAULT_CONFIG.engine.intervalMs);
    c.engine.burstIntervalMs = clampNumber(c.engine.burstIntervalMs, 300, 10_000, DEFAULT_CONFIG.engine.burstIntervalMs);
    c.engine.minRequestGapMs = clampNumber(c.engine.minRequestGapMs, 300, 5000, DEFAULT_CONFIG.engine.minRequestGapMs);
    c.engine.retryGapMs = clampNumber(c.engine.retryGapMs, 1000, 60_000, DEFAULT_CONFIG.engine.retryGapMs);
    c.engine.burstLeadMs = clampNumber(c.engine.burstLeadMs, 0, 900_000, DEFAULT_CONFIG.engine.burstLeadMs);
    c.engine.postOpenBurstMs = clampNumber(c.engine.postOpenBurstMs, 2000, 120_000, DEFAULT_CONFIG.engine.postOpenBurstMs);
    c.engine.bfree = String(c.engine.bfree || 'N').toUpperCase() === 'Y' ? 'Y' : 'N';
    c.engine.stopWhenAllDone = Boolean(c.engine.stopWhenAllDone);
  }
  if (c.ai) {
    c.ai.maxTargets = clampNumber(c.ai.maxTargets, 1, 10, DEFAULT_CONFIG.ai.maxTargets);
  }
  if (c.graduation?.history) {
    c.graduation.history.health = Math.max(0, Number(c.graduation.history.health || 0));
    c.graduation.history.care = Math.max(0, Number(c.graduation.history.care || 0));
    c.graduation.history.innovation = Math.max(0, Number(c.graduation.history.innovation || 0));
    c.graduation.history.excellence = Math.max(0, Number(c.graduation.history.excellence || 0));
    c.graduation.history.total = Math.max(0, Number(c.graduation.history.total || 0));
  }
  return c;
}

/**
 * 建立具備路徑隔離與串列化寫入保護之儲存庫實例。
 * @param {{ dataDir?: string }} options
 */
export function createStorage({ dataDir = DATA_DIR } = {}) {
  const configFile = path.join(dataDir, 'config.json');
  const stateFile = path.join(dataDir, 'state.json');

  let configWriteQueue = Promise.resolve();
  let stateWriteQueue = Promise.resolve();

  async function loadConfig() {
    await mkdir(dataDir, { recursive: true });
    try {
      const raw = await readFile(configFile, 'utf8');
      const parsed = JSON.parse(raw);
      const merged = merge(structuredClone(DEFAULT_CONFIG), parsed);
      return sanitizeConfig(merged);
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  function saveConfig(patch) {
    configWriteQueue = configWriteQueue.catch(() => {}).then(async () => {
      const current = await loadConfig();
      const next = sanitizeConfig(merge(current, patch));
      await mkdir(dataDir, { recursive: true });
      await writeFile(configFile, JSON.stringify(next, null, 2), 'utf8');
      return next;
    });
    return configWriteQueue;
  }

  async function loadState() {
    await mkdir(dataDir, { recursive: true });
    try {
      const raw = await readFile(stateFile, 'utf8');
      const parsed = JSON.parse(raw);
      return merge({ targets: [] }, parsed);
    } catch {
      return { targets: [] };
    }
  }

  function saveState(state) {
    stateWriteQueue = stateWriteQueue.catch(() => {}).then(async () => {
      await mkdir(dataDir, { recursive: true });
      const safeState = isPlainObject(state) ? state : { targets: [] };
      await writeFile(stateFile, JSON.stringify(safeState, null, 2), 'utf8');
      return safeState;
    });
    return stateWriteQueue;
  }

  return {
    dataDir,
    configFile,
    stateFile,
    loadConfig,
    saveConfig,
    loadState,
    saveState
  };
}

export const defaultStorage = createStorage({ dataDir: DATA_DIR });

export const loadConfig = () => defaultStorage.loadConfig();
export const saveConfig = (patch) => defaultStorage.saveConfig(patch);
export const loadState = () => defaultStorage.loadState();
export const saveState = (state) => defaultStorage.saveState(state);
