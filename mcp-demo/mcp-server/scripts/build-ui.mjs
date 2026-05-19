#!/usr/bin/env node
/**
 * Builds each step's HTML view as a single self-contained file via Vite.
 * Each call to `vite build` consumes one INPUT html and writes one inlined
 * dist/stepN.html — which is what the MCP App resource handler ships verbatim.
 */
import { spawn } from "node:child_process";

const STEPS = [
  "step1.html",
  "step2.html",
  "step3.html",
  "step4.html",
  "step5.html",
  "step6.html",
];

const watch = process.argv.includes("--watch");

function runVite(input) {
  return new Promise((resolve, reject) => {
    const args = ["vite", "build", ...(watch ? ["--watch"] : [])];
    const child = spawn("npx", args, {
      stdio: "inherit",
      env: { ...process.env, INPUT: input },
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`vite exit ${code} for ${input}`)),
    );
  });
}

if (watch) {
  // In watch mode, run all builds in parallel so each entry watches its own files.
  for (const step of STEPS) runVite(step).catch((e) => console.error(e));
} else {
  for (const step of STEPS) {
    console.log(`\n[build-ui] ${step}`);
    await runVite(step);
  }
}
