"use client";

import { GitCompareArrows, X } from "lucide-react";
import { ComparisonDialog } from "@/components/ComparisonDialog";
import { copy } from "@/lib/model";
import type { CatalogProduct, PublicModel } from "@/lib/model";

interface WorkspaceDialogsProps {
  model: PublicModel;
  compareIds: string[];
  comparedProducts: CatalogProduct[];
  comparisonOpen: boolean;
  onOpenComparison: () => void;
  onCloseComparison: () => void;
  onClearComparison: () => void;
}

export function WorkspaceDialogs({
  model,
  compareIds,
  comparedProducts,
  comparisonOpen,
  onOpenComparison,
  onCloseComparison,
  onClearComparison,
}: WorkspaceDialogsProps) {
  return (
    <>
      {compareIds.length > 0 && (
        <div className="compare-dock">
          <span>
            <GitCompareArrows size={16} aria-hidden="true" />
            {compareIds.length} / 2
          </span>
          <button type="button" onClick={onOpenComparison} disabled={compareIds.length < 2}>
            {copy(model, "compareSelected")}
          </button>
          <button
            type="button"
            className="dock-clear"
            aria-label={copy(model, "clearComparison")}
            onClick={onClearComparison}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      {comparisonOpen && <ComparisonDialog model={model} products={comparedProducts} onClose={onCloseComparison} />}
    </>
  );
}
