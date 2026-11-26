import { z } from "zod";

export const offerSchema = z
  .object({
    merchantId: z.string(),
    sku: z.string(),
    sourceVersion: z.number().int().positive(),
    priceCents: z.number().int().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    updatedAt: z.string(),
  })
  .strict();

export const availabilitySchema = z
  .object({
    locationId: z.string(),
    state: z.enum(["in_stock", "out_of_stock", "unknown"]),
    confirmedAt: z.string().nullable(),
    stale: z.boolean(),
  })
  .strict();

export const catalogFreshnessSchema = z.object({
  state: z.enum(["empty", "ready", "stale"]),
  asOf: z.string().nullable(),
  generatedAt: z.string(),
  maxAgeMinutes: z.number().int().positive(),
});

export const productSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    category: z.string(),
    priceCents: z.number().int().nonnegative(),
    description: z.string(),
    imageUrl: z.union([z.string().url(), z.string().regex(/^\/catalog\/(?:photos\/)?[a-z0-9-]+\.(?:svg|jpg)$/)]),
    imageAlt: z.string(),
    imageCredit: z
      .object({
        kind: z.literal("style-reference"),
        author: z.string().min(1).max(240),
        source: z.string().regex(/^https:\/\/www\.pexels\.com\/photo\/[a-z0-9-]+\/$/),
        licenseUrl: z.literal("https://www.pexels.com/license/"),
      })
      .strict()
      .optional(),
    attributes: z.array(z.string()),
    matchTags: z.array(z.string()).optional(),
    color: z.string().optional(),
    audience: z.enum(["women", "men", "kids", "unisex"]).optional(),
    productType: z.string().optional(),
    location: z
      .object({
        storeId: z.string(),
        layoutVersion: z.number().int().positive(),
        virtual: z.literal(true),
        aisle: z.string(),
        rack: z.string(),
        shelf: z.number().int().positive(),
      })
      .strict()
      .optional(),
    offer: offerSchema.optional(),
    availability: availabilitySchema.nullable().optional(),
  })
  .strict();

const messagesSchema = z
  .object({
    errors: z
      .object({
        invalidRequest: z.string(),
        invalidSearch: z.string(),
        invalidLocation: z.string(),
        offersUnavailable: z.string(),
        notFound: z.string(),
        originNotAllowed: z.string(),
        payloadTooLarge: z.string(),
        rateLimited: z.string(),
        server: z.string(),
      })
      .strict(),
    categories: z.record(z.string(), z.string()),
    intents: z.record(z.string(), z.string()),
  })
  .catchall(z.string());

export const contentModelSchema = z
  .object({
    version: z.number().int().positive(),
    appId: z.literal("shopsense-ai"),
    locale: z.string().min(2),
    messages: messagesSchema,
    data: z
      .object({
        app: z
          .object({
            name: z.string().min(1),
            descriptor: z.string().min(1),
            description: z.string().min(1),
            apiBaseUrl: z.union([z.string().url(), z.literal("/api/v1")]),
            allowedOrigin: z.string().url(),
            allowedOrigins: z.array(z.string().url()).min(1).optional(),
            currency: z.string().length(3),
            themeStorageKey: z.string().min(1),
            savedStorageKey: z.string().min(1),
            defaultTheme: z.enum(["light", "dark"]),
          })
          .strict(),
        navigation: z.array(
          z
            .object({
              id: z.enum(["discover", "saved"]),
              label: z.string().min(1),
              icon: z.string().min(1),
            })
            .strict(),
        ),
        search: z
          .object({
            maximumQueryCharacters: z.number().int().positive(),
            maximumBodyBytes: z.number().int().positive(),
            resultLimit: z.number().int().positive(),
            stopWords: z.array(z.string()),
          })
          .strict(),
        quickPrompts: z.array(z.string()),
        categories: z.array(
          z
            .object({
              id: z.string(),
              label: z.string(),
              aliases: z.array(z.string()),
            })
            .strict(),
        ),
        seed: z
          .object({
            version: z.number().int().positive(),
            products: z.array(productSchema),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const publicModelSchema = contentModelSchema.transform((envelope) => ({
  modelVersion: envelope.version,
  app: { ...envelope.data.app, locale: envelope.locale },
  navigation: envelope.data.navigation,
  copy: envelope.messages,
  search: envelope.data.search,
  quickPrompts: envelope.data.quickPrompts,
  categories: envelope.data.categories,
  seed: envelope.data.seed,
}));

export type ContentModelEnvelope = z.infer<typeof contentModelSchema>;
export type PublicModel = z.infer<typeof publicModelSchema>;
export type CatalogProduct = z.infer<typeof productSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type CatalogFreshness = z.infer<typeof catalogFreshnessSchema>;
export type StoreLocation = { id: string; name: string };
export type ThemeMode = PublicModel["app"]["defaultTheme"];
export type AttributeMatch = { field: "attributes" | "tags"; index?: number; text: string };
export type Recommendation = {
  product: CatalogProduct;
  matchedDetails: string[];
  matches?: AttributeMatch[];
};
export type ProductFilters = {
  audience?: "women" | "men" | "kids" | "unisex";
  color?: "black" | "white" | "navy" | "red" | "green" | "blue";
  maximumPriceCents?: number;
  availableOnly?: boolean;
};
export type SearchResult = {
  intentCategory: string | null;
  resultCount: number;
  results: Recommendation[];
  summary: string;
  source: string;
  totalMatches?: number;
  catalog?: CatalogFreshness;
  assistance?: {
    status: "catalog" | "assisted" | "unavailable";
    provider: "local" | "gemini" | "ollama";
    reason?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function copy(model: PublicModel, key: string): string {
  const value = model.copy[key];
  if (typeof value !== "string") throw new TypeError(`Missing content string: ${key}`);
  return value;
}

export function nestedCopy(model: PublicModel, section: string, key: string): string {
  const values = model.copy[section];
  if (!isRecord(values) || !(key in values)) {
    throw new TypeError(`Missing content string: ${section}.${key}`);
  }
  const value = values[key];
  if (typeof value !== "string") throw new TypeError(`Invalid content string: ${section}.${key}`);
  return value;
}

// Fills named {placeholders} in a content-model string; unknown placeholders are left as written.
export function copyWith(model: PublicModel, key: string, values: Record<string, string | number>): string {
  return copy(model, key).replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function formatPrice(model: PublicModel, cents: number, currency = model.app.currency): string {
  return new Intl.NumberFormat(model.app.locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDateTime(model: PublicModel, isoTimestamp: string): string {
  return new Intl.DateTimeFormat(model.app.locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(isoTimestamp),
  );
}
