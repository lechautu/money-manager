# PRD — AI Gateway (LLM Orchestrator) cho Money Manager 2 (MCP-first)

**Mục tiêu**: đưa AI LLM vào app theo hướng **tooling chuẩn**, trong đó **MCP Server là canonical tool surface** (schema + policy + enforcement).  
**Phạm vi PRD**: sản phẩm + kỹ thuật ở mức triển khai được (API contract, flows, acceptance criteria, metrics).  
**Ngày**: 2026-03-02 (Asia/Ho_Chi_Minh)

---

## 1) Tóm tắt

AI Gateway là một backend service đóng vai trò **LLM Orchestrator + Product AI API** cho Client (WebUI/Tauri). Nó:

- cung cấp endpoint ổn định cho UI (`/ai/chat`, `/ai/approve`) và state machine cho **disambiguation** + **Tier-2 approval**,
- gọi LLM provider (OpenAI/Claude/...) với tool-calling,
- thực thi tool calls **chỉ thông qua MCP Server** (MCP Streamable HTTP),
- không tự định nghĩa tool schema/policy riêng; luôn bám theo `tools_manifest_v1.json` (manifest_version=1.0) và `tools_policy.md` (Tier 0/1/2).

---

## 2) Bối cảnh hệ thống hiện tại

### 2.1 Thành phần & Ports (tham chiếu kiến trúc hiện có)
- Client Dev Server: `:5173`
- MCP Server: `:3100` (expose tools theo MCP Streamable HTTP; proxy tool calls sang Tool Gateway)
- Tool Gateway: `:3200` (REST API, JWT auth, audit, Tier 2 approval guard bằng `X-MM-Approval-Token`)

### 2.2 Tools & Tiers (tham chiếu policy hiện có)
- Manifest hiện tại có **66 tools** (tools_manifest_v1.json).
- Policy phân 3 tier:
  - **Tier 0**: read-only (auto-run)
  - **Tier 1**: write/update non-destructive (auto-run khi params hợp lệ)
  - **Tier 2**: destructive/sensitive (bắt buộc user confirm trước khi chạy)

---

## 3) Vấn đề cần giải quyết

1) Client cần NLUI (chat) với session + UX primitives (options, preview, confirm), nhưng **không thể gọi LLM trực tiếp** (keys/cost/abuse).  
2) MCP Server nên giữ vai trò **tool contract authority** (schema/policy/enforcement), không nên “phình” thành conversation runtime (session, retries, provider ops, UX state).  
3) Cần một lớp orchestration chuẩn hoá để:
   - đảm bảo **Tier 2** luôn có confirm/preview,
   - đảm bảo **disambiguation** xảy ra trước khi write/delete,
   - đảm bảo trace/audit & regression testable.

---

## 4) Mục tiêu & Không mục tiêu

### 4.1 Goals
**G1 — MCP-first tooling (hard requirement)**
- AI Gateway không gọi Tool Gateway trực tiếp.
- Tool allowlist + tier info lấy từ artifact manifest/policy, MCP vẫn là nơi enforce cuối cùng.

**G2 — Product-grade NLUI runtime**
- API ổn định cho UI (chat + approve).
- Session bền (durable store) để resume sau restart.
- Disambiguation & confirmation first-class.

**G3 — Governance & vận hành**
- Provider keys server-side; rate limit/quotas.
- Tracing end-to-end; logs có redaction.
- Evals/regression harness để “không vỡ behavior” khi đổi prompt/provider.

### 4.2 Non-goals (v1)
- Multi-agent architecture phức tạp (planner/executor tách rời).
- Long-term semantic memory (beyond small preferences).
- Personal finance advice; AI chỉ thao tác dữ liệu + giải thích dữ liệu.

---

## 5) Người dùng & Use cases

### 5.1 Personas
- **End user**: thao tác nhanh bằng text; cần an toàn khi xoá/sửa nhiều.
- **Maintainer**: cần trace/debug; cần regression; cần thay provider không phá contract.
- **External agent runner (future)**: dùng MCP trực tiếp (Claude Desktop/OpenAI Agents) không phụ thuộc AI Gateway.

### 5.2 Use cases (v1)
1) **Record transaction**: “hôm nay cafe 45k” → tạo transaction.
2) **Search & summarize**: “tháng này chi ăn uống bao nhiêu?” → analytics Tier 0.
3) **Update status**: mark pending/cleared.
4) **Transfers**: “chuyển 2tr từ A sang B”.
5) **Destructive**: delete/bulk delete/import data → Tier 2 confirm.

---

## 6) Định nghĩa thành công (Success Metrics)

### 6.1 Product metrics
- % chat turns hoàn thành action đúng (task success rate).
- % Tier-2 actions có preview+confirm (target: 100%).
- Disambiguation rate vs. “wrong target” incidents (target wrong target ~0).

### 6.2 Tech/ops metrics
- p50/p95 end-to-end latency cho `/ai/chat`.
- Avg tool calls/turn; max tool calls/turn.
- Provider token usage per successful task (monitor cost).
- Error rate theo class (provider/mcp/tool/session).

### 6.3 Quality metrics (eval harness)
- Tool-call accuracy (đúng tool + đúng args) trên golden prompts.
- Approval correctness (Tier 2 không chạy khi thiếu confirm).

---

## 7) Phạm vi (Scope)

### In-scope
- AI Gateway service (REST).
- LLM orchestration loop (tool-calling) + MCP adapter.
- Session store + approval token store.
- Disambiguation options + action preview payload.
- Observability: tracing/logging/metrics.
- Eval harness (golden prompts + trace assertions).

### Out-of-scope
- UI implementation trong Client (nhưng PRD định nghĩa contract cho UI).
- MCP Server refactor lớn (trừ thêm error envelope nếu cần).

---

## 8) Kiến trúc mục tiêu (Target Design)

### 8.1 Component responsibilities

**AI Gateway**
- Product-facing API: `/ai/chat`, `/ai/approve`
- Orchestration runtime (LLM loop)
- Session/state machine
- Provider ops (keys, quota, retries)
- Transform MCP errors → UI-friendly response

**MCP Server**
- Canonical tool surface (manifest schemas)
- Tier enforcement + approval guard
- Proxy tool calls → Tool Gateway

**Tool Gateway**
- Business logic + DB operations
- JWT auth (end-user)
- Audit logging Tier 1+
- Approval middleware Tier 2 (X-MM-Approval-Token)

### 8.2 Hard constraints
- AI Gateway **never** calls Tool Gateway directly (even for reads).
- Tier semantics come from policy; enforcement must remain at MCP/Tool GW.

---

## 9) UX Flows (Behavioral spec)

### 9.1 Flow A — Read-only / Tier 0
User: “tháng này chi ăn uống bao nhiêu?”  
- AI Gateway calls LLM → LLM requests `get_spending_analytics` → MCP executes → LLM responds with summary.

### 9.2 Flow B — Tier 1 write (auto-run)
User: “hôm nay ăn trưa 80k cash”  
- Resolve account/category if needed (Tier 0 tools).
- Execute `record_transaction` (Tier 1) nếu args đủ.
- Return confirmation + action payload (transactionId).

### 9.3 Flow C — Ambiguity → Options (must)
User: “xoá giao dịch Grab hôm qua”  
- Search trả nhiều candidate.
- AI Gateway trả `ui.options[]` (numbered list) để user chọn.
- Sau khi chọn xong mới chuyển sang Tier 2 confirm (nếu delete).

### 9.4 Flow D — Tier 2 confirm (must)
User: “xoá các giao dịch ăn uống hôm qua”  
- Search & preview items.
- MCP chặn Tier 2 nếu thiếu approval → AI Gateway trả `requiresApproval=true` + preview list.
- User confirm → `/ai/approve` → AI Gateway gọi lại MCP kèm `X-MM-Approval-Token`.

**Rule**: Tier 2 luôn đi theo pattern “preview → confirm → execute”.

---

## 10) Product Requirements (Epics & User Stories)

### Epic E1 — Chat API & Session Runtime

**US1.1**: User gửi message và nhận phản hồi text.  
- **AC**:
  - `/ai/chat` trả `assistantMessage`.
  - SessionId cho phép giữ context tối thiểu (window N messages).
  - Có `traceId` cho mỗi turn.

**US1.2**: Session bền và resume được sau restart.  
- **AC**:
  - Session store durable (không in-memory only).
  - Pending options/approval survive restart.
  - TTL hoạt động đúng.

---

### Epic E2 — Tool Orchestration (MCP-only)

**US2.1**: LLM có thể gọi tools và nhận result.  
- **AC**:
  - AI Gateway forward tool calls qua MCP.
  - Tool name allowlist theo manifest.
  - Max tool-steps/turn enforced.

**US2.2**: Không có bypass.  
- **AC**:
  - 0 code path gọi Tool Gateway trực tiếp.
  - Integration tests assert all tool execution goes through MCP adapter.

---

### Epic E3 — Disambiguation Options

**US3.1**: Khi nhiều target match, UI nhận options để chọn.  
- **AC**:
  - Response có `ui.options[]` kèm `optionsToken`.
  - `/ai/chat` hỗ trợ `resume.type=options`.
  - Không execute write/delete trước khi disambiguation xong.

---

### Epic E4 — Tier 2 Approval

**US4.1**: Tier 2 luôn require confirm.  
- **AC**:
  - Tier 2 tool attempt trả `requiresApproval=true` (từ MCP error mapping).
  - Response có `approvalToken` + preview items.
  - Token hết hạn đúng TTL.

**US4.2**: Approve/Reject flow.  
- **AC**:
  - `/ai/approve` với decision=approve trigger execution qua MCP kèm `X-MM-Approval-Token`.
  - decision=reject huỷ pending action và trả message xác nhận.

---

### Epic E5 — Governance (Security/Rate limits)

**US5.1**: Provider keys không rò rỉ.  
- **AC**:
  - Keys chỉ server-side; logs redact.

**US5.2**: Rate limit/quota theo user/device.  
- **AC**:
  - Configurable limits: requests/min, tokens/day (nếu có).
  - Clear error response khi rate-limited.

---

### Epic E6 — Observability & Audit

**US6.1**: Trace end-to-end.  
- **AC**:
  - traceId propagate AI GW → MCP → Tool GW.
  - Logs có tool sequence + durations.

**US6.2**: Metrics.  
- **AC**:
  - Export metrics: latency, tool calls/turn, approval rates, provider errors.

---

### Epic E7 — Evals & Regression

**US7.1**: Golden prompts → expected tool traces.  
- **AC**:
  - Repo có eval harness chạy CI.
  - Fail build nếu Tier 2 chạy thiếu approval hoặc tool-call drift vượt ngưỡng.

---

## 11) API Specification (Detailed)

### 11.1 `POST /ai/chat`

**Request**
- `sessionId` (string, required)
- `message` (string, required) — raw user text
- `locale` (string, optional, default from settings)
- `timezone` (string, required)
- `clientContext` (object, optional)
  - `currency`, `defaultAccountId`, `dateFormat`, `uiSelectionHints`
- `resume` (object, optional)
  - `type`: `options|approval`
  - `token`: `opt_*|appr_*`
  - `selectedOptionIds`: string[]

**Response**
- `assistantMessage` (string)
- `ui` (object, optional)
  - `options` (array) — disambiguation choices
  - `actionPreview` (object) — list of impacted items
- `requiresApproval` (boolean)
- `approval` (object, optional)
  - `approvalToken`, `expiresAt`, `actionType`, `preview`
- `actions` (array, optional)
  - canonical action objects for UI refresh (created/updated/deleted ids)
- `trace` (object)
  - `traceId`, `manifestVersion`, `policyVersion`, `provider`

### 11.2 `POST /ai/approve`

**Request**
- `sessionId` (string)
- `approvalToken` (string)
- `decision` (`approve|reject`)

**Response**
- same envelope as `/ai/chat` (assistantMessage, actions, trace)

### 11.3 Error Envelope (AI Gateway)
Standardize:
- `error.code` (enum)
- `error.message`
- `error.retryable` (bool)
- `trace.traceId`

Error codes:
- `LLM_PROVIDER_ERROR`
- `RATE_LIMITED`
- `SESSION_EXPIRED`
- `OPTIONS_INVALID`
- `APPROVAL_EXPIRED`
- `MCP_ERROR`
- `INTERNAL_ERROR`

---

## 12) Orchestration Spec (LLM Loop)

### 12.1 Prompting rules (high-level)
- **Do not invent** account/category/payee; use tools to resolve.
- Prefer disambiguation options when multiple matches.
- For Tier 2, stop and request approval.

### 12.2 Tool-call execution
- Validate tool name in allowlist (manifest).
- Forward to MCP; attach `traceId`.
- Append tool results to the conversation state for LLM.

### 12.3 Budgets
- Max tool calls/turn: 8 (config)
- Max wall time/turn: 25s (config)
- Max provider retries: 2

Stop conditions:
- final answer generated
- approval required
- exceeded budgets → return graceful error

---

## 13) Data & Storage

### 13.1 Session store (durable)
Store:
- conversation window (trimmed)
- pending options context (token → option map)
- pending approval context (token → tool args hash + preview + expiry)
- trace metadata

### 13.2 Token design
- **Options token**: opaque id -> stored server-side.
- **Approval token**: opaque id -> stored server-side (recommended, avoids replay/forgery).
  - includes: userId/sessionId, toolName, argsHash, expiry, preview snapshot.

---

## 14) Security & Compliance

- Secrets management for provider keys + MCP bearer.
- AuthN/Z:
  - Client → AI Gateway: JWT/session token (aligned with Tool Gateway)
  - AI Gateway → MCP: server bearer
- Anti-abuse:
  - Rate limit & quota
  - Max tool calls
  - Denylist patterns (prompt injection to bypass policy)
- Logging:
  - Redaction rules consistent (note, free-form text, potentially PII).

---

## 15) Performance Targets (initial)

- `/ai/chat` p95 < 6–10s cho tasks “simple write” (1–2 tool calls), tùy provider.
- Tool calls per turn: average < 4.
- Approval turn should not exceed p95 < 3–5s (mostly tool execution).

(Thực tế phụ thuộc provider latency; mục tiêu để monitor, không phải hard SLA v1.)

---

## 16) Acceptance Criteria (System-level DoD)

1) **MCP-first enforcement**: 0 bypass path; integration test asserts.  
2) **Tier 2 safety**: destructive tools không chạy nếu thiếu confirm; preview luôn trả.  
3) **Disambiguation correctness**: ambiguity → options; không tự chọn target cho destructive.  
4) **Durability**: pending approval survive restart; expiry đúng TTL.  
5) **Observability**: traceId end-to-end; logs đủ replay tool sequence.  
6) **Regression**: eval harness chạy CI; catch tool-call drift.

---

## 17) Rollout Plan

### M1 — Foundation
- AI Gateway skeleton + MCP adapter + session store
- Basic Tier 0 + Tier 1 flows

### M2 — Options + Approval
- Disambiguation primitive
- Tier 2 approval end-to-end

### M3 — Governance + Observability
- Rate limits, redaction, dashboards
- Trace propagation complete

### M4 — Evals/Regression hard gate
- Golden prompts + CI gating
- Provider swap testing

---

## 18) Risks & Mitigations

- **Tool-call drift / non-determinism** → eval harness, low temperature, replay tool outputs.
- **Latency** → cache read-only lists (accounts/categories/payees) at AI Gateway (short TTL), limit tool-steps.
- **Prompt injection** → strict tool allowlist + tier enforcement at MCP + budgets.
- **Token replay** → opaque approval tokens with expiry and argsHash binding.

---

## 19) Open Questions (to finalize)
1) Session store choice: Redis vs SQLite/Postgres (self-host constraints).  
2) Streaming responses for UX: now vs later.  
3) Tier 1 preview policy: always vs only bulk writes.  
4) Error envelope alignment: MCP error codes shape (if needs standardization).

---

## Appendix A — Policy snapshot (Tier tool lists)

Source: `tools_policy.md` (Tier 0/1/2 lists).

---

## Appendix B — Tool manifest snapshot

Source: `tools_manifest_v1.json` (manifest_version=1.0, last_updated=2026-02-23, tools=66).

