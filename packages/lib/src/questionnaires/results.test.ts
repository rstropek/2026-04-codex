import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/test-setup.js";
import { NotFoundError } from "./errors.js";
import { createQuestionnaire, submitAnswers } from "./repository.js";
import {
  getQuestionnaireVersionResults,
  type QuestionResult,
} from "./results.js";
import { buildSampleData, seedSampleData } from "./sample.js";
import type {
  Answer,
  CreateQuestionnaireInput,
  NewQuestionInput,
  SubmitAnswersInput,
} from "./schemas.js";

function assignQids(qs: NewQuestionInput[]) {
  return qs.map((q, i) => ({ ...q, qid: `q${i + 1}` }));
}

function computeExpected(
  questions: NewQuestionInput[],
  submissions: Omit<SubmitAnswersInput, "questionnaireId">[],
): QuestionResult[] {
  const withQids = assignQids(questions);
  return withQids.map((q): QuestionResult => {
    const answersForQid = submissions.map(
      (s) => s.answers.find((a) => a.qid === q.qid) as Answer | undefined,
    );
    if (q.type === "text") {
      const texts: string[] = [];
      let emptyCount = 0;
      for (const a of answersForQid) {
        if (!a || a.type !== "text" || a.value.trim().length === 0) {
          emptyCount++;
        } else {
          texts.push(a.value);
        }
      }
      return {
        qid: q.qid,
        type: "text",
        prompt: q.prompt,
        required: q.required,
        answers: texts,
        emptyCount,
      };
    }
    if (q.type === "boolean") {
      let trueCount = 0;
      let falseCount = 0;
      let emptyCount = 0;
      for (const a of answersForQid) {
        if (!a || a.type !== "boolean") emptyCount++;
        else if (a.value) trueCount++;
        else falseCount++;
      }
      return {
        qid: q.qid,
        type: "boolean",
        prompt: q.prompt,
        required: q.required,
        trueCount,
        falseCount,
        emptyCount,
      };
    }
    const counts = Array.from({ length: q.likertMax }, () => 0);
    let emptyCount = 0;
    for (const a of answersForQid) {
      if (!a || a.type !== "likert" || a.value < 1 || a.value > q.likertMax) {
        emptyCount++;
      } else {
        const idx = a.value - 1;
        counts[idx] = (counts[idx] ?? 0) + 1;
      }
    }
    return {
      qid: q.qid,
      type: "likert",
      prompt: q.prompt,
      required: q.required,
      likertMax: q.likertMax,
      lowLabel: q.lowLabel,
      highLabel: q.highLabel,
      counts,
      emptyCount,
    };
  });
}

describe("getQuestionnaireVersionResults", () => {
  it("matches expected aggregates derived from the sample plan", () => {
    const seed = 42;
    const plan = buildSampleData(seed);
    const { db } = createTestDb();
    const seeded = seedSampleData(db, { seed });

    plan.questionnaires.forEach((planQ, idx) => {
      const seededQ = seeded.questionnaires[idx];
      if (!seededQ) throw new Error(`missing seeded questionnaire ${idx}`);
      const dbId = seededQ.id;
      for (const version of planQ.versions) {
        const subs = planQ.submissionsByVersion.get(version) ?? [];
        const versionInput: CreateQuestionnaireInput =
          version === 1
            ? planQ.initial
            : (planQ.update as CreateQuestionnaireInput);

        const expected = computeExpected(versionInput.questions, subs);
        const actual = getQuestionnaireVersionResults(db, dbId, version);

        expect(actual.questionnaireId).toBe(dbId);
        expect(actual.questionnaireTitle).toBe(planQ.title);
        expect(actual.versionNumber).toBe(version);
        expect(actual.versionTitle).toBe(versionInput.title);
        expect(actual.submissionCount).toBe(subs.length);
        expect(actual.questions).toEqual(expected);
      }
    });
  });

  it("treats missing optional answers and whitespace-only text as empty", () => {
    const { db } = createTestDb();
    // Build a tiny questionnaire by hand to exercise the empty paths cleanly.
    const input: CreateQuestionnaireInput = {
      title: "Edge cases",
      questions: [
        { type: "text", prompt: "Comments?", required: false },
        { type: "boolean", prompt: "Subscribed?", required: false },
        {
          type: "likert",
          prompt: "Rate it",
          required: false,
          likertMax: 5,
          lowLabel: "low",
          highLabel: "high",
        },
      ],
    };
    const { id } = createQuestionnaire(db, input);

    submitAnswers(db, {
      questionnaireId: id,
      version: 1,
      answers: [{ qid: "q1", type: "text", value: "   " }],
    });
    submitAnswers(db, {
      questionnaireId: id,
      version: 1,
      answers: [
        { qid: "q1", type: "text", value: "real answer" },
        { qid: "q2", type: "boolean", value: true },
        { qid: "q3", type: "likert", value: 3 },
      ],
    });
    submitAnswers(db, { questionnaireId: id, version: 1, answers: [] });

    const result = getQuestionnaireVersionResults(db, id, 1);
    expect(result.submissionCount).toBe(3);

    const [text, bool, likert] = result.questions;
    expect(text).toMatchObject({
      type: "text",
      answers: ["real answer"],
      emptyCount: 2,
    });
    expect(bool).toMatchObject({
      type: "boolean",
      trueCount: 1,
      falseCount: 0,
      emptyCount: 2,
    });
    expect(likert).toMatchObject({
      type: "likert",
      counts: [0, 0, 1, 0, 0],
      emptyCount: 2,
    });
  });

  it("throws NotFoundError for unknown questionnaire or version", () => {
    const { db } = createTestDb();
    expect(() => getQuestionnaireVersionResults(db, 999, 1)).toThrow(
      NotFoundError,
    );

    const { id } = createQuestionnaire(db, {
      title: "x",
      questions: [{ type: "text", prompt: "p", required: true }],
    });
    expect(() => getQuestionnaireVersionResults(db, id, 99)).toThrow(
      NotFoundError,
    );
  });
});
