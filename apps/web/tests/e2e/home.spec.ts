import { expect, test } from "@playwright/test";

test("home page renders with primary navigation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Questionnaires", level: 1 }),
  ).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Questionnaires" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "About" })).toBeVisible();
});
