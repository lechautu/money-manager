# PRD — AI Gateway (LLM Orchestrator) for Money Manager 2

**Status**: Draft  
**Owner**: Product/Platform  
**Target**: MM2 “tooling-standard” track (MCP-first)  
**Last updated**: 2026-03-02 (Asia/Ho_Chi_Minh)

---

## 1) Context

Money Manager 2 (MM2) hiện có kiến trúc 3-tier:

- **Client (React SPA)** gọi **Tool Gateway** qua REST (JWT).
- **MCP Server** expose tool surface theo **MCP Streamable HTTP** cho AI agents và proxy tool calls sang Tool Gateway (Bearer token), đồng thời enforce tier/approval guard.
- **Tool Gateway** là backend business layer thao tác SQLite file-based.

AI Gateway được giới thiệu để:
- cung cấp **product-facing chat API** cho Client,
- chạy **LLM orchestration loop** (tool-calling) một cách production-grade,
- nhưng vẫn giữ **MCP là canonical tool contract authority** (schema/policy/enforcement).

**Canonical references (existing artifacts)**:
- System architecture: `system_architecture.md`
- Tool manifest: `tools_manifest_v1.json`
- Tool execution policy: `tools_policy.md`

---

## 2) Problem Statement

1) **Client UI cần NLUI** (chat) với session, disambiguation, approvals, nhưng không thể/không nên gọi LLM trực tiếp (keys, cost, quota, abuse).  
2) **MCP Server** phù hợp làm “tool surface chuẩn” và enforcement; không phù hợp làm “conversation runtime / product API” (session state machine, resume flow, provider ops).  
3) Nếu nhúng orchestration vào MCP, MCP bị “god service”, giảm tính chuẩn hoá tooling và khó reuse cho external agent runners.

---

## 3) Goals / Non-goals

### Goals
**G1 — MCP-first tooling**
- AI Gateway **không tự định nghĩa** tool schemas/policy riêng.
- Mọi tool execution **đi qua MCP Server**.

**G2 — Production-grade NLUI runtime**
- Cung cấp REST API ổn định cho Client (chat, streaming option, resume, approvals).
- Quản lý state machine cho “pending options / pending approval”.

**G3 — Governance & Operability**
- Bảo vệ provider keys; quota & rate limit.
- End-to-end tracing (Client → AI GW → MCP → Tool GW).
- Audit-friendly; deterministic evaluation harness-ready.

### Non-goals (v1)
- Multi-agent planner/executor phức tạp.
- Long-term semantic memory; chỉ session + prefs tối thiểu.
- Bỏ qua hoặc thay thế MCP.

---

## 4) Users & Use Cases

### Personas
1) **End User**: thao tác tài chính bằng ngôn ngữ tự nhiên, cần preview rõ trước hành động nhạy cảm.  
2) **Maintainer**: muốn contract chuẩn hoá, debug/test dễ, thay provider/prompt không làm vỡ behavior.  
3) **External agent runner (future)**: gọi MCP trực tiếp, không phụ thuộc AI Gateway.

### Primary use cases (v1)
- Record transaction / transfer funds.
- Search + update status.
- Destructive ops (Tier 2) qua flow confirm.
- “Help / explain” dựa trên read-only analytics (Tier 0).

---

## 5) Architecture Overview (Target)

**Client** → **AI Gateway (REST chat API)** → **LLM Provider**  
**AI Gateway** → **MCP Server (MCP protocol)** → **Tool Gateway (REST)** → **SQLite**

**Key principle**: AI Gateway orchestrates; MCP enforces.

---

## 6) Functional Requirements

### FR-1: Client-facing REST API

#### `POST /ai/chat`
**Purpose**: xử lý một user message (hoặc resume) và trả về assistant message + UI primitives (options/preview/approval).

**Request (proposed)**
```json
{
  "sessionId": "s_123",
  "message": "Xoá các giao dịch ăn uống hôm qua",
  "locale": "vi-VN",
  "timezone": "Asia/Ho_Chi_Minh",
  "clientContext": {
    "currency": "VND",
    "defaultAccountId": "acc_cash"
  },
  "resume": {
    "type": "options|approval",
    "token": "opt_xxx|appr_xxx",
    "selectedOptionIds": ["opt_1"]
  }
}
```

**Response (proposed)**
```json
{
  "sessionId": "s_123",
  "assistantMessage": "Mình tìm thấy 3 giao dịch… Bạn muốn xoá hết chứ?",
  "ui": {
    "options": [{"id":"opt_1","label":"..."}],
    "actionPreview": {
      "title": "Delete 3 transactions",
      "items": [{"id":"tx_1","label":"GrabFood • 120k • 2026-03-01"}]
    }
  },
  "requiresApproval": true,
  "approval": {
    "approvalToken": "appr_abc",
    "expiresAt": "2026-03-02T09:10:00+07:00",
    "actionType": "bulk_delete_transactions",
    "preview": {"count": 3}
  },
  "trace": {
    "traceId": "tr_...",
    "manifestVersion": "1.0",
    "policyVersion": "policy_1"
  }
}
```

#### `POST /ai/approve`
**Purpose**: user confirm/cancel Tier 2 action.

**Request**
```json
{
  "sessionId": "s_123",
  "approvalToken": "appr_abc",
  "decision": "approve"
}
```

**Response**
- `assistantMessage` + `actions[]` + `trace`.

> Note: có thể gộp approve vào `/ai/chat` bằng `resume`, nhưng tách endpoint giúp audit rõ.

---

### FR-2: LLM orchestration loop

AI Gateway thực thi vòng lặp:
1) Build prompt: system + user + minimal context (locale/timezone/prefs) + relevant short history window.
2) Call LLM với tool-calling enabled.
3) Nếu LLM trả tool call:
   - sanity-check tool name allowlist (từ manifest),
   - forward execution tới MCP,
   - append tool result (ok/error) cho LLM.
4) Dừng khi:
   - LLM trả final response, hoặc
   - MCP trả `APPROVAL_REQUIRED`, hoặc
   - vượt budgets (max tool steps / timeout).

**Budgets (config)**
- Max tool calls/turn: 8
- Max wall time/turn: 25s
- Max provider retries: 2 (exponential backoff)

---

### FR-3: MCP integration (tool execution path)

- AI Gateway gọi MCP theo **Streamable HTTP** (session reuse nếu cần).
- Propagate headers:
  - `Authorization: Bearer <MCP_BEARER>`
  - `x-user-id` (actor)
  - `x-request-id` / `x-trace-id` (correlation)
  - Approval only when approved:
    - `x-mm-approval: approved` **hoặc**
    - `X-MM-Approval-Token: <token>` (tùy gateway mode)

**Hard rule**: AI Gateway **không** gọi Tool Gateway trực tiếp.

---

### FR-4: Tier & approval behavior

Tier semantics theo `tools_policy.md`:

- **Tier 0**: auto-run (no confirm).
- **Tier 1**: auto-run nếu args đủ và hợp lệ (backend validate).
- **Tier 2**: luôn require confirm trước khi execute.

**Behavior**
- Khi MCP/Tool GW trả `APPROVAL_REQUIRED`:
  - AI Gateway chuyển thành `requiresApproval=true` và trả preview.
  - AI Gateway tạo `approvalToken` (opaque, short-lived) gắn với tool+args hash + user.
- Khi user approve:
  - AI Gateway resume đúng context và gọi MCP lại với approval header/token.

---

### FR-5: Disambiguation (Options primitive)

Khi ambiguity:
- AI Gateway trả `ui.options[]` cho UI chọn (numbered list).
- User chọn → `/ai/chat` với `resume.type=options`.

Rules:
- Không “guess” target khi ambiguity có thể dẫn tới write/delete sai.
- Với Tier 2: options resolution phải xong trước approval.

---

### FR-6: Session & state machine

**States**
- `IDLE`
- `TOOL_CALLING`
- `PENDING_OPTIONS`
- `PENDING_APPROVAL`
- `RESUMED`
- `DONE`
- `ERROR`

**Persisted session fields**
- conversation window (trimmed)
- pending options context (tool candidates + mapping)
- pending approval context (tool name, args hash, preview, expiry)
- trace metadata (manifestVersion/policyVersion)

**TTL**
- Session: 7–30 days (config)
- Approval token: 1–10 minutes (config)

---

### FR-7: UX outputs (Client contract)

AI Gateway phải trả về đủ dữ liệu để Client render:
- `assistantMessage` (text)
- `options[]` (nếu có)
- `actionPreview` (nếu có)
- `requiresApproval` + `approvalToken` (nếu có)
- `actions[]` (kết quả thực thi, để UI refresh view)

---

## 7) Security Requirements

### SR-1: Provider key protection
- OpenAI/Claude keys chỉ tồn tại ở AI Gateway secrets.

### SR-2: Client ↔ AI Gateway auth
- Tối thiểu JWT/session token.
- Thực thi rate limit theo user/device.

### SR-3: AI Gateway ↔ MCP auth
- Bearer token server-to-server (rotateable).

### SR-4: Prompt injection / tool misuse controls
- Tool allowlist từ manifest.
- Hard limits: max tool calls/turn; deny dangerous tool chaining patterns.
- Reject tool calls có args sai shape trước khi gửi MCP (MCP vẫn final validator).

---

## 8) Observability & Audit

### O-1: Tracing
- AI Gateway tạo `traceId` cho mỗi user turn.
- Propagate `traceId` tới MCP và Tool Gateway.

### O-2: Structured logs
- sessionId, traceId, userId, provider, tool sequence, durations, error codes.
- Redaction: note, password, fileContent, amounts nếu cần.

### O-3: Metrics
- latency p50/p95 per turn
- tool call success rate
- approval completion rate
- provider token usage/cost (nếu support)

---

## 9) Error Handling & UX Mapping

**Error classes**
- `LLM_PROVIDER_ERROR`: timeout/rate limit/network.
- `MCP_VALIDATION_ERROR`: schema invalid.
- `APPROVAL_REQUIRED`: Tier 2 gate.
- `TOOL_EXECUTION_ERROR`: domain errors from Tool Gateway.
- `SESSION_EXPIRED`: token/session expired.

**UX mapping**
- Validation: yêu cầu user bổ sung thông tin hoặc chọn options.
- Approval required: show preview + confirm.
- Tool execution: giải thích + đề xuất next-step (search rộng hơn, đổi date range…).

---

## 10) Acceptance Criteria (Definition of Done)

1) Không có code path bypass MCP để gọi Tool Gateway trực tiếp.  
2) Tier 2 không thể execute nếu thiếu approval; preview luôn được trả cho UI.  
3) Session + pending approval survive restart (durable store).  
4) TraceId xuyên suốt; logs đủ để replay tool-call sequence.  
5) Eval harness có thể chạy regression: prompt → expected tool trace.

---

## 11) Rollout Plan (Milestones)

**M1 — Skeleton**
- `/ai/chat` + basic tool-calling loop
- MCP adapter + trace propagation
- Minimal session store

**M2 — Options + Approval**
- Disambiguation primitive
- `/ai/approve` + resume flow
- Approval token TTL + replay safety

**M3 — Evals**
- Golden prompts (30–50)
- CI regression gate

**M4 — Hardening**
- Rate limit + quota + provider failover
- Dashboards

---

## 12) Open Questions

1) Approval token format: opaque token (server-side store) vs JWT signed?  
2) Session store lựa chọn: Redis vs SQLite/Postgres (self-host considerations).  
3) Streaming responses: cần ngay v1 hay defer?  
4) Tier 1 preview: luôn preview hay chỉ bulk writes?

---

## 13) Dependencies

- `tools_manifest_v1.json` (tool schemas + tier metadata)
- `tools_policy.md` (tier semantics)
- MCP Server security/approval behavior
- Tool Gateway error codes & audit logs
