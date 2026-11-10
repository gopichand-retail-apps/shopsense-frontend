"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { toRecommendation } from "@/components/CatalogComponents";
import { ShopperContent, type WorkspaceView } from "@/components/ShopperContent";
import { ShopperShell } from "@/components/ShopperShell";
import { WorkspaceDialogs } from "@/components/WorkspaceDialogs";
import { WorkspaceNotice } from "@/components/WorkspaceNotice";
import type { useShopperBootstrap } from "@/hooks/useShopperBootstrap";
import type { useShopperComparison } from "@/hooks/useShopperComparison";
import type { useShopperFeedback } from "@/hooks/useShopperFeedback";
import type { useShopperSearch } from "@/hooks/useShopperSearch";
import { copy, type CatalogProduct, type PublicModel, type ThemeMode } from "@/lib/model";
import type { Dispatch, SetStateAction } from "react";

interface ShopperWorkspaceProps {
  model: PublicModel;
  catalog: CatalogProduct[];
  catalogError: string | null;
  catalogLoading: boolean;
  offline: boolean;
  serviceConnected: boolean;
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  savedIds: string[];
  setSavedIds: ReturnType<typeof useShopperBootstrap>["setSavedIds"];
  activeView: WorkspaceView;
  setActiveView: Dispatch<SetStateAction<WorkspaceView>>;
  activeCategory: string;
  setActiveCategory: Dispatch<SetStateAction<string>>;
  navigationOpen: boolean;
  setNavigationOpen: Dispatch<SetStateAction<boolean>>;
  notice: string | null;
  setNotice: Dispatch<SetStateAction<string | null>>;
  search: ReturnType<typeof useShopperSearch>;
  comparison: ReturnType<typeof useShopperComparison>;
  feedback: ReturnType<typeof useShopperFeedback>;
  retryCatalog: () => Promise<void>;
}

export function ShopperWorkspace(props: ShopperWorkspaceProps) {
  const savedProducts = props.catalog.filter((product) => props.savedIds.includes(product.id));
  const recommendations =
    props.activeView === "saved"
      ? savedProducts.map(toRecommendation)
      : (props.search.searchResult?.results ?? props.catalog.map(toRecommendation));
  const visibleRecommendations = recommendations.filter(
    (item) => props.activeCategory === "all" || item.product.category === props.activeCategory,
  );
  const comparedProducts = props.comparison.compareIds
    .map((id) => props.catalog.find((product) => product.id === id))
    .filter((product): product is CatalogProduct => product !== undefined);

  function toggleSaved(productId: string) {
    const wasSaved = props.savedIds.includes(productId);
    props.setSavedIds((current) => (wasSaved ? current.filter((id) => id !== productId) : [...current, productId]));
    props.setNotice(copy(props.model, wasSaved ? "removeComplete" : "saveComplete"));
  }

  return (
    <>
      <ShopperShell
        model={props.model}
        activeView={props.activeView}
        navigationOpen={props.navigationOpen}
        theme={props.theme}
        serviceConnected={props.serviceConnected}
        savedCount={props.savedIds.length}
        onViewChange={props.setActiveView}
        onNavigationChange={props.setNavigationOpen}
        onThemeChange={props.setTheme}
      >
        {props.offline ? (
          <div className="network-offline" role="status">
            <WifiOff size={16} aria-hidden="true" />
            <span>{copy(props.model, "offlineNotice")}</span>
            <button type="button" onClick={() => void props.retryCatalog()} disabled={props.catalogLoading}>
              <RefreshCw size={14} aria-hidden="true" />
              {copy(props.model, "retry")}
            </button>
          </div>
        ) : null}
        <ShopperContent
          model={props.model}
          activeView={props.activeView}
          query={props.search.query}
          activeQuery={props.search.activeQuery}
          searchState={props.search.searchLoading ? "searching" : props.search.searchResult ? "complete" : "idle"}
          searchError={props.search.searchError}
          searchResult={props.search.searchResult}
          catalog={props.catalog}
          catalogLoading={props.catalogLoading}
          catalogError={props.catalogError}
          activeCategory={props.activeCategory}
          recommendations={visibleRecommendations}
          savedIds={props.savedIds}
          compareIds={props.comparison.compareIds}
          feedbackByProduct={props.feedback.feedbackByProduct}
          onQueryChange={props.search.setQuery}
          onClearQuery={props.search.clearSearch}
          onSubmitSearch={() => void props.search.submitQuery(props.search.query)}
          onPrompt={(prompt) => {
            props.search.setQuery(prompt);
            void props.search.submitQuery(prompt);
          }}
          onCategoryChange={props.setActiveCategory}
          onRefreshCatalog={() => void props.retryCatalog()}
          onToggleSaved={toggleSaved}
          onToggleCompare={props.comparison.toggleComparison}
          onFeedback={(productId, helpful) => void props.feedback.submitFeedback(productId, helpful)}
          onCompareSelected={() => props.comparison.setComparisonOpen(true)}
        />
        <WorkspaceNotice notice={props.notice} feedbackError={props.feedback.feedbackError} />
      </ShopperShell>
      <WorkspaceDialogs
        model={props.model}
        compareIds={props.comparison.compareIds}
        comparedProducts={comparedProducts}
        comparisonOpen={props.comparison.comparisonOpen}
        onOpenComparison={() => props.comparison.setComparisonOpen(true)}
        onCloseComparison={() => props.comparison.setComparisonOpen(false)}
        onClearComparison={() => props.comparison.setCompareIds([])}
      />
    </>
  );
}
