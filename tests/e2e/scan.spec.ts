import { expect, test } from "@playwright/test";

test("mobile visitor can verify vehicle and see contact options", async ({ page }) => {
  await page.goto("/c/seed-demo");

  await expect(page.getByText("请核对车辆")).toBeVisible();
  await expect(page.getByText("沪A·2345")).toBeVisible();
  await expect(page.getByRole("button", { name: "微信提醒车主" })).toBeVisible();
  await expect(page.getByText("直接电话联系")).toBeVisible();
});
