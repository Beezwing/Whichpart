-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "qbItemId" TEXT,
ADD COLUMN     "qbSyncToken" TEXT;

-- CreateTable
CREATE TABLE "SupplierQuickBooksAccount" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "primaryLocationId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,

    CONSTRAINT "SupplierQuickBooksAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierQuickBooksAccount_supplierId_key" ON "SupplierQuickBooksAccount"("supplierId");

-- AddForeignKey
ALTER TABLE "SupplierQuickBooksAccount" ADD CONSTRAINT "SupplierQuickBooksAccount_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
