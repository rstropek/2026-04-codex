import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { TextQuestionInput } from "./text-question-input";

test("renders the prompt and accepts text input", async () => {
  const screen = await render(
    <TextQuestionInput
      question={{
        qid: "q1",
        type: "text",
        prompt: "What is your name?",
        required: true,
      }}
      name="q1"
    />,
  );

  await expect.element(screen.getByText("What is your name?")).toBeVisible();

  const textarea = screen.getByRole("textbox", { name: /What is your name/ });
  await textarea.fill("Ada Lovelace");
  await expect.element(textarea).toHaveValue("Ada Lovelace");
});
