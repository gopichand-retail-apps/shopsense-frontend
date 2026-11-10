"use client";

import { useState } from "react";
import type { WorkspaceView } from "@/components/ShopperContent";
import { ShopperWorkspace } from "@/components/ShopperWorkspace";
import { useShopperBootstrap } from "@/hooks/useShopperBootstrap";
import { useShopperCatalogRetry } from "@/hooks/useShopperCatalogRetry";
import { useShopperComparison } from "@/hooks/useShopperComparison";
import { useShopperFeedback } from "@/hooks/useShopperFeedback";
import { useShopperSearch } from "@/hooks/useShopperSearch";

export function ShopperApp() {
  const bootstrap = useShopperBootstrap();
  const [activeView, setActiveView] = useState<WorkspaceView>("discover");
  const [activeCategory, setActiveCategory] = useState("all");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const feedback = useShopperFeedback(bootstrap.model, setNotice);
  const search = useShopperSearch({
    model: bootstrap.model,
    setActiveView,
    setServiceConnected: bootstrap.setServiceConnected,
    setNotice,
    clearFeedback: feedback.clearFeedback,
  });
  const comparison = useShopperComparison(bootstrap.model, setNotice);
  const retryCatalog = useShopperCatalogRetry(bootstrap);
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
      catalogError={bootstrap.catalogError}
      catalogLoading={bootstrap.catalogLoading}
      offline={bootstrap.offline}
      serviceConnected={bootstrap.serviceConnected}
      theme={bootstrap.theme}
      setTheme={bootstrap.setTheme}
      savedIds={bootstrap.savedIds}
      setSavedIds={bootstrap.setSavedIds}
      activeView={activeView}
      setActiveView={setActiveView}
      activeCategory={activeCategory}
      setActiveCategory={setActiveCategory}
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
