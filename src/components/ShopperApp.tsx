"use client";

import { useState } from "react";
import type { WorkspaceView } from "@/components/ShopperContent";
import { ShopperWorkspace } from "@/components/ShopperWorkspace";
import { useShopperBootstrap } from "@/hooks/useShopperBootstrap";
import { useShopperCatalogRetry } from "@/hooks/useShopperCatalogRetry";
import { useShopperComparison } from "@/hooks/useShopperComparison";
import { useShopperFeedback } from "@/hooks/useShopperFeedback";
import { useShopperSearch } from "@/hooks/useShopperSearch";
import { useCatalogPagination } from "@/hooks/useCatalogPagination";
import { useOfferActions } from "@/hooks/useOfferActions";

export function ShopperApp() {
  const bootstrap = useShopperBootstrap();
  const [activeView, setActiveView] = useState<WorkspaceView>("discover");
  const [activeCategory, setActiveCategory] = useState("all");
  const [browseCategory, setBrowseCategory] = useState("all");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const feedback = useShopperFeedback(bootstrap.model, setNotice);
  const search = useShopperSearch({
    model: bootstrap.model,
    locationId: bootstrap.locationId,
    setActiveView,
    setActiveCategory,
    setServiceConnected: bootstrap.setServiceConnected,
    setNotice,
    clearFeedback: feedback.clearFeedback,
  });
  const comparison = useShopperComparison(bootstrap.model, setNotice);
  const reloadCatalog = useShopperCatalogRetry({ ...bootstrap, category: browseCategory });
  const pagination = useCatalogPagination(bootstrap, setBrowseCategory);
  const offers = useOfferActions({ bootstrap, search, comparison, pagination, browseCategory, setNotice });
  async function retryCatalog() {
    pagination.reset();
    await reloadCatalog();
  }
  const model = bootstrap.model;

  if (!model) {
    return (
      <main className="boot-state" role={bootstrap.loadError ? "alert" : "status"}>
        {bootstrap.loadError ? (
          <code>CONTENT_MODEL_UNAVAILABLE</code>
        ) : (
          <span className="loading-orbit" aria-hidden="true" />
        )}
      </main>
    );
  }

  return (
    <ShopperWorkspace
      model={model}
      catalog={bootstrap.catalog}
      catalogTotal={bootstrap.catalogTotal}
      catalogFreshness={bootstrap.catalogFreshness}
      referencedProducts={bootstrap.referencedProducts}
      setReferencedProducts={bootstrap.setReferencedProducts}
      hasMoreProducts={pagination.hasMore}
      onLoadMore={() => void pagination.loadMore(browseCategory)}
      catalogError={bootstrap.catalogError}
      catalogLoading={bootstrap.catalogLoading}
      offline={bootstrap.offline}
      serviceConnected={bootstrap.serviceConnected}
      aiAvailable={bootstrap.aiAvailable}
      theme={bootstrap.theme}
      setTheme={bootstrap.setTheme}
      savedIds={bootstrap.savedIds}
      setSavedIds={bootstrap.setSavedIds}
      unavailableSavedIds={bootstrap.unavailableSavedIds}
      onRemoveUnavailableSaved={offers.removeUnavailableSaved}
      locations={bootstrap.locations}
      locationsStatus={bootstrap.locationsStatus}
      locationId={bootstrap.locationId}
      onLocationChange={(locationId) => void offers.changeLocation(locationId)}
      onIncludeUnconfirmed={() => void offers.includeUnconfirmed()}
      onOpenComparison={() => void offers.openComparison()}
      activeView={activeView}
      setActiveView={setActiveView}
      activeCategory={search.searchResult || activeView === "saved" ? activeCategory : browseCategory}
      setActiveCategory={(category) => {
        if (search.searchResult || activeView === "saved") setActiveCategory(category);
        else void pagination.selectCategory(category);
      }}
      navigationOpen={navigationOpen}
      setNavigationOpen={setNavigationOpen}
      notice={notice}
      setNotice={setNotice}
      search={search}
      comparison={comparison}
      feedback={feedback}
      retryCatalog={retryCatalog}
    />
  );
}
