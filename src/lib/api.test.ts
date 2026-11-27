import { describe, expect, it, vi } from "vitest";
import {
  envelope,
  freshness,
  jsonResponse,
  locations,
  model,
  offerPage,
  offerProducts,
  pathnameOf,
  products,
  responseForPath,
  searchParamsOf,
} from "../../tests/shopper-fixtures";
import {
  ApiError,
  apiV2BaseUrl,
  getFeedStatus,
  getHealth,
  getLocations,
  getOfferCatalog,
  getOffersByIds,
  loadModel,
  searchOffers,
  sendFeedback,
} from "./api";

describe("ShopSense API client", () => {
  it("loads and validates the strict content model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(envelope));
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadModel()).resolves.toEqual(model);
    expect(fetchMock).toHaveBeenCalledWith("/shopsense-ai-model.json", {
      cache: "no-store",
      signal: undefined,
    });
  });

  it("fails clearly when the content model is unavailable or invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));
    await expect(loadModel()).rejects.toThrow("Public content model is unavailable.");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ version: 1 })));
    await expect(loadModel()).rejects.toThrow("Public content model is invalid.");
  });

  it("derives the version 2 base from the configured version 1 base", () => {
    expect(apiV2BaseUrl(model)).toBe("/api/v2");
    const absolute = { ...model, app: { ...model.app, apiBaseUrl: "http://127.0.0.1:5802/api/v1" } };
    expect(apiV2BaseUrl(absolute)).toBe("http://127.0.0.1:5802/api/v2");
    expect(() => apiV2BaseUrl({ ...model, app: { ...model.app, apiBaseUrl: "/api" } })).toThrow();
  });

  it("validates health and offer pages and encodes catalog parameters", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responseForPath(pathnameOf(input), init));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getHealth(model)).resolves.toMatchObject({ status: "ok" });
    const page = await getOfferCatalog(model, {
      category: "bags & travel",
      locationId: "store-a",
      offset: 24,
      limit: 24,
    });

    expect(page.items).toHaveLength(products.length);
    expect(page.items[0]?.offer?.sku).toBe(`SYN-${products[0].id}`);
    expect(page.catalog).toEqual(freshness);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/v2/catalog?category=bags%20%26%20travel&location=store-a&offset=24&limit=24",
    );
  });

  it("resolves saved ids in chunks of 50 and collects unavailable ids", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const ids = searchParamsOf(input).get("ids")?.split(",") ?? [];
      const found = offerProducts.filter((product) => ids.includes(product.id));
      const unavailableIds = ids.filter((id) => !found.some((product) => product.id === id));
      return jsonResponse(offerPage(found, { unavailableIds }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const ids = [products[0].id, ...Array.from({ length: 50 }, (_, index) => `gone-${index}`)];

    const result = await getOffersByIds(model, ids, "store-b");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(searchParamsOf(fetchMock.mock.calls[0]?.[0] as string).get("location")).toBe("store-b");
    expect(result.items.map((item) => item.id)).toEqual([products[0].id]);
    expect(result.unavailableIds).toHaveLength(50);
    await expect(getOffersByIds(model, [], null)).resolves.toEqual({ items: [], unavailableIds: [] });
  });

  it("sends the store and in-stock filter with a search and parses matches and freshness", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responseForPath(pathnameOf(input), init));
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchOffers(model, "a light daypack", undefined, {
      locationId: "store-a",
      filters: { availableOnly: true },
    });

    expect(result.catalog).toEqual(freshness);
    expect(result.results[0]?.matches?.[0]).toEqual({ field: "attributes", index: 0, text: products[0].attributes[0] });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        query: "a light daypack",
        useAi: true,
        location: "store-a",
        filters: { availableOnly: true },
      }),
    });
  });

  it("reads stores, feed status and sends feedback", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responseForPath(pathnameOf(input), init));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLocations(model)).resolves.toEqual(locations);
    await expect(getFeedStatus(model)).resolves.toMatchObject({ state: "ready", locationCount: 2 });
    await expect(sendFeedback(model, { productId: products[0].id, helpful: true })).resolves.toEqual({
      accepted: true,
    });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ productId: products[0].id, helpful: true }),
    });
  });

  it("maps API and malformed response envelopes to safe errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code: "INVALID_SEARCH" } }, 400)));
    await expect(searchOffers(model, "need a pack")).rejects.toMatchObject({
      name: "ApiError",
      code: "INVALID_SEARCH",
      status: 400,
      requestId: "test-request-123",
      message: model.copy.errors.invalidSearch,
    });

    for (const [code, key] of [
      ["INVALID_LOCATION", "invalidLocation"],
      ["OFFERS_NOT_SUPPORTED", "offersUnavailable"],
      ["INVALID_REQUEST", "invalidRequest"],
    ] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code } }, 400)));
      await expect(getOfferCatalog(model)).rejects.toMatchObject({ code, message: model.copy.errors[key] });
    }

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{", { status: 503 })));
    await expect(getOfferCatalog(model)).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 503 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "bad" }, 500)));
    await expect(getOfferCatalog(model)).rejects.toMatchObject({
      code: "UNKNOWN_API_ERROR",
      message: model.copy.errors.server,
    });
  });

  it("rejects successful responses that do not match the endpoint contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: offerProducts })));
    await expect(getOfferCatalog(model)).rejects.toBeInstanceOf(ApiError);

    const unknownState: unknown = JSON.parse(JSON.stringify(offerPage()).replace('"in_stock"', '"available"'));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(unknownState)));
    await expect(getOfferCatalog(model)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
