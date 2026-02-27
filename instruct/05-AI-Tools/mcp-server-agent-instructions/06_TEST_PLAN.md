# Test Plan

## 1) Local smoke
From repo root:
1. `cd mcp-server`
2. `npm install`
3. `cp .env.example .env` and set:
   - `MCP_BEARER`
   - `MM_API_BASE_URL`
4. `npm run dev`
5. `curl http://localhost:<PORT>/healthz` → 200

## 2) Auth tests
- Missing bearer:
  - expect 401
- Invalid bearer:
  - expect 401

## 3) Tool discovery
Use an MCP inspector or a small harness.
Acceptance:
- list_tools returns 58 tools
- includes Tier 2 tools list

## 4) Tier 2 approval guard
Pick a Tier 2 tool (e.g. delete_transaction):
- Without `x-mm-approval: approved`:
  - expect 409 (APPROVAL_REQUIRED)
- With approval header:
  - request is forwarded to Tool Gateway (verify via Tool Gateway logs)

## 5) Idempotency
For a Tier 1 tool (e.g. record_transaction):
- Send twice with same `Idempotency-Key`
- Tool Gateway should create once; second returns same result

## 6) Timeout behavior
Configure Tool Gateway to delay > timeout
- MCP server should return a tool error (504-equivalent), not hang indefinitely

## 7) Negative schema validation
Send invalid args (missing required fields)
- Expect 4xx (VALIDATION_ERROR) and no side effects
