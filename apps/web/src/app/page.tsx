import styles from "./page.module.css";

export default function Home() {
  return (
    <section className={styles.page}>
      <p className={styles.eyebrow}>Workspace</p>
      <h1 className={styles.title}>Questionnaires</h1>
      <p className={styles.lede}>
        Build questionnaires, share them with respondents, and review the
        results in one place.
      </p>
    </section>
  );
}
