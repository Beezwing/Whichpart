/**
 * Controlled vocabularies shared by the API, web app, and mobile app so
 * every layer agrees on the same fixed set of values (Master Spec Sections
 * 4, 15, 30, 32, 54, 58).
 */

export const UserRole = {
  CUSTOMER: "CUSTOMER",
  SUPPLIER_OWNER: "SUPPLIER_OWNER",
  SUPPLIER_STAFF: "SUPPLIER_STAFF",
  SUPPLIER_LOCATION_MANAGER: "SUPPLIER_LOCATION_MANAGER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SupplierVerificationStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  ADDITIONAL_INFO_REQUIRED: "ADDITIONAL_INFO_REQUIRED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
  DEACTIVATED: "DEACTIVATED",
} as const;
export type SupplierVerificationStatus =
  (typeof SupplierVerificationStatus)[keyof typeof SupplierVerificationStatus];

export const BillingPeriod = {
  MONTHLY: "MONTHLY",
  ANNUAL: "ANNUAL",
} as const;
export type BillingPeriod = (typeof BillingPeriod)[keyof typeof BillingPeriod];

export const SubscriptionStatus = {
  TRIAL: "TRIAL",
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  SUSPENDED: "SUSPENDED",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const ProductCondition = {
  NEW: "NEW",
  USED: "USED",
  REFURBISHED: "REFURBISHED",
  RECONDITIONED: "RECONDITIONED",
  OEM: "OEM",
  AFTERMARKET: "AFTERMARKET",
} as const;
export type ProductCondition = (typeof ProductCondition)[keyof typeof ProductCondition];

export const DeliveryProvider = {
  PICKUP: "PICKUP",
  SUPPLIER_DELIVERY: "SUPPLIER_DELIVERY",
  DOORWAY: "DOORWAY",
  EIGHT_SEVEN_SIX_GET: "EIGHT_SEVEN_SIX_GET",
} as const;
export type DeliveryProvider = (typeof DeliveryProvider)[keyof typeof DeliveryProvider];

export const OrderStatus = {
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PAID: "PAID",
  PROCESSING: "PROCESSING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
  DISPUTED: "DISPUTED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  PAID: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
  CANCELLED: "CANCELLED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentProvider = {
  LUNIPAY: "LUNIPAY",
  FYGARO: "FYGARO",
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];
