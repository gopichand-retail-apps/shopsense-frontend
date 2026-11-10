import { z } from "zod";
import { apiErrorCopyForCode } from "./api-errors";
import { productSchema, publicModelSchema } from "./model";
import type { CatalogProduct, PublicModel, SearchResult } from "./model";

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
});
const feedbackSchema = z.object({ accepted: z.boolean() });
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

export function getCatalog(model: PublicModel, category?: string, signal?: AbortSignal) {
  const parameters = category ? `?category=${encodeURIComponent(category)}` : "";
  return requestData(model, `/catalog${parameters}`, catalogSchema, { signal });
}

export function searchCatalog(model: PublicModel, query: string, signal?: AbortSignal) {
  return requestData(model, "/search", searchResultSchema, {
    signal,
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

export function sendFeedback(model: PublicModel, feedback: { productId: string; helpful: boolean }) {
  return requestData(model, "/feedback", feedbackSchema, {
    method: "POST",
    body: JSON.stringify(feedback),
  });
}

export type { CatalogProduct, SearchResult };
