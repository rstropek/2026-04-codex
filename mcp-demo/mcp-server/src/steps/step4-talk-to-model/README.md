# Step 4 — Talking back to the model (React)

The previous step let the View pull data from the server. This step shows the
View _pushing_ into the conversation: model context, user messages, links.

## Principle

Three host endpoints, three different semantics:

| API                                   | What happens                                        | When to use                                            |
| ------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| `app.updateModelContext({ content })` | Silent: appended to context, no model turn.         | State, selection, "user changed slider to 42".         |
| `app.sendMessage({ role, content })`  | Looks like the user typed it — the model replies.   | Explicit requests: "summarise this", "translate that". |
| `app.openLink({ url })`               | Host opens externally. Iframe cannot `window.open`. | Documentation links, sharing.                          |

(Also introduced in this step: `useApp` from `@modelcontextprotocol/ext-apps/react`,
the SDK's React-friendly wrapper around `new App(...).connect()`.)

## What to point at on screen

- The "Pin to context" button does _not_ trigger a model response — watch
  the basic-host turn log stay still.
- The "Send as message" button does. The text shows up as a user turn.
- The "Open link" button never fires `window.open` from the iframe; the host
  handles it (and may refuse).

## Try this live

1. Pin a note, then send a follow-up message — the model uses the pinned
   note even though it never appeared in the chat.
2. Replace `app.openLink(...)` with `window.open(linkUrl, "_blank")` — the
   sandbox blocks it. That's _why_ `openLink` exists.
3. Inspect `app.getHostCapabilities()` (e.g. via DevTools console) to see
   what the host advertises — some hosts gate `openLink` behind a capability.
