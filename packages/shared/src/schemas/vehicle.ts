import { z } from "zod";

/**
 * Vehicle identifiers are variable-length alphanumeric on purpose
 * (Master Spec Section 17). Jamaica's used-import (JDM) market uses
 * chassis/frame and engine numbers that do NOT follow the 17-character
 * VIN standard — e.g. "GP54202133", "KGC100234761", "1KR0759867" — so we
 * never enforce a fixed length or a VIN checksum here.
 */
const identifier = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers, and hyphens only");

export const vehicleIdentifiersSchema = z.object({
  vin: identifier.optional(),
  chassisNumber: identifier.optional(),
  engineNumber: identifier.optional(),
  engineCode: identifier.optional(),
});
export type VehicleIdentifiers = z.infer<typeof vehicleIdentifiersSchema>;

export const savedVehicleSchema = z.object({
  nickname: z.string().min(1).max(60).optional(),
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.number().int().min(1970).max(new Date().getFullYear() + 1),
  transmission: z.string().max(40).optional(),
  mileage: z.number().int().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  ...vehicleIdentifiersSchema.shape,
});
export type SavedVehicleInput = z.infer<typeof savedVehicleSchema>;
