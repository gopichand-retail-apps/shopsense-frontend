"use client";

import { ArrowRight, ChevronDown, GitCompareArrows, Search, X } from "lucide-react";
import { CategoryFilters, EmptyState, ProductResults } from "@/components/CatalogComponents";
import { ProductCard } from "@/components/ProductCard";
import { copy, type PublicModel, type CatalogProduct, type Recommendation, type SearchResult } from "@/lib/model";

export type WorkspaceView = "discover" | "saved";
type SearchState = "idle" | "searching" | "complete";

interface ShopperContentProps {
  model: PublicModel;
  activeView: WorkspaceView;
  query: string;
  activeQuery: string;
  searchState: SearchState;
  searchError: string | null;
  searchResult: SearchResult | null;
  catalog: CatalogProduct[];
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
        <div className="hero-note">
          <span>01</span>
          <p>{copy(model, "catalogGrounding")}</p>
        </div>
      </section>

      <SearchPanel {...props} />
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
}: ShopperContentProps) {
  return (
    <section className="search-panel" aria-label={copy(model, "searchLabel")}>
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
          <button className="search-submit" type="submit" disabled={searchState === "searching"}>
            {searchState === "searching" ? copy(model, "searching") : copy(model, "searchAction")}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="search-footer">
          <span>{copy(model, "searchGuidance")}</span>
          <span>
            {query.length}/{model.search.maximumQueryCharacters}
          </span>
        </div>
      </form>
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
        {model.quickPrompts.map((prompt, index) => (
          <button key={prompt} type="button" className="quick-prompt" onClick={() => onPrompt(prompt)}>
            <span className="prompt-index">0{index + 1}</span>
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
        </div>
        <div className="results-tools">
          <span className="result-count">
            {searchResult.resultCount} {copy(model, "resultCount")}
          </span>
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
        <EmptyState
          model={model}
          title={copy(model, "noMatchesTitle")}
          description={copy(model, "noMatchesDescription")}
          onBack={onClearQuery}
        />
      )}
    </section>
  );
}

function CatalogSection(props: ShopperContentProps) {
  const {
    model,
    catalog,
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
  } = props;
  return (
    <section className="catalog-section">
      <div className="catalog-heading-row">
        <div>
          <span className="section-kicker">{copy(model, "catalogSource")}</span>
          <h2>{copy(model, "catalogTitle")}</h2>
        </div>
        <span className="result-count">
          {catalog.length} {copy(model, "catalogCount")}
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
        <EmptyState model={model} title={copy(model, "emptyTitle")} description={copy(model, "emptyDescription")} />
      ) : null}
    </section>
  );
}
