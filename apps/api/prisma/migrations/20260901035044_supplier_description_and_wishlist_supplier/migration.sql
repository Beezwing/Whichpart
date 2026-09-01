-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Wishlist" ADD COLUMN     "supplierId" TEXT;

-- AddForeignKey
ALTER TABLE "Wishlist" ADD CONSTRAINT "Wishlist_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
