import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { BooleanQuestionInput } from "./boolean-question-input";

test("selects Yes/No radio", async () => {
  const screen = await render(
    <BooleanQuestionInput
      question={{
        qid: "q1",
        type: "boolean",
        prompt: "Did you enjoy it?",
        required: true,
      }}
      name="q1"
    />,
  );

  await expect.element(screen.getByText("Did you enjoy it?")).toBeVisible();

  const yes = screen.getByRole("radio", { name: "Yes" });
  const no = screen.getByRole("radio", { name: "No" });

  await yes.click();
  await expect.element(yes).toBeChecked();
  await expect.element(no).not.toBeChecked();

  await no.click();
  await expect.element(no).toBeChecked();
  await expect.element(yes).not.toBeChecked();
});
