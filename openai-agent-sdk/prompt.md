# Workshop Demo: Multi-Agent Survey Builder

You are helping me build an incremental workshop demo. We will build a
multi-agent survey-building TypeScript console app using the OpenAI Agents
SDK, step by step.

## How we work together

This document defines a sequence of numbered increments. Each increment ends
with a working, type-checking, lint-clean state. I will say "do increment N"
or "next increment" — you do EXACTLY that increment, no more, no less.
After completing an increment:

1. Run `npm run check` and ensure everything passes
2. Briefly summarize what was added (max 5 bullets)
3. Stop and wait for me

Do NOT skip ahead. Do NOT combine increments. Do NOT add features that
belong to later increments, even if they seem helpful. The whole point is
that I demo each step in a workshop.

If something is ambiguous in an increment, ask me before guessing.

## Project goal

A TypeScript console app where developers can:

- Get advice on formulating good survey questions (Question Coach)
- Generate complete surveys on a topic (Survey Designer, structured output)
- Review existing surveys for quality issues (Review Agent)
- Save / load / list surveys via filesystem (Library Agent, via MCP)
- Talk to a Triage Agent that routes via handoffs to the right specialist

The app supports three modes:

- **Interactive REPL** (default): `npm run dev`
- **Non-interactive single-shot**: `npm run dev -- --prompt "..."`
  prints the final agent output and exits. Useful for scripting and
  manual smoke tests.
- **Scenario evaluation**: `npm run eval` runs LLM-as-a-judge integration
  tests via Vitest. The judge is itself an Agent SDK agent that "operates"
  the app via a custom tool, in-process.

## Non-functional requirements (apply to ALL increments)

- **TypeScript strict mode**: `"strict": true`,
  `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`,
  `"exactOptionalPropertyTypes": true`, ESM (`"module": "NodeNext"`,
  `"moduleResolution": "NodeNext"`), target ES2022. Set
  `"types": ["node"]` so globals like `console` and `process` resolve
  (since `lib` doesn't include DOM).
- **Biome** for format + lint. Run via `npm run lint` (check) and
  `npm run format` (write). Use Biome defaults; do NOT bikeshed the
  config. Enable `organizeImports` (in Biome 2.x this lives at
  `assist.actions.source.organizeImports: "on"`). If you set the
  `$schema` field, it MUST match the installed Biome version exactly,
  otherwise `biome check` fails — easiest is to omit it and let the
  formatter add the right one on first `npm run format`.
- **tsx** for running TS directly. No build step needed for dev.
- **Vitest** is used ONLY for LLM-as-a-judge integration tests
  (introduced in a later increment). No unit tests in earlier increments.
- **`npm run check`** is the gate. It runs `npm run format && npm run
  typecheck && npm run lint` — i.e. `biome check --write .` first
  (auto-fixes formatting and import order), then `tsc --noEmit`, then
  `biome check .` to catch anything format can't fix (unused vars, lint
  rules). Running format as part of the gate is intentional: every new
  file produces formatter diffs (Set/array line breaks, import groups,
  trailing commas) and a self-healing gate keeps each increment ending
  green without a manual format step. From the eval increment onward
  `check` also runs `vitest run` at the end.
- Node 20+ assumed. ESM modules throughout (`"type": "module"`).
- **Zod v4** for schemas (the Agents SDK requires v4).
- All agent instructions, user-facing strings, code identifiers, comments,
  and commit messages in **English**.
- No `any`. No `// @ts-ignore`. Use `unknown` + narrowing where needed.
  Note on `Agent` generics in shared seams: bare `Agent` (default
  `Agent<UnknownContext, "text">`) only works as long as no agent uses
  `outputType`. As soon as the Survey Designer arrives in increment 4,
  `Agent`'s `TOutput` becomes invariant (because the function form of
  `instructions` takes the agent itself as a parameter), so a
  `Record<string, () => Agent<UnknownContext, AgentOutputType>>`
  registry will NOT accept both `Agent<…, "text">` and `Agent<…, Survey>`
  — TypeScript treats them as siblings, not a sub/super pair. The
  working pattern is: type each shared seam (`processTurn`, `runRepl`)
  generic over the output type — `function f<T extends AgentOutputType>(
  agent: Agent<UnknownContext, T>) {…}` — and dispatch from `index.ts`
  via a `switch` over a `KNOWN_AGENTS` tuple instead of a record-typed
  factory map. That keeps every call site monomorphic, no `any` needed.
  Separately: any agent that owns `handoffs` to specialists with
  *different* output types (e.g. Triage handing off to text-output coach
  AND Survey-output designer AND ReviewReport-output reviewer; or
  SurveyDesigner with a chained handoff to the text-output Library agent)
  MUST be built with `Agent.create({...})` instead of `new Agent({...})`.
  `Agent.create` infers the union of possible `finalOutput` shapes across
  the handoff graph; `new Agent` does not, and the SDK emits a runtime
  warning (`handoffOutputTypeWarningEnabled`) plus loses type information.
  Let TypeScript infer the return type of these factories — don't pin
  them to `Agent` (which defaults to text output and won't match the
  inferred union).
- `exactOptionalPropertyTypes: true` means you cannot pass
  `{ traceUrl: undefined }` to a `{ traceUrl?: string }` slot. Either
  omit the property (spread / conditional object) or widen the type.
- Keep functions small. Side effects (file I/O, agent calls) at the edges.
- Console UI uses `chalk`, `@inquirer/prompts`, `ora`, `boxen`, `cli-table3`.
  Do NOT introduce other UI libs.
- Agent SDK: use `@openai/agents` (latest). Prefer documented primitives —
  `Agent`, `run`, `tool`, `MCPServerStdio`, handoffs, agent-as-tool.
- All configuration (model names, reasoning effort, API keys, paths)
  comes from environment variables loaded via `dotenv`. NEVER hard-code
  model names or keys in source files. Centralize env access in
  `src/config.ts`. Every agent reads its model from its dedicated
  `config.*_MODEL` variable AND applies `config.REASONING_EFFORT` via
  the SDK's `modelSettings` (when the underlying model supports it).

## Configuration via .env

`src/config.ts` loads and validates these variables (use Zod for the env
schema). All have sensible defaults except the API key. I will set the API
key after the initial code is up.

```text
OPENAI_API_KEY=                         # required

# --- Model selection ---
TRIAGE_MODEL=gpt-5.4
COACH_MODEL=gpt-5.4
DESIGNER_MODEL=gpt-5.4
REVIEW_MODEL=gpt-5.4
LIBRARY_MODEL=gpt-5.4
JUDGE_MODEL=gpt-5.4                     # judge should be at least as strong as the agents

# --- Behavior ---
REASONING_EFFORT=medium                 # minimal | low | medium | high (used where supported)
SURVEY_DIR=./surveys                    # filesystem MCP server sandbox root
LOG_LEVEL=info                          # info | debug
TRACE_ENABLED=true
```

`config.ts` exports a typed, frozen `config` object. Throw a clear,
actionable error if `OPENAI_API_KEY` is missing. Resolve `SURVEY_DIR` to
an absolute path.

## Tracing

Tracing is a first-class workshop topic. The OpenAI Agents SDK has built-in
tracing that ships traces to OpenAI's platform automatically using
`OPENAI_API_KEY`. After every agent run (REPL turn, non-interactive run,
judge scenario), if `TRACE_ENABLED=true`, print the trace URL in dim gray
to stderr so I can show it live in the OpenAI dashboard. Use the SDK's
`withTrace` / trace-id helpers; do NOT roll your own. Each judge scenario
should produce ONE trace that contains the entire conversation including
the judge's tool calls.

Implementation hints:

- `withTrace(name, fn)` does NOT pass the trace into `fn`. Read the active
  trace from inside the callback via `getCurrentTrace()` (imported from
  `@openai/agents`).
- Dashboard URL format:
  `https://platform.openai.com/traces/trace?trace_id=<trace.traceId>`.
- After each `run()`, update `state.activeAgent` from `result.lastAgent`
  (the agent that produced the final response). `result.activeAgent` is
  the *next-turn* agent — different concept; don't confuse them.

## Target architecture (final state — for orientation only)

```text
src/
  agents/
    triage.ts          // entry agent, routes via handoffs
    questionCoach.ts   // single-question advice, function tools
    surveyDesigner.ts  // generates full surveys, uses coach as tool, structured output
    reviewAgent.ts     // reviews surveys, structured output
    libraryAgent.ts    // file ops via MCP filesystem server
  schemas/
    survey.ts          // Zod: Survey, Question, Section
    review.ts          // Zod: ReviewReport, Finding
  core/
    processTurn.ts     // shared turn processor: REPL, non-interactive, and judge all use this
    state.ts           // ConversationState type
  ui/
    repl.ts            // inquirer + chalk loop
    render.ts          // boxen previews, cli-table3 lists
    spinner.ts         // ora helper, plays nicely with prompts
  mcp/
    filesystem.ts      // MCPServerStdio factory
  eval/
    judge.ts           // LLM-as-a-judge agent + scenario runner
  config.ts            // env vars, validated
  index.ts             // entry point: REPL or --prompt mode
surveys/               // managed by MCP filesystem server (gitignored)
tests/
  scenarios.test.ts    // Vitest scenarios via judge
```

The `core/processTurn.ts` boundary is intentional. It takes a
`ConversationState` and a user message and returns the assistant response.
The REPL, the `--prompt` mode, and the judge all call it. This is the
single seam through which "the app" is operated.

---

# The Increments

Each increment ends with a working `npm run check`. Don't move on until it
does.

## Increment 0 — Project skeleton

Set up the project so `npm run check` passes on an empty app.

- `package.json` with `"type": "module"`, scripts:
  - `dev`: `tsx src/index.ts`
  - `start`: `tsx src/index.ts`
  - `lint`: `biome check .`
  - `format`: `biome check --write .`
  - `typecheck`: `tsc --noEmit`
  - `check`: `npm run format && npm run typecheck && npm run lint`
    (later increments append `&& vitest run`)
- `tsconfig.json` with all strict settings listed above.
- `biome.json` minimal — formatter on, linter on, default rules,
  `organizeImports` enabled.
- `.gitignore`: `node_modules`, `surveys/`, `.env`, `dist`, `coverage`.
- `.env.example` with all variables from the configuration section above
  (commented where appropriate).
- `README.md` with: prerequisites (Node 20+, OpenAI API key), install,
  run modes (REPL, `--prompt`, eval), and the increment plan as a
  checklist that mirrors this document.
- `src/index.ts` that prints a `chalk` + `boxen` banner ("Survey Builder
  Multi-Agent Demo") and exits cleanly.
- Install runtime deps: `@openai/agents`, `zod`, `chalk`,
  `@inquirer/prompts`, `ora`, `boxen`, `cli-table3`, `dotenv`.
- Install dev deps: `typescript`, `tsx`, `@types/node`, `@biomejs/biome`.

Acceptance: `npm install` works, `npm run dev` shows banner, `npm run check`
passes. (Biome's default formatting is applied automatically by the
`format` step inside `check`, so freshly generated config files don't
need a separate `npm run format` pass.)

## Increment 1 — Config, core seam, REPL & non-interactive mode with dummy Triage Agent

Build the config layer, the `processTurn` seam, both run modes, and a
Triage Agent with NO handoffs yet — it just answers everything itself in
English. This validates the full plumbing independently of multi-agent
complexity.

- `src/config.ts`: dotenv-load, Zod-validated env schema, exported as a
  frozen, typed object. Throw a clear, actionable error on missing
  `OPENAI_API_KEY`. Resolve `SURVEY_DIR` to an absolute path.
- `src/core/state.ts`: define `ConversationState` (history items + active
  agent name) and a helper to create an empty state.
- `src/core/processTurn.ts`: export
  `processTurn(state, agent, userMessage) → Promise<{ reply: string;
  traceUrl?: string; finalOutput: unknown }>`. Internally: append user
  message to history, call `run(agent, history)`, append assistant reply
  to history, return the reply. Also surface `result.finalOutput`
  unchanged as `finalOutput: unknown` so callers can dispatch a
  structured renderer (introduced in increment 4) — the string `reply`
  alone is enough for plain-text agents but loses the parsed object for
  structured ones. If `TRACE_ENABLED`, capture the trace id and build
  the dashboard URL.
- `src/ui/spinner.ts`: thin `ora` wrapper. `withSpinner(label, fn)` starts
  a spinner, awaits the fn, ALWAYS stops the spinner before returning or
  throwing. This is critical so the spinner never collides with subsequent
  inquirer prompts.
- `src/ui/render.ts`: helper `printAssistant(text, agentName)` that renders
  the reply inside a `boxen` frame with the agent name as title.
  `printTraceUrl(url)` prints the trace URL dimmed to stderr (no-op when
  the URL is undefined).
- `src/ui/repl.ts`: async `runRepl(makeAgent)` that loops on
  `node:readline/promises` (`createInterface({ input: process.stdin,
  output: process.stdout, terminal: true })` plus `rl.question(...)`),
  handles `/exit` and `/help`, otherwise calls `processTurn` (wrapped in
  `withSpinner`) and renders the result. Print the active agent name in
  cyan on its own line above the prompt (e.g. `[Triage]`), and use a
  short prompt symbol like `› `. Wrap the loop in try/finally and call
  `rl.close()` on exit; treat Ctrl+C as a clean exit. Do NOT use
  `@inquirer/prompts`'s `input` here — its custom renderer mis-tracks
  cursor position when the typed text wraps to a second terminal line,
  which corrupts characters mid-prompt during a live demo. Native
  readline tracks `process.stdout.columns` correctly and handles wrap
  cleanly. (Other inquirer prompts like `editor` are still fine if a
  later increment needs them.)
- `src/agents/triage.ts`: export `createTriageAgent()` returning an `Agent`.
  English instructions: it's a survey-building assistant, currently has no
  specialists, should help directly and indicate that more specialists
  will arrive. Model from `config.TRIAGE_MODEL`.
- `src/index.ts`: parse argv. If `--prompt "<text>"` is present, run
  non-interactive: process exactly one turn against a fresh state, print
  the reply (and trace URL), exit 0 on success / 1 on error. Otherwise
  print the banner and start the REPL.

Acceptance:

- `npm run dev` opens an English chat with the triage agent; `/exit` quits.
- `npm run dev -- --prompt "Hello, what can you do?"` prints a single
  reply and exits.
- Trace URL is printed in both modes (dimmed, to stderr).
- `npm run check` passes.

## Increment 2 — Survey & Question Zod schemas

Add the data model. No agents touch it yet — this increment is
pure schema and a tiny example fixture.

- `src/schemas/survey.ts`: Zod schemas for:
  - `QuestionType`: enum of `single_choice`, `multiple_choice`, `likert_5`,
    `likert_7`, `open_text`, `ranking`, `nps`.
  - `Question`: `id` (string), `text` (string), `type` (QuestionType),
    `required` (boolean, default `true` — `z.boolean().default(true)`,
    same pattern as `version` on Survey; without a default, GPT-class
    models occasionally drop the field on structured-output runs and
    the whole survey fails Zod validation), `options` (array of string,
    optional — only sensible for choice types), `rationale` (string —
    why this question was chosen, valuable for didactics and the review
    agent).
  - `Section`: `title` (string), `questions` (array of Question, min 1).
  - `Survey`: `id` (string), `title` (string), `description` (string),
    `topic` (string), `estimatedDurationMinutes` (number),
    `sections` (array of Section, min 1), `createdAt` (ISO date string),
    `version` (number, default 1).
- Export inferred TypeScript types via `z.infer`.
- Add a small `surveys/.example.survey.json` (gitignored except this one
  file — adjust `.gitignore`) that validates against the schema, so I can
  show the shape during the workshop. The standard pattern for keeping one
  tracked file inside an otherwise-ignored directory is to replace
  `surveys/` with `surveys/*` plus a negation line
  `!surveys/.example.survey.json`.

Acceptance: `npm run check` passes. Manually parsing the example fixture
with the schema in a one-off `tsx` scratch script (e.g. `npx tsx --eval`)
succeeds — `node --eval` won't work because the schema is a TypeScript
ESM module. No behavior change in the running app.

## Increment 3 — Question Coach as a standalone agent

Add the first specialist. Still no handoffs — the coach is wired in as
the active agent via a temporary CLI flag for demonstration.

- `src/agents/questionCoach.ts`: export `createQuestionCoach()`. English
  instructions: helps formulate single survey questions, recommends
  question types from the schema enum, identifies common biases (leading
  questions, double-barreled, loaded language, acquiescence bias, social
  desirability bias), suggests reformulations. Model from
  `config.COACH_MODEL`.
- Give the coach two function tools (using `tool()` + Zod):
  - `analyzeQuestion(text: string)`: returns a structured critique
    (issues found, severity, suggested rewrite). Define the return type
    with Zod and have the tool return JSON-stringified output.
  - `recommendQuestionType(intent: string, audience: string)`: returns a
    suggested QuestionType plus rationale.
  - The tools' implementations are deterministic stubs that just echo
    structured shape back — the LLM does the actual reasoning. This is
    intentional: the workshop point is showing the tool/Zod plumbing,
    not building a real linter. Concretely: each tool returns
    `JSON.stringify(...)` of an object matching its Zod return schema,
    with the caller's input echoed into the relevant fields and the
    remaining fields left as empty strings / a sensible default enum
    value. The model fills in the real content in its reply.
- In `src/index.ts`: support a `--agent <name>` flag (`triage` | `coach`)
  that picks which agent the REPL or non-interactive run uses. Default
  `triage`. On an unknown name, throw a clear error that lists the
  known agent names — do NOT silently fall back to the default, since
  that turns a typo into a confusing demo moment.
- Update README's run examples.

Acceptance:

- `npm run dev -- --agent coach` opens a coaching chat in English.
- `npm run dev -- --agent coach --prompt "How should I phrase a question about employee satisfaction?"`
  prints a single reply.
- `npm run check` passes.

## Increment 4 — Survey Designer with structured output and coach-as-tool

Add the agent that generates whole surveys. This introduces two new SDK
patterns: `outputType` for structured output, and agent-as-tool.

- `src/agents/surveyDesigner.ts`: export `createSurveyDesigner(coach)`.
  Signature: `createSurveyDesigner(coach: Agent): Agent<UnknownContext,
  typeof Survey>` — the coach uses default Agent generics (TextOutput),
  the designer's return type is narrowed to the Survey schema.
  English instructions: given a topic and audience, design a complete
  survey. Use the Question Coach (passed in as an agent-as-tool) when
  unsure about question wording or type. Aim for 5–12 questions across
  1–3 sections, set sensible duration estimates, fill `rationale` for
  every question. Tell the model EXPLICITLY to set `required` for every
  question — even with `.default(true)` on the schema, models that omit
  the field produce surveys with surprising required-vs-optional
  defaults, and being explicit makes the demo output predictable.
  Model from `config.DESIGNER_MODEL`.
- Use `coach.asTool({ toolName: 'consult_question_coach', toolDescription: '...' })`
  to expose the coach as a tool to the designer.
- Use `outputType: Survey` (Zod schema from increment 2) so the designer
  returns structured JSON, not free text.
- Add `--agent designer` to the CLI selector. This is also where the
  registry-as-record pattern from increment 3 stops working (see the
  `Agent` generics note in the non-functional requirements). Replace it
  with a `KNOWN_AGENTS` tuple for name validation plus a `switch (name)`
  dispatch that calls a generic `runRepl<T extends AgentOutputType>` /
  `runOneShot<T extends AgentOutputType>` with the typed factory.
- In `src/ui/render.ts`: add `renderSurvey(survey)` that prints a nice
  `boxen` summary (title, duration, sections, question count) and a
  `cli-table3` listing of questions. Add `renderTurnOutput(reply,
  finalOutput, agentName)` that runs `Survey.safeParse(finalOutput)` and
  routes to `renderSurvey` on success, otherwise falls back to
  `printAssistant`. Both REPL and `--prompt` modes call this helper —
  this is where `processTurn`'s new `finalOutput` field gets consumed.
- Add `src/ui/progress.ts` with `attachProgressLogger(agent, label)`.
  It subscribes to the per-agent SDK lifecycle events
  (`agent_start`, `agent_tool_start`, `agent_tool_end`, `agent_handoff`,
  `agent_end`) via `agent.on(...)` and prints dim status lines to
  stderr (e.g. `→ SurveyDesigner: calling tool "consult_question_coach"`,
  `← QuestionCoach: tool "analyzeQuestion" returned`). The designer
  factory attaches it to BOTH the coach and the freshly constructed
  designer before returning, so the audience sees what's happening
  during the otherwise-quiet long run. Stderr keeps the lines off
  `ora`'s stdout-spinner channel — they coexist visually fine. This is
  a lifecycle-hooks demo moment; do NOT switch to `run(..., { stream:
  true })` here, since structured-output agents need the full parsed
  object and streaming complicates that.

Acceptance:

- `npm run dev -- --agent designer --prompt "Design a survey on remote work satisfaction"`
  produces a structured survey rendered as a table.
- The trace URL shows the designer calling the coach as a tool one or
  more times.
- `npm run check` passes.

## Increment 5 — Library Agent via MCP Filesystem Server

Introduce MCP. The Library Agent uses the official filesystem MCP server
to read/write/list survey files.

- `src/mcp/filesystem.ts`: factory
  `createSurveyFilesystemServer()` that returns a configured
  `MCPServerStdio` rooted at `config.SURVEY_DIR`. Use
  `npx -y @modelcontextprotocol/server-filesystem <SURVEY_DIR>`.
  Set `cacheToolsList: true`. Caller is responsible for `connect()` and
  `close()`.
- Ensure `SURVEY_DIR` exists at startup (mkdir if missing). This MUST
  happen *before* `MCPServerStdio.connect()` — the filesystem server
  child process exits with an opaque non-zero status if its allowed
  directory does not exist, and the resulting error from `connect()`
  does not name the missing path.
- `src/agents/libraryAgent.ts`: export `createLibraryAgent(fsServer)`.
  English instructions: manages the survey library at `SURVEY_DIR`.
  Filename convention: `<slug>.survey.json`, where `slug` is derived from
  the survey title (lowercase, dashed, ASCII). Validates surveys against
  the Zod schema before writing. When listing, returns title, id, topic,
  and createdAt extracted from each file. Model from `config.LIBRARY_MODEL`.
- The agent uses ONLY the MCP server tools (no custom function tools in
  this increment). The schema validation happens via instructions:
  the agent reads the file content, the LLM checks structure against
  the schema described in the system prompt. (Real validation comes via
  the surveyDesigner pipeline, not here.)
- Update `src/index.ts`: when the active agent needs the filesystem MCP
  server, connect it before starting the REPL/non-interactive run, and
  close it on exit (try/finally). Use a small registry pattern keyed by
  agent name so future agents can opt in.
- Add `--agent library` to the CLI selector.

Acceptance:

- `npm run dev -- --agent library --prompt "List all surveys"`
  works (empty list at first).
- The trace URL shows MCP tool calls (`list_directory`, `read_file`, etc.).
- `npm run dev -- --agent library` interactively allows saving a pasted
  survey JSON to a file.
- `npm run check` passes.

## Increment 6 — Review Agent + Triage Agent with handoffs

This increment does two things: introduces the Review Agent (deferred
from earlier so it can land together with handoffs) and wires all
specialists together via the Triage Agent.

### 6a — Review Agent with structured output

Build the survey reviewer using the same pattern as the Survey Designer
(English instructions, structured output via Zod, lifecycle progress
logger).

- `src/schemas/review.ts`: Zod for:
  - `Finding`: `severity` (`info` | `warning` | `critical`), `location`
    (string — e.g. `section[0].question[2]` or `survey`), `issue`
    (string), `suggestion` (string).
  - `ReviewReport`: `overallScore` (1–10), `summary` (string),
    `findings` (array of Finding), `wouldShipIt` (boolean).
- `src/agents/reviewAgent.ts`: export
  `createReviewAgent(): Agent<UnknownContext, typeof ReviewReport>`.
  English instructions: input is a JSON survey; check for ordering
  effects, demographic placement, length / drop-off risk, scale gaps,
  type consistency, and survey-level bias. Output via
  `outputType: ReviewReport`. Model from `config.REVIEW_MODEL`.
  Attach `attachProgressLogger(reviewer, "ReviewAgent")` (same lesson
  as Increment 4 — long structured runs need audience-visible progress).
- Add `--agent review` to the CLI selector via the
  `KNOWN_AGENTS` switch dispatch (same pattern as Increment 4 — do not
  reach for a Record-typed factory map).
- In `src/ui/render.ts`: `renderReview(report)` printing a colored
  summary box and a findings table. Extend `renderTurnOutput` with a
  `ReviewReport.safeParse(finalOutput)` branch so the dispatcher routes
  to `renderReview` (same shape as the Survey branch from Increment 4).

### 6b — Triage Agent with handoffs

Wire all four specialists together.

- Update `src/agents/triage.ts`: instead of answering directly, the
  Triage Agent's English instructions describe the four specialists and
  when to hand off. Configure `handoffs: [coach, designer, review, library]`.
  Build it with `Agent.create({...})` (heterogeneous handoff outputs —
  see the non-functional `Agent` generics note).
- Add a chained handoff `designer → library` so compound requests like
  "design a survey AND save it" work. Without this, once Triage hands off
  to the SurveyDesigner the specialist owns the conversation and produces
  its structured Survey output as the final response — the "save it"
  half is silently dropped because the designer has no edge to library.
  Concretely: thread an optional `library` agent into
  `createSurveyDesigner(coach, library?)`, set `handoffs: library ? [library] : []`,
  switch the designer factory to `Agent.create` (heterogeneous outputs:
  Survey vs. text), and extend the designer instructions to tell the
  model that when the user asks to save, it should emit the full Survey
  JSON in its reasoning first (so the survey is present in conversation
  history) and THEN hand off to LibraryAgent. Triage wires this up by
  constructing the library agent first and passing it into
  `createSurveyDesigner`. Direct `--agent designer` runs continue to
  work because the `library` parameter is optional.
- `src/core/processTurn.ts` must now correctly track the active agent
  ACROSS turns when a handoff happens, not just within a single
  `run()` call. Use the SDK's reported `lastAgent` (or equivalent on
  the result) to update `state.activeAgent` after each turn. The REPL
  prompt label updates accordingly: `[Triage] ›` becomes `[Designer] ›`
  after a handoff.
- Make the triage agent the default in `src/index.ts` (already is) and
  document that `--agent <name>` now bypasses triage for direct access
  during demos.
- Connect the filesystem MCP server unconditionally when triage is
  active, since handoff to the library agent could happen at any point.

Acceptance:

- `npm run dev -- --agent review` accepts a pasted survey JSON and
  prints a structured review (with progress lines).
- `npm run dev` and a request like "Help me with a question about
  customer satisfaction" hands off to the coach (visible in the prompt
  label and the trace).
- `npm run dev -- --prompt "Create a survey on the topic of pizza and save it"`
  shows handoff(s) leading to designer and library.
- A request like "review this survey: { ... }" hands off to the review
  agent and prints the structured report.
- `npm run check` passes.

## Increment 7 — LLM-as-a-judge scenario evaluation

Add Vitest for integration tests where an LLM judge "operates" the app
in-process via a tool, then renders a verdict.

- Install dev deps: `vitest`.
- `vitest.config.ts`: `testTimeout: 120_000`, `hookTimeout: 30_000`.
  Also set `disableConsoleIntercept: true` and
  `reporters: ["verbose"]` — without these, Vitest buffers per-turn
  `console.log` output and the demo run looks silent until the very
  end. With them, judge ↔ app dialogue and trace URLs stream to
  stdout in real time.
- Update `npm run check` to also run `vitest run`.
- `src/eval/judge.ts`: export `runScenario(scenario, successCriteria, options?)`.
  Implementation:
  - Create a fresh `ConversationState` and connect the filesystem MCP
    server (since triage may hand off to the library agent).
  - Build the production triage agent (with handoffs).
  - Define two tools for the judge using the `tool({ name,
    description, parameters: <zod schema>, execute })` factory from
    `@openai/agents` (NOT `Agent.asTool`, which is for agent-as-tool
    and has a different shape):
    - `send_message_to_app({ message: string })`: calls
      `processTurn(state, message)` and returns the reply. Records the
      exchange in a transcript array.
    - `finish_evaluation({ passed: boolean, reasoning: string })`:
      records the verdict and signals end of run.
  - Log per-turn output so a workshop attendee can follow the run
    live: scenario header, trace URL, `Judge → App` and
    `App (<activeAgent>) → Judge` lines (truncated to ~400 chars), and
    a final `VERDICT: PASS/FAIL — <reasoning>`. Use `chalk` for
    colors; the dependency is already present.
  - Build the judge `Agent` with `config.JUDGE_MODEL`. English
    instructions: simulate a realistic user playing through the
    scenario by calling `send_message_to_app`, judge against the
    success criteria, then call `finish_evaluation`. Max
    `options.maxAppTurns` (default 8) calls to the app tool.
  - Wrap the entire scenario in a single `withTrace` so one trace covers
    judge + app + handoffs + MCP calls. Print the trace URL up front
    (inside the `withTrace` callback, right after capturing it via
    `getCurrentTrace()`) so attendees can click it while the run is
    still in flight. Note: `processTurn` opens its own inner
    `withTrace` per app turn; that is fine — nested `withTrace` calls
    become spans of the outer trace, not duplicate traces.
  - Pass `{ maxTurns: maxAppTurns * 2 + 4 }` to the judge's `run(...)`.
    The default `maxTurns` is 10; with up to 8 app-tool calls plus
    reasoning items plus the final `finish_evaluation`, the judge can
    hit the cap before deciding.
  - Return `{ passed, reasoning, transcript, traceUrl }`.
  - ALWAYS close the MCP server in a finally block.
- `tests/scenarios.test.ts`: three scenarios, each calling `runScenario`
  and asserting `result.passed` (using `result.reasoning` as the
  failure message):
  1. "Single-question advice routes to the Question Coach":
     scenario asks for help with a single question; success criteria
     require the app to give concrete advice on question type and bias.
  2. "Designer produces a structured survey":
     scenario asks for a survey on remote-work satisfaction; success
     criteria require at least 5 questions across at least 2 sections,
     each with a non-empty rationale.
  3. "Save round-trip via Library Agent":
     scenario asks for a short pizza-preferences survey to be created
     AND saved as `pizza-survey`; success criteria require the app to
     confirm the save AND the file `pizza-survey.survey.json` to exist
     in `SURVEY_DIR` (the test asserts this directly via fs after the
     judge finishes).
- Add `npm run eval` script: `vitest run tests/scenarios.test.ts`.
- Each test prints its trace URL on completion (via `console.log` so it
  shows in Vitest output).
- Tests skip gracefully (using `it.skipIf`) when `OPENAI_API_KEY` is
  unset, so `npm run check` is still safe in CI without secrets.
  Important: `it.skipIf` only skips test execution, not module
  loading. `src/eval/judge.ts` transitively imports `config.ts`,
  which validates `process.env` at module load and throws when
  `OPENAI_API_KEY` is missing — so a top-level
  `import { runScenario } from "../src/eval/judge.js"` would crash
  the whole test file in CI without a key. Either: (a) load the
  judge via a dynamic `await import("../src/eval/judge.js")` inside
  each test body (after the `skipIf` gate), or (b) make `config.ts`
  validate lazily. (a) is the smaller change.

Acceptance:

- `npm run eval` runs all three scenarios, each producing a trace URL.
- All three scenarios pass against the implementation from prior
  increments.
- `npm run check` passes (typecheck + lint + vitest).

## Increment 8 (optional stretch) — Memory MCP server on Triage

Only do this if I explicitly say so. Adds a second MCP server to show
how `connectMcpServers` composes multiple servers and demonstrates
cross-session memory.

- Add `@modelcontextprotocol/server-memory` via `npx`.
- `src/mcp/memory.ts`: factory similar to filesystem.ts.
- Triage agent gets both MCP servers attached.
- Triage instructions: at the start of a session, query memory for
  user preferences (typical survey types, audience); at the end, store
  notable facts. Keep it lightweight.
- Add a fourth scenario that verifies memory-driven personalization
  across two sequential `runScenario` calls sharing the same memory
  store.

Acceptance: `npm run check` passes; the new scenario passes; trace
shows tool calls to both MCP servers.

---

# Workshop demo notes (for me, ignore when coding)

The increments map roughly to the workshop schedule:

- Increment 0–1: Setup, REPL, non-interactive mode, first agent. (~30 min)
- Increment 2–3: Schemas, Question Coach with custom function tools. (~45 min)
- Increment 4: Structured output, agent-as-tool (Survey Designer). (~30 min)
- Break.
- Increment 5: MCP integration via filesystem server (Library Agent). (~30 min)
- Increment 6: Review Agent + Handoffs, the Triage orchestrator. (~45 min)
- Increment 7: LLM-as-a-judge testing. (~30 min)
- Increment 8: stretch / Q&A buffer.

When the agent claims an increment is done, I will manually demo it
before saying "next increment".