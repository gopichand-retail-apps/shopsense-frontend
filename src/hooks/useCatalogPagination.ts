"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getCatalog } from "@/lib/api";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";
import type { ShopperBootstrap } from "./useShopperBootstrap";

export function useCatalogPagination(bootstrap: ShopperBootstrap, setCategory: Dispatch<SetStateAction<string>>) {
  const controller = useRef<AbortController | null>(null);
  const [exhausted, setExhausted] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);

  async function requestPage(category: string, replace: boolean) {
    if (!bootstrap.model) return;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    bootstrap.setCatalogLoading(true);
    bootstrap.setCatalogError(null);
    try {
      const products = await getCatalog(bootstrap.model, category === "all" ? undefined : category, active.signal, {
        limit: 24,
        offset: replace ? 0 : bootstrap.catalog.length,
      });
      if (active.signal.aborted) return;
      bootstrap.setCatalog((current) => (replace ? products : [...current, ...products]));
      setExhausted(products.length < 24);
    } catch (error) {
      if (!active.signal.aborted) bootstrap.setCatalogError(userFacingErrorCopy(bootstrap.model, error, "loadError"));
    } finally {
      if (!active.signal.aborted) bootstrap.setCatalogLoading(false);
    }
  }
  return {
    reset: () => setExhausted(false),
    hasMore: !exhausted && bootstrap.catalog.length >= 24 && bootstrap.catalog.length < bootstrap.catalogTotal,
    loadMore: (category: string) => requestPage(category, false),
    selectCategory: (category: string) => {
      setCategory(category);
      setExhausted(false);
      return requestPage(category, true);
    },
  };
}
