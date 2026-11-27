"use client";

import type { Dispatch, SetStateAction } from "react";
import { getOffersByIds } from "@/lib/api";
import { copy, type CatalogProduct, type ProductFilters } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";
import type { useShopperComparison } from "./useShopperComparison";
import type { useShopperSearch } from "./useShopperSearch";
import type { ShopperBootstrap } from "./useShopperBootstrap";

interface OfferActionsContext {
  bootstrap: ShopperBootstrap;
  search: ReturnType<typeof useShopperSearch>;
  comparison: ReturnType<typeof useShopperComparison>;
  pagination: { reset: () => void; selectCategory: (category: string, locationId?: string | null) => Promise<void> };
  browseCategory: string;
  setNotice: Dispatch<SetStateAction<string | null>>;
}

// Replaces remembered saved/compared snapshots with the API's current offers and drops unpublished ones.
async function refreshReferenced(context: OfferActionsContext, ids: string[], locationId: string | null) {
  const { model } = context.bootstrap;
  if (!model || !ids.length) return { unavailableIds: [] as string[] };
  const result = await getOffersByIds(model, ids, locationId);
  const replaced = new Set([...result.unavailableIds, ...result.items.map((product) => product.id)]);
  context.bootstrap.setReferencedProducts((current: CatalogProduct[]) => [
    ...current.filter((product) => !replaced.has(product.id)),
    ...result.items,
  ]);
  return result;
}

async function refreshSaved(context: OfferActionsContext, locationId: string | null) {
  const { bootstrap } = context;
  try {
    const result = await refreshReferenced(context, bootstrap.savedIds, locationId);
    bootstrap.setUnavailableSavedIds(result.unavailableIds);
  } catch (error) {
    if (bootstrap.model) context.setNotice(userFacingErrorCopy(bootstrap.model, error, "loadError"));
  }
}

async function changeLocation(context: OfferActionsContext, locationId: string | null) {
  const { bootstrap, search } = context;
  bootstrap.setLocationId(locationId);
  // Without a store, "in stock at this store" has no meaning, so that filter is dropped.
  const filters: ProductFilters = locationId ? search.filters : { ...search.filters, availableOnly: undefined };
  if (!locationId) search.setFilters(filters);
  context.pagination.reset();
  const pending: Promise<unknown>[] = [
    context.pagination.selectCategory(context.browseCategory, locationId),
    refreshSaved(context, locationId),
  ];
  if (search.searchResult && search.activeQuery)
    pending.push(search.submitQuery(search.activeQuery, { filters, locationId }));
  await Promise.all(pending);
}

async function openComparison(context: OfferActionsContext) {
  const { bootstrap, comparison } = context;
  if (!bootstrap.model) return;
  try {
    const { unavailableIds } = await refreshReferenced(context, comparison.compareIds, bootstrap.locationId);
    if (unavailableIds.length) {
      comparison.setCompareIds((ids) => ids.filter((id) => !unavailableIds.includes(id)));
      context.setNotice(copy(bootstrap.model, "compareRefreshed"));
    }
  } catch (error) {
    context.setNotice(userFacingErrorCopy(bootstrap.model, error, "loadError"));
  }
  comparison.setComparisonOpen(true);
}

export function useOfferActions(context: OfferActionsContext) {
  return {
    changeLocation: (locationId: string | null) => changeLocation(context, locationId),
    openComparison: () => openComparison(context),
    includeUnconfirmed: () => {
      const filters = { ...context.search.filters, availableOnly: undefined };
      context.search.setFilters(filters);
      return context.search.submitQuery(context.search.activeQuery, { filters });
    },
    removeUnavailableSaved: () => {
      const gone = new Set(context.bootstrap.unavailableSavedIds);
      context.bootstrap.setSavedIds((ids) => ids.filter((id) => !gone.has(id)));
      context.bootstrap.setUnavailableSavedIds([]);
    },
  };
}
