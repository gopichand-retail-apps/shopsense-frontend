import Image from "next/image";
import { Bookmark, Check, GitCompareArrows } from "lucide-react";
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

  return (
    <article className="product-card" data-testid="product-card">
      <div className="product-image-wrap">
        <Image
          src={product.imageUrl}
          alt={product.imageAlt}
          fill
          sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
          unoptimized
        />
        <span className="product-brand">{product.brand}</span>
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
        <div className="product-card-title-row">
          <div>
            <span className="product-category">{nestedCopy(model, "categories", product.category)}</span>
            <h2>{product.name}</h2>
          </div>
          <strong className="product-price">{formatPrice(model, product.priceCents)}</strong>
        </div>
        <p className="product-description">{product.description}</p>
        <div className="match-details">
          <span className="match-details-heading">{copy(model, "groundedIn")}</span>
          <ul>
            {matchedDetails.map((detail) => (
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
