import { z } from "zod";
import { apiErrorCopyForCode } from "./api-errors";
import { catalogFreshnessSchema, productSchema, publicModelSchema } from "./model";
import type { CatalogProduct, ProductFilters, PublicModel, SearchResult, StoreLocation } from "./model";

const offerPageSchema = z.object({
  items: z.array(productSchema),
  total: z.number().int().nonnegative(),
  unavailableIds: z.array(z.string()),
  catalog: catalogFreshnessSchema,
});
export type OfferPage = z.infer<typeof offerPageSchema>;
const locationsSchema = z.object({
  locations: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
});
const feedStatusSchema = catalogFreshnessSchema.extend({
  offerCount: z.number().int().nonnegative(),
  withdrawnCount: z.number().int().nonnegative(),
  locationCount: z.number().int().nonnegative(),
});
export type FeedStatus = z.infer<typeof feedStatusSchema>;
const matchSchema = z
  .object({ field: z.enum(["attributes", "tags"]), index: z.number().int().nonnegative().optional(), text: z.string() })
  .strict();
const searchResultSchema = z.object({
  intentCategory: z.string().nullable(),
  resultCount: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      product: productSchema.omit({ matchTags: true }),
      matchedDetails: z.array(z.string()),
      matches: z.array(matchSchema).optional(),
    }),
  ),
  summary: z.string(),
  source: z.string(),
  totalMatches: z.number().int().nonnegative().optional(),
  catalog: catalogFreshnessSchema.optional(),
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
  options: { signal?: AbortSignal; method?: string; body?: string; base?: string } = {},
): Promise<T> {
  const clientRequestId = crypto.randomUUID();
  const headers = new Headers({ "X-Request-ID": clientRequestId });
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${options.base ?? model.app.apiBaseUrl}${path}`, {
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

// The content model names the version 1 base; version 2 offer routes sit beside it.
export function apiV2BaseUrl(model: PublicModel): string {
  const base = model.app.apiBaseUrl;
  if (!base.endsWith("/v1")) throw new Error("The ShopSense API base must end with /v1.");
  return `${base.slice(0, -"/v1".length)}/v2`;
}

function requestOffers<T>(
  model: PublicModel,
  path: string,
  schema: z.ZodType<T>,
  options: { signal?: AbortSignal; method?: string; body?: string } = {},
) {
  return requestData(model, path, schema, { ...options, base: apiV2BaseUrl(model) });
}

export async function getLocations(model: PublicModel, signal?: AbortSignal): Promise<StoreLocation[]> {
  return (await requestOffers(model, "/locations", locationsSchema, { signal })).locations;
}

export function getFeedStatus(model: PublicModel, signal?: AbortSignal): Promise<FeedStatus> {
  return requestOffers(model, "/feed-status", feedStatusSchema, { signal });
}

export interface OfferCatalogQuery {
  category?: string;
  locationId?: string | null;
  offset?: number;
  limit?: number;
  ids?: string[];
}

export function getOfferCatalog(model: PublicModel, query: OfferCatalogQuery = {}, signal?: AbortSignal) {
  const fields: string[] = [];
  if (query.category) fields.push(`category=${encodeURIComponent(query.category)}`);
  if (query.locationId) fields.push(`location=${encodeURIComponent(query.locationId)}`);
  if (query.offset !== undefined) fields.push(`offset=${query.offset}`);
  if (query.limit !== undefined) fields.push(`limit=${query.limit}`);
  if (query.ids?.length) fields.push(`ids=${encodeURIComponent(query.ids.join(","))}`);
  const parameters = fields.length ? `?${fields.join("&")}` : "";
  return requestOffers(model, `/catalog${parameters}`, offerPageSchema, { signal });
}

export async function getOffersByIds(
  model: PublicModel,
  ids: string[],
  locationId: string | null,
  signal?: AbortSignal,
): Promise<{ items: CatalogProduct[]; unavailableIds: string[] }> {
  const items: CatalogProduct[] = [];
  const unavailableIds: string[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const page = await getOfferCatalog(model, { ids: ids.slice(offset, offset + 50), limit: 50, locationId }, signal);
    items.push(...page.items);
    unavailableIds.push(...page.unavailableIds);
  }
  return { items, unavailableIds };
}

export function searchOffers(
  model: PublicModel,
  query: string,
  signal?: AbortSignal,
  options: { useAi?: boolean; filters?: ProductFilters; locationId?: string | null } = {},
): Promise<SearchResult> {
  const { useAi = true, filters, locationId } = options;
  return requestOffers(model, "/search", searchResultSchema, {
    signal,
    method: "POST",
    body: JSON.stringify({
      query,
      ...(useAi ? { useAi: true } : {}),
      ...(locationId ? { location: locationId } : {}),
      ...(filters ? { filters } : {}),
    }),
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

export type { CatalogProduct, SearchResult, StoreLocation };
