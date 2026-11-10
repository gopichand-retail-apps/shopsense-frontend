import { afterEach, describe, expect, it, vi } from "vitest";
import { model } from "../../tests/shopper-fixtures";
import { apiErrorCopyByCode, apiErrorCopyForCode } from "./api-errors";

const expectedEntries = [
  ["ORIGIN_NOT_ALLOWED", "originNotAllowed"],
  ["RATE_LIMITED", "rateLimited"],
  ["INVALID_CATEGORY", "invalidRequest"],
  ["INVALID_SEARCH", "invalidSearch"],
  ["INVALID_FEEDBACK", "invalidRequest"],
  ["PRODUCT_NOT_FOUND", "notFound"],
  ["NOT_FOUND", "notFound"],
  ["PAYLOAD_TOO_LARGE", "payloadTooLarge"],
  ["INVALID_JSON", "invalidRequest"],
  ["INTERNAL_ERROR", "server"],
  ["INVALID_RESPONSE", "server"],
  ["UNKNOWN_API_ERROR", "server"],
] as const satisfies ReadonlyArray<readonly [keyof typeof apiErrorCopyByCode, keyof typeof model.copy.errors]>;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API error copy mapping", () => {
  it("maps every stable API error code to localized model copy", () => {
    expect(apiErrorCopyByCode).toEqual(Object.fromEntries(expectedEntries));

    for (const [code, copyKey] of expectedEntries) {
      expect(apiErrorCopyForCode(model, code)).toBe(model.copy.errors[copyKey]);
    }
  });

  it("fails for unmapped codes outside production and uses safe copy in production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => apiErrorCopyForCode(model, "NEW_BACKEND_CODE")).toThrow(
      "Missing ShopSense error-copy mapping for API code: NEW_BACKEND_CODE",
    );

    vi.stubEnv("NODE_ENV", "production");
    expect(apiErrorCopyForCode(model, "NEW_BACKEND_CODE")).toBe(model.copy.errors.server);
  });

  it("fails when a mapped model error message is missing", () => {
    const incompleteModel = structuredClone(model);
    Reflect.deleteProperty(incompleteModel.copy.errors, "invalidSearch");

    expect(() => apiErrorCopyForCode(incompleteModel, "INVALID_SEARCH")).toThrow(
      "Missing content string: errors.invalidSearch",
    );
  });
});
