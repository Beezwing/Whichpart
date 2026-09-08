import { z } from "zod";

export const registerCustomerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(10).max(200),
});
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Registration only opens a supplier application (Section 3/4) — it never
 * grants selling access. Only an admin approval transitions the resulting
 * SupplierVerification to APPROVED.
 */
export const registerSupplierSchema = z.object({
  legalBusinessName: z.string().min(2).max(200),
  tradingName: z.string().min(2).max(200),
  businessType: z.string().min(2).max(100),
  businessRegistrationNumber: z.string().max(100).optional(),
  physicalAddress: z.string().min(5).max(300),
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  website: z.string().url().optional(),
  authorizedRepresentativeName: z.string().min(2).max(150),
});
export type RegisterSupplierInput = z.infer<typeof registerSupplierSchema>;

export const supplierSignupSchema = registerSupplierSchema.extend({
  password: z.string().min(10).max(200),
});
export type SupplierSignupInput = z.infer<typeof supplierSignupSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Ids of the guided app tours (Section: onboarding). Versioned so a
 * meaningfully-redesigned tour can be re-shown to everyone by shipping a
 * new id ("customer-v2") without touching User.toursSeen for the old one.
 */
export const TOUR_IDS = ["customer-v1", "supplier-v1"] as const;
export const tourIdSchema = z.enum(TOUR_IDS);
export type TourId = z.infer<typeof tourIdSchema>;
