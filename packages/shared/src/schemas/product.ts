import { z } from "zod";
import { ProductCondition } from "../enums";

/**
 * Fields the SUPPLIER submits and that are authoritative (Master Spec
 * Rules 3-5, Section 11). No AI-assist workflow may ever write to
 * sku, price, or quantity — this schema is the only path that can.
 */
export const supplierProductInputSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z0-9._-]+$/, "SKU may contain letters, numbers, dot, underscore, hyphen"),
  name: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid(),
  brand: z.string().max(100).optional(),
  condition: z.nativeEnum(ProductCondition),
  price: z.number().positive().finite(),
  currency: z.literal("JMD"),
  quantity: z.number().int().nonnegative(),
  locationId: z.string().uuid(),
  oemPartNumber: z.string().max(60).optional(),
  manufacturerPartNumber: z.string().max(60).optional(),
  compatibilityNotes: z.string().max(2000).optional(),
});
export type SupplierProductInput = z.infer<typeof supplierProductInputSchema>;

/**
 * AI may ONLY ever produce suggestions in this shape. It is structurally
 * incapable of carrying price, quantity, or sku (Master Spec Section 11,
 * Rules 6-8) — there is no field here for the API layer to accidentally
 * persist over supplier-submitted values.
 */
export const aiCategorizationSuggestionSchema = z.object({
  productId: z.string().uuid(),
  suggestedCategoryId: z.string().uuid().optional(),
  suggestedSubcategoryId: z.string().uuid().optional(),
  suggestedKeywords: z.array(z.string().max(40)).max(20).optional(),
  cleanedDescription: z.string().max(5000).optional(),
  suggestedCompatibility: z.array(z.string().max(120)).max(20).optional(),
  confidence: z.number().min(0).max(1),
});
export type AiCategorizationSuggestion = z.infer<typeof aiCategorizationSuggestionSchema>;
