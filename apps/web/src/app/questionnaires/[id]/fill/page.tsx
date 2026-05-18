import { getQuestionnaire, NotFoundError } from "@questionnaires/lib";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "../../../../server/db";
import pageStyles from "../../../page.module.css";
import { FillForm } from "./_components/fill-form";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export default async function FillPage({ params }: RouteParams) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const { db } = getDb();
  let questionnaire: ReturnType<typeof getQuestionnaire>;
  try {
    questionnaire = getQuestionnaire(db, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <section className={pageStyles.page}>
      <Link href="/questionnaires" className={styles.backLink}>
        ← All questionnaires
      </Link>
      <p className={pageStyles.eyebrow}>Fill out</p>
      <h1 className={pageStyles.title}>{questionnaire.title}</h1>
      <p className={pageStyles.lede}>
        Version {questionnaire.version.versionNumber}
      </p>
      <FillForm
        questionnaireId={questionnaire.id}
        versionNumber={questionnaire.version.versionNumber}
        questions={questionnaire.questions}
      />
    </section>
  );
}
