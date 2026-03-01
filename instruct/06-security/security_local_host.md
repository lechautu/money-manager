# Security Contract — Local Host (WebUI + Tool Gateway + MCP Server) v3
> Variant: **No login**, **no LOCAL_UI_TOKEN**. Accepts the risk of intentional user port-forwarding.

## Scope
- Components: **Client WebUI (pure browser)**, **Tool Gateway**, **MCP Server**
- Deployment: all components run on the **same local machine**
- Product constraints:
  - **User does not log in** to use the app
  - **Tool Gateway must not be exposed** to LAN/WAN (localhost-only)
  - **Only external tool callers** (e.g., LLM/AI agent outside localhost) must authenticate to **MCP Server**
  - Explicit policy: **If user intentionally sets up port-forwarding**, any resulting exposure is considered **user-managed risk acceptance**

## Threat Model (Minimum)
### Assets
- Local financial database (transactions, accounts, categories, payees, etc.)
- Tier-2 destructive operations (bulk delete, overwrite import, clear DB)
- Tier-1 state-changing operations (create/update single entities)

### Threats
- **CSRF-to-localhost**: arbitrary website triggers side-effect requests to `http://localhost:<port>`
- **Local process abuse**: other processes on the same machine calling loopback endpoints
- **Accidental destructive tool calls** from an LLM

### Explicitly accepted risk
- **Intentional port-forwarding exposure** (ssh port forward / reverse proxy / router forwarding) is treated as a user action that changes the trust boundary.
  - The app does not attempt to prevent misuse in this configuration.

### Non-goals
- Multi-user accounts, password login flows
- Remote exposure of Tool Gateway
- Cloud identity provider integration

---

## Hard Requirements — Network Exposure

### Tool Gateway
1. **MUST bind loopback-only**
   - Listen only on `127.0.0.1` (IPv4) and optionally `::1` (IPv6)
2. **MUST NOT bind** to `0.0.0.0` or any non-loopback interface
3. **MUST NOT be reachable** from other devices on the network under normal conditions

### MCP Server
1. Default mode: **loopback-only**
2. External access **MAY be enabled** explicitly via config
3. If external access is enabled:
   - **MUST require Bearer token** authentication for all requests

---

## Auth & Trust Rules

### 1) WebUI → Tool Gateway (No Login)
User can use the app immediately without login.

**Gateway MUST allow WebUI requests only when all are true:**
- Connection is loopback (enforced by loopback bind)
- `Origin` header exists and is in **TRUSTED_ORIGINS** allowlist

For state-changing requests (POST/PUT/PATCH/DELETE):
- `Origin` validation is **mandatory**
- If `Origin` is missing or not allowed → reject with **403** `ORIGIN_NOT_ALLOWED`

**Identity for logging/audit (local)**
- Gateway SHOULD attach a stable identity for trusted-local:
  - `req.user = { userId: "local" }` (or equivalent)

No JWT required for trusted-local WebUI calls.

> Note: `Origin` is client-controlled and can be spoofed. This contract relies on loopback-only exposure + origin checks to mitigate CSRF-to-localhost in typical usage. It does not claim to harden against intentional port-forwarding.

---

### 2) External tool caller → MCP Server (Token Required)
Any non-trusted-local caller MUST authenticate with:
- `Authorization: Bearer <MCP_API_TOKEN>`

---

### 3) MCP Server → Tool Gateway (Internal Service Token — Required)
Even on same host, protect the MCP→Gateway hop.

Tool Gateway MUST require an internal shared secret on MCP-originated calls, e.g.:
- `X-Internal-Token: <GATEWAY_INTERNAL_TOKEN>`

This is service-to-service and separate from user login (none).

---

## HTTP Security Controls

### Origin Guard (Mandatory)
Tool Gateway:
- For any state-changing method:
  - Missing Origin → 403 `ORIGIN_NOT_ALLOWED`
  - Origin not in allowlist → 403 `ORIGIN_NOT_ALLOWED`

MCP Server:
- If externally reachable, do not rely on Origin; rely on Bearer token.

### CSRF
- Not strictly required if you enforce strict Origin checks for every state-changing request.
- Recommended as defense-in-depth if feasible, but out of scope for this contract.

### CORS (UX-only; not security)
- Configure CORS to allow `TRUSTED_ORIGINS` so WebUI can read responses.

---

## Tiering & Destructive Operation Approval (Mandatory)

### Tier Definitions
- Tier 1: normal read/write with limited blast radius
- Tier 2: destructive/high-blast operations:
  - bulk delete transactions
  - import with overwrite
  - clear/reset database
  - irreversible bulk updates

### Tier 2 Approval Guard
Regardless of trusted-local checks:
- Tier 2 requests MUST include:
  - `X-MM-Approval: confirm`
  - OR `X-MM-Approval-Token: <short-lived token from UI confirm step>`

If missing → 403 `APPROVAL_REQUIRED`

---

## Runtime Modes & Configuration

### Tool Gateway env
- `GATEWAY_HOST=127.0.0.1`
- `GATEWAY_PORT=<port>`
- `TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`
- `GATEWAY_INTERNAL_TOKEN=<random-long-secret>`
- `TIER2_APPROVAL_MODE=header|token` (default: `header`)

### MCP Server env
- `MCP_HOST=127.0.0.1` (default)
- `MCP_PORT=<port>`
- `MCP_API_TOKEN=<random-long-secret>`
- `MCP_ALLOW_EXTERNAL=false` (default)

---

## Required Error Shapes
All errors MUST be JSON and consistent:

- Origin violation: 403 `ORIGIN_NOT_ALLOWED`
- Missing MCP token (external): 401 `UNAUTHORIZED`
- Missing Tier2 approval: 403 `APPROVAL_REQUIRED`

---

## Policy Note — Port Forwarding Risk Acceptance (Documentation Requirement)
The product MUST document (README/help) that:
- Tool Gateway is designed for localhost-only usage.
- If the user intentionally exposes localhost services via port-forwarding/proxying, they assume the security risk and must secure it externally.
