"use client";

import { useEffect, useState } from "react";
import { getStoreLayout, type StoreLayout } from "@/lib/api";
import { copy, type PublicModel } from "@/lib/model";

export function StoreGuide({ model }: { model: PublicModel }) {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<StoreLayout | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open || layout) return;
    const controller = new AbortController();
    getStoreLayout(model, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setFailed(false);
          setLayout(value);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [open, layout, model, attempt]);

  return (
    <details className="store-guide" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{copy(model, "storeGuide")}</summary>
      {open && <p>{copy(model, "virtualStoreNotice")}</p>}
      {open &&
        (failed ? (
          <div role="alert">
            <p>{copy(model, "storeGuideError")}</p>
            <button
              className="text-action"
              type="button"
              onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              {copy(model, "retry")}
            </button>
          </div>
        ) : !layout ? (
          <p role="status">{copy(model, "storeGuideLoading")}</p>
        ) : (
          <div className="store-floor" aria-label={copy(model, "storeLayoutLabel")}>
            <p className="store-entrance">{copy(model, "storeEntrance")}</p>
            <ol>
              {layout.aisles.map((aisle) => (
                <li key={aisle.id}>
                  <strong>{copy(model, "aisleLabel").replace("{aisle}", aisle.id)}</strong>
                  <h3>{aisle.label}</h3>
                  <ul>
                    {aisle.racks.map((rack, index) => (
                      <li key={rack}>
                        <span>{`R${index + 1}`}</span> {rack}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        ))}
    </details>
  );
}
