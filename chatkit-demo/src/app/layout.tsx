import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatKit Demo",
  description: "Next.js ChatKit demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Script src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js" />
        {children}
      </body>
    </html>
  );
}
