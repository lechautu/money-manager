# Implementation Contract — mm2 MCP Server (OpenAI-hosted)

Date: 2026-02-26  
Tool manifest: `tools_manifest_v1.json` (version=1.0, last_updated=2026-02-23)  
Security policy: `tools_policy.md`

## 1) Objective
Implement a **remote MCP server** (Streamable HTTP) that:
1. **Lists** the mm2 tools exactly as defined in the manifest (names, descriptions, JSON schema).
2. **Executes** tool calls by proxying to a backend **Tool Gateway** endpoint: `POST /tools/{toolName}`.
3. Enforces **tier policy** with defense-in-depth:
   - Tier 0: read-only, can run without approvals.
   - Tier 1: write/update, must be safe with retries.
   - Tier 2: destructive/sensitive, **must not execute without explicit approval guard**.

## 2) Non-goals
- Do not change the client app architecture or move the repo root.
- Do not re-implement mm2 business logic in the MCP server (server is an adapter/router).

## 3) Transport & endpoints
### Required
- `GET /healthz` → 200 OK
- MCP endpoint: `/mcp` supporting Streamable HTTP (POST/GET/DELETE per transport needs)

### Recommended
- `GET /version` → `{"app":"mm2-mcp-server","manifest_version":"1.0","manifest_last_updated":"2026-02-23","git_sha":"<optional>"}`

## 4) Tool registry rules
- Load manifest at startup.
- Register all tools with:
  - `name` (exact)
  - `description` (from manifest; do not invent semantics)
  - `inputSchema` = JSON Schema from `parameters`
  - `annotations` derived from tier (see `03_TOOL_CATALOG.md`)

Schema handling:
- If a tool has `{}` as `parameters`, normalize to:
  - `{"type":"object","properties":{},"additionalProperties":false}`

## 5) Execution routing
When MCP runtime calls a tool:
1. Validate: tool exists, args is object.
2. Enforce auth + user identity.
3. Enforce approval guard for Tier 2 (and optionally for export/import if configured).
4. Forward to Tool Gateway:
   - `POST {MM_API_BASE_URL}/tools/{toolName}`
   - headers: `content-type: application/json`, plus user identity header(s)
   - body: `args` JSON
5. Return `structuredContent` as JSON (prefer stable, parseable responses).

## 6) Security & multi-tenant
- Require `Authorization: Bearer <MCP_BEARER>` for **all** requests.
- Require user identity (choose one):
  - header `x-user-id`, or
  - user-scoped JWT (preferred in production)
- Never allow cross-tenant reads/writes.

## 7) Approval guard (defense-in-depth)
Even if the orchestrator misconfigures `require_approval`, the MCP server must block Tier 2 without a server-side signal.

Minimum viable guard:
- For Tier 2 tools, require header: `x-mm-approval: approved`
- If missing → return error `409` with code `APPROVAL_REQUIRED` and **do not execute**.

Config:
- Env: `REQUIRE_APPROVAL_GUARD=true|false` (default true)
- Env allowlist/denylist can override (see `04_SECURITY_APPROVALS.md`)

## 8) Idempotency & retries
- For Tier 1/2 tools, accept header `Idempotency-Key`.
- Forward it to Tool Gateway (same header) so backend can dedupe.
- MCP server itself should be retry-safe (no side effects without Tool Gateway).

## 9) Logging & audit hooks
- Log per request: request_id, tool_name, tier, latency_ms, status_code.
- Redact sensitive args (amounts, notes, payees) from logs by default.
- Tool Gateway is responsible for durable audit records.

## 10) Acceptance Criteria
### AC-1 Repo constraints
- All MCP server code resides in `/mcp-server/**`.
- Client root remains functional; no breaking changes.

### AC-2 Tool discovery
- Listing tools returns **58 tools** (exact count) and includes all names from manifest.
- Each tool has correct schema and tier-derived annotations.

### AC-3 Tier enforcement
- Tier 0 tools execute without approval guard (unless configured otherwise).
- Tier 2 tools:
  - Without `x-mm-approval: approved` → blocked (409).
  - With approval header → forwarded to Tool Gateway.

### AC-4 Auth & identity
- Missing/invalid bearer token → 401.
- Missing user identity → 400/401 (consistent behavior; document which).
- Identity is forwarded to Tool Gateway.

### AC-5 Operational
- `/healthz` returns 200
- Server runs with `npm run dev` from `/mcp-server`
- Reasonable error handling: backend timeouts return 504-equivalent tool error.

### AC-6 No schema drift
- If manifest changes, a manifest validation script must catch:
  - duplicate tool names
  - invalid tier values
  - non-object parameters schemas
