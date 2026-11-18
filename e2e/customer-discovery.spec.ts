import { expect, test } from "@playwright/test";
import envelope from "../public/shopsense-ai-model.json";

test("customer refines a search, finds its aisle, saves it, compares it and returns to browsing", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("searchbox").fill("shirt");
  await page.getByLabel("Collection", { exact: true }).selectOption("men");
  await page.getByLabel("Color", { exact: true }).selectOption("black");
  await page.getByLabel("Budget", { exact: true }).selectOption("2500");
  const response = page.waitForResponse((value) => value.url().endsWith("/api/v1/search"));
  await page.getByRole("button", { name: "Find products", exact: true }).click();
  const { data } = await (await response).json();
  expect(data.results).toHaveLength(2);
  expect(
    data.results.every(
      (item: { product: { audience: string; color: string; priceCents: number } }) =>
        item.product.audience === "men" && item.product.color === "black" && item.product.priceCents <= 2500,
    ),
  ).toBe(true);
  const cards = page.getByTestId("product-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first().getByText("Aisle A2 · Rack R2 · Shelf 1", { exact: true })).toBeVisible();
  await expect(cards.first().locator("img")).toHaveAttribute("src", /\/catalog\/photos\/shirt-black\.jpg$/);
  await expect
    .poll(() =>
      cards
        .first()
        .locator("img")
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await cards
    .first()
    .getByRole("button", { name: /^Save product:/ })
    .click();
  await cards
    .first()
    .getByRole("button", { name: /^Compare:/ })
    .click();
  await cards
    .last()
    .getByRole("button", { name: /^Compare:/ })
    .click();
  const trigger = page.locator(".compare-dock").getByRole("button", { name: "Compare selected", exact: true });
  await trigger.click();
  const close = page.getByRole("button", { name: "Close comparison" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByText(envelope.messages.storeGuide, { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Men's clothing", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to discovery", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browse the catalog" })).toBeVisible();
});

for (const width of [320, 390, 768, 1440]) {
  test(`customer search remains usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("searchbox").fill("black dress for women");
    await page.getByRole("button", { name: "Find products", exact: true }).click();
    await expect(page.getByTestId("product-card")).toHaveCount(2);
    await expect(page.getByText("Showing 2 of 2 matches", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`customer-search-${width}.png`), fullPage: true });
  });
}

test("contradictory filters give a useful no-match response and can be cleared", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("black shirt");
  await page.getByLabel("Color", { exact: true }).selectOption("white");
  await page.getByRole("button", { name: "Find products", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No close matches yet" })).toBeVisible();
  await expect(page.getByTestId("product-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("button", { name: "Find products", exact: true }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(6);
});

test("an everyday cold-drink request finds recorded insulation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("something to keep my drink cold");
  await page.getByRole("button", { name: "Find products", exact: true }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Trail Bottle", exact: true })).toBeVisible();
  await expect(page.getByText("Aisle O1 · Rack R1 · Shelf 1", { exact: true })).toBeVisible();
});

test("searching preserves the previous browse category and its paging context", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Audio", exact: true }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(24);
  await expect(page.getByRole("heading", { name: "Studio Headphones", exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("black shirt");
  await page.getByRole("button", { name: "Find products", exact: true }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(6);
  await page.getByRole("button", { name: "Back to discovery", exact: true }).click();
  await expect(page.getByRole("button", { name: "Audio", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Studio Headphones", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "All categories", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ridge Daypack", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more products", exact: true }).click();
  await expect(page.getByTestId("product-card")).toHaveCount(48);
  const headings = await page.getByTestId("product-card").getByRole("heading").allTextContents();
  expect(new Set(headings).size).toBe(48);
});

test("resizing from desktop hides closed navigation and keeps its controls out of the tab order", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator(".shop-sidebar")).toBeHidden();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.locator(".shop-sidebar").getByRole("button", { name: "Close navigation", exact: true }).click();
  await expect(page.locator(".shop-sidebar")).toBeHidden();
});
