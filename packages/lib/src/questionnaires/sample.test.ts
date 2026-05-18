import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-setup.js";
import { listSubmissions } from "./repository.js";
import { buildSampleData, seedSampleData } from "./sample.js";

describe("seedSampleData", () => {
  it("persists exactly what buildSampleData describes", () => {
    const seed = 42;
    const plan = buildSampleData(seed);
    const { db } = createTestDb();
    const result = seedSampleData(db, { seed });

    expect(result.seed).toBe(seed);
    expect(result.questionnaires).toHaveLength(plan.questionnaires.length);

    plan.questionnaires.forEach((expected, idx) => {
      const actual = result.questionnaires[idx];
      if (!actual) throw new Error(`missing actual at index ${idx}`);
      const expectedTotal = expected.versions.reduce(
        (sum, v) => sum + (expected.submissionsByVersion.get(v)?.length ?? 0),
        0,
      );
      expect(actual.title).toBe(expected.title);
      expect(actual.versions).toEqual(expected.versions);
      expect(actual.submissions).toBe(expectedTotal);

      const dbSubs = listSubmissions(db, actual.id);
      expect(dbSubs).toHaveLength(expectedTotal);

      for (const version of expected.versions) {
        const planSubs = expected.submissionsByVersion.get(version) ?? [];
        const dbForVersion = dbSubs.filter((s) => s.versionNumber === version);
        expect(dbForVersion).toHaveLength(planSubs.length);
        planSubs.forEach((planSub, i) => {
          const dbSub = dbForVersion[i];
          if (!dbSub) throw new Error(`missing db submission at ${i}`);
          expect(dbSub.answers).toEqual(planSub.answers);
        });
      }
    });
  });
});
