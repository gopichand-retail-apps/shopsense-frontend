"use client";

import { ArrowLeftRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { copy, formatPrice, nestedCopy } from "@/lib/model";
import type { CatalogProduct, PublicModel } from "@/lib/model";

interface ComparisonDialogProps {
  model: PublicModel;
  products: CatalogProduct[];
  onClose: () => void;
}

export function ComparisonDialog({ model, products, onClose }: ComparisonDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    closeButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="comparison-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-heading"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Tab") {
            event.preventDefault();
            closeButton.current?.focus();
          }
        }}
      >
        <div className="dialog-heading">
          <div>
            <span className="section-kicker">
              <ArrowLeftRight size={13} aria-hidden="true" />
              {copy(model, "compare")}
            </span>
            <h2 id="compare-heading">{copy(model, "compareTitle")}</h2>
          </div>
          <button
            ref={closeButton}
            type="button"
            className="icon-button"
            aria-label={copy(model, "compareClose")}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="comparison-grid">
          {products.map((product) => (
            <article className="comparison-product" key={product.id}>
              <span className="comparison-category">{nestedCopy(model, "categories", product.category)}</span>
              <h3>{product.name}</h3>
              <strong className="comparison-price">{formatPrice(model, product.priceCents)}</strong>
              <p>{product.description}</p>
              <ul>
                {product.attributes.map((attribute) => (
                  <li key={attribute}>{attribute}</li>
                ))}
              </ul>
            </article>
          ))}
          {products.length === 1 ? <p className="compare-placeholder">{copy(model, "compareEmpty")}</p> : null}
        </div>
      </section>
    </div>
  );
}
