import { expect, test, type Locator, type Page } from "@playwright/test";
import envelope from "../public/shopsense-ai-model.json";

// SS-01..SS-03 against the isolated local API (synthetic feed), in whichever data mode the build selected.
const copy = envelope.messages;
const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
const expectedDataMode = process.env.NEXT_PUBLIC_IS_MOCK === "false" ? "live" : "mock";

type Availability = { state: "in_stock" | "out_of_stock" | "unknown"; stale: boolean; confirmedAt: string | null };
type OfferItem = { id: string; name: string; availability: Availability | null };

async function openDiscovery(page: Page) {
  await page.goto("/");
  await expect(page.locator(".shop-shell")).toHaveAttribute("data-mode", expectedDataMode);
  await expect(page.getByRole("combobox", { name: copy.locationLabel })).toHaveValue("store-a");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
}

// Moves focus with the Tab key only, proving the control is reachable from the keyboard.
async function tabTo(page: Page, target: Locator, limit = 200) {
  for (let step = 0; step < limit; step += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("The control could not be reached with the Tab key.");
}

function expectedStockText(availability: Availability, store: string) {
  if (availability.state === "in_stock") return fill(copy.availabilityInStock, { store });
  if (availability.state === "out_of_stock") return fill(copy.availabilityOutOfStock, { store });
  if (availability.stale) return fill(copy.availabilityStale, { store, time: "" }).replace(/\s*·?\s*$/, "");
  return fill(copy.availabilityUnknown, { store });
}

test("every card shows the store stock the API reported and nothing unconfirmed reads as in stock", async ({
  page,
}) => {
  await openDiscovery(page);
  const pageResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v2/catalog" &&
      new URL(response.url()).searchParams.get("location") === "store-b",
  );
  await page.getByRole("combobox", { name: copy.locationLabel }).selectOption("store-b");
  const { data } = (await (await pageResponse).json()) as { data: { items: OfferItem[] } };
  const cards = page.getByTestId("product-card");
  await expect(cards).toHaveCount(data.items.length);

  const states = new Set<string>();
  for (const [index, item] of data.items.entries()) {
    const availability = item.availability!;
    states.add(availability.stale ? "stale" : availability.state);
    const stock = cards.nth(index).getByTestId("availability");
    await expect(stock).toContainText(expectedStockText(availability, "Riverside Store"));
    if (availability.state !== "in_stock")
      await expect(stock).not.toContainText(fill(copy.availabilityInStock, { store: "Riverside Store" }));
  }
  expect(states.has("in_stock") && states.has("out_of_stock")).toBe(true);
  await expect(page.getByText(/^Catalog updated /)).toBeVisible();
});

test("a keyboard-only shopper filters to in-stock items at a store, compares two and opens matched evidence", async ({
  page,
}) => {
  await openDiscovery(page);
  const store = page.getByRole("combobox", { name: copy.locationLabel });
  await tabTo(page, store);
  await page.keyboard.press("ArrowDown");
  await expect(store).toHaveValue("store-b");
  const inStockOnly = page.getByRole("checkbox", { name: copy.availableOnlyFilter });
  await tabTo(page, inStockOnly);
  await page.keyboard.press("Space");
  await expect(inStockOnly).toBeChecked();

  const searchbox = page.getByRole("searchbox");
  await searchbox.focus();
  // "black headphones" matches the stored attribute "Black color"; "headphones" alone matches only a tag.
  await page.keyboard.type("black headphones");
  const request = page.waitForRequest((candidate) => new URL(candidate.url()).pathname === "/api/v2/search");
  await page.keyboard.press("Enter");
  expect((await request).postDataJSON()).toMatchObject({
    query: "black headphones",
    location: "store-b",
    filters: { availableOnly: true },
  });
  const cards = page.getByTestId("product-card");
  await expect(page.getByRole("heading", { name: copy.resultsTitle })).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  for (const stock of await page.getByTestId("availability").all())
    await expect(stock).toContainText(fill(copy.availabilityInStock, { store: "Riverside Store" }));

  for (const index of [0, 1]) {
    await tabTo(page, cards.nth(index).getByRole("button", { name: /^Compare:/ }));
    await page.keyboard.press("Enter");
  }
  const launch = page.locator(".compare-launch");
  await tabTo(page, launch);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(copy.compareAvailability)).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  const evidence = cards.first().locator(".match-link").first();
  const evidenceText = (await evidence.textContent()) ?? "";
  await tabTo(page, evidence);
  await page.keyboard.press("Enter");
  await expect(page.locator(":focus")).toHaveText(evidenceText);
  await expect(cards.first().locator("details.stored-attributes")).toHaveAttribute("open", "");
});

test("discovery, results and the staff page fit 320, 390, 768 and 1280 px without horizontal scrolling", async ({
  page,
}, testInfo) => {
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  await openDiscovery(page);
  await page.getByRole("searchbox").fill("black headphones");
  await page.getByRole("button", { name: copy.searchAction }).click();
  await expect(page.getByRole("heading", { name: copy.resultsTitle })).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await fits(), `results at ${width}px`).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`results-${width}.png`), fullPage: true });
  }
  await page.goto("/staff");
  await expect(page.getByRole("heading", { name: copy.staffReadyTitle })).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await fits(), `staff at ${width}px`).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`staff-${width}.png`), fullPage: true });
  }
});

test("the staff page reports the real feed counts from the API", async ({ page }) => {
  const status = (await (await page.request.get("/api/v2/feed-status")).json()) as {
    data: { offerCount: number; locationCount: number };
  };
  await page.goto("/staff");

  await expect(page.getByRole("heading", { name: copy.staffReadyTitle })).toBeVisible();
  // Chromium does not expose aria-labelledby names on <dd>, so read each value through its visible term.
  const fact = (label: string) =>
    page.locator(".staff-facts > div").filter({ has: page.getByRole("term").filter({ hasText: label }) });
  await expect(fact(copy.staffOfferCount).getByRole("definition")).toHaveText(String(status.data.offerCount));
  await expect(fact(copy.staffLocationCount).getByRole("definition")).toHaveText(String(status.data.locationCount));
  await expect(page.getByText(copy.staffLocalNotice)).toBeVisible();
});

test("contract fixtures: empty store, stale catalog and staff onboarding are honest", async ({ page }) => {
  const generatedAt = new Date().toISOString();
  const empty = { state: "empty", asOf: null, generatedAt, maxAgeMinutes: 1440 };
  await page.route("**/api/v2/catalog**", (route) =>
    route.fulfill({ json: { data: { items: [], total: 0, unavailableIds: [], catalog: empty } } }),
  );
  await page.route("**/api/v2/feed-status", (route) =>
    route.fulfill({ json: { data: { ...empty, offerCount: 0, withdrawnCount: 0, locationCount: 2 } } }),
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: copy.catalogEmptyTitle })).toBeVisible();
  await page.goto("/staff");
  await expect(page.getByRole("heading", { name: copy.staffOnboardingTitle })).toBeVisible();

  await page.unroute("**/api/v2/catalog**");
  await page.route("**/api/v2/catalog**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.catalog = { state: "stale", asOf: "2026-11-01T09:00:00.000Z", generatedAt, maxAgeMinutes: 1440 };
    await route.fulfill({ response, json: payload });
  });
  await page.goto("/");
  await expect(page.getByRole("status", { name: copy.catalogStaleTitle })).toBeVisible();
});
