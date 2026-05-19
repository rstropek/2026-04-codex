import path from "node:path";

/**
 * Resolves the directory containing the bundled step HTML files.
 *
 * MCP App resource handlers must ship the *same* HTML whether we run from
 * source (`tsx src/main.ts` → `src/dist-dir.ts`) or compiled
 * (`node dist/main.js` → `dist/dist-dir.js`). Vite always writes the bundles
 * to `<project-root>/dist`, so we compute the path relative to this file.
 */
export const DIST_DIR: string = (() => {
  const here = import.meta.dirname;
  // src/dist-dir.ts → ../dist ; dist/dist-dir.js → .
  return import.meta.filename.endsWith(".ts")
    ? path.join(here, "..", "dist")
    : here;
})();
