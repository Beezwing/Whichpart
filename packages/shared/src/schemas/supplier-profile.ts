import { z } from "zod";

/**
 * Legal identity fields (legal name, registration number) are NOT
 * editable here once a supplier exists — changing them without another
 * verification pass would undermine the point of verifying them at all.
 * Only day-to-day business info can be self-updated.
 */
export const updateSupplierProfileSchema = z.object({
  tradingName: z.string().min(2).max(200).optional(),
  phone: z.string().min(7).max(20).optional(),
  website: z.string().url().optional().or(z.literal("")),
  physicalAddress: z.string().min(5).max(300).optional(),
  description: z.string().max(2000).optional(),
});
export type UpdateSupplierProfileInput = z.infer<typeof updateSupplierProfileSchema>;

const deliveryZoneSchema = z.object({
  name: z.string().min(1).max(100),
  fee: z.number().nonnegative(),
  estimatedTime: z.string().max(60).optional(),
  minimumOrder: z.number().nonnegative().optional(),
});
export type DeliveryZone = z.infer<typeof deliveryZoneSchema>;

export const supplierLocationSchema = z.object({
  name: z.string().min(1).max(150),
  address: z.string().min(5).max(300),
  phone: z.string().min(7).max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  openingHours: z.string().max(300).optional(),
  pickupAvailable: z.boolean(),
  deliveryAvailable: z.boolean(),
  deliveryZones: z.array(deliveryZoneSchema).max(20).optional(),
});
export type SupplierLocationInput = z.infer<typeof supplierLocationSchema>;

export const choosePlanSchema = z.object({
  planId: z.string().uuid(),
});
export type ChoosePlanInput = z.infer<typeof choosePlanSchema>;

export const paymentAccountSchema = z.object({
  provider: z.enum(["LUNIPAY", "FYGARO"]),
  publicIdentifier: z.string().min(1).max(200),
  apiKey: z.string().min(1).max(500),
});
export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;

export const adminUpdatePlanSchema = z.object({
  priceUsd: z.number().positive(),
  trialDays: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});
export type AdminUpdatePlanInput = z.infer<typeof adminUpdatePlanSchema>;
