import { beforeEach, describe, expect, it } from "vitest";
import type { CreatedDb } from "../db/client.js";
import { createTestDb } from "../db/test-setup.js";
import { NotFoundError, ValidationError } from "./errors.js";
import {
  createQuestionnaire,
  getQuestionnaire,
  listSubmissions,
  softDeleteQuestionnaire,
  submitAnswers,
  updateQuestionnaire,
} from "./repository.js";
import type { NewQuestionInput } from "./schemas.js";

let created: CreatedDb;

beforeEach(() => {
  created = createTestDb();
});

function v1Questions(): NewQuestionInput[] {
  return [
    { type: "text", prompt: "What is your role?", required: true },
    { type: "boolean", prompt: "Would you recommend us?", required: true },
    {
      type: "likert",
      prompt: "How satisfied are you?",
      required: true,
      likertMax: 4,
      lowLabel: "not satisfied",
      highLabel: "very satisfied",
    },
    { type: "text", prompt: "Any additional comments?", required: false },
    { type: "boolean", prompt: "Have you contacted support?", required: false },
  ];
}

function v2Questions(): NewQuestionInput[] {
  return [
    { type: "text", prompt: "What is your current role?", required: true },
    {
      type: "boolean",
      prompt: "Would you recommend our service?",
      required: true,
    },
    {
      type: "likert",
      prompt: "How satisfied are you overall?",
      required: true,
      likertMax: 4,
      lowLabel: "not at all",
      highLabel: "very",
    },
    { type: "text", prompt: "Additional comments?", required: false },
    {
      type: "boolean",
      prompt: "Have you contacted support recently?",
      required: false,
    },
    {
      type: "boolean",
      prompt: "Did support resolve your issue?",
      required: false,
    },
  ];
}

describe("scripted happy path", () => {
  it("creates v1, updates to v2, submits answers for both versions, lists them back", () => {
    const { db } = created;

    const createResult = createQuestionnaire(db, {
      title: "Customer Feedback Q2",
      questions: v1Questions(),
    });
    expect(createResult.version).toBe(1);

    const v1 = getQuestionnaire(db, createResult.id, { version: 1 });
    expect(v1.questions).toHaveLength(5);
    expect(v1.title).toBe("Customer Feedback Q2");

    const updateResult = updateQuestionnaire(db, createResult.id, {
      title: "Customer Feedback Q2",
      questions: v2Questions(),
    });
    expect(updateResult.version).toBe(2);

    const current = getQuestionnaire(db, createResult.id);
    expect(current.version.versionNumber).toBe(2);
    expect(current.questions).toHaveLength(6);
    expect(current.questions[0]?.prompt).toBe("What is your current role?");

    const v1Again = getQuestionnaire(db, createResult.id, { version: 1 });
    expect(v1Again.questions).toHaveLength(5);

    const v1Answers = submitAnswers(db, {
      questionnaireId: createResult.id,
      version: 1,
      answers: [
        { qid: "q1", type: "text", value: "Engineer" },
        { qid: "q2", type: "boolean", value: true },
        { qid: "q3", type: "likert", value: 3 },
        { qid: "q4", type: "text", value: "Great service" },
        { qid: "q5", type: "boolean", value: false },
      ],
    });
    expect(v1Answers.submissionId).toBeGreaterThan(0);

    const v2Answers = submitAnswers(db, {
      questionnaireId: createResult.id,
      version: 2,
      answers: [
        { qid: "q1", type: "text", value: "Senior Engineer" },
        { qid: "q2", type: "boolean", value: true },
        { qid: "q3", type: "likert", value: 4 },
        { qid: "q4", type: "text", value: "" },
        { qid: "q5", type: "boolean", value: true },
        { qid: "q6", type: "boolean", value: true },
      ],
    });
    expect(v2Answers.submissionId).toBeGreaterThan(v1Answers.submissionId);

    const subs = listSubmissions(db, createResult.id);
    expect(subs).toHaveLength(2);
    expect(subs[0]?.versionNumber).toBe(1);
    expect(subs[0]?.answers).toHaveLength(5);
    expect(subs[1]?.versionNumber).toBe(2);
    expect(subs[1]?.answers).toHaveLength(6);
  });
});

describe("submission failure cases", () => {
  function setupV1(): number {
    return createQuestionnaire(created.db, {
      title: "Customer Feedback Q2",
      questions: v1Questions(),
    }).id;
  }

  it("rejects missing required answer", () => {
    const id = setupV1();
    let caught: unknown;
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [
          { qid: "q1", type: "text", value: "Eng" },
          { qid: "q2", type: "boolean", value: true },
          // q3 (likert, required) is missing
        ],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    const issues = (caught as ValidationError).issues;
    expect(
      issues.some(
        (i) => i.code === "missing_required_answer" && i.qid === "q3",
      ),
    ).toBe(true);
  });

  it("rejects unknown qid", () => {
    const id = setupV1();
    expect(() =>
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [
          { qid: "q1", type: "text", value: "x" },
          { qid: "q2", type: "boolean", value: false },
          { qid: "q3", type: "likert", value: 2 },
          { qid: "qX", type: "text", value: "ghost" },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects answers for a non-existent questionnaire", () => {
    expect(() =>
      submitAnswers(created.db, {
        questionnaireId: 9999,
        version: 1,
        answers: [],
      }),
    ).toThrow(NotFoundError);
  });

  it("rejects answers for a soft-deleted questionnaire", () => {
    const id = setupV1();
    softDeleteQuestionnaire(created.db, id);
    let caught: unknown;
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [
          { qid: "q1", type: "text", value: "x" },
          { qid: "q2", type: "boolean", value: true },
          { qid: "q3", type: "likert", value: 2 },
        ],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).issues[0]?.code).toBe(
      "questionnaire_deleted",
    );
  });

  it("rejects wrong answer type", () => {
    const id = setupV1();
    let caught: unknown;
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [
          { qid: "q1", type: "boolean", value: true },
          { qid: "q2", type: "boolean", value: true },
          { qid: "q3", type: "likert", value: 2 },
        ],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect(
      (caught as ValidationError).issues.some(
        (i) => i.code === "wrong_answer_type" && i.qid === "q1",
      ),
    ).toBe(true);
  });

  it("rejects likert out-of-range (low and high boundaries)", () => {
    const id = setupV1();
    let caughtLow: unknown;
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [
          { qid: "q1", type: "text", value: "x" },
          { qid: "q2", type: "boolean", value: true },
          { qid: "q3", type: "likert", value: 0 },
        ],
      });
    } catch (e) {
      caughtLow = e;
    }
    // value: 0 fails the Zod min(1) check -> invalid_input
    expect(caughtLow).toBeInstanceOf(ValidationError);

    let caughtHigh: unknown;
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [
          { qid: "q1", type: "text", value: "x" },
          { qid: "q2", type: "boolean", value: true },
          { qid: "q3", type: "likert", value: 5 },
        ],
      });
    } catch (e) {
      caughtHigh = e;
    }
    expect(caughtHigh).toBeInstanceOf(ValidationError);
    expect(
      (caughtHigh as ValidationError).issues.some(
        (i) => i.code === "likert_out_of_range",
      ),
    ).toBe(true);
  });

  it("rejects duplicate answers for the same qid", () => {
    const id = setupV1();
    let caught: unknown;
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [
          { qid: "q1", type: "text", value: "a" },
          { qid: "q1", type: "text", value: "b" },
          { qid: "q2", type: "boolean", value: true },
          { qid: "q3", type: "likert", value: 2 },
        ],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect(
      (caught as ValidationError).issues.some(
        (i) => i.code === "duplicate_answer",
      ),
    ).toBe(true);
  });

  it("rejects answers against a non-existent version", () => {
    const id = setupV1();
    let caught: unknown;
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 99,
        answers: [
          { qid: "q1", type: "text", value: "x" },
          { qid: "q2", type: "boolean", value: true },
          { qid: "q3", type: "likert", value: 2 },
        ],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    expect((caught as ValidationError).issues[0]?.code).toBe(
      "version_not_found",
    );
  });

  it("aggregates multiple issues in a single error", () => {
    const id = setupV1();
    let caught: unknown;
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [
          { qid: "q1", type: "boolean", value: true }, // wrong_answer_type
          { qid: "qX", type: "text", value: "ghost" }, // unknown_qid
          { qid: "q2", type: "boolean", value: true },
          { qid: "q3", type: "likert", value: 2 },
        ],
      });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ValidationError);
    const codes = (caught as ValidationError).issues.map((i) => i.code);
    expect(codes).toContain("wrong_answer_type");
    expect(codes).toContain("unknown_qid");
  });

  it("rolls back the submission on validation failure", () => {
    const id = setupV1();
    try {
      submitAnswers(created.db, {
        questionnaireId: id,
        version: 1,
        answers: [{ qid: "q1", type: "text", value: "only one" }],
      });
    } catch {
      // expected
    }
    expect(listSubmissions(created.db, id)).toHaveLength(0);
  });
});

describe("update failure cases", () => {
  it("throws NotFoundError for missing questionnaire", () => {
    expect(() =>
      updateQuestionnaire(created.db, 9999, {
        title: "x",
        questions: [{ type: "text", prompt: "?", required: true }],
      }),
    ).toThrow(NotFoundError);
  });

  it("rejects updates to a soft-deleted questionnaire", () => {
    const id = createQuestionnaire(created.db, {
      title: "x",
      questions: v1Questions(),
    }).id;
    softDeleteQuestionnaire(created.db, id);
    expect(() =>
      updateQuestionnaire(created.db, id, {
        title: "x",
        questions: [{ type: "text", prompt: "?", required: true }],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects empty question lists via Zod", () => {
    const id = createQuestionnaire(created.db, {
      title: "x",
      questions: v1Questions(),
    }).id;
    expect(() =>
      updateQuestionnaire(created.db, id, { title: "x", questions: [] }),
    ).toThrow(ValidationError);
  });
});
