---
name: asia-lecture-assistant
description: 亞洲大學講座自動報名助手與畢業素養追蹤 AI 代理技能。遵循 2026-07-28 MCP 無狀態標準，提供當期通識講座查詢、四大素養（健康力/關懷力/創新力/卓越力）畢業門檻審核、衝堂防護與秒報/退選手動與排程調度。TRIGGER when: 使用者詢問亞洲大學講座、通識活動、四大基本素養進度、搶課、報名講座、取消退選、行事曆衝堂檢驗。DO NOT TRIGGER when: 非亞洲大學通識系統、一般非通識學期排課、未提供亞大帳號之離線無關事務。
version: 2.0.0
protocol: mcp-2026-07-28
compatibility: node >= 20.0.0, mcp >= 2026-07-28
metadata:
  author: Asia Lecture Grabber Maintainers
  license: MIT
  specification_date: 2026-07-28
  primitives:
    - tools
    - tasks
  tools:
    - asia_list_lectures
    - asia_get_lecture
    - asia_check_graduation
    - asia_register_lecture
    - asia_cancel_lecture
    - asia_get_calendar
    - asia_manage_targets
    - asia_get_engine_status
  tasks:
    - grab-engine-poller
---

# 亞洲大學通識講座助理 Agent Skill (MCP 2026-07-28 規格)

本 Skill 為外部 AI Agent（如 Claude Desktop、Cursor、Antigravity、OpenCode 等終端環境與雲端代理）提供調用亞洲大學「講座暨通識課程線上報名系統」之完整標準能力。全面遵循 2026-07-28 Model Context Protocol (MCP) 無狀態核心規範。

---

## 1. 協定整合架構 (MCP 2026-07-28 Specification)

本系統支援兩種標準無狀態接入渠道：

### 1.1 CLI Stdio 模式 (本機終端 Agent)
在終端代理之 MCP 配置（例如 `claude_desktop_config.json` 或 `antigravity.json`）中宣告：
```json
{
  "mcpServers": {
    "asia-lecture-grabber": {
      "command": "node",
      "args": ["<REPO_ROOT>/src/mcp.mjs"]
    }
  }
}
```
> `<REPO_ROOT>` 請替換為本專案在本機的絕對路徑。

stdio 進入點會載入 `data/config.json` 與 `data/state.json`、建立本機搶課引擎，並在已記住帳密時於背景自動登入。登入完成前，`asia_register_lecture`、`asia_cancel_lecture` 等需要授權的工具會回傳明確的登入提示；完成後 8 項工具皆可運作。`runStdioMcpServer()` 會拒絕沒有 engine 的 context。

### 1.2 HTTP 無狀態端點模式 (本機 Web 代理)
向伺服器發送標準 JSON-RPC 2.0 POST 請求至 `http://127.0.0.1:5199/api/mcp`。
符合 2026-07-28 規範，支援 HTTP Header-Based Routing：
- 標頭 `Mcp-Method: tools/call`
- 標頭 `Mcp-Name: asia_list_lectures`
- 伺服器回應標頭包含 `Mcp-Protocol-Version: 2026-07-28`
- 安全限制：伺服器預設只綁定 `127.0.0.1`。所有變更狀態的 API（含 `POST /api/mcp`、報名、退選與設定）僅接受 loopback／同源區網 Origin 與 `Content-Type: application/json`；跨站瀏覽器請求會收到 `403`，非 JSON 請求會收到 `415`。非瀏覽器客戶端可省略 Origin。

```http
POST /api/mcp HTTP/1.1
Host: 127.0.0.1:5199
Content-Type: application/json
Mcp-Method: tools/call
Mcp-Name: asia_list_lectures

{
  "jsonrpc": "2.0",
  "id": 1,
  "params": {
    "arguments": {
      "literacy": "創新力",
      "status": "Y"
    }
  }
}
```

---

## 2. 核心工具目錄 (Tool Catalog)

系統提供 8 項核心 Tools，嚴格對齊 JSON-Schema 2020-12 / OpenAPI 3.1 規範：

### 2.1 `asia_list_lectures`
- 職責：查詢當期通識講座清冊，支援多維度篩選。
- 參數：
  - `keyword`（string，選填）：搜尋關鍵字（課程名稱、講者或地點）。
  - `literacy`（string，選填）：篩選素養類別，枚舉：`["健康力", "關懷力", "創新力", "卓越力", "一般"]`。
  - `status`（string，選填）：報名狀態代號，枚舉：`["Y", "F", "N1", "N2", "C", "D"]`。
    - `Y`: 可報名
    - `F`: 額滿待補
    - `N1`: 未開放
    - `N2`: 已截止
    - `C`: 現場報名
  - `refresh`（boolean，選填，預設 false）：設為 true 時強制重新向校方取得清單，不使用本機快取。
  - `limit`（integer，選填，預設 50，上限 200）：回傳筆數。

### 2.2 `asia_get_lecture`
- 職責：以講座唯一識別代碼（`eid01`）查詢單場完整詳細資料。
- 參數：
  - `eid01`（string，必填）：講座唯一識別碼（如 `L01`）。

### 2.3 `asia_check_graduation`
- 職責：精算四大基本素養門檻達成率、尚缺場次與歷年補登進度。
- 門檻規則：
  - 健康力 >= 2 次
  - 關懷力 >= 2 次
  - 創新力 >= 2 次
  - 卓越力 >= 2 次
  - 累積總場合計 >= 8 場
- 參數：無。

### 2.4 `asia_register_lecture`
- 職責：向校方系統直接發送報名請求。具備零 OCR 延遲特性。需先在搶課助手完成登入。
- 參數：
  - `eid01`（string，必填）：要報名的講座識別碼。
  - `bfree`（string，選填）：本次報名的無障礙空間需求（`"Y"` 或 `"N"`）；未提供時沿用本機設定，且不會改寫全域設定。

### 2.5 `asia_cancel_lecture`
- 職責：退選已報名講座。自動匹配校方伺服器加密流水號（格式 `ID...`）確保安全退選。需先在搶課助手完成登入。
- 參數：
  - `eid01`（string，必填）：要取消報名的講座代碼。

### 2.6 `asia_get_calendar`
- 職責：取得學生目前已報名講座行程清單，並自動交叉檢驗衝堂重疊時段。
- 參數：無。

### 2.7 `asia_manage_targets`
- 職責：操作搶課引擎監控目標佇列。
- 參數：
  - `action`（string，必填）：枚舉 `["add", "remove", "clear_finished", "list"]`。
  - `eid01`（string，當 action 為 `add` 或 `remove` 時必填）：講座識別碼。

### 2.8 `asia_get_engine_status`
- 職責：取得搶課狀態機即時狀態、輪詢統計與最近執行日誌。
- 參數：
  - `logLimit`（integer，選填，預設 20，上限 100）：回傳日誌筆數。

---

## 3. 2026-07-28 Tasks 原語生命週期 (Tasks Lifecycle)

針對非同步搶課與定時排程，本模組實作 2026-07-28 Tasks 標準擴展原語：

- `tasks/list`：列出所有執行中的背景任務（如搶課引擎輪詢任務 `grab-engine-poller`）。
- `tasks/get`：依 `taskId` 查詢任務執行進度、輪詢次數、成功場次與目標清冊；與 `tasks/list` 使用相同任務視圖。
- `tasks/cancel`：中止搶課任務運作，避免無謂消耗伺服器資源。
- 錯誤碼：缺少 `taskId` 回傳 `-32602`；未知 `taskId` 或引擎尚未就緒回傳 `-32001`。

---

## 4. 最佳決策工作流程 (Agent Decision Workflows)

外部 AI Agent 在引導學生時，應遵循下列標準決策樹：

```
[使用者提出需求]
   │
   ├─► 詢問畢業進度 / 缺哪些講座？
   │      └─► 呼叫 asia_check_graduation
   │            └─► 提取 deficiencies（缺額素養）
   │                  └─► 呼叫 asia_list_lectures 篩選缺額素養與 status="Y"
   │                        └─► 呼叫 asia_get_calendar 驗證不衝堂後推薦
   │
   ├─► 要求手動報名特定講座？
   │      └─► 呼叫 asia_get_calendar 檢查是否已報名或時段衝突
   │            └─► 無衝突 ──► 呼叫 asia_register_lecture (eid01, bfree="N")
   │
   ├─► 目標講座已額滿（status="F"）？
   │      └─► 呼叫 asia_manage_targets (action="add", eid01=...)
   │            └─► 啟動搶課狀態機守候名額釋出
   │
   └─► 要求退選講座？
          └─► 提示學生二段式確認 ──► 呼叫 asia_cancel_lecture (eid01=...)
```

---

## 5. 安全防護與防幻覺準則 (Safety & Guardrails)

1. **100% 存在性校驗**：嚴禁 Agent 虛構不存在的 `eid01` 或講座名稱。所有報名或加入目標之 `eid01` 必須來自 `asia_list_lectures` 的實際回傳。
2. **單場多素養計算規範**：單場講座若同時具備多種素養（例如同時為關懷力與創新力），學生參加該場講座在四大素養指標上可各自累計 1 次，但**總場次僅計算 1 場**。門檻精算一律以 `asia_check_graduation` 回傳為準。
3. **退選實體安全防護**：退選涉及實體曠課風險。嚴禁在未成功獲得校方 API 成功回應前擅自標記為已退選。
4. **無障礙標籤規範**：無障礙空間需求預設一律為 `"N"`，除非學生明確提出需求，方可設為 `"Y"`。
5. **風格約束**：全專案嚴禁使用任何表情符號（Emoji），文字輸出使用繁體中文。
