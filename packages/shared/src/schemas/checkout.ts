import { z } from "zod";

export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export type CheckoutItem = z.infer<typeof checkoutItemSchema>;

/**
 * One entry per supplier in the cart. The customer picks WHICH of that
 * supplier's locations fulfills their order (so they can see accurate
 * pickup/delivery options and zone fees before paying) — the backend
 * still independently verifies that location actually has enough stock
 * for every item, never trusting the choice blindly.
 */
export const supplierFulfillmentSchema = z.object({
  supplierId: z.string().uuid(),
  locationId: z.string().uuid(),
  deliveryMethod: z.enum(["PICKUP", "SUPPLIER_DELIVERY"]),
  deliveryZoneName: z.string().max(100).optional(),
  recipientName: z.string().max(150).optional(),
  recipientPhone: z.string().max(20).optional(),
  deliveryAddress: z.string().max(300).optional(),
  // Optional pin dropped on the map at checkout — purely a courier aid,
  // never used in place of deliveryAddress (which stays the record of
  // what the customer typed/agreed to).
  deliveryLatitude: z.number().min(-90).max(90).optional(),
  deliveryLongitude: z.number().min(-180).max(180).optional(),
});
export type SupplierFulfillmentInput = z.infer<typeof supplierFulfillmentSchema>;

export const checkoutRequestSchema = z.object({
  items: z.array(checkoutItemSchema).min(1),
  supplierFulfillment: z.array(supplierFulfillmentSchema).min(1),
});
export type CheckoutRequestInput = z.infer<typeof checkoutRequestSchema>;
