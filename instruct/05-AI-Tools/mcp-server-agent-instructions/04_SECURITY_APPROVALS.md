# Security, Approvals, Idempotency

## 1) AuthN (server-to-server)
All requests to MCP server require:
- `Authorization: Bearer <MCP_BEARER>`

If missing/invalid:
- return 401

## 2) AuthZ / Tenant isolation
Each tool execution must be scoped to a user identity.
Choose one:
- `x-user-id: <string>` header (simplest)
- User-scoped JWT bearer (recommended for production)

If identity missing:
- return 400 (preferred) or 401; document the choice.

Forward identity to Tool Gateway via header:
- `x-user-id`

## 3) Approval guard (Tier 2)
Defense-in-depth requirement:
- For Tier 2 tools, require: `x-mm-approval: approved`
- If missing: return 409 with code `APPROVAL_REQUIRED`

Config knobs (env):
- `REQUIRE_APPROVAL_GUARD` (default true)
- `APPROVAL_GUARD_DENYLIST` (comma-separated tool names; always require approval)
- `APPROVAL_GUARD_ALLOWLIST` (comma-separated; optional override)

## 4) Idempotency (Tier 1/2)
- Accept `Idempotency-Key` header for Tier 1/2 tool calls.
- Forward the header to Tool Gateway.

Rationale:
- LLM runtimes may retry tool calls; idempotency prevents double writes.

## 5) Logging and redaction
- Do not log full payloads by default.
- Redact: transaction notes, payee, free-text, full amounts if you want (optional).
- Always log: tool_name, tier, status_code, latency_ms, request_id.
