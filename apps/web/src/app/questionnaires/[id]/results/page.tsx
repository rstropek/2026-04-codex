import {
  getQuestionnaire,
  getQuestionnaireVersionResults,
  NotFoundError,
} from "@questionnaires/lib";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../server/db";
import pageStyles from "../../../page.module.css";
import { BooleanResult } from "./_components/boolean-result";
import { LikertResult } from "./_components/likert-result";
import { TextResult } from "./_components/text-result";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export default async function ResultsPage({ params }: RouteParams) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { db } = getDb();

  let questionnaire: Awaited<ReturnType<typeof getQuestionnaire>>;
  try {
    questionnaire = getQuestionnaire(db, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const results = getQuestionnaireVersionResults(
    db,
    id,
    questionnaire.version.versionNumber,
  );

  return (
    <section className={pageStyles.page}>
      <Link href="/questionnaires" className={styles.backLink}>
        ← All questionnaires
      </Link>
      <p className={pageStyles.eyebrow}>Results</p>
      <h1 className={pageStyles.title}>{results.questionnaireTitle}</h1>
      <div className={styles.headerMeta}>
        <span>v{results.versionNumber}</span>
        <span>
          {results.submissionCount} submission
          {results.submissionCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className={styles.questions}>
        {results.questions.map((q) => (
          <div key={q.qid} className={styles.question}>
            <p className={styles.qtype}>{q.type}</p>
            <h2 className={styles.prompt}>{q.prompt}</h2>
            {q.type === "text" && <TextResult result={q} />}
            {q.type === "boolean" && <BooleanResult result={q} />}
            {q.type === "likert" && <LikertResult result={q} />}
          </div>
        ))}
      </div>
    </section>
  );
}
