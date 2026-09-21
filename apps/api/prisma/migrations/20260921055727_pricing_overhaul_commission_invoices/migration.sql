-- AlterTable: SubscriptionPlan.priceUsd -> price + currency + commissionRate.
-- Backfills price from the existing priceUsd values (2 rows) before dropping
-- it, so no data is lost even transiently -- the actual new JMD amounts are
-- set by a follow-up UPDATE outside this migration (Section: pricing overhaul).
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "price" DECIMAL(10,2);
UPDATE "SubscriptionPlan" SET "price" = "priceUsd";
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "price" SET NOT NULL;
ALTER TABLE "SubscriptionPlan" DROP COLUMN "priceUsd";
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'JMD';
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "commissionRate" DECIMAL(5,4),
ADD COLUMN     "commissionAmount" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "serviceFeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDue" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_supplierId_periodStart_key" ON "SupplierInvoice"("supplierId", "periodStart");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_idx" ON "SupplierInvoice"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierInvoice_status_idx" ON "SupplierInvoice"("status");

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
