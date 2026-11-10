import { expect, test } from "@playwright/test";

const queryBox = "What are you looking for?";
const expectedDataMode = process.env.NEXT_PUBLIC_IS_MOCK === "false" ? "live" : "mock";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Browse the catalog", level: 2 })).toBeVisible();
  await expect(page.locator(".shop-shell")).toHaveAttribute("data-mode", expectedDataMode);
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(8);
});

test("Flow 1: opens discovery with catalog-backed products", async ({ page }) => {
  await expect(page.getByRole("complementary").getByText("Catalog service connected")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: queryBox })).toBeVisible();
  await expect(page.locator(".product-image-wrap").first()).toHaveCSS("position", "relative");
});

test("shows offline state and verifies service health after reconnecting", async ({ page }) => {
  const offlineMessage = [
    "Your device is offline. Catalog searches and feedback need a connection;",
    "your current search remains on this page.",
  ].join(" ");
  await page.context().setOffline(true);
  await expect(page.getByText(offlineMessage, { exact: true })).toBeVisible();
  await expect(page.getByText("Catalog service unavailable", { exact: true })).toBeVisible();

  await page.context().setOffline(false);
  await expect(page.getByText("Catalog service connected", { exact: true })).toBeVisible();
  await expect(page.getByText(offlineMessage, { exact: true })).toHaveCount(0);
});

test("API requests carry and return the same request ID", async ({ page }) => {
  const [request, response] = await Promise.all([
    page.waitForRequest((candidate) => candidate.url().endsWith("/api/v1/catalog")),
    page.waitForResponse((candidate) => candidate.url().endsWith("/api/v1/catalog")),
    page.reload(),
  ]);
  const requestId = (await request.allHeaders())["x-request-id"];

  expect(requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect((await response.allHeaders())["x-request-id"]).toBe(requestId);
});

test("Flow 2: submits a natural-language product need", async ({ page }) => {
  await page.getByRole("searchbox", { name: queryBox }).fill("A light pack for weekend trails");
  await page.getByRole("button", { name: "Find products" }).click();
  await expect(page.getByRole("heading", { name: "Ridge Daypack", level: 2 })).toBeVisible();
  await expect(page.getByText("daypack", { exact: true })).toBeVisible();
});

test("Flow 3: ranks and explains headphones from stored attributes", async ({ page }) => {
  await page.getByRole("searchbox", { name: queryBox }).fill("Quiet headphones for focused work");
  await page.getByRole("button", { name: "Find products" }).click();
  await expect(page.getByRole("heading", { name: "Studio Headphones", level: 2 })).toBeVisible();
  await expect(page.getByText("quiet", { exact: true })).toBeVisible();
});

test("Flow 4: category filters narrow the catalog", async ({ page }) => {
  await page.getByRole("button", { name: "Audio", exact: true }).click();
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Studio Headphones", level: 2 })).toBeVisible();
});

test("Flow 5: an unmatched query returns no fabricated products", async ({ page }) => {
  await page.getByRole("searchbox", { name: queryBox }).fill("a purple titanium telescope for whales");
  await page.getByRole("button", { name: "Find products" }).click();
  await expect(page.getByRole("heading", { name: "No close matches yet" })).toBeVisible();
  await expect(page.locator('[data-testid="product-card"]')).toHaveCount(0);
});

test("Flow 6: saves a product and restores it after reload", async ({ page }) => {
  await page.getByRole("button", { name: "Save product: Ridge Daypack" }).click();
  await expect(page.getByText("Added to your saved list.")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: /Saved list/ })
    .click();
  await expect(page.getByRole("heading", { name: "Your saved list", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ridge Daypack", level: 2 })).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: /Saved list/ })
    .click();
  await expect(page.getByRole("heading", { name: "Ridge Daypack", level: 2 })).toBeVisible();
});

test("Flow 7: compares two catalog products side by side", async ({ page }) => {
  await page.getByRole("button", { name: "Compare: Ridge Daypack" }).click();
  await page.getByRole("button", { name: "Compare: Studio Headphones" }).click();
  await page.getByRole("button", { name: "Compare selected" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Ridge Daypack")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Studio Headphones")).toBeVisible();
});

test("Flow 8: sends feedback for a recommendation", async ({ page }) => {
  await page.getByRole("searchbox", { name: queryBox }).fill("Fragrance-free care for dry skin");
  await page.getByRole("button", { name: "Find products" }).click();
  await expect(page.getByRole("heading", { name: "Calm Face Oil", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Helpful: Calm Face Oil" }).click();
  await expect(page.locator(".feedback-thanks")).toBeVisible();
});

test("Flow 9: switches and persists light/dark appearance", async ({ page }) => {
  await page.getByRole("button", { name: "Toggle light and dark mode" }).click();
  await expect(page.locator(".shop-shell")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator(".shop-shell")).toHaveAttribute("data-theme", "dark");
});

test("keeps architecture documentation outside the product UI", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Architecture", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Application architecture" })).toHaveCount(0);

  const modelResponse = await page.request.get("/shopsense-ai-model.json");
  expect(modelResponse.ok()).toBe(true);
  const contentModel = await modelResponse.json();
  expect(contentModel).toMatchObject({ version: 1, appId: "shopsense-ai" });
  expect(contentModel.data).not.toHaveProperty("architecture");
  expect(contentModel.data.navigation).not.toContainEqual(expect.objectContaining({ id: "architecture" }));

  const publicArchitecture = await page.request.get("/architecture.md");
  expect(publicArchitecture.status()).toBe(404);
});

test("replaces model locale, shopper copy, and document metadata", async ({ page }) => {
  const response = await page.request.get("/shopsense-ai-model.json");
  const englishModel = await response.json();
  const localizedModel = {
    ...englishModel,
    locale: "fr-FR",
    messages: {
      ...englishModel.messages,
      catalogTitle: "Parcourir le catalogue",
    },
    data: {
      ...englishModel.data,
      app: {
        ...englishModel.data.app,
        descriptor: "Découverte de produits",
        description: "Des recommandations issues du catalogue actuel.",
      },
    },
  };
  await page.route("**/shopsense-ai-model.json", (route) => route.fulfill({ json: localizedModel }));
  await page.reload();

  await expect(page.getByRole("heading", { name: "Parcourir le catalogue", level: 2 })).toBeVisible();
  await expect(page).toHaveTitle("ShopSense AI | Découverte de produits");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Des recommandations issues du catalogue actuel.",
  );
});

test("API errors map known codes to model copy instead of backend messages", async ({ page }) => {
  const rawBackendMessage = "Internal catalog exception detail.";
  await page.route("**/api/v1/search", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INVALID_SEARCH", message: rawBackendMessage } }),
    }),
  );
  await page.getByRole("searchbox", { name: queryBox }).fill("a light pack for weekend trails");
  await page.getByRole("button", { name: "Find products" }).click();
  await expect(page.locator(".inline-error")).toHaveText("Enter a search of 3 to 240 characters.");
  await expect(page.locator(".inline-error")).not.toContainText(rawBackendMessage);
});

test("unknown API error codes use generic model copy", async ({ page }) => {
  const rawBackendMessage = "Internal catalog exception detail.";
  await page.route("**/api/v1/search", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NEW_BACKEND_CODE", message: rawBackendMessage } }),
    }),
  );
  await page.getByRole("searchbox", { name: queryBox }).fill("a light pack for weekend trails");
  await page.getByRole("button", { name: "Find products" }).click();
  await expect(page.locator(".inline-error")).toHaveText("The request could not be completed. Try again.");
  await expect(page.locator(".inline-error")).not.toContainText(rawBackendMessage);
});

test("mobile navigation opens and closes without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await page.locator(".mobile-scrim").click({ position: { x: 350, y: 400 } });
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(width.page).toBe(width.viewport);
});
