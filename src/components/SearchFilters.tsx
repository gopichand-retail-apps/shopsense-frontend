"use client";

import { copy, type ProductFilters, type PublicModel } from "@/lib/model";

const audiences = ["women", "men", "kids", "unisex"] as const;
const colors = ["black", "white", "navy", "red", "green", "blue"] as const;
const budgets = [2500, 5000, 10000] as const;

export function SearchFilters({
  model,
  filters,
  onChange,
}: {
  model: PublicModel;
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
}) {
  return (
    <fieldset className="search-filters">
      <legend>{copy(model, "refineSearch")}</legend>
      <label>
        {copy(model, "audienceFilter")}
        <select
          aria-label={copy(model, "audienceFilter")}
          value={filters.audience ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              audience: audiences.find((value) => value === event.target.value),
            })
          }
        >
          <option value="">{copy(model, "anyAudience")}</option>
          {audiences.map((value) => (
            <option key={value} value={value}>
              {copy(model, `audience_${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy(model, "colorFilter")}
        <select
          aria-label={copy(model, "colorFilter")}
          value={filters.color ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              color: colors.find((value) => value === event.target.value),
            })
          }
        >
          <option value="">{copy(model, "anyColor")}</option>
          {colors.map((value) => (
            <option key={value} value={value}>
              {copy(model, `color_${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {copy(model, "budgetFilter")}
        <select
          aria-label={copy(model, "budgetFilter")}
          value={filters.maximumPriceCents ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              maximumPriceCents: budgets.find((value) => String(value) === event.target.value),
            })
          }
        >
          <option value="">{copy(model, "anyPrice")}</option>
          {budgets.map((value) => (
            <option key={value} value={value}>
              {copy(model, `budget_${value}`)}
            </option>
          ))}
        </select>
      </label>
      {Object.values(filters).some((value) => value !== undefined) && (
        <button className="text-action" type="button" onClick={() => onChange({})}>
          {copy(model, "clearFilters")}
        </button>
      )}
    </fieldset>
  );
}
