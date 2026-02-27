# Tool Gateway — Agent Implementation Pack

This folder contains **MD instruction contracts** for an implementation agent to build the **Tool Gateway** backend for Money Manager.

## Canonical sources
- `features.md`: technical context, schema, invariants, analytics rules
- `tools_manifest_v1.json`: 58 tools (names, descriptions, JSON schema params, tier)
- `tools_policy.md`: tiering policy (Tier 0/1/2)

## Deliverables expected from the implementation agent
1. A deployable **Tool Gateway** service exposing REST APIs that implement all tools (or an agreed MVP subset).
2. Security: AuthN/AuthZ + Tier 2 approval token verification.
3. Logging/Audit + trace IDs.
4. Automated tests (unit + integration) for invariants and tier enforcement.
5. OpenAPI (or equivalent) describing the public surface.

## Operating constraints
- Gateway is **API-first** (no UI).
- Gateway is the **data authority**: do not trust upstream callers (WebUI/MCP).
- Use DB transactions for multi-step mutations (transfer, split, delete/restore cascades).

See the documents in this pack in order (00→07).
