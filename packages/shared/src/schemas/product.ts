import { z } from "zod";
import { ProductCondition } from "../enums";

/**
 * Free-text for now — Phase 5 builds the real Make/Model/Engine database
 * and can backfill structured links later. Storing plain text here means
 * we're not inventing vehicle data or forcing a match that doesn't exist
 * yet (Section 17/18).
 */
export const vehicleCompatibilityInputSchema = z.object({
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  yearFrom: z.number().int().min(1970).max(new Date().getFullYear() + 1).optional(),
  yearTo: z.number().int().min(1970).max(new Date().getFullYear() + 1).optional(),
  engine: z.string().max(60).optional(),
  engineCode: z.string().max(60).optional(),
  transmission: z.string().max(60).optional(),
  notes: z.string().max(1000).optional(),
});
export type VehicleCompatibilityInput = z.infer<typeof vehicleCompatibilityInputSchema>;

/**
 * Fields the SUPPLIER submits and that are authoritative (Master Spec
 * Rules 3-5, Section 11). No AI-assist workflow may ever write to
 * sku, price, or quantity — this schema is the only path that can.
 */
export const createProductSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z0-9._-]+$/, "SKU may contain letters, numbers, dot, underscore, hyphen"),
  name: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid().optional(),
  brand: z.string().max(100).optional(),
  condition: z.nativeEnum(ProductCondition),
  price: z.number().positive().finite(),
  oemPartNumber: z.string().max(60).optional(),
  manufacturerPartNumber: z.string().max(60).optional(),
  compatibility: vehicleCompatibilityInputSchema.optional(),
  locationId: z.string().uuid(),
  quantity: z.number().int().nonnegative(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema
  .omit({ locationId: true, quantity: true })
  .partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const updateInventorySchema = z.object({
  quantity: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().nullable().optional(),
  criticalStockThreshold: z.number().int().nonnegative().nullable().optional(),
});
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

/**
 * One row of the bulk-upload spreadsheet (Section 10). Price, quantity,
 * and SKU here are exactly as authoritative as they are on the single-
 * product form — bulk upload is not a side door around Rules 3-5.
 */
export const productImportRowSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  name: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  make: z.string().max(60).optional(),
  model: z.string().max(60).optional(),
  yearFrom: z.number().int().optional(),
  yearTo: z.number().int().optional(),
  engine: z.string().max(60).optional(),
  engineCode: z.string().max(60).optional(),
  transmission: z.string().max(60).optional(),
  oemPartNumber: z.string().max(60).optional(),
  manufacturerPartNumber: z.string().max(60).optional(),
  condition: z.nativeEnum(ProductCondition),
  price: z.number().positive(),
  quantity: z.number().int().nonnegative(),
  location: z.string().min(1).max(150),
  compatibilityNotes: z.string().max(1000).optional(),
});
export type ProductImportRow = z.infer<typeof productImportRowSchema>;

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
