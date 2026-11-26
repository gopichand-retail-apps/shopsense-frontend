"use client";

import { ArrowRight, ChevronDown, GitCompareArrows, Search, X } from "lucide-react";
import { CategoryFilters, EmptyState, ProductResults } from "@/components/CatalogComponents";
import { ProductCard } from "@/components/ProductCard";
import { SearchAssistance, SearchAssistanceStatus } from "@/components/SearchAssistance";
import { VoiceInput } from "@/components/VoiceInput";
import { SearchFilters } from "@/components/SearchFilters";
import { StoreGuide } from "@/components/StoreGuide";
import { LocationPicker, type LocationsStatus } from "@/components/LocationPicker";
import { CatalogFreshnessNotice, SavedUnavailableNotice, useLocationName } from "@/components/OfferNotices";
import type { CatalogFreshness, ProductFilters, StoreLocation } from "@/lib/model";
import {
  copy,
  copyWith,
  type PublicModel,
  type CatalogProduct,
  type Recommendation,
  type SearchResult,
} from "@/lib/model";

export type WorkspaceView = "discover" | "saved";
type SearchState = "idle" | "searching" | "complete";

interface ShopperContentProps {
  model: PublicModel;
  activeView: WorkspaceView;
  query: string;
  aiAvailable: boolean;
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  onCancelSearch: () => void;
  activeQuery: string;
  searchState: SearchState;
  searchError: string | null;
  searchResult: SearchResult | null;
  catalog: CatalogProduct[];
  catalogTotal: number;
  catalogFreshness: CatalogFreshness | null;
  unavailableSavedIds: string[];
  onRemoveUnavailableSaved: () => void;
  locations: StoreLocation[];
  locationsStatus: LocationsStatus;
  locationId: string | null;
  onLocationChange: (locationId: string | null) => void;
  onIncludeUnconfirmed: () => void;
  hasMoreProducts: boolean;
  onLoadMore: () => void;
  catalogLoading: boolean;
  catalogError: string | null;
  activeCategory: string;
  recommendations: Recommendation[];
  savedIds: string[];
  compareIds: string[];
  feedbackByProduct: Record<string, boolean>;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  onSubmitSearch: () => void;
  onPrompt: (prompt: string) => void;
  onCategoryChange: (category: string) => void;
  onRefreshCatalog: () => void;
  onToggleSaved: (productId: string) => void;
  onToggleCompare: (productId: string) => void;
  onFeedback: (productId: string, helpful: boolean) => void;
  onCompareSelected: () => void;
}

export function ShopperContent(props: ShopperContentProps) {
  if (props.activeView === "saved") return <SavedPage {...props} />;
  return <DiscoveryPage {...props} />;
}

function SavedPage({
  model,
  recommendations,
  activeCategory,
  savedIds,
  unavailableSavedIds,
  onRemoveUnavailableSaved,
  compareIds,
  feedbackByProduct,
  onCategoryChange,
  onToggleSaved,
  onToggleCompare,
  onFeedback,
}: ShopperContentProps) {
  return (
    <>
      <div className="page-intro saved-intro">
        <span className="page-overline">{copy(model, "saved")}</span>
        <h1>{copy(model, "savedTitle")}</h1>
        <p>{copy(model, "savedDescription")}</p>
      </div>
      <SavedUnavailableNotice
        model={model}
        count={unavailableSavedIds.filter((id) => savedIds.includes(id)).length}
        onRemove={onRemoveUnavailableSaved}
      />
      <ProductResults
        model={model}
        items={recommendations}
        activeCategory={activeCategory}
        savedIds={savedIds}
        compareIds={compareIds}
        compareDisabled={compareIds.length >= 2}
        showFeedback={false}
        feedbackByProduct={feedbackByProduct}
        onCategory={onCategoryChange}
        onToggleSaved={onToggleSaved}
        onToggleCompare={onToggleCompare}
        onFeedback={onFeedback}
      />
    </>
  );
}

function DiscoveryPage(props: ShopperContentProps) {
  const { model } = props;
  return (
    <>
      {!props.searchResult && (
        <section className="discovery-hero">
          <div className="hero-copy">
            <span className="page-overline">
              <span className="hero-sparkle">
                <Search size={13} aria-hidden="true" />
              </span>
              {copy(model, "eyebrow")}
            </span>
            <h1>
              {copy(model, "headline")
                .split("\n")
                .map((line) => (
                  <span key={line}>{line}</span>
                ))}
            </h1>
            <p>{copy(model, "description")}</p>
          </div>
        </section>
      )}

      <SearchPanel {...props} />
      <StoreGuide model={model} />
      {props.searchState === "idle" && !props.searchResult && <QuickPrompts model={model} onPrompt={props.onPrompt} />}
      {props.searchState === "searching" && <SearchStatus model={model} />}
      {props.searchResult && <RecommendationSection {...props} />}
      {!props.searchResult && props.searchState === "idle" && <CatalogSection {...props} />}
    </>
  );
}

function SearchPanel({
  model,
  query,
  searchState,
  searchError,
  onQueryChange,
  onClearQuery,
  onSubmitSearch,
  aiAvailable,
  filters,
  onFiltersChange,
  onCancelSearch,
  locations,
  locationsStatus,
  locationId,
  onLocationChange,
}: ShopperContentProps) {
  return (
    <section className="search-panel" aria-label={copy(model, "searchLabel")}>
      <LocationPicker
        model={model}
        locations={locations}
        status={locationsStatus}
        locationId={locationId}
        onChange={onLocationChange}
      />
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitSearch();
        }}
      >
        <label htmlFor="shop-query">{copy(model, "searchLabel")}</label>
        <div className="search-input-row">
          <Search size={19} aria-hidden="true" />
          <input
            id="shop-query"
            type="search"
            aria-describedby="search-guidance"
            value={query}
            maxLength={model.search.maximumQueryCharacters}
            placeholder={copy(model, "searchPlaceholder")}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {query && (
            <button
              className="clear-query"
              type="button"
              aria-label={copy(model, "clearSearch")}
              onClick={onClearQuery}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
          <VoiceInput model={model} onTranscript={onQueryChange} />
          <button className="search-submit" type="submit" disabled={searchState === "searching"}>
            {searchState === "searching" ? copy(model, "searching") : copy(model, "searchAction")}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          {searchState === "searching" && (
            <button type="button" className="text-action" onClick={onCancelSearch}>
              {copy(model, "cancelSearch")}
            </button>
          )}
        </div>
        <div className="search-footer">
          <span id="search-guidance">{copy(model, "searchGuidance")}</span>
          <span>
            {query.length}/{model.search.maximumQueryCharacters}
          </span>
        </div>
        <SearchFilters
          model={model}
          filters={filters}
          locationSelected={Boolean(locationId)}
          onChange={onFiltersChange}
        />
      </form>
      <SearchAssistance model={model} available={aiAvailable} />
      {searchError && (
        <p className="inline-error" role="alert">
          {searchError}
        </p>
      )}
    </section>
  );
}

function QuickPrompts({ model, onPrompt }: { model: PublicModel; onPrompt: (prompt: string) => void }) {
  return (
    <section className="quick-prompt-section">
      <div className="quick-prompt-heading">
        <span>{copy(model, "quickFinds")}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </div>
      <div className="quick-prompt-list">
        {model.quickPrompts.map((prompt) => (
          <button key={prompt} type="button" className="quick-prompt" onClick={() => onPrompt(prompt)}>
            <span>{prompt}</span>
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

function SearchStatus({ model }: { model: PublicModel }) {
  return (
    <div className="search-status" role="status" aria-live="polite">
      <span className="loading-orbit" aria-hidden="true" />
      <span>{copy(model, "searching")}</span>
    </div>
  );
}

function RecommendationSection({
  model,
  searchResult,
  activeQuery,
  recommendations,
  activeCategory,
  savedIds,
  compareIds,
  feedbackByProduct,
  onCategoryChange,
  onToggleSaved,
  onToggleCompare,
  onFeedback,
  onCompareSelected,
  onClearQuery,
  filters,
  locationId,
  onIncludeUnconfirmed,
}: ShopperContentProps) {
  if (!searchResult) return null;
  return (
    <section className="results-section" aria-labelledby="results-heading">
      <div className="results-heading-row">
        <div>
          <span className="section-kicker">
            {copy(model, "queryLabel")}: “{activeQuery}”
          </span>
          <h2 id="results-heading">{copy(model, "resultsTitle")}</h2>
          <p className="results-summary">{searchResult.summary}</p>
          <SearchAssistanceStatus model={model} result={searchResult} />
          <CatalogFreshnessNotice model={model} freshness={searchResult.catalog} />
        </div>
        <div className="results-tools">
          <span className="result-count">
            {copy(model, "recommendationCount")
              .replace("{shown}", String(recommendations.length))
              .replace("{total}", String(searchResult.totalMatches ?? searchResult.resultCount))}
          </span>
          {searchResult.resultCount > 0 && (
            <button type="button" className="text-action" onClick={onClearQuery}>
              {copy(model, "backToDiscover")}
            </button>
          )}
          <button type="button" className="compare-launch" disabled={!compareIds.length} onClick={onCompareSelected}>
            <GitCompareArrows size={15} aria-hidden="true" />
            {copy(model, "compareSelected")}
            {compareIds.length ? ` · ${compareIds.length}` : ""}
          </button>
        </div>
      </div>
      <CategoryFilters model={model} activeCategory={activeCategory} onCategory={onCategoryChange} />
      {recommendations.length ? (
        <div className="product-grid">
          {recommendations.map((item) => (
            <ProductCard
              key={item.product.id}
              model={model}
              recommendation={item}
              saved={savedIds.includes(item.product.id)}
              compared={compareIds.includes(item.product.id)}
              compareDisabled={compareIds.length >= 2}
              showFeedback
              feedbackChoice={feedbackByProduct[item.product.id]}
              onToggleSaved={onToggleSaved}
              onToggleCompare={onToggleCompare}
              onFeedback={onFeedback}
            />
          ))}
        </div>
      ) : (
        <SearchEmptyState
          model={model}
          catalogState={searchResult.catalog?.state}
          inStockOnly={Boolean(filters.availableOnly && locationId)}
          locationId={locationId}
          onClearQuery={onClearQuery}
          onIncludeUnconfirmed={onIncludeUnconfirmed}
        />
      )}
    </section>
  );
}

// An empty store, a store with nothing confirmed in stock, and an ordinary miss are different answers.
function SearchEmptyState({
  model,
  catalogState,
  inStockOnly,
  locationId,
  onClearQuery,
  onIncludeUnconfirmed,
}: {
  model: PublicModel;
  catalogState: CatalogFreshness["state"] | undefined;
  inStockOnly: boolean;
  locationId: string | null;
  onClearQuery: () => void;
  onIncludeUnconfirmed: () => void;
}) {
  const store = useLocationName(locationId);
  if (catalogState === "empty") {
    return (
      <EmptyState
        model={model}
        title={copy(model, "catalogEmptyTitle")}
        description={copy(model, "catalogEmptyDescription")}
        onBack={onClearQuery}
      />
    );
  }
  if (inStockOnly) {
    return (
      <EmptyState
        model={model}
        title={copy(model, "noMatchesTitle")}
        description={copyWith(model, "noMatchesInStockDescription", { store })}
        onBack={onClearQuery}
        action={{ label: copy(model, "includeUnconfirmed"), onClick: onIncludeUnconfirmed }}
      />
    );
  }
  return (
    <EmptyState
      model={model}
      title={copy(model, "noMatchesTitle")}
      description={copy(model, "noMatchesDescription")}
      onBack={onClearQuery}
    />
  );
}

function CatalogSection(props: ShopperContentProps) {
  const {
    model,
    catalogError,
    catalogLoading,
    recommendations,
    activeCategory,
    savedIds,
    compareIds,
    feedbackByProduct,
    onCategoryChange,
    onToggleSaved,
    onToggleCompare,
    onFeedback,
    onRefreshCatalog,
    catalogFreshness,
  } = props;
  const emptyStore = catalogFreshness?.state === "empty";
  return (
    <section className="catalog-section">
      <div className="catalog-heading-row">
        <div>
          <span className="section-kicker">{copy(model, "catalogSource")}</span>
          <h2>{copy(model, "catalogTitle")}</h2>
          <CatalogFreshnessNotice model={model} freshness={catalogFreshness} />
        </div>
        <span className="result-count">
          {props.catalogTotal} {copy(model, "catalogCount")}
        </span>
      </div>
      {catalogError && (
        <div className="error-panel" role="alert">
          <p>{catalogError}</p>
          <button className="text-action" type="button" onClick={onRefreshCatalog} disabled={catalogLoading}>
            {copy(model, "retry")}
          </button>
        </div>
      )}
      {catalogLoading && <SearchStatus model={model} />}
      {recommendations.length ? (
        <div className="catalog-results">
          <ProductResults
            model={model}
            items={recommendations}
            activeCategory={activeCategory}
            savedIds={savedIds}
            compareIds={compareIds}
            compareDisabled={compareIds.length >= 2}
            showFeedback={false}
            feedbackByProduct={feedbackByProduct}
            onCategory={onCategoryChange}
            onToggleSaved={onToggleSaved}
            onToggleCompare={onToggleCompare}
            onFeedback={onFeedback}
          />
        </div>
      ) : !catalogLoading && !catalogError ? (
        <EmptyState
          model={model}
          title={copy(model, emptyStore ? "catalogEmptyTitle" : "emptyTitle")}
          description={copy(model, emptyStore ? "catalogEmptyDescription" : "emptyDescription")}
        />
      ) : null}
      {props.hasMoreProducts && (
        <button type="button" className="text-action load-more" onClick={props.onLoadMore} disabled={catalogLoading}>
          {copy(model, "loadMoreProducts")}
        </button>
      )}
    </section>
  );
}
