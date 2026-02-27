# Agent Instructions Pack — mm2 MCP Server

This folder contains the implementation contract for building a **remote MCP server** for **Money Manager 2 (mm2)** that works in an **OpenAI-hosted workflow** (Responses API / Agents) and exposes the mm2 tool catalog defined in `tools_manifest_v1.json`.

## Hard constraints (must-follow)
- Repo root is the **client**. MCP server source **must live in**: `/mcp-server/**`
- MCP server must run independently from the client (separate `package.json`, scripts, env).
- The tool contract is defined by `tools_manifest_v1.json` (manifest_version=1.0, last_updated=2026-02-23).
- Tier policy must be enforced (Tier 0/1/2). Tier 2 must be approval-gated.

## Files
- `01_IMPLEMENTATION_CONTRACT.md` — primary spec; treat as source of truth
- `02_REPO_LAYOUT.md` — required folder structure and scripts
- `03_TOOL_CATALOG.md` — tool registry rules and tier mapping
- `04_SECURITY_APPROVALS.md` — auth, identity, approval guard, idempotency
- `05_API_CONTRACT_TOOL_GATEWAY.md` — proxy API that MCP server calls
- `06_TEST_PLAN.md` — unit/integration/e2e and curl checks
- `07_DEPLOYMENT.md` — local + Docker + production notes
- `08_OPENAI_INTEGRATION.md` — Responses API MCP configuration examples
- `09_TASKLIST.md` — step-by-step tasks / checkpoints for the implementation agent

## Success definition
Implementation is done when **all Acceptance Criteria** in `01_IMPLEMENTATION_CONTRACT.md` and `06_TEST_PLAN.md` pass, and the MCP server is fully contained in `/mcp-server`.
