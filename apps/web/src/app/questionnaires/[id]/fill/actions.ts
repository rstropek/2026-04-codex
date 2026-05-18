"use server";

import {
  type Answer,
  getQuestionnaire,
  submitAnswers,
} from "@questionnaires/lib";
import { redirect } from "next/navigation";
import { getDb } from "../../../../server/db";

export async function submitAnswersAction(formData: FormData) {
  const questionnaireId = Number(formData.get("questionnaireId"));
  const versionNumber = Number(formData.get("versionNumber"));
  if (
    !Number.isInteger(questionnaireId) ||
    questionnaireId <= 0 ||
    !Number.isInteger(versionNumber) ||
    versionNumber <= 0
  ) {
    throw new Error("Invalid form submission");
  }

  const { db } = getDb();
  const questionnaire = getQuestionnaire(db, questionnaireId, {
    version: versionNumber,
  });

  const answers: Answer[] = [];
  for (const q of questionnaire.questions) {
    const raw = formData.get(q.qid);
    if (q.type === "text") {
      const value = raw == null ? "" : raw.toString();
      if (!value.trim() && !q.required) continue;
      answers.push({ qid: q.qid, type: "text", value });
    } else if (q.type === "boolean") {
      if (raw == null) continue;
      const str = raw.toString();
      if (str !== "true" && str !== "false") continue;
      answers.push({ qid: q.qid, type: "boolean", value: str === "true" });
    } else {
      if (raw == null || raw.toString() === "") continue;
      const value = Number(raw);
      if (!Number.isInteger(value)) continue;
      answers.push({ qid: q.qid, type: "likert", value });
    }
  }

  submitAnswers(db, {
    questionnaireId,
    version: versionNumber,
    answers,
  });

  redirect(`/questionnaires/${questionnaireId}/fill/thanks`);
}
