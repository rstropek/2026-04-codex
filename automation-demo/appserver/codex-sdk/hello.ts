// Stage C / Hello — same scenario as codex-raw/hello.ts, but via @openai/codex-sdk.
//
// Auth: uses whatever `codex login` configured on this machine — a ChatGPT
// subscription locally, or CODEX_API_KEY in CI. There is no SDK-specific
// credential; the SDK shells out to the same `codex` binary the CLI uses.
//
// What to notice (compare side-by-side with codex-raw/hello.ts):
//   - No spawn(), no readline, no JSON-RPC ids, no `turn/completed` detection.
//   - The wire traffic is identical — `initialize` → `thread/start` →
//     `turn/start` still happen inside the SDK. We just stopped writing them.
//   - `turn.items` is the buffered notification stream from Stage B; one entry
//     per `item/*` event. Proof that the SDK *is* the protocol, not a new one.

import { Codex } from "@openai/codex-sdk";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Point at the monorepo root, not demo/appserver where `pnpm` runs from.
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const codex = new Codex();
const thread = codex.startThread({
  workingDirectory: repoRoot,
  sandboxMode: "read-only",
});

const turn = await thread.run("Summarize this repo in 5 bullets.");

console.log("─── final response ───");
console.log(turn.finalResponse);
console.log("─── item types emitted ───");
console.log(turn.items.map((i) => i.type).join(", "));
