"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { sendFeedback } from "@/lib/api";
import type { PublicModel } from "@/lib/model";
import { copy } from "@/lib/model";
import { userFacingErrorCopy } from "@/lib/user-facing-error-copy";

export function useShopperFeedback(model: PublicModel | null, setNotice: Dispatch<SetStateAction<string | null>>) {
  const [feedbackByProduct, setFeedbackByProduct] = useState<Record<string, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  async function submitFeedback(productId: string, helpful: boolean) {
    if (!model) return;
    setFeedbackError(null);
    try {
      await sendFeedback(model, { productId, helpful });
      setFeedbackByProduct((current) => ({ ...current, [productId]: helpful }));
      setNotice(copy(model, "feedbackReceived"));
    } catch (error) {
      setFeedbackError(userFacingErrorCopy(model, error, "feedbackError"));
    }
  }

  function clearFeedback() {
    setFeedbackByProduct({});
  }

  return { feedbackByProduct, feedbackError, submitFeedback, clearFeedback };
}
