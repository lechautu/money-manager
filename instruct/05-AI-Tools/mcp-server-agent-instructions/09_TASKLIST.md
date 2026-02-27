# Tasklist for Implementation Agent

This is the execution checklist. Do not skip steps.

## Phase 0 — Repo setup
1. Create `/mcp-server` folder with its own `package.json`.
2. Add `.env.example`, `README.md`, `tsconfig.json` (if TS).
3. Decide manifest location:
   - Copy into `/mcp-server/tools_manifest_v1.json` (preferred) OR load from root.
4. Implement `npm run dev` and `npm run start`.

## Phase 1 — MCP server core
5. Implement HTTP server with:
   - `/healthz`
   - `/mcp` Streamable HTTP transport
6. Load manifest at startup; validate:
   - tool names unique
   - tier values are 0/1/2
   - parameters normalize to object schema
7. Register tools dynamically from manifest with tier-derived annotations.

## Phase 2 — Execution routing
8. Implement proxy call:
   - `POST {MM_API_BASE_URL}/tools/{toolName}`
   - forward `x-user-id`, `Idempotency-Key`, `x-request-id`
9. Implement error mapping:
   - backend 4xx/5xx -> MCP tool error (structured, stable)

## Phase 3 — Security and approvals
10. Enforce `Authorization: Bearer <MCP_BEARER>` for all requests.
11. Enforce user identity header required.
12. Enforce Tier 2 approval guard:
   - require `x-mm-approval: approved` for Tier 2
   - return 409 if missing

## Phase 4 — Hardening
13. Add request timeout (env-driven).
14. Add rate limiting (optional MVP but recommended).
15. Add log redaction.

## Phase 5 — Tests
16. Add minimal tests:
   - manifest validation
   - tier mapping annotations
   - approval guard behavior
17. Provide curl-based smoke steps in README.

## Phase 6 — Done criteria
18. Verify Acceptance Criteria in `01_IMPLEMENTATION_CONTRACT.md`.
19. Ensure no server code exists outside `/mcp-server`.
20. Ensure client still runs unchanged.
