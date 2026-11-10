"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { WorkspaceView } from "@/components/ShopperContent";
import { searchCatalog } from "@/lib/api";
import { copy, type PublicModel, type SearchResult } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";

interface SearchActions {
  model: PublicModel | null;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  setServiceConnected: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  clearFeedback: () => void;
}

export function useShopperSearch(actions: SearchActions) {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);

  function submitQuery(value: string) {
    return executeSearch(value, actions, {
      setActiveQuery,
      setSearchError,
      setSearchLoading,
      setSearchResult,
    });
  }

  function clearSearch() {
    setQuery("");
    setActiveQuery("");
    setSearchResult(null);
    setSearchError(null);
  }

  return {
    query,
    setQuery,
    activeQuery,
    searchLoading,
    searchError,
    searchResult,
    setSearchResult,
    setSearchError,
    submitQuery,
    clearSearch,
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
) {
  const { model } = actions;
  if (!model) return;
  actions.setActiveView("discover");
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
    setters.setSearchResult(await searchCatalog(model, normalized));
    actions.setServiceConnected(true);
  } catch (error) {
    setters.setSearchError(userFacingErrorCopy(model, error, "searchError"));
  } finally {
    setters.setSearchLoading(false);
  }
}
