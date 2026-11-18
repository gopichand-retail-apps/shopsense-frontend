import { expect, test } from "@playwright/test";
import envelope from "../public/shopsense-ai-model.json";

for (const status of ["assisted", "unavailable"] as const) {
  test(`ordinary AI search reports ${status} without calling a live provider in CI`, async ({ page }, testInfo) => {
    await page.route("**/api/v1/health", (route) =>
      route.fulfill({
        json: {
          data: {
            status: "ok",
            service: "shopsense-api",
            storage: "sqlite",
            ai: { available: true, provider: "gemini" },
          },
        },
      }),
    );
    await page.route("**/api/v1/search", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ query: "A light pack for weekend trails", useAi: true });
      const product = structuredClone(envelope.data.seed.products[0]);
      Reflect.deleteProperty(product, "matchTags");
      await route.fulfill({
        json: {
          data: {
            intentCategory: product.category,
            resultCount: 1,
            results: [{ product, matchedDetails: product.attributes.slice(0, 1) }],
            summary: "Found one catalog match.",
            source: envelope.messages.localCatalogSource,
            assistance: { status, provider: status === "assisted" ? "gemini" : "local" },
          },
        },
      });
    });
    await page.goto("/");
    await expect(page.getByText(envelope.messages.aiSearchReady)).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await page.getByText(envelope.messages.searchPrivacy).click();
    await expect(page.getByText(envelope.messages.aiSearchDisclosure)).toBeVisible();
    await page.getByRole("searchbox").fill("A light pack for weekend trails");
    await page.getByRole("button", { name: envelope.messages.searchAction }).click();
    await expect(page.getByRole("heading", { name: envelope.messages.resultsTitle })).toBeVisible();
    await expect(page.getByRole("heading", { name: envelope.data.seed.products[0].name })).toBeVisible();
    await expect(
      page.getByText(status === "assisted" ? envelope.messages.aiSearchUsed : envelope.messages.aiSearchFallback),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`ai-${status}.png`), fullPage: true });
  });
}
