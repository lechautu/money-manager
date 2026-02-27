# Deployment Notes

## 1) Environment variables
Required:
- `PORT`
- `MCP_PATH` (default /mcp)
- `MCP_BEARER`
- `MM_API_BASE_URL`
- `REQUIRE_APPROVAL_GUARD` (default true)
Optional:
- `LOG_LEVEL`
- `REQUEST_TIMEOUT_MS`

## 2) HTTPS
For OpenAI-hosted calling, deploy MCP server behind HTTPS.

## 3) Docker (recommended)
Provide Dockerfile in /mcp-server:
- multi-stage build if TypeScript
- expose PORT
- healthcheck on /healthz

## 4) Observability
- structured logs to stdout
- optional OTEL exporter
