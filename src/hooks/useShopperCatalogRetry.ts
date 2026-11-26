"use client";

import type { Dispatch, SetStateAction } from "react";
import { getHealth, getOfferCatalog } from "@/lib/api";
import type { CatalogFreshness, CatalogProduct, PublicModel } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";

interface CatalogRetryActions {
  model: PublicModel | null;
  category?: string;
  locationId: string | null;
  setCatalog: Dispatch<SetStateAction<CatalogProduct[]>>;
  setCatalogError: Dispatch<SetStateAction<string | null>>;
  setCatalogLoading: Dispatch<SetStateAction<boolean>>;
  setServiceConnected: Dispatch<SetStateAction<boolean>>;
  setAiAvailable: Dispatch<SetStateAction<boolean>>;
  setCatalogTotal: Dispatch<SetStateAction<number>>;
  setCatalogFreshness: Dispatch<SetStateAction<CatalogFreshness | null>>;
}

export function useShopperCatalogRetry(actions: CatalogRetryActions) {
  return async function retryCatalog() {
    if (!actions.model) return;
    actions.setCatalogLoading(true);
    actions.setCatalogError(null);
    try {
      const category = actions.category === "all" ? undefined : actions.category;
      const [health, page] = await Promise.all([
        getHealth(actions.model),
        getOfferCatalog(actions.model, { category, locationId: actions.locationId }),
      ]);
      actions.setServiceConnected(health.status === "ok");
      actions.setAiAvailable(health.ai?.available === true);
      actions.setCatalog(page.items);
      actions.setCatalogTotal(page.total);
      actions.setCatalogFreshness(page.catalog);
    } catch (error) {
      actions.setServiceConnected(false);
      actions.setCatalogError(userFacingErrorCopy(actions.model, error, "loadError"));
    } finally {
      actions.setCatalogLoading(false);
    }
  };
}
