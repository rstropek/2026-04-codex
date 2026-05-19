# Step 1 — Hello: tool ↔ UI link

The smallest possible MCP App. Demonstrates the core mechanic that makes
"MCP Apps" different from plain MCP: a tool result is paired with an HTML UI
that the host renders in a sandboxed iframe.

## Principle

A tool gains a UI by declaring `_meta.ui.resourceUri`. The host:

1. Sees the tool result.
2. Calls `resources/read` for that URI.
3. Mounts the returned HTML in a sandboxed iframe (the **View**).
4. Pushes both `content` (for the model) and `structuredContent` (for the View)
   into the iframe via `postMessage`.

## New APIs

| Side   | API                                                                              |
| ------ | -------------------------------------------------------------------------------- |
| Server | `registerAppTool(server, name, { _meta: { ui: { resourceUri }}}, ...)`           |
| Server | `registerAppResource(server, name, uri, { mimeType: RESOURCE_MIME_TYPE }, ...)` |
| View   | `new App({ name, version })` + `app.connect()`                                   |
| View   | `app.ontoolresult = (result) => {...}`                                           |

## What to point at on screen

- `register.ts`: the `_meta: { ui: { resourceUri } }` line — _this_ is the
  whole link. Without it, the tool is a plain MCP tool.
- `register.ts`: the two return fields on `CallToolResult` —
  `content` (for the model) vs `structuredContent` (for the View).
- `view.ts`: the handler is wired **before** `app.connect()` — the host may
  push the first tool result immediately, so a late binding loses it.

## Try this live

1. **Strip the `_meta.ui`** from the tool registration → basic-host still calls
   the tool, but no iframe renders. That is plain MCP.
2. **Set `structuredContent` to `undefined`** → the View shows the placeholder;
   the model still sees the text from `content`.
3. **Move `app.ontoolresult = ...` to _after_ `app.connect()`** → in some hosts
   the first result is missed; refresh to recover.
