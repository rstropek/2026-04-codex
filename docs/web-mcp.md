# Web MCP server (Streamable HTTP)

The Next.js app (`apps/web`) exposes the same questionnaire MCP tool surface as
the console STDIO server, but over Streamable HTTP via Vercel's `mcp-handler`.

## Endpoint

- Transport: Streamable HTTP
- URL: `POST /api/mcp` (also `GET` and `DELETE` for session lifecycle)
- The route is `apps/web/src/app/api/[transport]/route.ts`. The `[transport]`
  segment lets `mcp-handler` mount its supported transports under the same
  base path; the canonical client URL is `/api/mcp`.

## Shared tool definitions

Tool registration lives in `packages/lib/src/mcp.ts` and is consumed by both
the console (`apps/console/src/mcp.ts`) and the web route. There is exactly
one place where tool names, descriptions, Zod input schemas, and result shapes
are defined — neither transport can drift from the other.

The four tools — `questionnaire_list`, `questionnaire_get`,
`questionnaire_result`, `submission_submit` — and their contracts are
described in `docs/console-cli.md`.

## Database lifecycle

The web app keeps a singleton `better-sqlite3` handle (see
`apps/web/src/server/db.ts`) that survives across requests. The MCP route
hands `getDb` to the shared tool registration so every tool call reuses that
handle. Unlike the console transport, the HTTP route never opens or closes a
connection per tool call — Next.js process lifetime owns the handle.

## CORS

Browser-based MCP clients (the MCP Inspector, for one) need CORS to reach the
route. The handler in `route.ts` wraps every response with permissive headers
(`Access-Control-Allow-Origin: *`) and answers `OPTIONS` preflight with 204.
`mcp-session-id` and `mcp-protocol-version` are listed in
`Access-Control-Expose-Headers` so the client can read them.

`*` is intentional for dev. For a deployed app, narrow the origin to the
actual client(s) — the wildcard combined with no auth is fine on localhost
and not fine on the public internet.

## No authentication

The route is unauthenticated, matching the console STDIO transport. That
includes `submission_submit`, which writes a row. This is acceptable for the
sample-project scope. Anything beyond local development needs an auth layer
in front (a bearer-token check in `route.ts`, an edge middleware, or
deploy-platform auth) — pick one before exposing the endpoint publicly.

## Verification

`apps/web/src/app/api/[transport]/route.test.ts` boots the route inside an
in-process Node HTTP server and drives it with the MCP SDK's
`StreamableHTTPClientTransport`. It asserts the tool set, the `submission_submit`
input schema preserves the `anyOf` answer union, and a simple `questionnaire_list`
call succeeds against a fresh database.

For manual smoke testing, run `pnpm web`, then point an MCP-aware client
(e.g. the MCP Inspector) at `http://localhost:3000/api/mcp`.
