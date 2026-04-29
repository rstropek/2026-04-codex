import { expect, test } from "@playwright/test";

test("renders the hello world page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Hello World", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Shared library result: 1 + 2 = 3"),
  ).toBeVisible();
  await expect(page.locator('svg[data-icon="thumbs-up"]')).toBeVisible();
});
