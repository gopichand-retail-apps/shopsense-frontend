import { describe, expect, it, vi } from "vitest";
import { envelope, jsonResponse, model, pathnameOf, products, responseForPath } from "../../tests/shopper-fixtures";
import { ApiError, getCatalog, getHealth, loadModel, searchCatalog, sendFeedback } from "./api";

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

  it("validates health and catalog responses and encodes category filters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = pathnameOf(input);
      if (path === "/api/v1/health") {
        return jsonResponse({ data: { status: "ok", service: "shopsense-api", storage: "sqlite" } });
      }
      return jsonResponse({ data: products });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getHealth(model)).resolves.toMatchObject({ status: "ok" });
    await expect(getCatalog(model, "bags & travel")).resolves.toHaveLength(8);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/v1/catalog?category=bags%20%26%20travel");
  });

  it("sends search and feedback as validated JSON requests", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => responseForPath(pathnameOf(input), init));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchCatalog(model, "a light daypack")).resolves.toMatchObject({ resultCount: 1 });
    await expect(sendFeedback(model, { productId: products[0].id, helpful: true })).resolves.toEqual({
      accepted: true,
    });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ query: "a light daypack" }),
    });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ productId: products[0].id, helpful: true }),
    });
  });

  it("maps API and malformed response envelopes to safe errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: { code: "INVALID_SEARCH" } }, 400)));
    await expect(searchCatalog(model, "need a pack")).rejects.toMatchObject({
      name: "ApiError",
      code: "INVALID_SEARCH",
      status: 400,
      requestId: "test-request-123",
      message: model.copy.errors.invalidSearch,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{", { status: 503 })));
    await expect(getCatalog(model)).rejects.toMatchObject({
      name: "ApiError",
      code: "INVALID_RESPONSE",
      status: 503,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "bad" }, 500)));
    await expect(getCatalog(model)).rejects.toMatchObject({
      code: "UNKNOWN_API_ERROR",
      message: model.copy.errors.server,
    });
  });

  it("rejects successful responses that do not match the endpoint contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ data: { products: [] } })));

    await expect(getCatalog(model)).rejects.toBeInstanceOf(ApiError);
    await expect(getCatalog(model)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
