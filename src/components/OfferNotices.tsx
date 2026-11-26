"use client";

import { CircleCheck, CircleQuestionMark, CircleX, TriangleAlert } from "lucide-react";
import { createContext, useContext, useId } from "react";
import { copy, copyWith, formatDateTime } from "@/lib/model";
import type { Availability, CatalogFreshness, PublicModel, StoreLocation } from "@/lib/model";

// Store names come from the API's location list; components look them up by availability.locationId.
export const LocationNamesContext = createContext<ReadonlyMap<string, string>>(new Map());

export function locationNames(locations: StoreLocation[]): ReadonlyMap<string, string> {
  return new Map(locations.map((location) => [location.id, location.name]));
}

export function useLocationName(locationId: string | null | undefined): string {
  const names = useContext(LocationNamesContext);
  return locationId ? (names.get(locationId) ?? locationId) : "";
}

const availabilityIcons = {
  in_stock: CircleCheck,
  out_of_stock: CircleX,
  unknown: CircleQuestionMark,
} as const;

function availabilityText(model: PublicModel, availability: Availability, store: string): string {
  const confirmed = availability.confirmedAt
    ? copyWith(model, "availabilityConfirmed", { time: formatDateTime(model, availability.confirmedAt) })
    : "";
  if (availability.state === "in_stock") return `${copyWith(model, "availabilityInStock", { store })} · ${confirmed}`;
  if (availability.state === "out_of_stock")
    return `${copyWith(model, "availabilityOutOfStock", { store })} · ${confirmed}`;
  if (availability.stale && availability.confirmedAt)
    return copyWith(model, "availabilityStale", { store, time: formatDateTime(model, availability.confirmedAt) });
  return copyWith(model, "availabilityUnknown", { store });
}

export function AvailabilityLine({ model, availability }: { model: PublicModel; availability: Availability }) {
  const store = useLocationName(availability.locationId);
  const Icon = availabilityIcons[availability.state];
  return (
    <p className={`availability availability-${availability.state}`} data-testid="availability">
      <Icon size={15} aria-hidden="true" />
      <span>{availabilityText(model, availability, store)}</span>
    </p>
  );
}

export function CatalogFreshnessNotice({
  model,
  freshness,
}: {
  model: PublicModel;
  freshness: CatalogFreshness | null | undefined;
}) {
  const headingId = useId();
  if (!freshness || freshness.state === "empty") return null;
  if (freshness.state === "stale") {
    return (
      <div className="stale-notice" role="status" aria-labelledby={headingId}>
        <TriangleAlert size={17} aria-hidden="true" />
        <div>
          <h3 id={headingId}>{copy(model, "catalogStaleTitle")}</h3>
          <p>
            {copyWith(model, "catalogStaleDescription", {
              time: freshness.asOf ? formatDateTime(model, freshness.asOf) : copy(model, "staffNever"),
            })}
          </p>
        </div>
      </div>
    );
  }
  if (!freshness.asOf) return null;
  return (
    <p className="catalog-freshness">
      {copyWith(model, "catalogFreshness", { time: formatDateTime(model, freshness.asOf) })}
    </p>
  );
}

export function SavedUnavailableNotice({
  model,
  count,
  onRemove,
}: {
  model: PublicModel;
  count: number;
  onRemove: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="saved-unavailable" role="status">
      <p>{copyWith(model, "savedUnavailableNotice", { count })}</p>
      <button type="button" className="text-action" onClick={onRemove}>
        {copy(model, "savedUnavailableRemove")}
      </button>
    </div>
  );
}
