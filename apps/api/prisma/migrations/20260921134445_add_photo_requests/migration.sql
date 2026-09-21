-- CreateTable
CREATE TABLE "PhotoRequest" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),

    CONSTRAINT "PhotoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoRequest_productId_idx" ON "PhotoRequest"("productId");

-- CreateIndex
CREATE INDEX "PhotoRequest_customerId_idx" ON "PhotoRequest"("customerId");

-- CreateIndex
CREATE INDEX "PhotoRequest_status_idx" ON "PhotoRequest"("status");

-- AddForeignKey
ALTER TABLE "PhotoRequest" ADD CONSTRAINT "PhotoRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoRequest" ADD CONSTRAINT "PhotoRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
