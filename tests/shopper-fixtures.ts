import modelEnvelope from "../public/shopsense-ai-model.json";
import { publicModelSchema } from "../src/lib/model";

export const envelope = structuredClone(modelEnvelope);
export const model = publicModelSchema.parse(envelope);
export const products = envelope.data.seed.products;

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
  if (path === "/api/v1/catalog") return jsonResponse({ data: products });
  if (path === "/api/v1/search") {
    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
    const product = structuredClone(products[0]);
    Reflect.deleteProperty(product, "matchTags");
    return jsonResponse({
      data: {
        intentCategory: product.category,
        resultCount: 1,
        results: [{ product, matchedDetails: product.attributes.slice(0, 1) }],
        summary: `Found one catalog match for ${body.query ?? ""}.`,
        source: model.copy.localCatalogSource,
      },
    });
  }
  if (path === "/api/v1/feedback") return jsonResponse({ data: { accepted: true } }, 201);
  return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
}

export function pathnameOf(input: RequestInfo | URL): string {
  if (input instanceof URL) return input.pathname;
  return new URL(typeof input === "string" ? input : input.url, "http://localhost").pathname;
}
