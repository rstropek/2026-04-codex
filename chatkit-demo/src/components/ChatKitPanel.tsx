"use client";

import { ChatKit, useChatKit } from "@openai/chatkit-react";

async function getClientSecret(currentSecret: string | null): Promise<string> {
  if (currentSecret) return currentSecret;

  const response = await fetch("/api/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    client_secret?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to create session");
  }
  if (!payload.client_secret) {
    throw new Error("Missing client secret in response");
  }
  return payload.client_secret;
}

type QuestionnaireActionPayload = {
  questionnaire?: {
    description?: string;
    audience?: string;
    tonality?: string;
    anonymous?: boolean;
  };
};

export function ChatKitPanel() {
  const chatkit = useChatKit({
    api: { getClientSecret },
    widgets: {
      onAction: async (action, item) => {
        console.log("[ChatKit] widget action", { action, item });

        if (action.type !== "questionnaire.create") return;

        const q = (action.payload as QuestionnaireActionPayload | undefined)?.questionnaire ?? {};
        const text = [
          `Generate a questionnaire for me`,
          `Description: ${q.description ?? ""}`,
          `Audience: ${q.audience ?? ""}`,
          `Tonality: ${q.tonality ?? "neutral"}`,
          `Anonymous: ${q.anonymous ? "yes" : "no"}`,
        ].join("\n");

        await chatkit.sendUserMessage({ text });
      },
    },
  });

  return <ChatKit control={chatkit.control} />;
}
