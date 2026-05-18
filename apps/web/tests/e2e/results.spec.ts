import { expect, test } from "@playwright/test";

test("results page renders a question results table", async ({ page }) => {
  await page.goto("/questionnaires");
  const firstResults = page.locator("main li").first().getByRole("link", {
    name: "Results",
  });
  await firstResults.click();

  await page.waitForURL(/\/questionnaires\/\d+\/results$/);

  await expect(page.getByText(/\d+ submission/)).toBeVisible();
  await expect(page.getByText("Answer", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Count", { exact: true }).first()).toBeVisible();
});
