import { expect, test } from "@playwright/test";

test("fill out a questionnaire and land on the thank-you page", async ({
  page,
}) => {
  await page.goto("/questionnaires");
  await page
    .locator("main li")
    .first()
    .getByRole("link", {
      name: "Fill out",
    })
    .click();

  await page.waitForURL(/\/questionnaires\/\d+\/fill$/);
  const fillUrl = new URL(page.url());
  const id = fillUrl.pathname.split("/")[2];

  const textareas = page.locator("form textarea");
  const textCount = await textareas.count();
  for (let i = 0; i < textCount; i++) {
    await textareas.nth(i).fill("E2E response");
  }

  const groups = page.getByRole("group");
  const groupCount = await groups.count();
  for (let i = 0; i < groupCount; i++) {
    const firstRadio = groups.nth(i).getByRole("radio").first();
    await firstRadio.check();
  }

  await page.getByRole("button", { name: "Submit" }).click();

  await page.waitForURL(`/questionnaires/${id}/fill/thanks`);
  await expect(
    page.getByRole("heading", { name: "Thanks for your answers" }),
  ).toBeVisible();
});
