import modelEnvelope from "../public/shopsense-ai-model.json";
import { publicModelSchema, type Availability, type CatalogFreshness } from "../src/lib/model";

export const envelope = structuredClone(modelEnvelope);
export const model = publicModelSchema.parse(envelope);
export const products = envelope.data.seed.products;

export const NOW_ISO = "2026-11-24T12:00:00.000Z";
export const locations = [
  { id: "store-a", name: "Northside Store" },
  { id: "store-b", name: "Riverside Store" },
];
export const freshness: CatalogFreshness = {
  state: "ready",
  asOf: "2026-11-24T11:50:00.000Z",
  generatedAt: NOW_ISO,
  maxAgeMinutes: 1440,
};
export const inStock: Availability = {
  locationId: "store-a",
  state: "in_stock",
  confirmedAt: "2026-11-24T11:40:00.000Z",
  stale: false,
};

type SeedProduct = (typeof products)[number];

export function offerProduct(product: SeedProduct, availability: Availability | null = inStock) {
  const copy = structuredClone(product);
  Reflect.deleteProperty(copy, "matchTags");
  return {
    ...copy,
    offer: {
      merchantId: "synthetic-merchant-1",
      sku: `SYN-${product.id}`,
      sourceVersion: 1,
      priceCents: product.priceCents,
      currency: "USD",
      updatedAt: "2026-11-23T00:00:00.000Z",
    },
    availability,
  };
}

export const offerProducts = products.map((product) => offerProduct(product));

type FixtureProduct = { category: string; attributes: string[] };

export function offerPage(items: readonly unknown[] = offerProducts, overrides: Record<string, unknown> = {}) {
  return { data: { items, total: items.length, unavailableIds: [], catalog: freshness, ...overrides } };
}

export function offerSearch(
  query: string,
  items: readonly FixtureProduct[] = offerProducts.slice(0, 1),
  overrides: Record<string, unknown> = {},
) {
  return {
    data: {
      intentCategory: items[0]?.category ?? null,
      resultCount: items.length,
      results: items.map((product) => ({
        product,
        matchedDetails: product.attributes.slice(0, 1),
        matches: product.attributes.slice(0, 1).map((text, index) => ({ field: "attributes", index, text })),
      })),
      summary: `Found ${items.length} catalog match for ${query}.`,
      source: model.copy.localCatalogSource,
      catalog: freshness,
      ...overrides,
    },
  };
}

export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": "test-request-123",
    },
  });
}

export function responseForPath(path: string, init?: RequestInit): Response {
  if (path === "/shopsense-ai-model.json") return jsonResponse(envelope);
  if (path === "/api/v1/health") {
    return jsonResponse({ data: { status: "ok", service: "shopsense-api", storage: "sqlite" } });
  }
  if (path === "/api/v2/locations") return jsonResponse({ data: { locations } });
  if (path === "/api/v2/catalog") return jsonResponse(offerPage());
  if (path === "/api/v2/feed-status") {
    return jsonResponse({
      data: { ...freshness, offerCount: offerProducts.length, withdrawnCount: 0, locationCount: locations.length },
    });
  }
  if (path === "/api/v2/search") {
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
    return jsonResponse(offerSearch(body.query ?? ""));
  }
  if (path === "/api/v1/feedback") return jsonResponse({ data: { accepted: true } }, 201);
  return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
}

export function pathnameOf(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.pathname;
  return new URL(typeof input === "string" ? input : input.url, "http://localhost").pathname;
}

export function searchParamsOf(input: RequestInfo | URL): URLSearchParams {
  if (input instanceof URL) return input.searchParams;
  return new URL(typeof input === "string" ? input : input.url, "http://localhost").searchParams;
}
