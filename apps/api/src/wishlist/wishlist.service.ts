import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireCustomerId(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer)
      throw new NotFoundException('No customer account found for this user.');
    return customer.id;
  }

  async list(userId: string) {
    const customerId = await this.requireCustomerId(userId);
    const rows = await this.prisma.wishlist.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            supplier: { select: { tradingName: true } },
          },
        },
        supplier: {
          select: { id: true, tradingName: true, verificationStatus: true },
        },
      },
    });
    return {
      products: rows
        .filter((r) => r.product)
        .map((r) => ({ wishlistId: r.id, ...r.product! })),
      suppliers: rows
        .filter((r) => r.supplier)
        .map((r) => ({ wishlistId: r.id, ...r.supplier! })),
    };
  }

  async addProduct(userId: string, productId: string) {
    const customerId = await this.requireCustomerId(userId);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found.');

    const existing = await this.prisma.wishlist.findFirst({
      where: { customerId, productId },
    });
    if (existing) return existing;
    return this.prisma.wishlist.create({ data: { customerId, productId } });
  }

  async removeProduct(userId: string, productId: string) {
    const customerId = await this.requireCustomerId(userId);
    await this.prisma.wishlist.deleteMany({ where: { customerId, productId } });
  }

  async addSupplier(userId: string, supplierId: string) {
    const customerId = await this.requireCustomerId(userId);
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');

    const existing = await this.prisma.wishlist.findFirst({
      where: { customerId, supplierId },
    });
    if (existing) return existing;
    return this.prisma.wishlist.create({ data: { customerId, supplierId } });
  }

  async removeSupplier(userId: string, supplierId: string) {
    const customerId = await this.requireCustomerId(userId);
    await this.prisma.wishlist.deleteMany({
      where: { customerId, supplierId },
    });
  }
}
