"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { getCatalog, getHealth, getProductsByIds, loadModel } from "@/lib/api";
import type { CatalogProduct, PublicModel, ThemeMode } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";

export interface ShopperBootstrap {
  model: PublicModel | null;
  loadError: boolean;
  catalog: CatalogProduct[];
  catalogTotal: number;
  setCatalogTotal: Dispatch<SetStateAction<number>>;
  referencedProducts: CatalogProduct[];
  setReferencedProducts: Dispatch<SetStateAction<CatalogProduct[]>>;
  setCatalog: Dispatch<SetStateAction<CatalogProduct[]>>;
  catalogError: string | null;
  setCatalogError: Dispatch<SetStateAction<string | null>>;
  catalogLoading: boolean;
  setCatalogLoading: Dispatch<SetStateAction<boolean>>;
  serviceConnected: boolean;
  aiAvailable: boolean;
  setAiAvailable: Dispatch<SetStateAction<boolean>>;
  setServiceConnected: Dispatch<SetStateAction<boolean>>;
  offline: boolean;
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  savedIds: string[];
  setSavedIds: Dispatch<SetStateAction<string[]>>;
}

export function useShopperBootstrap(): ShopperBootstrap {
  const [model, setModel] = useState<PublicModel | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { setters: catalogSetters, ...catalogState } = useCatalogState();
  const [serviceConnected, setServiceConnected] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(
    () =>
      beginInitialLoad({
        setModel,
        setLoadError,
        setTheme,
        setSavedIds,
        ...catalogSetters,
        setServiceConnected,
        setAiAvailable,
      }),
    [catalogSetters],
  );

  useEffect(() => {
    if (!model) return;
    window.localStorage.setItem(model.app.themeStorageKey, theme);
    window.localStorage.setItem(model.app.savedStorageKey, JSON.stringify(savedIds));
  }, [model, theme, savedIds]);

  const offline = useNetworkStatus(model, setServiceConnected);
  return {
    model,
    loadError,
    ...catalogState,
    serviceConnected,
    aiAvailable,
    setAiAvailable,
    setServiceConnected,
    offline,
    theme,
    setTheme,
    savedIds,
    setSavedIds,
  };
}

function useCatalogState() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [referencedProducts, setReferencedProducts] = useState<CatalogProduct[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const setters = useMemo(() => ({ setCatalog, setCatalogTotal, setReferencedProducts, setCatalogError }), []);
  return {
    catalog,
    catalogTotal,
    referencedProducts,
    catalogError,
    catalogLoading,
    setCatalogLoading,
    ...setters,
    setters,
  };
}

function beginInitialLoad(setters: {
  setCatalogTotal: Dispatch<SetStateAction<number>>;
  setReferencedProducts: Dispatch<SetStateAction<CatalogProduct[]>>;
  setAiAvailable: Dispatch<SetStateAction<boolean>>;
  setModel: Dispatch<SetStateAction<PublicModel | null>>;
  setLoadError: Dispatch<SetStateAction<boolean>>;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  setSavedIds: Dispatch<SetStateAction<string[]>>;
  setCatalog: Dispatch<SetStateAction<CatalogProduct[]>>;
  setCatalogError: Dispatch<SetStateAction<string | null>>;
  setServiceConnected: Dispatch<SetStateAction<boolean>>;
}) {
  const controller = new AbortController();
  let mounted = true;
  void initializeShopper({ ...setters, signal: controller.signal, isMounted: () => mounted });
  return () => {
    mounted = false;
    controller.abort();
  };
}

async function initializeShopper(context: {
  setCatalogTotal: Dispatch<SetStateAction<number>>;
  setReferencedProducts: Dispatch<SetStateAction<CatalogProduct[]>>;
  setAiAvailable: Dispatch<SetStateAction<boolean>>;
  signal: AbortSignal;
  isMounted: () => boolean;
  setModel: Dispatch<SetStateAction<PublicModel | null>>;
  setLoadError: Dispatch<SetStateAction<boolean>>;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  setSavedIds: Dispatch<SetStateAction<string[]>>;
  setCatalog: Dispatch<SetStateAction<CatalogProduct[]>>;
  setCatalogError: Dispatch<SetStateAction<string | null>>;
  setServiceConnected: Dispatch<SetStateAction<boolean>>;
}) {
  try {
    const model = await loadModel(context.signal);
    if (!context.isMounted()) return;
    context.setModel(model);
    context.setTheme(readTheme(model));
    context.setSavedIds(readSavedIds(model.app.savedStorageKey));
    updateDocumentMetadata(model);
    await loadInitialCatalog(model, context);
    const saved = await getProductsByIds(model, readSavedIds(model.app.savedStorageKey), context.signal);
    if (context.isMounted()) context.setReferencedProducts(saved);
  } catch {
    if (context.isMounted()) context.setLoadError(true);
  }
}

async function loadInitialCatalog(
  model: PublicModel,
  context: Pick<
    ShopperBootstrap,
    "setCatalog" | "setCatalogError" | "setServiceConnected" | "setAiAvailable" | "setCatalogTotal"
  > & {
    signal: AbortSignal;
    isMounted: () => boolean;
  },
) {
  try {
    const [health, products] = await Promise.all([
      getHealth(model, context.signal),
      getCatalog(model, undefined, context.signal),
    ]);
    if (!context.isMounted()) return;
    context.setServiceConnected(health.status === "ok");
    context.setAiAvailable(health.ai?.available === true);
    context.setCatalog(products);
    context.setCatalogTotal(health.catalogCount ?? products.length);
  } catch (error) {
    if (!context.isMounted()) return;
    context.setServiceConnected(false);
    context.setCatalogError(userFacingErrorCopy(model, error, "loadError"));
  }
}

function useNetworkStatus(model: PublicModel | null, setServiceConnected: Dispatch<SetStateAction<boolean>>) {
  const offline = useSyncExternalStore(subscribeToNetworkStatus, getOfflineSnapshot, getServerOfflineSnapshot);
  useEffect(() => {
    let active = true;
    let healthController: AbortController | null = null;
    const handleOffline = () => {
      setServiceConnected(false);
    };
    const handleOnline = () => {
      if (!model) return;
      healthController?.abort();
      healthController = new AbortController();
      void getHealth(model, healthController.signal)
        .then((health) => {
          if (active) setServiceConnected(health.status === "ok");
        })
        .catch(() => {
          if (active) setServiceConnected(false);
        });
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      healthController?.abort();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [model, setServiceConnected]);
  return offline;
}

function subscribeToNetworkStatus(onChange: () => void) {
  window.addEventListener("offline", onChange);
  window.addEventListener("online", onChange);
  return () => {
    window.removeEventListener("offline", onChange);
    window.removeEventListener("online", onChange);
  };
}

function getOfflineSnapshot() {
  return !navigator.onLine;
}

function getServerOfflineSnapshot() {
  return false;
}

function readSavedIds(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored) && stored.every((id): id is string => typeof id === "string")
      ? [...new Set(stored)]
      : [];
  } catch {
    return [];
  }
}

function readTheme(model: PublicModel): ThemeMode {
  const stored = window.localStorage.getItem(model.app.themeStorageKey);
  return stored === "dark" || stored === "light" ? stored : model.app.defaultTheme;
}

function updateDocumentMetadata(model: PublicModel) {
  document.title = `${model.app.name} | ${model.app.descriptor}`;
  document.documentElement.lang = model.app.locale.split("-")[0];
  let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!description) {
    description = document.createElement("meta");
    description.name = "description";
    document.head.append(description);
  }
  description.content = model.app.description;
}
