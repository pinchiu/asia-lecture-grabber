/**
 * 亞洲大學「講座自動報名助手」Model Context Protocol (MCP) 伺服器模組。
 *
 * 遵循 2026-07-28 最新 Model Context Protocol (MCP) 無狀態架構規範，支援：
 * 1. 完全無狀態核心（Stateless Request/Response Core）：無需 stateful session，各請求自包含
 * 2. 標頭路由導向（Header-Based Routing）：支援 Mcp-Method 與 Mcp-Name HTTP 標頭
 * 3. 快取中繼標註（Cache Metadata）：tools/list 包含 ttlMs 與 cacheScope
 * 4. 2026-07-28 Tasks 標準擴展原語（tasks/list, tasks/get, tasks/cancel）
 * 5. 雙向通訊介面：
 *    - CLI stdio 管道：供 Claude Desktop、Cursor、Antigravity 等終端 AI Agent 調用
 *    - HTTP 端點：供 Web / 雲端代理透過 POST /api/mcp 調用
 *
 * 核心工具（Tools）：
 *   - asia_list_lectures: 講座清冊查詢與素養篩選
 *   - asia_get_lecture: 單場講座詳細規格
 *   - asia_check_graduation: 四大素養畢業門檻進度評估與缺額推薦
 *   - asia_register_lecture: 手動秒報指定講座
 *   - asia_cancel_lecture: 退選已報名講座
 *   - asia_get_calendar: 個人行程與時段衝堂檢驗
 *   - asia_manage_targets: 搶課引擎監控目標佇列管理
 *   - asia_get_engine_status: 引擎即時監控狀態與日誌
 */

import readline from 'node:readline';
import * as defaultApi from './asia.mjs';
import * as defaultStorage from './storage.mjs';
import { extractLiteracies, buildCalendar, findConflicts } from './calendar.mjs';

export const MCP_SERVER_INFO = {
  name: 'asia-lecture-grabber',
  version: '2.0.0'
};

export const MCP_PROTOCOL_VERSION = '2026-07-28';
export const SUPPORTED_PROTOCOL_VERSIONS = ['2026-07-28', '2024-11-05'];

export const MCP_TOOLS = [
  {
    name: 'asia_list_lectures',
    description: '查詢亞洲大學當期通識講座清單，支援依四大素養（健康力、關懷力、創新力、卓越力）、報名狀態（可報名、已額滿等）與關鍵字篩選。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜尋關鍵字（課程名稱、講者或地點）'
        },
        literacy: {
          type: 'string',
          enum: ['健康力', '關懷力', '創新力', '卓越力', '一般'],
          description: '篩選特定素養類別'
        },
        status: {
          type: 'string',
          enum: ['Y', 'F', 'N1', 'N2', 'C', 'D'],
          description: '篩選報名狀態：Y(可報名)、F(已額滿)、N1(未開放)、N2(已截止)、C(現場報名)'
        },
        limit: {
          type: 'integer',
          description: '回傳筆數上限，預設 50 筆'
        }
      }
    }
  },
  {
    name: 'asia_get_lecture',
    description: '以講座識別碼（eid01）查詢單場講座之完整規格資訊（含主辦單位、時間、地點、名額、四大素養與報名起訖時間）。',
    inputSchema: {
      type: 'object',
      properties: {
        eid01: {
          type: 'string',
          description: '講座唯一識別碼（如 L01）'
        }
      },
      required: ['eid01']
    }
  },
  {
    name: 'asia_check_graduation',
    description: '分析目前已報名場次與歷年補登紀錄，計算四大基本素養（健康力、關懷力、創新力、卓越力各需 ≥ 2 次，總場合計需 ≥ 8 場）之畢業門檻達成率與尚缺場次。',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'asia_register_lecture',
    description: '直接向校方系統送出指定講座之報名請求。具備零延遲直報特性，支援無障礙空間需求設定。',
    inputSchema: {
      type: 'object',
      properties: {
        eid01: {
          type: 'string',
          description: '要報名的講座識別碼（eid01）'
        },
        bfree: {
          type: 'string',
          enum: ['Y', 'N'],
          description: '無障礙空間需求（預設 N）'
        }
      },
      required: ['eid01']
    }
  },
  {
    name: 'asia_cancel_lecture',
    description: '取消已報名之講座（退選）。系統會自動比對校方伺服器核發之加密流水代號並完成退選。',
    inputSchema: {
      type: 'object',
      properties: {
        eid01: {
          type: 'string',
          description: '要取消報名的講座代號或識別碼'
        }
      },
      required: ['eid01']
    }
  },
  {
    name: 'asia_get_calendar',
    description: '取得個人已報名講座之時間行程清冊，並自動交叉檢驗各場次之間是否存在時段重疊衝堂。',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'asia_manage_targets',
    description: '操作本機搶課引擎的監控目標清單（加入目標、移除目標、或清除已完成目標）。',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'remove', 'clear_finished', 'list'],
          description: '操作類型'
        },
        eid01: {
          type: 'string',
          description: '講座識別碼（action 為 add 或 remove 時必填）'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'asia_get_engine_status',
    description: '取得目前搶課引擎的即時運作狀態（待命、輪詢中、爆速模式）、登入 Session 資訊、已執行輪詢次數與最近日誌。',
    inputSchema: {
      type: 'object',
      properties: {
        logLimit: {
          type: 'integer',
          description: '回傳最新日誌筆數，預設 20 筆'
        }
      }
    }
  }
];

/**
 * 處理單一 JSON-RPC 2.0 請求（符合 MCP 2026-07-28 無狀態協定規範）。
 */
export async function handleJsonRpcMessage(message, context = {}) {
  if (!message || typeof message !== 'object') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request: payload must be a JSON object' }
    };
  }

  const headers = context.headers || {};
  const headerMethod = headers['mcp-method'] || headers['Mcp-Method'];
  const headerName = headers['mcp-name'] || headers['Mcp-Name'];

  const id = message.id ?? null;
  const method = String(message.method || headerMethod || '').trim();
  const params = message.params || {};

  // 2026-07-28 規範：支援請求中傳遞 _meta 協議資料
  const clientMeta = params._meta || {};

  switch (method) {
    case 'initialize': {
      const requestedVersion = String(params.protocolVersion || clientMeta.protocolVersion || '');
      const chosenVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requestedVersion)
        ? requestedVersion
        : MCP_PROTOCOL_VERSION;

      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: chosenVersion,
          capabilities: {
            tools: {
              listChanged: false
            },
            tasks: {
              list: true,
              get: true,
              cancel: true
            }
          },
          serverInfo: MCP_SERVER_INFO,
          _meta: {
            stateless: true,
            specDate: '2026-07-28'
          }
        }
      };
    }

    case 'notifications/initialized': {
      return null;
    }

    case 'ping': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          status: 'ok',
          _meta: {
            protocolVersion: MCP_PROTOCOL_VERSION
          }
        }
      };
    }

    case 'tools/list': {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS,
          _meta: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            ttlMs: 60000,
            cacheScope: 'global'
          }
        }
      };
    }

    case 'tools/call': {
      const toolName = params?.name || headerName;
      const args = params?.arguments || {};

      if (!toolName) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Invalid params: tool name is required in params.name or Mcp-Name header'
          }
        };
      }

      try {
        const toolResult = await executeTool(toolName, args, context);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
              }
            ],
            _meta: {
              protocolVersion: MCP_PROTOCOL_VERSION
            }
          }
        };
      } catch (err) {
        const isParamError = err?.name === 'InvalidParamError' || String(err?.message || '').startsWith('缺少必要參數');
        if (isParamError) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Invalid params: ${err?.message || err}`
            }
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `執行工具「${toolName}」失敗：${err?.message || err}`
              }
            ],
            _meta: {
              protocolVersion: MCP_PROTOCOL_VERSION
            }
          }
        };
      }
    }

    // 2026-07-28 Tasks Primitive 原語擴展
    case 'tasks/list': {
      const engine = context.engine;
      const tasks = [];
      if (engine) {
        const state = engine.getState();
        tasks.push({
          taskId: 'grab-engine-poller',
          name: '亞洲大學通識搶課輪詢器',
          status: state.running ? 'running' : 'idle',
          mode: state.mode,
          targetsCount: state.targets?.length || 0,
          totalPolls: state.stats?.polls || 0,
          totalSuccess: state.stats?.successes || 0
        });
      }
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tasks,
          _meta: {
            protocolVersion: MCP_PROTOCOL_VERSION
          }
        }
      };
    }

    case 'tasks/get': {
      const taskId = params.taskId;
      if (!taskId) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Invalid params: taskId is required'
          }
        };
      }

      const engine = context.engine;
      if (taskId === 'grab-engine-poller' && engine) {
        const state = engine.getState();
        return {
          jsonrpc: '2.0',
          id,
          result: {
            taskId,
            name: '亞洲大學通識搶課輪詢器',
            status: state.running ? 'running' : 'idle',
            mode: state.mode,
            targets: engine.targetsView(),
            stats: state.stats,
            _meta: {
              protocolVersion: MCP_PROTOCOL_VERSION
            }
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: `Task not found: ${taskId}`
        }
      };
    }

    case 'tasks/cancel': {
      const taskId = params.taskId;
      if (!taskId) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Invalid params: taskId is required'
          }
        };
      }

      const engine = context.engine;
      if (taskId === 'grab-engine-poller' && engine) {
        engine.stop();
        return {
          jsonrpc: '2.0',
          id,
          result: {
            taskId,
            cancelled: true,
            message: '搶課輪詢器已成功停止',
            _meta: {
              protocolVersion: MCP_PROTOCOL_VERSION
            }
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: `Task not found: ${taskId}`
        }
      };
    }

    default: {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method || '<empty>'}`
        }
      };
    }
  }
}

/**
 * 執行特定 MCP 工具呼叫。
 */
export async function executeTool(name, args = {}, context = {}) {
  const api = context.api || defaultApi;
  const storage = context.storage || defaultStorage;
  const engine = context.engine;
  const token = engine?.session?.token || null;

  switch (name) {
    case 'asia_list_lectures': {
      let rows = engine?.lectures || [];
      if (!rows.length) {
        rows = await api.listLectures(token);
        if (engine) engine.applyRows(rows);
      }

      let filtered = rows;
      if (args.keyword) {
        const kw = String(args.keyword).toLowerCase();
        filtered = filtered.filter((r) =>
          String(r.rescnm || '').toLowerCase().includes(kw) ||
          String(r.teachm || '').toLowerCase().includes(kw) ||
          String(r.locale || '').toLowerCase().includes(kw) ||
          String(r.reseid || '').toLowerCase().includes(kw)
        );
      }

      if (args.status) {
        filtered = filtered.filter((r) => String(r.canapp || '') === args.status);
      }

      if (args.literacy) {
        filtered = filtered.filter((r) => {
          const lits = extractLiteracies(r);
          if (args.literacy === '一般') return lits.length === 0;
          return lits.includes(args.literacy);
        });
      }

      const limit = Math.max(1, Math.min(Number(args.limit || 50), 200));
      const result = filtered.slice(0, limit).map((r) => ({
        eid01: r.eid01,
        code: r.reseid,
        title: r.rescnm,
        speaker: r.teachm || '-',
        time: `${r.stime || ''}-${r.etime || ''}`,
        date: r.rescsd || r.resdat || '-',
        place: r.locale || '-',
        status: r.canapp,
        statusText: api.STATUS_LABEL[r.canapp] || '未知',
        capacity: `${r.selnum || 0}/${r.maxstd || r.webstd || '-'}`,
        registered: Number(r.cnt_10 || 0) > 0,
        literacies: extractLiteracies(r)
      }));

      return {
        totalMatches: filtered.length,
        returned: result.length,
        lectures: result
      };
    }

    case 'asia_get_lecture': {
      if (!args.eid01) throw new Error('缺少必要參數：eid01');
      const detail = await api.getLecture(token, String(args.eid01));
      if (!detail) throw new Error(`找不到代號為 ${args.eid01} 的講座`);
      return {
        ...detail,
        statusText: api.STATUS_LABEL[detail.canapp] || '未知',
        literacies: extractLiteracies(detail)
      };
    }

    case 'asia_check_graduation': {
      const config = await storage.loadConfig();
      const hist = config?.graduation?.history || {};

      let registeredList = [];
      if (token) {
        try {
          registeredList = await api.listRegistered(token);
        } catch {}
      }

      const currentLits = {
        健康力: Number(hist.health || 0),
        關懷力: Number(hist.care || 0),
        創新力: Number(hist.innovation || 0),
        卓越力: Number(hist.excellence || 0)
      };

      const countedEids = new Set();
      for (const row of registeredList) {
        if (!countedEids.has(row.eid01)) {
          countedEids.add(row.eid01);
          const lits = extractLiteracies(row);
          for (const lit of lits) {
            if (currentLits[lit] !== undefined) currentLits[lit] += 1;
          }
        }
      }

      const currentTotal = Number(hist.total || 0) + countedEids.size;
      const threshold = { total: 8, health: 2, care: 2, innovation: 2, excellence: 2 };

      const deficiencies = [];
      if (currentLits['健康力'] < threshold.health) deficiencies.push({ literacy: '健康力', need: threshold.health - currentLits['健康力'] });
      if (currentLits['關懷力'] < threshold.care) deficiencies.push({ literacy: '關懷力', need: threshold.care - currentLits['關懷力'] });
      if (currentLits['創新力'] < threshold.innovation) deficiencies.push({ literacy: '創新力', need: threshold.innovation - currentLits['創新力'] });
      if (currentLits['卓越力'] < threshold.excellence) deficiencies.push({ literacy: '卓越力', need: threshold.excellence - currentLits['卓越力'] });

      const totalNeed = Math.max(0, threshold.total - currentTotal);
      const isGraduationReady = deficiencies.length === 0 && totalNeed === 0;

      return {
        isGraduationReady,
        progress: {
          total: { current: currentTotal, threshold: threshold.total, fulfilled: currentTotal >= threshold.total },
          health: { current: currentLits['健康力'], threshold: threshold.health, fulfilled: currentLits['健康力'] >= threshold.health },
          care: { current: currentLits['關懷力'], threshold: threshold.care, fulfilled: currentLits['關懷力'] >= threshold.care },
          innovation: { current: currentLits['創新力'], threshold: threshold.innovation, fulfilled: currentLits['創新力'] >= threshold.innovation },
          excellence: { current: currentLits['卓越力'], threshold: threshold.excellence, fulfilled: currentLits['卓越力'] >= threshold.excellence }
        },
        deficiencies,
        totalNeed
      };
    }

    case 'asia_register_lecture': {
      if (!args.eid01) throw new Error('缺少必要參數：eid01');
      if (!engine) throw new Error('本機引擎尚未就緒');
      if (!engine.session?.token) throw new Error('請先於搶課助手登入帳號');
      if (args.bfree) {
        engine.settings.bfree = args.bfree === 'Y' ? 'Y' : 'N';
      }
      const message = await engine.manualRegister(String(args.eid01));
      return { ok: true, message, eid01: args.eid01 };
    }

    case 'asia_cancel_lecture': {
      if (!args.eid01) throw new Error('缺少必要參數：eid01');
      if (!engine) throw new Error('本機引擎尚未就緒');
      if (!engine.session?.token) throw new Error('請先於搶課助手登入帳號');
      const title = await engine.cancelTarget(String(args.eid01));
      return { ok: true, message: `已成功取消報名：${title}` };
    }

    case 'asia_get_calendar': {
      let registered = [];
      if (token) {
        try {
          registered = await api.listRegistered(token);
        } catch {}
      }
      const allRows = [...(engine?.lectures || []).filter((r) => Number(r.cnt_10 || 0) > 0), ...registered];
      const events = buildCalendar(allRows);
      const conflictIds = findConflicts(events);

      const items = events.map((ev) => ({
        eid01: ev.eid01,
        title: ev.title,
        date: ev.dateText,
        time: ev.timeText,
        place: ev.place,
        literacies: ev.literacies,
        hasConflict: conflictIds.has(ev.eid01)
      }));

      return {
        totalEvents: items.length,
        conflictCount: conflictIds.size,
        events: items
      };
    }

    case 'asia_manage_targets': {
      if (!engine) throw new Error('搶課引擎尚未就緒');
      const action = args.action;

      if (action === 'list') {
        return { targets: engine.targetsView() };
      }
      if (action === 'clear_finished') {
        engine.clearFinished();
        return { ok: true, message: '已清除已完成目標', targets: engine.targetsView() };
      }
      if (action === 'remove') {
        if (!args.eid01) throw new Error('缺少必要參數：eid01');
        engine.removeTarget(String(args.eid01));
        return { ok: true, message: `已移除目標 ${args.eid01}`, targets: engine.targetsView() };
      }
      if (action === 'add') {
        if (!args.eid01) throw new Error('缺少必要參數：eid01');
        let lectures = engine.lectures || [];
        if (!lectures.length) {
          lectures = await api.listLectures(token);
          engine.applyRows(lectures);
        }
        const row = lectures.find((r) => String(r.eid01) === String(args.eid01));
        if (!row) throw new Error(`在講座清冊中找不到代號為 ${args.eid01} 的講座`);
        const added = engine.addTargets([row], 1);
        return { ok: true, addedCount: added.length, targets: engine.targetsView() };
      }
      throw new Error(`不支援的 action: ${action}`);
    }

    case 'asia_get_engine_status': {
      if (!engine) throw new Error('搶課引擎尚未就緒');
      const limit = Math.max(1, Math.min(Number(args.logLimit || 20), 100));
      const logs = engine.logs.slice(-limit);
      return {
        session: engine.sessionView(),
        state: engine.getState(),
        recentLogs: logs
      };
    }

    default:
      throw new Error(`未知的工具名稱：${name}`);
  }
}

/**
 * 啟動基於標準輸入輸出的 stdio JSON-RPC MCP 伺服器。
 */
export function runStdioMcpServer(context = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    const trimmed = String(line || '').trim();
    if (!trimmed) return;

    try {
      const message = JSON.parse(trimmed);
      const response = await handleJsonRpcMessage(message, context);
      if (response !== null) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error: invalid JSON' }
        }) + '\n'
      );
    }
  });

  process.stderr.write(`[asia-mcp] Asia Lecture Grabber MCP Server is running over stdio (spec 2026-07-28).\n`);
}

// 若直接以 node src/mcp.mjs 執行，自動啟動 stdio MCP 伺服器
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  runStdioMcpServer();
}
