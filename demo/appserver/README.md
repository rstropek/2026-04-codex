# Codex AppServer — Learning Demos

These samples back the **AppServer protocol** portion of the Codex training.
They exist to make one point: the Codex CLI, the SDK, and any custom client
all speak the same **JSON-RPC 2.0** protocol to `codex app-server`. Once you
see the wire format, the SDK stops feeling like magic.

> All scripts under `codex-raw/` are **for learning only**. Real applications
> should use [`@openai/codex-sdk`](https://www.npmjs.com/package/@openai/codex-sdk).
> The SDK demos in the follow-up session will replace these ~80 lines with ~5.

## Setup

```bash
cd demo/appserver
pnpm install
```

You also need:

- Node 22+
- The `codex` CLI on `PATH` (`codex --version` should work).
- `CODEX_API_KEY` exported in your shell — same key the CLI uses.

## Stage A — JSON-RPC from first principles (`jsonrpc-intro/`)

No Codex involved. A tiny Express server and a `fetch` client that demonstrate
the three message shapes every JSON-RPC client deals with.

```bash
# Terminal 1
pnpm server

# Terminal 2
pnpm client
```

You should see three labeled blocks:

1. **Request/response** — `math.add(2, 3)` → `result: 5`.
2. **Structured error** — `math.divide(10, 0)` returns a JSON-RPC error
   object. The HTTP status is still 200; errors live in the JSON body.
3. **Notification** — `log` sent without an `id`. Server returns 204 (no
   body); the client logs "no response."

## Stage B — Raw Codex AppServer client (`codex-raw/`)

Same JSON-RPC shapes, but the transport is now newline-delimited JSON over
stdio, and the peer is the real `codex app-server`.

```bash
pnpm hello        # one prompt, one response
pnpm multi-turn   # two prompts, same thread — context carries over
```

Watch the stream:

- `initialize` (id 0) → server replies with agent info.
- `initialized` (notification).
- `thread/start` (id 1) → server replies with `result.thread.id`.
- `turn/start` (id 2, …) → server streams notifications (`turn/started`,
  `item/*`, …) and finally responds with the assistant message.

The exact same notifications are what `codex exec --json` emits, and the same
events the SDK exposes for streaming.

## Further reading

- WebSocket transport for `codex app-server` (experimental, not used here).
- Generated TS/JSON schemas for the protocol — opt in via
  `codex app-server generate-ts --out ./schemas` if you want typed shapes in
  your own client.
- The supported path for application code: the SDK. See the follow-up segment.
