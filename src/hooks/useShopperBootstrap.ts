"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import type { LocationsStatus } from "@/components/LocationPicker";
import { getHealth, getLocations, getOfferCatalog, getOffersByIds, loadModel } from "@/lib/api";
import type { CatalogFreshness, CatalogProduct, PublicModel, StoreLocation, ThemeMode } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";

type Setter<T> = Dispatch<SetStateAction<T>>;

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
  catalogFreshness: CatalogFreshness | null;
  setCatalogFreshness: Setter<CatalogFreshness | null>;
  unavailableSavedIds: string[];
  setUnavailableSavedIds: Setter<string[]>;
  locations: StoreLocation[];
  locationsStatus: LocationsStatus;
  locationId: string | null;
  setLocationId: Setter<string | null>;
}

type InitialLoadSetters = Pick<
  ShopperBootstrap,
  | "setCatalog"
  | "setCatalogTotal"
  | "setCatalogError"
  | "setCatalogFreshness"
  | "setReferencedProducts"
  | "setUnavailableSavedIds"
  | "setServiceConnected"
  | "setAiAvailable"
  | "setSavedIds"
> & {
  setModel: Setter<PublicModel | null>;
  setLoadError: Setter<boolean>;
  setTheme: Setter<ThemeMode>;
  setLocations: Setter<StoreLocation[]>;
  setLocationsStatus: Setter<LocationsStatus>;
  setLocationId: Setter<string | null>;
};
type LoadContext = InitialLoadSetters & { signal: AbortSignal; isMounted: () => boolean };

export function useShopperBootstrap(): ShopperBootstrap {
  const [model, setModel] = useState<PublicModel | null>(null);
  const [loadError, setLoadError] = useState(false);
  const { setters: catalogSetters, ...catalogState } = useCatalogState();
  const [serviceConnected, setServiceConnected] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const { setters: locationSetters, ...locationState } = useLocationState();

  useEffect(
    () =>
      beginInitialLoad({
        setModel,
        setLoadError,
        setTheme,
        setSavedIds,
        ...catalogSetters,
        ...locationSetters,
        setServiceConnected,
        setAiAvailable,
      }),
    [catalogSetters, locationSetters],
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
    ...locationState,
    setLocationId: locationSetters.setLocationId,
  };
}

function useCatalogState() {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [referencedProducts, setReferencedProducts] = useState<CatalogProduct[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFreshness, setCatalogFreshness] = useState<CatalogFreshness | null>(null);
  const [unavailableSavedIds, setUnavailableSavedIds] = useState<string[]>([]);
  const setters = useMemo(
    () => ({
      setCatalog,
      setCatalogTotal,
      setReferencedProducts,
      setCatalogError,
      setCatalogFreshness,
      setUnavailableSavedIds,
    }),
    [],
  );
  return {
    catalog,
    catalogTotal,
    referencedProducts,
    catalogError,
    catalogLoading,
    setCatalogLoading,
    catalogFreshness,
    unavailableSavedIds,
    ...setters,
    setters,
  };
}

// The selected store lives in memory only: no new browser-storage key.
function useLocationState() {
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [locationsStatus, setLocationsStatus] = useState<LocationsStatus>("loading");
  const [locationId, setLocationId] = useState<string | null>(null);
  const setters = useMemo(() => ({ setLocations, setLocationsStatus, setLocationId }), []);
  return { locations, locationsStatus, locationId, setters };
}

function beginInitialLoad(setters: InitialLoadSetters) {
  const controller = new AbortController();
  let mounted = true;
  void initializeShopper({ ...setters, signal: controller.signal, isMounted: () => mounted });
  return () => {
    mounted = false;
    controller.abort();
  };
}

async function initializeShopper(context: LoadContext) {
  try {
    const model = await loadModel(context.signal);
    if (!context.isMounted()) return;
    context.setModel(model);
    context.setTheme(readTheme(model));
    context.setSavedIds(readSavedIds(model.app.savedStorageKey));
    updateDocumentMetadata(model);
    const locationId = await loadLocations(model, context);
    await loadInitialCatalog(model, locationId, context);
    const saved = await getOffersByIds(model, readSavedIds(model.app.savedStorageKey), locationId, context.signal);
    if (!context.isMounted()) return;
    context.setReferencedProducts(saved.items);
    context.setUnavailableSavedIds(saved.unavailableIds);
  } catch {
    if (context.isMounted()) context.setLoadError(true);
  }
}

// Stores are optional for browsing: a failure leaves "any store" and an explanation, not a broken page.
async function loadLocations(model: PublicModel, context: LoadContext): Promise<string | null> {
  try {
    const locations = await getLocations(model, context.signal);
    if (!context.isMounted()) return null;
    const first = locations[0]?.id ?? null;
    context.setLocations(locations);
    context.setLocationId(first);
    context.setLocationsStatus("ready");
    return first;
  } catch {
    if (context.isMounted()) context.setLocationsStatus("error");
    return null;
  }
}

async function loadInitialCatalog(model: PublicModel, locationId: string | null, context: LoadContext) {
  try {
    const [health, page] = await Promise.all([
      getHealth(model, context.signal),
      getOfferCatalog(model, { locationId }, context.signal),
    ]);
    if (!context.isMounted()) return;
    context.setServiceConnected(health.status === "ok");
    context.setAiAvailable(health.ai?.available === true);
    context.setCatalog(page.items);
    context.setCatalogTotal(page.total);
    context.setCatalogFreshness(page.catalog);
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
