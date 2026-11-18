import { z } from "zod";
import { apiErrorCopyForCode } from "./api-errors";
import { productSchema, publicModelSchema } from "./model";
import type { CatalogProduct, ProductFilters, PublicModel, SearchResult } from "./model";

const catalogSchema = z.array(productSchema);
const searchResultSchema = z.object({
  intentCategory: z.string().nullable(),
  resultCount: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      product: productSchema.omit({ matchTags: true }),
      matchedDetails: z.array(z.string()),
    }),
  ),
  summary: z.string(),
  source: z.string(),
  totalMatches: z.number().int().nonnegative().optional(),
  assistance: z
    .object({
      status: z.enum(["catalog", "assisted", "unavailable"]),
      provider: z.enum(["local", "gemini", "ollama"]),
      reason: z
        .enum([
          "not_configured",
          "busy",
          "budget",
          "timeout",
          "quota",
          "provider_error",
          "invalid_response",
          "catalog_limit",
        ])
        .optional(),
    })
    .optional(),
});
const feedbackSchema = z.object({ accepted: z.boolean() });
const storeLayoutSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  name: z.string(),
  aisles: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      category: z.string(),
      audience: z.string().optional(),
      racks: z.array(z.string()),
    }),
  ),
});
export type StoreLayout = z.infer<typeof storeLayoutSchema>;
const apiErrorSchema = z.object({
  error: z.object({ code: z.string() }).passthrough(),
});

export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly code: string;

  constructor(model: PublicModel, status: number, requestId: string | null, code: string) {
    super(apiErrorCopyForCode(model, code));
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.code = code;
  }
}

export async function loadModel(signal?: AbortSignal): Promise<PublicModel> {
  const response = await fetch("/shopsense-ai-model.json", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Public content model is unavailable.");
  const payload: unknown = await response.json();
  const parsed = publicModelSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Public content model is invalid.");
  return parsed.data;
}

export function getHealth(model: PublicModel, signal?: AbortSignal) {
  return requestData(
    model,
    "/health",
    z.object({
      status: z.string(),
      service: z.string(),
      storage: z.string(),
      catalogCount: z.number().int().nonnegative().optional(),
      ai: z.object({ available: z.boolean(), provider: z.enum(["local", "gemini", "ollama"]) }).optional(),
    }),
    { signal },
  );
}

async function requestData<T>(
  model: PublicModel,
  path: string,
  schema: z.ZodType<T>,
  options: { signal?: AbortSignal; method?: string; body?: string } = {},
): Promise<T> {
  const clientRequestId = crypto.randomUUID();
  const headers = new Headers({ "X-Request-ID": clientRequestId });
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${model.app.apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    signal: options.signal,
    headers,
    body: options.body,
  });
  const requestId = response.headers.get("x-request-id") ?? clientRequestId;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(model, response.status, requestId, "INVALID_RESPONSE");
  }
  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload);
    const code = parsedError.success ? parsedError.data.error.code : "UNKNOWN_API_ERROR";
    throw new ApiError(model, response.status, requestId, code);
  }
  const data = typeof payload === "object" && payload !== null && "data" in payload ? payload.data : undefined;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(model, response.status, requestId, "INVALID_RESPONSE");
  }
  return parsed.data;
}

export function getCatalog(
  model: PublicModel,
  category?: string,
  signal?: AbortSignal,
  page: { offset?: number; limit?: number; ids?: string[] } = {},
) {
  const fields: string[] = [];
  if (category) fields.push(`category=${encodeURIComponent(category)}`);
  if (page.offset !== undefined) fields.push(`offset=${page.offset}`);
  if (page.limit !== undefined) fields.push(`limit=${page.limit}`);
  if (page.ids?.length) fields.push(`ids=${encodeURIComponent(page.ids.join(","))}`);
  const parameters = fields.length ? `?${fields.join("&")}` : "";
  return requestData(model, `/catalog${parameters}`, catalogSchema, { signal });
}

export async function getProductsByIds(model: PublicModel, ids: string[], signal?: AbortSignal) {
  const products: CatalogProduct[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    products.push(...(await getCatalog(model, undefined, signal, { ids: ids.slice(offset, offset + 50), limit: 50 })));
  }
  return products;
}

export function searchCatalog(
  model: PublicModel,
  query: string,
  signal?: AbortSignal,
  options: { useAi?: boolean; filters?: ProductFilters } | boolean = {},
) {
  const { useAi = true, filters } = typeof options === "boolean" ? { useAi: options } : options;
  return requestData(model, "/search", searchResultSchema, {
    signal,
    method: "POST",
    body: JSON.stringify({ query, ...(useAi ? { useAi: true } : {}), ...(filters ? { filters } : {}) }),
  });
}

export function sendFeedback(model: PublicModel, feedback: { productId: string; helpful: boolean }) {
  return requestData(model, "/feedback", feedbackSchema, {
    method: "POST",
    body: JSON.stringify(feedback),
  });
}

export function getStoreLayout(model: PublicModel, signal?: AbortSignal) {
  return requestData(model, "/store-layout", storeLayoutSchema, { signal });
}

export type { CatalogProduct, SearchResult };
