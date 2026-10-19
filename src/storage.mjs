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

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

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
function merge(base, patch) {
  if (!isPlainObject(patch)) return base;
  const out = isPlainObject(base) ? base : {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (isPlainObject(value) && isPlainObject(out[key])) out[key] = merge(out[key], value);
    else out[key] = value;
  }
  return out;
}

export async function loadConfig() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(CONFIG_FILE, 'utf8');
    return merge(structuredClone(DEFAULT_CONFIG), JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

let configWriteQueue = Promise.resolve();

export function saveConfig(patch) {
  configWriteQueue = configWriteQueue.catch(() => {}).then(async () => {
    const current = await loadConfig();
    const next = merge(current, patch);
    next.engine.intervalMs = clampNumber(next.engine.intervalMs, 1000, 30_000, DEFAULT_CONFIG.engine.intervalMs);
    next.engine.burstIntervalMs = clampNumber(next.engine.burstIntervalMs, 300, 10_000, DEFAULT_CONFIG.engine.burstIntervalMs);
    next.ai.maxTargets = clampNumber(next.ai.maxTargets, 1, 10, DEFAULT_CONFIG.ai.maxTargets);
    if (next.graduation?.history) {
      next.graduation.history.total = Math.max(0, Number(next.graduation.history.total || 0));
    }
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
    return next;
  });
  return configWriteQueue;
}

export async function loadState() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    return merge({ targets: [] }, JSON.parse(raw));
  } catch {
    return { targets: [] };
  }
}

export async function saveState(state) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
