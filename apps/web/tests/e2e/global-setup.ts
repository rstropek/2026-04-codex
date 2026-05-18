import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const E2E_DATABASE_URL = path.join(tmpdir(), "questionnaires-e2e.db");
export const E2E_SEED = 42;

export default async function globalSetup() {
  if (existsSync(E2E_DATABASE_URL)) rmSync(E2E_DATABASE_URL);

  execSync("pnpm --filter @questionnaires/lib build", {
    stdio: "inherit",
    cwd: path.resolve(__dirname, "../../../.."),
  });

  const { createDb, applyMigrations, seedSampleData } = await import(
    "@questionnaires/lib"
  );
  const { db, sqlite } = createDb(E2E_DATABASE_URL);
  applyMigrations(db);
  seedSampleData(db, { seed: E2E_SEED });
  sqlite.close();

  process.env.DATABASE_URL = E2E_DATABASE_URL;
}
