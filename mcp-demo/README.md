# MCP Apps Training Demo

A step-by-step demo for **MCP Apps** — the `io.modelcontextprotocol/ui`
extension that lets MCP tools ship a sandboxed HTML/JS UI alongside their
result.

> This material assumes you already know plain MCP (tools, resources,
> stdio/HTTP transports). MCP Apps adds **one** thing: a tool result can be
> paired with an interactive UI rendered by the host in a sandboxed iframe.

The demo is two pieces:

| Folder | What it is | Port |
|--------|------------|------|
| `mcp-server/` | The demo server: 6 tools, 6 UIs, one per principle. | 3001 (`/mcp`) |
| `basic-host/` | Reference MCP-Apps host (unmodified upstream copy) for testing. | 8080 + 8081 |

## Six-step roadmap

| # | Tool | Principle | Stack |
|---|------|-----------|-------|
| 1 | `step1-hello`          | **Tool ↔ UI link.** A tool returns `structuredContent`; the linked HTML resource renders it. | vanilla TS |
| 2 | `step2-host-context`   | **Host context & theming.** UI adapts to theme/locale/dimensions and re-renders on change. | vanilla TS |
| 3 | `step3-quote`          | **View → server tool calls.** A button calls a *second* tool that is app-only (hidden from the model). | vanilla TS |
| 4 | `step4-talk-to-model`  | **View → model.** `updateModelContext`, `sendMessage`, `openLink`. | React |
| 5 | `step5-monitor`        | **Live polling + lifecycle.** App-only polling tool + `onteardown` cleanup. | React |
| 6 | `step6-flag`           | **Display modes + CSP.** `requestDisplayMode` + `_meta.ui.csp.resourceDomains` for an external image. | React |

Each step folder has its own `README.md` with the new APIs, what to point at
on screen, and a "Try this live" section.

## Run it

One-time install:

```bash
pnpm -C mcp-server install
pnpm -C basic-host install
pnpm install            # root: just `concurrently`
```

Start both processes:

```bash
pnpm dev                # mcp-server in watch mode + basic-host
# – or –
pnpm start              # production-built versions of both
```

Open <http://localhost:8080>. The host auto-connects to
`http://localhost:3001/mcp` (its default) and lists the six demo tools.

## Trainer cheat-sheet (suggested talking order)

1. **Step 1 — Hello.** Open `register.ts` and point at the single
   `_meta.ui.resourceUri` line — *that* is what makes this an MCP App.
   Open `view.ts`, point at `app.ontoolresult` and the difference between
   `content` (for the model) and `structuredContent` (for the View).
2. **Step 2 — Host context.** Toggle the host's theme and resize the
   window — the iframe re-paints without a tool call. Show the
   `applyHostStyleVariables` helper.
3. **Step 3 — Refresh.** Click "Another one" repeatedly; the conversation
   stays empty. Open the tool registration and point at
   `visibility: ["app"]`.
4. **Step 4 — Talk back.** "Pin to context" silently appends to the
   model's context (no turn). "Send as message" triggers a model turn.
   Compare the two semantics.
5. **Step 5 — Live polling.** Stats tick every 2 s; close the panel and
   watch the `teardown` log. Show the React effect cleanup *and* the
   `onteardown` handler — both belt and braces.
6. **Step 6 — Fullscreen + CSP.** Click "Go fullscreen". Then delete the
   `resourceDomains` entry in `register.ts`, restart, and the flag image
   is blocked — a quick reminder that the View runs default-deny.

## Cleanup

`pnpm -C mcp-server build` writes `dist/` files under `mcp-server/`. To start
fresh: `rm -rf mcp-server/dist`.
