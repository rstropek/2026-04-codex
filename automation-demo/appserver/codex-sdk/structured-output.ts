// Stage C / Structured output — SDK counterpart of CLI Demo 3
// (`codex exec --output-schema demo/schemas/risk.schema.json …`).
//
// Auth: uses whatever `codex login` configured on this machine.
//
// What to notice:
//   - The JSON Schema at demo/schemas/risk.schema.json and the Zod schema
//     below are the *same contract*. The CLI loads it from disk; here we
//     author it in TypeScript and convert at runtime via `z.toJSONSchema()`
//     (built into Zod v4 — no extra dependency).
//   - `turn.finalResponse` is a JSON string that conforms to the schema.
//     Calling `RiskReport.parse(...)` is a second belt: the SDK promises
//     conformance, Zod gives you a typed value plus a runtime guarantee.

import { Codex } from "@openai/codex-sdk";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const RiskReport = z.object({
  generated_at: z.string().describe("ISO-8601 timestamp"),
  modules: z.array(
    z.object({
      path: z.string().describe("Repo-relative path or workspace name"),
      risk_level: z.enum(["low", "medium", "high"]),
      reason: z.string().describe("One-sentence justification"),
      recommended_owner: z.string().describe("Best-guess team or role"),
    }),
  ),
});
type RiskReport = z.infer<typeof RiskReport>;

const codex = new Codex();
const thread = codex.startThread({
  workingDirectory: repoRoot,
  sandboxMode: "read-only",
});

const turn = await thread.run(
  `Audit the source tree under packages/ and apps/. Classify each workspace ` +
    `by risk if changed. Return JSON matching the provided schema. Use ` +
    `${new Date().toISOString()} as generated_at.`,
  { outputSchema: z.toJSONSchema(RiskReport) },
);

const parsed: RiskReport = RiskReport.parse(JSON.parse(turn.finalResponse));

console.log("─── parsed JSON ───");
console.log(JSON.stringify(parsed, null, 2));

// Pipeline gate — same shape as CLI Demo 3's `jq -e` check.
const high = parsed.modules.filter((m) => m.risk_level === "high");
console.log(
  high.length === 0
    ? "Gate PASSED"
    : `Gate FAILED — ${high.length} high-risk module(s)`,
);
