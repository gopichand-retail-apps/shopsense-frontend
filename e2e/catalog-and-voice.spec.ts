import { expect, test } from "@playwright/test";
import type { SpeechRecognitionClient } from "../src/lib/speech-recognition";

test("browses 308 records in pages and fetches the selected category from the database", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(24);
  await expect(page.getByText("308 Products in catalog", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more products" }).click();
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(48);
  await page.getByRole("button", { name: "Audio", exact: true }).click();
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(24);
  await page.getByRole("button", { name: "Load more products" }).click();
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(48);
  await page.getByRole("button", { name: "Load more products" }).click();
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(61);
  await expect(page.getByRole("button", { name: "Load more products" })).toHaveCount(0);
});

test("filters black dresses by audience and restores saved products outside the first page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("black dress for men");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/v1/search"));
  await page.getByRole("button", { name: "Find products" }).click();
  const payload = await (await responsePromise).json();
  expect(payload.data.results).toHaveLength(2);
  expect(
    payload.data.results.every(
      (item: { product: { color: string; audience: string; productType: string } }) =>
        item.product.color === "black" && item.product.audience === "men" && item.product.productType === "dress",
    ),
  ).toBe(true);
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(2);
  const firstName = await page.locator('[data-testid="product-card"] h2').first().innerText();
  await page.getByRole("button", { name: `Save product: ${firstName}`, exact: true }).click();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Saved list/ })
    .click();
  await expect(page.getByRole("heading", { name: firstName, exact: true })).toBeVisible();
});

test("voice creates an editable transcript and only submits after the shopper selects Find products", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = class implements SpeechRecognitionClient {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: SpeechRecognitionClient["onresult"] = null;
      onerror: SpeechRecognitionClient["onerror"] = null;
      onend: SpeechRecognitionClient["onend"] = null;
      start() {
        this.onresult?.({ results: [[{ transcript: "black dress for men" }]] });
        this.onend?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    };
  });
  let searches = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/search")) searches += 1;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use microphone for voice input" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("black dress for men");
  expect(searches).toBe(0);
  await page.getByRole("button", { name: "Find products" }).click();
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(2);
  expect(searches).toBe(1);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
