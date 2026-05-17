import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { TopNav } from "./_components/top-nav";
import "./globals.css";
import styles from "./layout.module.css";

config.autoAddCss = false;

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Questionnaires",
  description: "Build, share, and analyse questionnaires.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <TopNav />
        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </body>
    </html>
  );
}
