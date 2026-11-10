import type { PublicModel } from "./model";

type ApiErrorCode =
  | "ORIGIN_NOT_ALLOWED"
  | "RATE_LIMITED"
  | "INVALID_CATEGORY"
  | "INVALID_SEARCH"
  | "INVALID_FEEDBACK"
  | "PRODUCT_NOT_FOUND"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_JSON"
  | "INTERNAL_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN_API_ERROR";

type ApiErrorCopyKey = keyof PublicModel["copy"]["errors"];

export const apiErrorCopyByCode = {
  ORIGIN_NOT_ALLOWED: "originNotAllowed",
  RATE_LIMITED: "rateLimited",
  INVALID_CATEGORY: "invalidRequest",
  INVALID_SEARCH: "invalidSearch",
  INVALID_FEEDBACK: "invalidRequest",
  PRODUCT_NOT_FOUND: "notFound",
  NOT_FOUND: "notFound",
  PAYLOAD_TOO_LARGE: "payloadTooLarge",
  INVALID_JSON: "invalidRequest",
  INTERNAL_ERROR: "server",
  INVALID_RESPONSE: "server",
  UNKNOWN_API_ERROR: "server",
} as const satisfies Record<ApiErrorCode, ApiErrorCopyKey>;

type MappedApiErrorCode = keyof typeof apiErrorCopyByCode;

export function apiErrorCopyForCode(model: PublicModel, code: string): string {
  if (!isMappedApiErrorCode(code)) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`Missing ShopSense error-copy mapping for API code: ${code}`);
    }
    return readModelErrorCopy(model, "server");
  }

  return readModelErrorCopy(model, apiErrorCopyByCode[code]);
}

function isMappedApiErrorCode(code: string): code is MappedApiErrorCode {
  return Object.prototype.hasOwnProperty.call(apiErrorCopyByCode, code);
}

function readModelErrorCopy(model: PublicModel, key: ApiErrorCopyKey): string {
  const message = model.copy.errors[key];
  if (typeof message !== "string") throw new TypeError(`Missing content string: errors.${key}`);
  return message;
}
