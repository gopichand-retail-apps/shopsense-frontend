import { describe, expect, it } from "vitest";
import { envelope, model } from "../../tests/shopper-fixtures";
import { contentModelSchema, copy, formatPrice, nestedCopy, publicModelSchema } from "./model";

describe("ShopSense content model", () => {
  it("normalizes the strict versioned envelope", () => {
    const parsed = publicModelSchema.parse(envelope);

    expect(parsed.modelVersion).toBe(1);
    expect(parsed.app.locale).toBe("en-US");
    expect(parsed.copy.catalogTitle).toBe("Browse the catalog");
    expect(parsed.seed.products).toHaveLength(8);
  });

  it("rejects the wrong app, missing data, and unknown envelope fields", () => {
    const wrongApp = { ...envelope, appId: "another-app" };
    expect(contentModelSchema.safeParse(wrongApp).success).toBe(false);

    const missingData = structuredClone(envelope);
    Reflect.deleteProperty(missingData, "data");
    expect(contentModelSchema.safeParse(missingData).success).toBe(false);

    const unexpectedField = { ...envelope, architecture: { diagram: "not product copy" } };
    expect(contentModelSchema.safeParse(unexpectedField).success).toBe(false);
  });

  it("requires nested copy to exist and formats localized prices", () => {
    expect(copy(model, "catalogTitle")).toBe("Browse the catalog");
    expect(nestedCopy(model, "categories", "bags")).toBe("Bags and travel");
    expect(formatPrice(model, 12900)).toBe("$129.00");
    expect(() => copy(model, "missing")).toThrow("Missing content string: missing");
    expect(() => nestedCopy(model, "categories", "missing")).toThrow("Missing content string: categories.missing");
    expect(() => nestedCopy(model, "missing", "value")).toThrow("Missing content string: missing.value");

    const invalidModel = structuredClone(model);
    Reflect.set(invalidModel.copy.categories, "bags", 42);
    expect(() => nestedCopy(invalidModel, "categories", "bags")).toThrow("Invalid content string: categories.bags");
  });
});
