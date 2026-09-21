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
  // Editing an existing location round-trips these straight from the
  // API response, and Prisma returns null (not undefined) for a
  // nullable column that was never set -- .optional() alone rejects
  // that null, which silently failed every save on a location that
  // had never had a phone/coordinates/hours set, with no visible
  // error since none of these render an error message in the form.
  phone: z.string().min(7).max(20).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  openingHours: z.string().max(300).nullable().optional(),
  pickupAvailable: z.boolean(),
  deliveryAvailable: z.boolean(),
  deliveryZones: z.array(deliveryZoneSchema).max(20).nullable().optional(),
});
export type SupplierLocationInput = z.infer<typeof supplierLocationSchema>;

export const choosePlanSchema = z.object({
  planId: z.string().uuid(),
});
export type ChoosePlanInput = z.infer<typeof choosePlanSchema>;

export const paymentAccountSchema = z
  .object({
    provider: z.enum(["LUNIPAY", "FYGARO", "DIMEPAY"]),
    publicIdentifier: z.string().min(1).max(200),
    // DimePay calls this the "Client Key" -- sent as a header on every
    // request.
    apiKey: z.string().min(1).max(500),
    // DimePay-only: the separate secret used to sign every request's JWT
    // payload, never transmitted directly. Not used by other providers.
    apiSecret: z.string().min(1).max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.provider === "DIMEPAY" && !data.apiSecret) {
      ctx.addIssue({
        code: "custom",
        path: ["apiSecret"],
        message: "DimePay requires a signing secret in addition to the client key.",
      });
    }
  });
export type PaymentAccountInput = z.infer<typeof paymentAccountSchema>;

export const adminUpdatePlanSchema = z.object({
  price: z.number().positive(),
  currency: z.string().min(1).max(10).optional(),
  // Fraction, not a percent -- 0.05 means 5%.
  commissionRate: z.number().min(0).max(1).optional(),
  trialDays: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});
export type AdminUpdatePlanInput = z.infer<typeof adminUpdatePlanSchema>;
