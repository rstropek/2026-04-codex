import { en, Faker } from "@faker-js/faker";
import type { QuestionnaireDb } from "../db/client.js";
import { ValidationError } from "./errors.js";
import {
  createQuestionnaire,
  submitAnswers,
  updateQuestionnaire,
} from "./repository.js";
import type {
  Answer,
  CreateQuestionnaireInput,
  NewQuestionInput,
  SubmitAnswersInput,
  UpdateQuestionnaireInput,
} from "./schemas.js";

export type SeedSampleOptions = {
  seed?: number;
};

export type SeededQuestionnaire = {
  id: number;
  title: string;
  versions: number[];
  submissions: number;
};

export type SeedSampleResult = {
  seed: number;
  questionnaires: SeededQuestionnaire[];
};

export type SampleQuestionnairePlan = {
  /** Local index within the plan, 1-based. Translates to DB id after seeding. */
  localId: number;
  title: string;
  initial: CreateQuestionnaireInput;
  /** v2 input if the questionnaire should be updated to a second version. */
  update?: UpdateQuestionnaireInput;
  versions: number[];
  /** Submissions indexed by versionNumber. */
  submissionsByVersion: Map<
    number,
    Omit<SubmitAnswersInput, "questionnaireId">[]
  >;
};

export type SampleDataPlan = {
  seed: number;
  questionnaires: SampleQuestionnairePlan[];
};

const customerFeedbackV1: CreateQuestionnaireInput = {
  title: "Customer Feedback Q2",
  questions: [
    { type: "text", prompt: "What did you like?", required: true },
    { type: "boolean", prompt: "Would you recommend us?", required: true },
    {
      type: "likert",
      prompt: "How satisfied are you?",
      required: true,
      likertMax: 4,
      lowLabel: "Not at all",
      highLabel: "Extremely",
    },
    { type: "text", prompt: "Any other feedback?", required: false },
    { type: "boolean", prompt: "Subscribe to newsletter?", required: false },
  ],
};

const customerFeedbackV2: CreateQuestionnaireInput = {
  title: "Customer Feedback Q2",
  questions: [
    { type: "text", prompt: "What did you enjoy most?", required: true },
    {
      type: "boolean",
      prompt: "Would you recommend us to a friend?",
      required: true,
    },
    {
      type: "likert",
      prompt: "How satisfied are you?",
      required: true,
      likertMax: 4,
      lowLabel: "Not at all",
      highLabel: "Extremely",
    },
    { type: "text", prompt: "Any other feedback?", required: false },
    { type: "boolean", prompt: "Subscribe to newsletter?", required: false },
    { type: "boolean", prompt: "Interested in a follow-up?", required: false },
  ],
};

const onboardingSurvey: CreateQuestionnaireInput = {
  title: "Developer Onboarding Survey",
  questions: [
    { type: "text", prompt: "Which team did you join?", required: true },
    {
      type: "likert",
      prompt: "How would you rate the documentation?",
      required: true,
      likertMax: 5,
      lowLabel: "Poor",
      highLabel: "Excellent",
    },
    {
      type: "boolean",
      prompt: "Was a mentor assigned to you?",
      required: true,
    },
    {
      type: "text",
      prompt: "Any blockers in your first week?",
      required: false,
    },
    {
      type: "boolean",
      prompt: "Interested in pair-programming sessions?",
      required: false,
    },
  ],
};

const incidentRetrospective: CreateQuestionnaireInput = {
  title: "Post-Incident Retrospective",
  questions: [
    {
      type: "text",
      prompt: "Briefly summarize the incident.",
      required: true,
    },
    {
      type: "likert",
      prompt: "How severe was the impact?",
      required: true,
      likertMax: 7,
      lowLabel: "Negligible",
      highLabel: "Critical",
    },
    {
      type: "boolean",
      prompt: "Were customers directly impacted?",
      required: true,
    },
    {
      type: "text",
      prompt: "Proposed follow-up actions?",
      required: false,
    },
  ],
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSubmissionCount(rng: () => number): number {
  return 15 + Math.floor(rng() * 6);
}

function buildAnswers(
  questions: NewQuestionInput[],
  rng: () => number,
  faker: Faker,
): Answer[] {
  const answers: Answer[] = [];
  questions.forEach((q, i) => {
    const qid = `q${i + 1}`;
    if (!q.required && rng() < 0.25) return;
    if (q.type === "text") {
      answers.push({ qid, type: "text", value: faker.lorem.sentence() });
    } else if (q.type === "boolean") {
      answers.push({ qid, type: "boolean", value: rng() < 0.5 });
    } else {
      const value = 1 + Math.floor(rng() * q.likertMax);
      answers.push({ qid, type: "likert", value });
    }
  });
  return answers;
}

/**
 * Pure planner. Given a seed, returns the exact dataset that
 * {@link seedSampleData} would persist — without touching a DB. Both the
 * seeding routine and tests consume this so that expected results can be
 * derived without re-deriving RNG state.
 */
export function buildSampleData(seed: number): SampleDataPlan {
  if (!Number.isFinite(seed)) {
    throw new ValidationError([
      { code: "invalid_input", message: "seed must be a finite number" },
    ]);
  }
  const rng = mulberry32(seed);
  const faker = new Faker({ locale: en, seed });

  // Customer Feedback (versioned)
  const cfCount = pickSubmissionCount(rng);
  const cfV2Fraction = 0.4 + rng() * 0.4;
  let cfV2 = Math.round(cfCount * cfV2Fraction);
  if (cfV2 < 3) cfV2 = 3;
  if (cfCount - cfV2 < 3) cfV2 = cfCount - 3;
  const cfV1 = cfCount - cfV2;

  const cfV1Subs = [] as Omit<SubmitAnswersInput, "questionnaireId">[];
  for (let i = 0; i < cfV1; i++) {
    cfV1Subs.push({
      version: 1,
      answers: buildAnswers(customerFeedbackV1.questions, rng, faker),
    });
  }
  const cfV2Subs = [] as Omit<SubmitAnswersInput, "questionnaireId">[];
  for (let i = 0; i < cfV2; i++) {
    cfV2Subs.push({
      version: 2,
      answers: buildAnswers(customerFeedbackV2.questions, rng, faker),
    });
  }

  // Onboarding
  const obCount = pickSubmissionCount(rng);
  const obSubs = [] as Omit<SubmitAnswersInput, "questionnaireId">[];
  for (let i = 0; i < obCount; i++) {
    obSubs.push({
      version: 1,
      answers: buildAnswers(onboardingSurvey.questions, rng, faker),
    });
  }

  // Incident retrospective
  const irCount = pickSubmissionCount(rng);
  const irSubs = [] as Omit<SubmitAnswersInput, "questionnaireId">[];
  for (let i = 0; i < irCount; i++) {
    irSubs.push({
      version: 1,
      answers: buildAnswers(incidentRetrospective.questions, rng, faker),
    });
  }

  const questionnaires: SampleQuestionnairePlan[] = [
    {
      localId: 1,
      title: customerFeedbackV1.title,
      initial: customerFeedbackV1,
      update: customerFeedbackV2,
      versions: [1, 2],
      submissionsByVersion: new Map([
        [1, cfV1Subs],
        [2, cfV2Subs],
      ]),
    },
    {
      localId: 2,
      title: onboardingSurvey.title,
      initial: onboardingSurvey,
      versions: [1],
      submissionsByVersion: new Map([[1, obSubs]]),
    },
    {
      localId: 3,
      title: incidentRetrospective.title,
      initial: incidentRetrospective,
      versions: [1],
      submissionsByVersion: new Map([[1, irSubs]]),
    },
  ];

  return { seed, questionnaires };
}

export function seedSampleData(
  db: QuestionnaireDb,
  opts: SeedSampleOptions = {},
): SeedSampleResult {
  if (opts.seed !== undefined && !Number.isFinite(opts.seed)) {
    throw new ValidationError([
      { code: "invalid_input", message: "seed must be a finite number" },
    ]);
  }
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const plan = buildSampleData(seed);

  const seeded: SeededQuestionnaire[] = [];
  for (const q of plan.questionnaires) {
    const created = createQuestionnaire(db, q.initial);
    if (q.update) {
      updateQuestionnaire(db, created.id, q.update);
    }
    let total = 0;
    for (const version of q.versions) {
      const subs = q.submissionsByVersion.get(version) ?? [];
      for (const s of subs) {
        submitAnswers(db, { ...s, questionnaireId: created.id });
        total++;
      }
    }
    seeded.push({
      id: created.id,
      title: q.title,
      versions: q.versions,
      submissions: total,
    });
  }

  return { seed, questionnaires: seeded };
}
