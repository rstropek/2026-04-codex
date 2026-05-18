# Build — Lib Compilation and How Apps Consume It

`@questionnaires/lib` is a **compiled** workspace package. The apps import it
the way they would import any published npm package — via the `exports` field
in its `package.json`, which points at `dist/` (compiled JavaScript +
declaration files), not at `src/`.

This is the boring, conventional setup. The notes below exist because there
*was* an earlier setup that exposed raw `.ts` source files directly, and that
turned out not to compose with Next.js. Understanding why is useful for
anyone tempted to "simplify" things back.

## Why we compile

We tried `exports."."` pointing at `./src/index.ts`. Three things broke:

1. **NodeNext-style imports.** The lib uses `import "./foo.js"` even though
   the source is `foo.ts` — that is the canonical TypeScript convention for
   Node ESM. `tsx` and Vitest rewrite the extension transparently. Real
   bundlers (Webpack, Turbopack) do not, especially when the package is
   pulled in via `transpilePackages`.
2. **Native-addon loading.** `better-sqlite3` finds its `.node` binary via
   the `bindings` package, which walks the V8 stack to discover the caller's
   filename. When the lib is bundled inline into the Next server build, the
   stack frames are webpack-internal paths and `bindings` returns
   `undefined`, causing a crash inside `new Database(url)`. Even with
   `serverExternalPackages: ["better-sqlite3"]`, transpiling the lib's
   wrapper module changed the require resolution enough to break this.
3. **ESM/CJS interop friction.** The lib is `"type": "module"`; Drizzle and
   `better-sqlite3` are CJS. Two bundlers each handle the interop slightly
   differently; the source-package approach put us on the wrong side of
   that.

Compiling the lib to `dist/` and letting the apps consume it as a normal
package eliminates all three problems at once. The cost is a real build step;
the benefit is that the apps stop being unusual.

## Lib layout

```
packages/lib/
├── src/                 ← edit here
├── dist/                ← generated (.gitignored)
├── migrations/          ← Drizzle SQL, shipped alongside dist
├── tsconfig.json        ← editor / `pnpm typecheck` (no emit)
├── tsconfig.build.json  ← emits to ./dist with declarations + sourcemaps
└── package.json
```

`package.json` key fields:

- `"type": "module"` — ESM output.
- `"main"`, `"types"`, and `"exports"` all point at `./dist/...`. There is no
  `src/` in `exports`; consumers can't reach the TypeScript source.
- `"files": ["dist", "migrations"]` — what would be published if this were
  ever shipped to npm.
- `"prepare": "pnpm build"` — pnpm runs this on `pnpm install` for workspace
  packages, so a fresh clone has a built `dist/` with no manual step.

The migrations folder stays at the package root (not inside `dist/`).
`applyMigrations()` resolves the path relative to its compiled location:
`dist/db/migrate.js` → `../../migrations` → `packages/lib/migrations/`. This
works the same before and after compilation because `dist/db/` has the same
depth from the package root as `src/db/`.

## Apps consume the lib like a normal package

`apps/web` and `apps/console` both declare a workspace dependency:

```json
"dependencies": { "@questionnaires/lib": "workspace:*" }
```

pnpm symlinks `packages/lib/` into each app's `node_modules`. The apps
import `@questionnaires/lib` — Node / Next / `tsx` all resolve it through
`exports`, hitting `dist/index.js`. No `transpilePackages`, no `webpack.alias`
hacks, no `extensionAlias`. Next's default Turbopack pipeline works.

`apps/web/next.config.ts` does one thing relevant to the lib:
`serverExternalPackages: ["better-sqlite3"]`. That tells Next to leave the
native module alone — let Node load it at runtime instead of bundling it.
The lib itself is now ordinary JS in `node_modules`, so it gets bundled
normally with no special treatment.

## When the lib gets rebuilt

| Trigger | What runs |
| --- | --- |
| `pnpm install` | `prepare` on `packages/lib` → `pnpm build` |
| `pnpm dev` (in `apps/web`) | `predev` → `pnpm --filter @questionnaires/lib build` |
| `pnpm build` (in `apps/web`) | `prebuild` → `pnpm --filter @questionnaires/lib build` |
| `pnpm console` | `prestart` → `pnpm --filter @questionnaires/lib build` |
| `pnpm test:e2e` | Playwright `globalSetup` runs `pnpm --filter @questionnaires/lib build` |
| `pnpm build` (root) | `pnpm -r build` builds the lib in topological order |

Side-by-side editing of lib + an app therefore "just works" — touching a
source file in `packages/lib/src/` and re-running `pnpm dev` will rebuild
the lib before Next starts. The full `tsc` build is ~1s; for long lib-editing
sessions, run `tsc -p tsconfig.build.json --watch` in a separate terminal
and the `predev` rebuild becomes a no-op (TS skips unchanged files).

## What does *not* depend on the build

- `pnpm test` for `packages/lib` runs Vitest against `src/` directly — no
  `dist/` involved. Lib tests still work even if `dist/` is missing or stale.
- The lib's own `db:generate` / `db:migrate` scripts use `tsx` to run
  TypeScript source. They never read from `dist/`.

This is intentional: the build is for *consumers* of the lib. The lib itself
develops against source.

## Build outputs (`dist/`)

`tsconfig.build.json` emits:

- `.js` — ESM JavaScript (target ES2022, NodeNext module resolution).
- `.d.ts` — type declarations.
- `.js.map` and `.d.ts.map` — sourcemaps. Errors and stack traces in the
  apps point back to the original TS files in `packages/lib/src/`.

`dist/` is gitignored. CI / fresh clones rebuild via `prepare`.

## When to break this convention

Don't. If a future lib change needs a new export path, add it to
`exports` and `tsconfig.build.json`'s `include`, then rebuild. If a future
consumer can't reach a function, the fix is on the lib side — export it
properly. Avoid reaching into `packages/lib/src/` from app code; the
`exports` field is the supported surface, and bypassing it puts you back in
the world of bundler quirks the build was created to escape.
