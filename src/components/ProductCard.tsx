import { ProductImage, PhotoCredit } from "./ProductImage";
import { Bookmark, Check, GitCompareArrows, MapPin } from "lucide-react";
import { copy, formatPrice, nestedCopy } from "@/lib/model";
import type { PublicModel, Recommendation } from "@/lib/model";

interface ProductCardProps {
  model: PublicModel;
  recommendation: Recommendation;
  saved: boolean;
  compared: boolean;
  compareDisabled: boolean;
  showFeedback: boolean;
  feedbackChoice: boolean | undefined;
  onToggleSaved: (productId: string) => void;
  onToggleCompare: (productId: string) => void;
  onFeedback: (productId: string, helpful: boolean) => void;
}

export function ProductCard({
  model,
  recommendation,
  saved,
  compared,
  compareDisabled,
  showFeedback,
  feedbackChoice,
  onToggleSaved,
  onToggleCompare,
  onFeedback,
}: ProductCardProps) {
  const { product, matchedDetails } = recommendation;
  const illustrative = product.id.startsWith("sample-") && product.brand === "ShopSense Sample";
  const description = illustrative ? `${product.attributes[0]}. ${product.attributes.at(-1)}.` : product.description;

  return (
    <article className="product-card" data-testid="product-card">
      <div className="product-image-wrap">
        <ProductImage key={product.imageUrl} model={model} product={product} />
        <span className="product-brand">
          {illustrative ? nestedCopy(model, "categories", product.category) : product.brand}
        </span>
        <button
          className={saved ? "save-button is-saved" : "save-button"}
          type="button"
          aria-label={`${copy(model, saved ? "removeSaved" : "saveProduct")}: ${product.name}`}
          aria-pressed={saved}
          onClick={() => onToggleSaved(product.id)}
        >
          {saved ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
        </button>
      </div>
      <div className="product-card-body">
        <PhotoCredit model={model} product={product} />
        <div className="product-card-title-row">
          <div>
            <span className="product-category">{nestedCopy(model, "categories", product.category)}</span>
            <h2>{product.name}</h2>
          </div>
          <strong className="product-price">{formatPrice(model, product.priceCents)}</strong>
        </div>
        <p className="product-description">{description}</p>
        {product.location && (
          <p className="product-location">
            <MapPin size={15} aria-hidden="true" />
            {copy(model, "productLocation")
              .replace("{aisle}", product.location.aisle)
              .replace("{rack}", product.location.rack)
              .replace("{shelf}", String(product.location.shelf))}
          </p>
        )}
        <div className="match-details">
          <span className="match-details-heading">
            {copy(model, matchedDetails.length ? "groundedIn" : "productDetails")}
          </span>
          <ul>
            {(matchedDetails.length ? matchedDetails : product.attributes.slice(0, 3)).map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </div>
        <div className="product-card-actions">
          <button
            type="button"
            className={compared ? "compare-button is-selected" : "compare-button"}
            aria-pressed={compared}
            aria-label={`${copy(model, "compare")}: ${product.name}`}
            disabled={compareDisabled && !compared}
            onClick={() => onToggleCompare(product.id)}
          >
            <GitCompareArrows size={15} aria-hidden="true" />
            {copy(model, compared ? "removeComparison" : "compare")}
          </button>
          {showFeedback ? (
            <div className="feedback-control">
              {feedbackChoice === undefined ? (
                <>
                  <span>{copy(model, "feedbackQuestion")}</span>
                  <button
                    type="button"
                    aria-label={`${copy(model, "feedbackHelpful")}: ${product.name}`}
                    onClick={() => onFeedback(product.id, true)}
                  >
                    {copy(model, "feedbackHelpful")}
                  </button>
                  <button
                    type="button"
                    aria-label={`${copy(model, "feedbackNotRelevant")}: ${product.name}`}
                    onClick={() => onFeedback(product.id, false)}
                  >
                    {copy(model, "feedbackNotRelevant")}
                  </button>
                </>
              ) : (
                <span className="feedback-thanks" role="status">
                  {copy(model, "feedbackReceived")}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
