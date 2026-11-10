"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { copy, type PublicModel } from "@/lib/model";

export function useShopperComparison(model: PublicModel | null, setNotice: Dispatch<SetStateAction<string | null>>) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);

  function toggleComparison(productId: string) {
    if (compareIds.includes(productId)) {
      setCompareIds((current) => current.filter((id) => id !== productId));
      return;
    }
    if (compareIds.length >= 2) {
      if (model) setNotice(copy(model, "compareLimit"));
      return;
    }
    setCompareIds((current) => [...current, productId]);
  }

  return {
    compareIds,
    setCompareIds,
    comparisonOpen,
    setComparisonOpen,
    toggleComparison,
  };
}
