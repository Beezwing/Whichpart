import { z } from "zod";

/**
 * The curated Make/Model/Engine taxonomy admins maintain (Section 18) —
 * distinct from the free-text fields on a customer's SavedVehicle, which
 * describe one specific car and don't need to match this list exactly.
 */
export const createMakeSchema = z.object({
  name: z.string().min(1).max(60),
});
export type CreateMakeInput = z.infer<typeof createMakeSchema>;

export const createModelSchema = z.object({
  makeId: z.string().uuid(),
  name: z.string().min(1).max(60),
});
export type CreateModelInput = z.infer<typeof createModelSchema>;

export const createEngineSchema = z.object({
  modelId: z.string().uuid().optional(),
  code: z.string().min(1).max(60),
  name: z.string().max(100).optional(),
});
export type CreateEngineInput = z.infer<typeof createEngineSchema>;
