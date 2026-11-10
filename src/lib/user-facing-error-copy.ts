import { ApiError } from "./api";
import { copy, type PublicModel } from "./model";

export function userFacingErrorCopy(model: PublicModel, error: unknown, fallbackKey: string): string {
  return error instanceof ApiError ? error.message : copy(model, fallbackKey);
}
