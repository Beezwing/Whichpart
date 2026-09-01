import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Everything here is public and unauthenticated (Rule 10) — but every
 * query still filters to isActive products from APPROVED suppliers only
 * (Rule 9). A product/supplier that fails that check 404s exactly like
 * one that doesn't exist; we never reveal that a draft/suspended record
 * exists at all.
 */
@Injectable()
export class MarketplaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        supplier: { verificationStatus: 'APPROVED' },
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
        brand: true,
        compatibilities: true,
        inventory: { include: { location: true } },
        supplier: {
          select: {
            id: true,
            tradingName: true,
            verificationStatus: true,
            physicalAddress: true,
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async getSupplier(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, verificationStatus: 'APPROVED' },
      select: {
        id: true,
        tradingName: true,
        description: true,
        phone: true,
        website: true,
        verificationStatus: true,
        createdAt: true,
        locations: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            openingHours: true,
            pickupAvailable: true,
            deliveryAvailable: true,
            deliveryZones: true,
          },
        },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');
    return supplier;
  }
}
