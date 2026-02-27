# Tool Gateway Contract (Backend API)

MCP server proxies execution to a Tool Gateway service.

## Endpoint
`POST {MM_API_BASE_URL}/tools/{toolName}`

## Headers
- `content-type: application/json`
- `x-user-id: <user>` (required)
- `Idempotency-Key: <key>` (optional; recommended for Tier 1/2)
- `x-request-id: <uuid>` (optional)

## Body
JSON object matching the tool `parameters` schema from the manifest.

## Success response
- `200 OK`
- JSON body:
  - any object; must be JSON-serializable
  - recommended stable shape:
    - `{ "ok": true, "data": <...> }`

## Error response
- `4xx/5xx`
- JSON body (recommended):
```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR|NOT_FOUND|CONFLICT|INTERNAL",
    "message": "human readable",
    "details": {}
  }
}
```

## Notes
- Tool Gateway is responsible for:
  - data persistence
  - tier policy enforcement at business layer
  - audit log persistence
  - idempotency dedupe store
