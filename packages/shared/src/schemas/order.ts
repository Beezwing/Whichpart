import { z } from "zod";

/**
 * Statuses a supplier can set by hand from their dashboard (Section:
 * order fulfillment). With no live payment-gateway webhook wired up yet
 * (Rule: each supplier holds their own LuniPay/Fygaro/DimePay account,
 * the marketplace never touches the money), "PAID" here means the
 * supplier is confirming they were paid directly, not that this system
 * verified a charge. REFUNDED and DISPUTED are deliberately excluded --
 * both need a real payment integration or admin involvement before this
 * app should let anyone flip that switch with a dropdown.
 */
export const SUPPLIER_SETTABLE_ORDER_STATUSES = [
  "PAID",
  "PROCESSING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const updateOrderStatusSchema = z.object({
  status: z.enum(SUPPLIER_SETTABLE_ORDER_STATUSES),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
