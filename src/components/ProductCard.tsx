import { ProductImage, PhotoCredit } from "./ProductImage";
import { Bookmark, Check, GitCompareArrows, MapPin } from "lucide-react";
import { useRef } from "react";
import { AvailabilityLine } from "@/components/OfferNotices";
import { copy, copyWith, formatPrice, nestedCopy } from "@/lib/model";
import type { CatalogProduct, PublicModel, Recommendation } from "@/lib/model";

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
  const { product } = recommendation;
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
          <strong className="product-price">{formatPrice(model, product.priceCents, product.offer?.currency)}</strong>
        </div>
        {product.availability ? <AvailabilityLine model={model} availability={product.availability} /> : null}
        {product.offer ? (
          <p className="product-sku">{copyWith(model, "offerSku", { sku: product.offer.sku })}</p>
        ) : null}
        <p className="product-description">{description}</p>
        <ProductPlacement model={model} product={product} />
        <MatchDetails model={model} recommendation={recommendation} />
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
            <FeedbackControl model={model} product={product} choice={feedbackChoice} onFeedback={onFeedback} />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ProductPlacement({ model, product }: { model: PublicModel; product: CatalogProduct }) {
  if (!product.location) return null;
  return (
    <p className="product-location">
      <MapPin size={15} aria-hidden="true" />
      {copy(model, "productLocation")
        .replace("{aisle}", product.location.aisle)
        .replace("{rack}", product.location.rack)
        .replace("{shelf}", String(product.location.shelf))}
    </p>
  );
}

// Matched details that came from a stored attribute open the attribute list and move focus to that entry.
function MatchDetails({ model, recommendation }: { model: PublicModel; recommendation: Recommendation }) {
  const { product, matchedDetails, matches } = recommendation;
  const details = useRef<HTMLDetailsElement>(null);
  const attributeItems = useRef<(HTMLLIElement | null)[]>([]);
  const matchedIndexes = new Set((matches ?? []).flatMap((match) => (match.index === undefined ? [] : [match.index])));
  function reveal(index: number) {
    if (details.current) details.current.open = true;
    attributeItems.current[index]?.focus();
  }
  return (
    <div className="match-details">
      <span className="match-details-heading">
        {copy(model, matchedDetails.length ? "groundedIn" : "productDetails")}
      </span>
      <ul>
        {matches?.length
          ? matches.map((match) => (
              <li key={`${match.field}-${match.index ?? match.text}`}>
                {match.field === "attributes" && match.index !== undefined ? (
                  <button
                    type="button"
                    className="match-link"
                    aria-label={copyWith(model, "showStoredAttribute", { text: match.text })}
                    onClick={() => reveal(match.index ?? 0)}
                  >
                    {match.text}
                  </button>
                ) : (
                  match.text
                )}
              </li>
            ))
          : (matchedDetails.length ? matchedDetails : product.attributes.slice(0, 3)).map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
      </ul>
      {matches?.length ? (
        <details ref={details} className="stored-attributes">
          <summary>{copyWith(model, "storedAttributes", { count: product.attributes.length })}</summary>
          <ol>
            {product.attributes.map((attribute, index) => (
              <li
                key={`${index}-${attribute}`}
                ref={(element) => {
                  attributeItems.current[index] = element;
                }}
                tabIndex={-1}
                className={matchedIndexes.has(index) ? "is-matched" : undefined}
              >
                {attribute}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

function FeedbackControl({
  model,
  product,
  choice,
  onFeedback,
}: {
  model: PublicModel;
  product: CatalogProduct;
  choice: boolean | undefined;
  onFeedback: (productId: string, helpful: boolean) => void;
}) {
  return (
    <div className="feedback-control">
      {choice === undefined ? (
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
  );
}
