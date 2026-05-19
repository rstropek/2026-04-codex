# Step 3 — View → server tool calls (with app-only visibility)

The View isn't a passive renderer. It can call any tool the server exposes,
including tools that are deliberately _hidden_ from the model.

## Principle

Two visibility regimes for tools:

| `_meta.ui.visibility`       | Visible to model? | Callable from View? |
| --------------------------- | ----------------- | ------------------- |
| absent / `["model", "app"]` | yes               | yes                 |
| `["app"]`                   | **no**            | yes                 |

App-only tools exist for UI affordances — refresh buttons, pagination,
"load more", form submits, polling. They don't pollute the model's tool
list and they don't consume a conversation turn.

## New APIs

| Side   | API                                                                           |
| ------ | ----------------------------------------------------------------------------- |
| Server | `_meta: { ui: { visibility: ["app"] } }` on `registerAppTool`.                |
| View   | `await app.callServerTool({ name, arguments })` — returns a `CallToolResult`. |

Note: results from `callServerTool` come back as the awaited value. They do
**not** flow through `app.ontoolresult` (that handler is reserved for tool
calls the model initiated).

## What to point at on screen

- `register.ts` registers two tools but only one resource. They share the
  iframe because they share the `resourceUri`.
- The "Another one" button calls `step3-next-quote` directly — open the
  basic-host transcript and confirm the model's turn list is unchanged.
- In `view.ts`, the click handler awaits a value; the initial render comes
  through `ontoolresult`. Two different paths, one iframe.

## Try this live

1. Open the host's tool inspector — `step3-next-quote` is absent.
2. Remove `visibility: ["app"]` and reload — the model now lists the
   refresh tool and may decide to call it itself, mid-conversation.
3. Make `pickQuote` throw — the View's button click rejects; the model is
   never notified. App-only failures are the View's problem.
