import type { Issue } from "./errors.js";
import type { Answer, Question } from "./schemas.js";

export function validateAnswers(
  questions: Question[],
  answers: Answer[],
): Issue[] {
  const issues: Issue[] = [];
  const byQid = new Map<string, Question>();
  for (const q of questions) {
    byQid.set(q.qid, q);
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const a of answers) {
    if (seen.has(a.qid)) {
      duplicates.add(a.qid);
    } else {
      seen.add(a.qid);
    }
  }
  for (const qid of duplicates) {
    issues.push({
      code: "duplicate_answer",
      qid,
      message: `Multiple answers provided for question "${qid}"`,
    });
  }

  const wrongType = new Set<string>();
  for (const a of answers) {
    const q = byQid.get(a.qid);
    if (!q) {
      issues.push({
        code: "unknown_qid",
        qid: a.qid,
        message: `No question with qid "${a.qid}" exists in this version`,
      });
      continue;
    }
    if (q.type !== a.type) {
      wrongType.add(a.qid);
      issues.push({
        code: "wrong_answer_type",
        qid: a.qid,
        message: `Answer type "${a.type}" does not match question type "${q.type}" for qid "${a.qid}"`,
      });
      continue;
    }
    if (q.type === "likert" && a.type === "likert") {
      if (a.value < 1 || a.value > q.likertMax) {
        issues.push({
          code: "likert_out_of_range",
          qid: a.qid,
          message: `Likert value ${a.value} is outside [1, ${q.likertMax}] for qid "${a.qid}"`,
        });
      }
    }
  }

  const answered = new Set(
    answers.filter((a) => !wrongType.has(a.qid)).map((a) => a.qid),
  );
  for (const q of questions) {
    if (q.required && !answered.has(q.qid)) {
      issues.push({
        code: "missing_required_answer",
        qid: q.qid,
        message: `Required question "${q.qid}" was not answered`,
      });
    }
  }

  return issues;
}
