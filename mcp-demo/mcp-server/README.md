# mcp-server — MCP Apps training demo server

A single Express + Streamable-HTTP MCP server that exposes six tools, one per
MCP-Apps principle, designed for a step-by-step walkthrough in a training.

The plain MCP plumbing is in `src/main.ts`; everything MCP-Apps-specific lives
in `src/steps/`.

## Architecture

```
basic-host (8080)            mcp-server (3001)
   ┌──────────┐  POST /mcp     ┌────────────────────────────────┐
   │  React   │ ────────────►  │  Express + StreamableHTTP      │
   │  host UI │                │  └─ createServer()             │
   └────┬─────┘  ◄────────────┐│        └─ register stepN tools │
        │ srcdoc HTML          │└────────────────────────────────┘
   ┌────▼─────┐                │
   │ sandbox  │ resources/read │
   │  iframe  │ ────────────► (returns bundled HTML)
   └──────────┘
```

Each step folder contributes:

- a **tool** registered via `registerAppTool` with `_meta.ui.resourceUri`
  pointing at a `ui://stepN-name/app.html` URI;
- a **resource** registered via `registerAppResource` that serves the
  Vite-bundled, single-file HTML from `dist/stepN.html`;
- a **view** (`view.ts` or `view.tsx`) that runs inside the sandboxed iframe
  and uses the `App` class (or React `useApp` hook) from
  `@modelcontextprotocol/ext-apps` to talk to the host.

## How `_meta.ui.*` flows

```
server: registerAppTool({ _meta: { ui: { resourceUri }}})        ←── tool↔UI link
              │
              ▼
host: lists tool → notices resourceUri → resources/read(uri)
              │
              ▼
server: registerAppResource → returns HTML + _meta.ui.csp/permissions/...
              │
              ▼
host: renders HTML in sandboxed iframe with CSP from _meta.ui.csp
              │
              ▼
view: new App().connect() → postMessage handshake → ontoolresult / etc.
```

The `_meta.ui` namespace is the *only* thing the host inspects: everything
else is plain MCP. Strip every `_meta.ui` and you have a regular MCP server.

## Folder map

```
src/
  main.ts                  ← Express bootstrap, port 3001, /mcp endpoint
  server.ts                ← createServer() composes the six step modules
  dist-dir.ts              ← resolves the directory holding bundled stepN.html
  steps/
    step1-hello/           ← Tool ↔ UI link (vanilla TS)
    step2-host-context/    ← Theme/locale/dimensions, onhostcontextchanged (vanilla TS)
    step3-call-tool/       ← View→Server tool calls + visibility:["app"] (vanilla TS)
    step4-talk-to-model/   ← updateModelContext / sendMessage / openLink (React)
    step5-live-polling/    ← Polling pattern + onteardown cleanup (React)
    step6-fullscreen-csp/  ← requestDisplayMode + _meta.ui.csp.resourceDomains (React)
step1.html ... step6.html  ← Vite entry HTMLs, each references one view module
```

Each `stepN-*/README.md` covers the principle in detail with a "Try this live"
section.

## Build & run

```bash
pnpm install
pnpm build           # bundles all six step HTMLs + compiles the server
pnpm start           # node dist/main.js
# – or –
pnpm dev             # vite --watch for the views + tsx --watch for the server
```

The server logs `MCP App demo server listening on http://localhost:3001/mcp` —
that URL is the default in `basic-host/serve.ts`, so no env vars are needed.

## Where the bundled HTML lives

`vite-plugin-singlefile` inlines all CSS/JS into one HTML per step. The build
script (`scripts/build-ui.mjs`) loops over the six entry HTMLs and writes
`dist/step1.html` … `dist/step6.html`. The resource handlers `fs.readFile`
those files at request time and return them verbatim in the
`resources/read` response — that is the bytes the host renders in the
iframe.
