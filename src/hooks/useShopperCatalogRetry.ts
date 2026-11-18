"use client";

import type { Dispatch, SetStateAction } from "react";
import { getCatalog, getHealth } from "@/lib/api";
import type { CatalogProduct, PublicModel } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";

interface CatalogRetryActions {
  model: PublicModel | null;
  category?: string;
  setCatalog: Dispatch<SetStateAction<CatalogProduct[]>>;
  setCatalogError: Dispatch<SetStateAction<string | null>>;
  setCatalogLoading: Dispatch<SetStateAction<boolean>>;
  setServiceConnected: Dispatch<SetStateAction<boolean>>;
  setAiAvailable: Dispatch<SetStateAction<boolean>>;
  setCatalogTotal: Dispatch<SetStateAction<number>>;
}

export function useShopperCatalogRetry(actions: CatalogRetryActions) {
  return async function retryCatalog() {
    if (!actions.model) return;
    actions.setCatalogLoading(true);
    actions.setCatalogError(null);
    try {
      const category = actions.category === "all" ? undefined : actions.category;
      const [health, products] = await Promise.all([getHealth(actions.model), getCatalog(actions.model, category)]);
      actions.setServiceConnected(health.status === "ok");
      actions.setAiAvailable(health.ai?.available === true);
      actions.setCatalog(products);
      actions.setCatalogTotal(health.catalogCount ?? products.length);
    } catch (error) {
      actions.setServiceConnected(false);
      actions.setCatalogError(userFacingErrorCopy(actions.model, error, "loadError"));
    } finally {
      actions.setCatalogLoading(false);
    }
  };
}
