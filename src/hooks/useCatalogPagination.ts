"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getOfferCatalog } from "@/lib/api";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";
import type { ShopperBootstrap } from "./useShopperBootstrap";

const PAGE_SIZE = 24;

export function useCatalogPagination(bootstrap: ShopperBootstrap, setCategory: Dispatch<SetStateAction<string>>) {
  const controller = useRef<AbortController | null>(null);
  const [exhausted, setExhausted] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);

  async function requestPage(category: string, replace: boolean, locationId: string | null) {
    if (!bootstrap.model) return;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    bootstrap.setCatalogLoading(true);
    bootstrap.setCatalogError(null);
    try {
      const page = await getOfferCatalog(
        bootstrap.model,
        {
          category: category === "all" ? undefined : category,
          locationId,
          limit: PAGE_SIZE,
          offset: replace ? 0 : bootstrap.catalog.length,
        },
        active.signal,
      );
      if (active.signal.aborted) return;
      bootstrap.setCatalog((current) => (replace ? page.items : [...current, ...page.items]));
      bootstrap.setCatalogTotal(page.total);
      bootstrap.setCatalogFreshness(page.catalog);
      setExhausted(page.items.length < PAGE_SIZE);
    } catch (error) {
      if (!active.signal.aborted) bootstrap.setCatalogError(userFacingErrorCopy(bootstrap.model, error, "loadError"));
    } finally {
      if (!active.signal.aborted) bootstrap.setCatalogLoading(false);
    }
  }
  return {
    reset: () => setExhausted(false),
    hasMore: !exhausted && bootstrap.catalog.length >= PAGE_SIZE && bootstrap.catalog.length < bootstrap.catalogTotal,
    loadMore: (category: string) => requestPage(category, false, bootstrap.locationId),
    selectCategory: (category: string, locationId: string | null = bootstrap.locationId) => {
      setCategory(category);
      setExhausted(false);
      return requestPage(category, true, locationId);
    },
  };
}
