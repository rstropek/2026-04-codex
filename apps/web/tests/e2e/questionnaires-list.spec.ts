import { expect, test } from "@playwright/test";

test("questionnaires list shows seeded items with action links", async ({
  page,
}) => {
  await page.goto("/questionnaires");

  await expect(
    page.getByRole("heading", { name: "Questionnaires", level: 1 }),
  ).toBeVisible();

  const cards = page.locator("main li");
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  const firstCard = cards.first();
  await expect(firstCard.getByRole("link", { name: "Results" })).toBeVisible();
  await expect(firstCard.getByRole("link", { name: "Fill out" })).toBeVisible();
});
