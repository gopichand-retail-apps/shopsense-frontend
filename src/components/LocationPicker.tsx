"use client";

import { MapPin } from "lucide-react";
import { copy, type PublicModel, type StoreLocation } from "@/lib/model";

export type LocationsStatus = "loading" | "ready" | "error";

interface LocationPickerProps {
  model: PublicModel;
  locations: StoreLocation[];
  status: LocationsStatus;
  locationId: string | null;
  onChange: (locationId: string | null) => void;
}

export function LocationPicker({ model, locations, status, locationId, onChange }: LocationPickerProps) {
  if (status === "error") {
    return (
      <p className="location-unavailable" role="status">
        <MapPin size={15} aria-hidden="true" />
        {copy(model, "locationUnavailable")}
      </p>
    );
  }
  return (
    <label className="location-picker">
      <span>
        <MapPin size={15} aria-hidden="true" />
        {copy(model, "locationLabel")}
      </span>
      <select
        aria-label={copy(model, "locationLabel")}
        value={locationId ?? ""}
        disabled={status === "loading"}
        onChange={(event) => onChange(event.target.value || null)}
      >
        {status === "loading" ? <option value="">{copy(model, "locationLoading")}</option> : null}
        {status === "ready" ? <option value="">{copy(model, "locationAny")}</option> : null}
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </label>
  );
}
