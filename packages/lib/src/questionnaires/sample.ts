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
} from "./schemas.js";

export interface SeedSampleOptions {
  seed?: number;
}

export interface SeededQuestionnaire {
  id: number;
  title: string;
  versions: number[];
  submissions: number;
}

export interface SeedSampleResult {
  seed: number;
  questionnaires: SeededQuestionnaire[];
}

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
  const rng = mulberry32(seed);
  const faker = new Faker({ locale: en, seed });

  const cf = createQuestionnaire(db, customerFeedbackV1);
  updateQuestionnaire(db, cf.id, customerFeedbackV2);
  const ob = createQuestionnaire(db, onboardingSurvey);
  const ir = createQuestionnaire(db, incidentRetrospective);

  const cfCount = pickSubmissionCount(rng);
  const cfV2Fraction = 0.4 + rng() * 0.4;
  let cfV2 = Math.round(cfCount * cfV2Fraction);
  if (cfV2 < 3) cfV2 = 3;
  if (cfCount - cfV2 < 3) cfV2 = cfCount - 3;
  const cfV1 = cfCount - cfV2;

  for (let i = 0; i < cfV1; i++) {
    submitAnswers(db, {
      questionnaireId: cf.id,
      version: 1,
      answers: buildAnswers(customerFeedbackV1.questions, rng, faker),
    });
  }
  for (let i = 0; i < cfV2; i++) {
    submitAnswers(db, {
      questionnaireId: cf.id,
      version: 2,
      answers: buildAnswers(customerFeedbackV2.questions, rng, faker),
    });
  }

  const obCount = pickSubmissionCount(rng);
  for (let i = 0; i < obCount; i++) {
    submitAnswers(db, {
      questionnaireId: ob.id,
      version: 1,
      answers: buildAnswers(onboardingSurvey.questions, rng, faker),
    });
  }

  const irCount = pickSubmissionCount(rng);
  for (let i = 0; i < irCount; i++) {
    submitAnswers(db, {
      questionnaireId: ir.id,
      version: 1,
      answers: buildAnswers(incidentRetrospective.questions, rng, faker),
    });
  }

  return {
    seed,
    questionnaires: [
      {
        id: cf.id,
        title: customerFeedbackV1.title,
        versions: [1, 2],
        submissions: cfCount,
      },
      {
        id: ob.id,
        title: onboardingSurvey.title,
        versions: [1],
        submissions: obCount,
      },
      {
        id: ir.id,
        title: incidentRetrospective.title,
        versions: [1],
        submissions: irCount,
      },
    ],
  };
}
