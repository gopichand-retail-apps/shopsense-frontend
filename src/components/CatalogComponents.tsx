"use client";

import { ArrowDownRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { copy, nestedCopy } from "@/lib/model";
import type { CatalogProduct, PublicModel, Recommendation } from "@/lib/model";

interface CategoryFiltersProps {
  model: PublicModel;
  activeCategory: string;
  onCategory: (category: string) => void;
}

interface ProductResultsProps {
  model: PublicModel;
  items: Recommendation[];
  activeCategory: string;
  savedIds: string[];
  compareIds: string[];
  compareDisabled: boolean;
  showFeedback: boolean;
  feedbackByProduct: Record<string, boolean>;
  onCategory: (category: string) => void;
  onToggleSaved: (productId: string) => void;
  onToggleCompare: (productId: string) => void;
  onFeedback: (productId: string, helpful: boolean) => void;
}

interface EmptyStateProps {
  model: PublicModel;
  title: string;
  description: string;
  onBack?: () => void;
}

export function CategoryFilters({ model, activeCategory, onCategory }: CategoryFiltersProps) {
  return (
    <div className="category-filters" role="group" aria-label={copy(model, "filterCategories")}>
      <button
        type="button"
        className={activeCategory === "all" ? "category-filter is-active" : "category-filter"}
        aria-pressed={activeCategory === "all"}
        onClick={() => onCategory("all")}
      >
        {copy(model, "allCategories")}
      </button>
      {model.categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={activeCategory === category.id ? "category-filter is-active" : "category-filter"}
          aria-pressed={activeCategory === category.id}
          onClick={() => onCategory(category.id)}
        >
          <span className={`category-dot category-${category.id}`} aria-hidden="true" />
          {nestedCopy(model, "categories", category.id)}
        </button>
      ))}
    </div>
  );
}

export function ProductResults({
  model,
  items,
  activeCategory,
  savedIds,
  compareIds,
  compareDisabled,
  showFeedback,
  feedbackByProduct,
  onCategory,
  onToggleSaved,
  onToggleCompare,
  onFeedback,
}: ProductResultsProps) {
  return (
    <>
      <CategoryFilters model={model} activeCategory={activeCategory} onCategory={onCategory} />
      {items.length > 0 ? (
        <div className="product-grid">
          {items.map((item) => (
            <ProductCard
              key={item.product.id}
              model={model}
              recommendation={item}
              saved={savedIds.includes(item.product.id)}
              compared={compareIds.includes(item.product.id)}
              compareDisabled={compareDisabled}
              showFeedback={showFeedback}
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
          title={copy(model, "emptySaved")}
          description={copy(model, "emptySavedDescription")}
        />
      )}
    </>
  );
}

export function toRecommendation(product: CatalogProduct): Recommendation {
  return { product, matchedDetails: [] };
}

export function EmptyState({ model, title, description, onBack }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <ArrowDownRight size={18} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <button
        className="text-action"
        type="button"
        onClick={() => (onBack ? onBack() : window.scrollTo({ top: 0, behavior: "smooth" }))}
      >
        {copy(model, "backToDiscover")}
      </button>
    </div>
  );
}
