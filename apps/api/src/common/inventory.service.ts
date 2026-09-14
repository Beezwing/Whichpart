import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AvailabilityRequestItem {
  productId: string;
  quantity: number;
}

export interface AvailabilityShortage {
  productId: string;
  needed: number;
  available: number;
}

export interface LocationAvailability {
  locationId: string;
  canFulfillAll: boolean;
  shortages: AvailabilityShortage[];
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Available stock is never a stored counter — it's computed fresh every
   * time as on-hand minus quantities on other orders that are still
   * AWAITING_PAYMENT and unexpired (Section 34). This makes reservation
   * expiry self-cleaning: once paymentExpiresAt passes, that order simply
   * stops counting, with no cleanup job required.
   */
  async getAvailableQuantity(
    productId: string,
    locationId: string,
  ): Promise<number> {
    const inventory = await this.prisma.inventoryLocation.findUnique({
      where: { productId_locationId: { productId, locationId } },
    });
    if (!inventory) return 0;

    const reserved = await this.prisma.orderItem.aggregate({
      where: {
        productId,
        order: {
          locationId,
          status: 'AWAITING_PAYMENT',
          paymentExpiresAt: { gt: new Date() },
        },
      },
      _sum: { quantity: true },
    });

    return inventory.quantity - (reserved._sum.quantity ?? 0);
  }

  /**
   * For each candidate location, checks whether it alone can cover every
   * item's requested quantity -- used so checkout can default to (and the
   * customer can be warned about) a location that actually has the cart in
   * stock, instead of discovering a shortage only after trying to place
   * the order (Section: cart/checkout stock mismatch).
   */
  async getAvailabilityByLocation(
    items: AvailabilityRequestItem[],
    locationIds: string[],
  ): Promise<LocationAvailability[]> {
    return Promise.all(
      locationIds.map(async (locationId) => {
        const shortages: AvailabilityShortage[] = [];
        for (const item of items) {
          const available = await this.getAvailableQuantity(
            item.productId,
            locationId,
          );
          if (available < item.quantity) {
            shortages.push({
              productId: item.productId,
              needed: item.quantity,
              available: Math.max(0, available),
            });
          }
        }
        return { locationId, canFulfillAll: shortages.length === 0, shortages };
      }),
    );
  }
}
