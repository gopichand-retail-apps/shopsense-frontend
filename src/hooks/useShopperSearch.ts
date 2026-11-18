"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { WorkspaceView } from "@/components/ShopperContent";
import { searchCatalog } from "@/lib/api";
import { copy, type ProductFilters, type PublicModel, type SearchResult } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";

interface SearchActions {
  model: PublicModel | null;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  setServiceConnected: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  clearFeedback: () => void;
  setActiveCategory: Dispatch<SetStateAction<string>>;
}

export function useShopperSearch(actions: SearchActions) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ProductFilters>({});
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const state = useSearchState();

  function submitQuery(value: string) {
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    return executeSearch(
      value,
      actions,
      {
        setActiveQuery: state.setActiveQuery,
        setSearchError: state.setSearchError,
        setSearchLoading: state.setSearchLoading,
        setSearchResult: state.setSearchResult,
      },
      { filters, signal: active.signal },
    );
  }

  function cancelSearch() {
    controller.current?.abort();
    state.setSearchLoading(false);
  }

  function clearSearch() {
    cancelSearch();
    setQuery("");
    state.setActiveQuery("");
    state.setSearchResult(null);
    state.setSearchError(null);
    setFilters({});
  }

  return {
    query,
    filters,
    setFilters,
    cancelSearch,
    setQuery,
    ...state,
    submitQuery,
    clearSearch,
  };
}

function useSearchState() {
  const [activeQuery, setActiveQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  return {
    activeQuery,
    setActiveQuery,
    searchLoading,
    setSearchLoading,
    searchError,
    setSearchError,
    searchResult,
    setSearchResult,
  };
}

async function executeSearch(
  value: string,
  actions: SearchActions,
  setters: {
    setActiveQuery: Dispatch<SetStateAction<string>>;
    setSearchError: Dispatch<SetStateAction<string | null>>;
    setSearchLoading: Dispatch<SetStateAction<boolean>>;
    setSearchResult: Dispatch<SetStateAction<SearchResult | null>>;
  },
  options: { filters: ProductFilters; signal: AbortSignal },
) {
  const { model } = actions;
  if (!model) return;
  actions.setActiveView("discover");
  actions.setActiveCategory("all");
  const normalized = value.trim();
  if (normalized.length < 3) {
    setters.setSearchError(copy(model, "searchTooShort"));
    return;
  }
  if (normalized.length > model.search.maximumQueryCharacters) {
    setters.setSearchError(copy(model, "searchTooLong"));
    return;
  }

  setters.setActiveQuery(normalized);
  setters.setSearchError(null);
  actions.setNotice(null);
  setters.setSearchLoading(true);
  setters.setSearchResult(null);
  actions.clearFeedback();
  try {
    const filters = Object.values(options.filters).some((value) => value !== undefined) ? options.filters : undefined;
    const result = await searchCatalog(model, normalized, options.signal, { useAi: true, filters });
    if (options.signal.aborted) return;
    setters.setSearchResult(result);
    actions.setServiceConnected(true);
  } catch (error) {
    if (!options.signal.aborted) setters.setSearchError(userFacingErrorCopy(model, error, "searchError"));
  } finally {
    if (!options.signal.aborted) setters.setSearchLoading(false);
  }
}
