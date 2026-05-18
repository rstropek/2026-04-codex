import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { LikertQuestionInput } from "./likert-question-input";

test("renders likert scale and selects a value", async () => {
  const screen = await render(
    <LikertQuestionInput
      question={{
        qid: "q1",
        type: "likert",
        prompt: "Rate the experience",
        required: true,
        likertMax: 5,
        lowLabel: "Poor",
        highLabel: "Excellent",
      }}
      name="q1"
    />,
  );

  await expect.element(screen.getByText("Poor")).toBeVisible();
  await expect.element(screen.getByText("Excellent")).toBeVisible();

  const option = screen.getByRole("radio", { name: "3" });
  await option.click();
  await expect.element(option).toBeChecked();
});
