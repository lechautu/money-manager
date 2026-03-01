# Acceptance Tests — Local Host Security Contract v3

## Test Setup Assumptions
- Tool Gateway: `http://127.0.0.1:<GATEWAY_PORT>`
- MCP Server: `http://127.0.0.1:<MCP_PORT>`
- `TRUSTED_ORIGINS` includes `http://localhost:5173`
- `GATEWAY_INTERNAL_TOKEN` configured
- Tier 2 approval uses `X-MM-Approval: confirm`

---

## A) No-login UX (WebUI → Gateway)
### A1. Tier 1 GET succeeds without auth
- From allowed Origin `http://localhost:5173`, call any GET endpoint (e.g., list categories)
- Expected:
  - HTTP 200
  - No login/token prompts

### A2. Tier 1 POST succeeds with allowed Origin
- From allowed Origin, POST a Tier 1 write endpoint
- Expected:
  - HTTP 200/201
  - Request logged with userId `"local"` (or equivalent)

---

## B) Gateway not exposed to LAN/WAN
### B1. Gateway reachable on loopback
- Local machine:
  - `curl http://127.0.0.1:<GATEWAY_PORT>/health`
- Expected:
  - HTTP 200

### B2. Gateway not reachable from another device
- Other device on same LAN:
  - `curl http://<LAN_IP_OF_HOST>:<GATEWAY_PORT>/health`
- Expected:
  - Connection refused / timeout

---

## C) Origin Guard (CSRF baseline)
### C1. State-changing request without Origin is rejected
- Local machine:
  - `curl -X POST http://127.0.0.1:<GATEWAY_PORT>/...`
  - Ensure no `Origin` header is set
- Expected:
  - HTTP 403
  - JSON code: `ORIGIN_NOT_ALLOWED`

### C2. State-changing request with disallowed Origin is rejected
- `curl -X POST http://127.0.0.1:<GATEWAY_PORT>/... -H "Origin: https://evil.example"`
- Expected:
  - HTTP 403
  - JSON code: `ORIGIN_NOT_ALLOWED`

### C3. Allowed Origin succeeds
- `curl -X POST http://127.0.0.1:<GATEWAY_PORT>/... -H "Origin: http://localhost:5173"`
- Expected:
  - HTTP 200/201 (for Tier 1 endpoint)

---

## D) Tier 2 Approval Guard
### D1. Tier 2 request without approval is rejected
- Call a Tier 2 endpoint with allowed Origin:
  - `curl -X POST http://127.0.0.1:<GATEWAY_PORT>/...tier2... \
      -H "Origin: http://localhost:5173"`
- Expected:
  - HTTP 403
  - JSON code: `APPROVAL_REQUIRED`

### D2. Tier 2 request with approval header succeeds
- Add:
  - `-H "X-MM-Approval: confirm"`
- Expected:
  - HTTP 200

---

## E) MCP External Requires Token
> Applies only if `MCP_ALLOW_EXTERNAL=true`.

### E1. MCP request without Bearer token is rejected
- `curl http://<HOST_PUBLIC_OR_LAN_IP>:<MCP_PORT>/...`
- Expected:
  - HTTP 401
  - JSON code: `UNAUTHORIZED`

### E2. MCP request with Bearer token succeeds
- `curl http://<HOST_PUBLIC_OR_LAN_IP>:<MCP_PORT>/... \
    -H "Authorization: Bearer <MCP_API_TOKEN>"`
- Expected:
  - HTTP 200

---

## F) MCP → Gateway Internal Token
### F1. Gateway rejects MCP proxy call without internal token
- `curl -X POST http://127.0.0.1:<GATEWAY_PORT>/tools/<toolName> \
    -H "Origin: http://localhost:5173"`
- Expected:
  - HTTP 401/403 (implementation-defined)
  - Error indicates missing internal token

### F2. Gateway accepts MCP proxy call with internal token
- Add:
  - `-H "X-Internal-Token: <GATEWAY_INTERNAL_TOKEN>"`
- Expected:
  - HTTP 200

---

## G) Port-forwarding note (non-test)
Port-forwarding risk is accepted and must be documented. No acceptance test enforces prevention.
