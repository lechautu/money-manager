# API Contract Guidelines

## Versioning
- All endpoints under: `/api/v1/...`
- Breaking changes: `/api/v2`

## Request/Response conventions
### Success
```json
{ "data": { }, "meta": { "traceId": "..." } }
```

### Error
```json
{
  "error": { "code": "FORBIDDEN", "message": "..." , "details": {} },
  "traceId": "..."
}
```

## Idempotency
- Support `Idempotency-Key` for POST endpoints that create resources or trigger generation.
- If same key used with different payload, respond `409 CONFLICT`.

## Pagination
- Prefer cursor-based: `?limit=50&cursor=...`
- Response meta includes `nextCursor`.

## Validation
- Validate against tool parameter schemas (from `tools_manifest_v1.json`) *before* hitting business logic.

## OpenAPI
- Maintain an OpenAPI 3.0 spec (or equivalent) as part of the repo.
- Ensure each tool has a clearly defined endpoint and JSON schema.
