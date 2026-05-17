// Stage C / Multi-turn — same scenario as codex-raw/multi-turn.ts.
//
// Auth: uses whatever `codex login` configured on this machine — subscription
// locally, CODEX_API_KEY in CI. Same as the `codex` CLI.
//
// What to notice (compare side-by-side with codex-raw/multi-turn.ts):
//   - A second prompt is just a second `thread.run()`. No id bookkeeping, no
//     `turn/completed` listener — `await` handles both.
//   - The same `Thread` carries context. We never re-send turn 1's prompt;
//     turn 2 sees it because the server stored it under `thread.id`.
//
// Cross-process resume:
//   When this process exits, the `Thread` object is gone — but the session is
//   persisted under ~/.codex/sessions. To continue in a *new* process:
//
//       const codex = new Codex();
//       const thread = codex.resumeThread("<thread.id from earlier run>");
//       await thread.run("Continue where we left off.");
//
//   This is the SDK equivalent of `codex exec resume --last` (CLI Demo 6).

import { Codex } from "@openai/codex-sdk";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const codex = new Codex();
const thread = codex.startThread({
  workingDirectory: repoRoot,
  sandboxMode: "read-only",
});

const first = await thread.run(
  "List the top-level workspaces in this monorepo.",
);
console.log("─── [turn 1] ───");
console.log(first.finalResponse);

const second = await thread.run(
  "Which of those workspaces would you start reading first to understand the project, and why?",
);
console.log("─── [turn 2] ───");
console.log(second.finalResponse);

console.log("─── thread id (for resumeThread) ───");
console.log(thread.id);
