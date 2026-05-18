export type {
  Answer,
  CreateQuestionnaireInput,
  NewQuestionInput,
  Question,
  SubmitAnswersInput,
  UpdateQuestionnaireInput,
} from "./schemas.js";

export type QuestionnaireVersionMeta = {
  id: number;
  versionNumber: number;
  title: string;
  createdAt: string;
};

export type Questionnaire = {
  id: number;
  title: string;
  deletedAt: string | null;
  version: QuestionnaireVersionMeta;
  questions: import("./schemas.js").Question[];
};

export type QuestionnaireSummary = {
  id: number;
  title: string;
  currentVersion: number | null;
  createdAt: string;
  deletedAt: string | null;
};

export type Submission = {
  id: number;
  questionnaireId: number;
  versionNumber: number;
  createdAt: string;
  answers: import("./schemas.js").Answer[];
};
