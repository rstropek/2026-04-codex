import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-setup.js";
import { listSubmissions } from "./repository.js";
import { seedSampleData } from "./sample.js";

describe("seedSampleData", () => {
  // Snapshot is regenerated with `pnpm --filter @questionnaires/lib test -- -u`
  // after any intentional change to scenarios, RNG, or faker major bump.
  it("produces a stable dataset for a fixed seed", () => {
    const { db } = createTestDb();
    const result = seedSampleData(db, { seed: 42 });
    const submissions = result.questionnaires.map((q) => ({
      title: q.title,
      submissions: listSubmissions(db, q.id).map((s) => ({
        versionNumber: s.versionNumber,
        answers: s.answers,
      })),
    }));
    expect({ result, submissions }).toMatchSnapshot();
  });
});
