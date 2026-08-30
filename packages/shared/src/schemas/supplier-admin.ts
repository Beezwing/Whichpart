import { z } from "zod";

/**
 * Admin actions on a supplier's verification (Section 4). Every one of
 * these is written to the immutable audit log by the API, never just
 * updated silently.
 */
export const rejectSupplierSchema = z.object({
  reason: z.string().min(5).max(1000),
});
export type RejectSupplierInput = z.infer<typeof rejectSupplierSchema>;

export const requestInfoSchema = z.object({
  message: z.string().min(5).max(1000),
});
export type RequestInfoInput = z.infer<typeof requestInfoSchema>;

export const suspendSupplierSchema = z.object({
  reason: z.string().min(5).max(1000),
});
export type SuspendSupplierInput = z.infer<typeof suspendSupplierSchema>;

export const addInternalNoteSchema = z.object({
  note: z.string().min(1).max(2000),
});
export type AddInternalNoteInput = z.infer<typeof addInternalNoteSchema>;

export const documentTypes = [
  "BUSINESS_REGISTRATION",
  "REPRESENTATIVE_ID",
  "OTHER",
] as const;
export const uploadDocumentSchema = z.object({
  documentType: z.enum(documentTypes),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
