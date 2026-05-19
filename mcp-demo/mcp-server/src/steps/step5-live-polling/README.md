# Step 5 — Live polling & lifecycle (React)

A dashboard that pulls fresh host stats every 2 seconds. Demonstrates the
canonical "polling pattern" for MCP Apps and the cleanup contract every
View must honour.

## Principle

For live data, don't ask the model to drive the refresh — it would burn
turns. Instead:

1. Register a **second, app-only tool** (`visibility: ["app"]`) that returns
   one fresh sample on demand.
2. From the View, `setInterval(() => app.callServerTool({ name }), 2000)`.
3. Stop the interval on `app.onteardown` _and_ on the React effect cleanup
   path (StrictMode, host teardown, route change).

## New APIs

| Side   | API                                                          |
| ------ | ------------------------------------------------------------ |
| Server | A second tool with `_meta: { ui: { visibility: ["app"] } }`. |
| View   | `setInterval` driven by `app.callServerTool(...)`.           |
| View   | `app.onteardown = async () => { ...; return {}; }`.          |

## What to point at on screen

- The dashboard counter (`Polls observed`) increments every 2 s without any
  conversation activity.
- `register.ts`: the poll tool is _separate_ from the open-the-panel tool —
  one returns the same shape as the other so the View can render either.
- `view.tsx`: the React effect's cleanup function clears the interval. The
  `onteardown` log line confirms the host signalled an unmount.

## Try this live

1. Close the basic-host tool panel — the console shows `teardown requested`;
   the poll calls stop. Re-open it; polling resumes.
2. Remove the `clearInterval` from the effect cleanup — refresh the page a
   few times and watch overlapping intervals fire. Lesson: cleanup is not
   optional.
3. Drop `visibility: ["app"]` from `step5-stats` — the model now sees the
   poll tool. Some models will start invoking it mid-conversation; the
   transcript explodes.
