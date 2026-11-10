"use client";

import type { Dispatch, SetStateAction } from "react";
import { getCatalog, getHealth } from "@/lib/api";
import type { CatalogProduct, PublicModel } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";

interface CatalogRetryActions {
  model: PublicModel | null;
  setCatalog: Dispatch<SetStateAction<CatalogProduct[]>>;
  setCatalogError: Dispatch<SetStateAction<string | null>>;
  setCatalogLoading: Dispatch<SetStateAction<boolean>>;
  setServiceConnected: Dispatch<SetStateAction<boolean>>;
}

export function useShopperCatalogRetry(actions: CatalogRetryActions) {
  return async function retryCatalog() {
    if (!actions.model) return;
    actions.setCatalogLoading(true);
    actions.setCatalogError(null);
    try {
      const [health, products] = await Promise.all([getHealth(actions.model), getCatalog(actions.model)]);
      actions.setServiceConnected(health.status === "ok");
      actions.setCatalog(products);
    } catch (error) {
      actions.setServiceConnected(false);
      actions.setCatalogError(userFacingErrorCopy(actions.model, error, "loadError"));
    } finally {
      actions.setCatalogLoading(false);
    }
  };
}
