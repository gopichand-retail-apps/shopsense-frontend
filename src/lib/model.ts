import { z } from "zod";

export const productSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    category: z.string(),
    priceCents: z.number().int().nonnegative(),
    description: z.string(),
    imageUrl: z.string().url(),
    imageAlt: z.string(),
    attributes: z.array(z.string()),
    matchTags: z.array(z.string()).optional(),
  })
  .strict();

const messagesSchema = z
  .object({
    errors: z
      .object({
        invalidRequest: z.string(),
        invalidSearch: z.string(),
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
export type ThemeMode = PublicModel["app"]["defaultTheme"];
export type Recommendation = {
  product: CatalogProduct;
  matchedDetails: string[];
};
export type SearchResult = {
  intentCategory: string | null;
  resultCount: number;
  results: Recommendation[];
  summary: string;
  source: string;
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

export function formatPrice(model: PublicModel, cents: number): string {
  return new Intl.NumberFormat(model.app.locale, {
    style: "currency",
    currency: model.app.currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
