import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import type {
  CheckoutRequestInput,
  DeliveryZone,
  SupplierFulfillmentInput,
} from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';

type ProductWithSupplier = Prisma.ProductGetPayload<{
  include: { supplier: { include: { paymentAccount: true } } };
}>;

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async requireCustomerId(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer)
      throw new NotFoundException('No customer account found for this user.');
    return customer.id;
  }

  /**
   * Available stock is never a stored counter — it's computed fresh every
   * time as on-hand minus quantities on other orders that are still
   * AWAITING_PAYMENT and unexpired (Section 34). This makes reservation
   * expiry self-cleaning: once paymentExpiresAt passes, that order simply
   * stops counting, with no cleanup job required.
   */
  private async getAvailableQuantity(
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

  async checkout(userId: string, input: CheckoutRequestInput) {
    const customerId = await this.requireCustomerId(userId);

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        supplier: { verificationStatus: 'APPROVED' },
      },
      include: { supplier: { include: { paymentAccount: true } } },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    const missing = input.items.filter((i) => !productById.has(i.productId));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Some items in your cart are no longer available: ${missing.map((m) => m.productId).join(', ')}.`,
      );
    }

    const bySupplier = new Map<
      string,
      { productId: string; quantity: number }[]
    >();
    for (const item of input.items) {
      const supplierId = productById.get(item.productId)!.supplierId;
      bySupplier.set(supplierId, [...(bySupplier.get(supplierId) ?? []), item]);
    }

    const fulfillmentBySupplier = new Map(
      input.supplierFulfillment.map((f) => [f.supplierId, f]),
    );

    const createdOrders: {
      orderId: string;
      orderNumber: string;
      supplierName: string;
      total: string;
    }[] = [];

    // Every supplier order is created independently — a failure on one
    // supplier's order never touches another's (Section 23).
    for (const [supplierId, items] of bySupplier) {
      const fulfillment = fulfillmentBySupplier.get(supplierId);
      if (!fulfillment) {
        throw new BadRequestException(
          'Missing pickup/delivery choice for one of the suppliers in your cart.',
        );
      }

      const order = await this.createSupplierOrder(
        userId,
        customerId,
        supplierId,
        items,
        fulfillment,
        productById,
      );
      createdOrders.push(order);
    }

    return createdOrders;
  }

  private async createSupplierOrder(
    userId: string,
    customerId: string,
    supplierId: string,
    items: { productId: string; quantity: number }[],
    fulfillment: SupplierFulfillmentInput,
    productById: Map<string, ProductWithSupplier>,
  ) {
    const location = await this.prisma.supplierLocation.findFirst({
      where: { id: fulfillment.locationId, supplierId },
    });
    if (!location)
      throw new BadRequestException(
        'That location does not belong to the selected supplier.',
      );

    const supplier = productById.get(items[0].productId)!.supplier;
    if (
      !supplier.paymentAccount ||
      supplier.paymentAccount.status !== 'CONNECTED'
    ) {
      throw new BadRequestException(
        `${supplier.tradingName} hasn't finished setting up payments yet — this order can't be placed.`,
      );
    }

    // Verify every item has enough stock at the ONE chosen location. We
    // deliberately don't auto-split across locations (Section 34) — a
    // shortfall here is a clear, specific error, not a silent guess.
    for (const item of items) {
      const available = await this.getAvailableQuantity(
        item.productId,
        location.id,
      );
      if (available < item.quantity) {
        const product = productById.get(item.productId)!;
        throw new BadRequestException(
          `${product.name}: only ${Math.max(available, 0)} available at ${location.name}.`,
        );
      }
    }

    let deliveryFee = 0;
    if (fulfillment.deliveryMethod === 'PICKUP') {
      if (!location.pickupAvailable)
        throw new BadRequestException(`${location.name} doesn't offer pickup.`);
    } else {
      if (!location.deliveryAvailable)
        throw new BadRequestException(
          `${location.name} doesn't offer delivery.`,
        );
      // Freight items (complete engines, engine blocks) can't safely go
      // through a flat delivery zone fee — this is enforced here, not
      // just hidden in the UI, since the cart's requiresFreightQuote copy
      // is never authoritative (Rule 13/14). The customer's route around
      // this is pickup, or contacting the supplier directly to arrange
      // delivery outside checkout's flat-fee flow.
      const freightItems = items
        .map((item) => productById.get(item.productId)!)
        .filter((p) => p.requiresFreightQuote);
      if (freightItems.length > 0) {
        throw new BadRequestException(
          `${freightItems.map((p) => p.name).join(', ')} need${freightItems.length === 1 ? 's' : ''} a manual freight quote — choose pickup, or contact ${supplier.tradingName} directly to arrange delivery.`,
        );
      }
      const zones =
        (location.deliveryZones as unknown as DeliveryZone[] | null) ?? [];
      const zone = zones.find((z) => z.name === fulfillment.deliveryZoneName);
      if (!zone) {
        throw new BadRequestException(
          `Delivery zone "${fulfillment.deliveryZoneName ?? ''}" isn't offered at ${location.name}.`,
        );
      }
      deliveryFee = zone.fee;
    }

    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(productById.get(item.productId)!.price) * item.quantity,
      0,
    );
    const total = subtotal + deliveryFee;

    const orderNumber = `ORD-${randomUUID().split('-')[0].toUpperCase()}`;
    const paymentExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        customerId,
        supplierId,
        locationId: location.id,
        status: 'AWAITING_PAYMENT',
        paymentStatus: 'PENDING',
        paymentExpiresAt,
        subtotal,
        deliveryFee,
        total,
        deliveryProvider: fulfillment.deliveryMethod,
        deliveryAddress: fulfillment.deliveryAddress,
        deliveryLatitude: fulfillment.deliveryLatitude,
        deliveryLongitude: fulfillment.deliveryLongitude,
        recipientName: fulfillment.recipientName,
        recipientPhone: fulfillment.recipientPhone,
        items: {
          create: items.map((item) => {
            const product = productById.get(item.productId)!;
            return {
              productId: item.productId,
              skuSnapshot: product.sku,
              nameSnapshot: product.name,
              priceAtPurchase: Number(product.price),
              quantity: item.quantity,
            };
          }),
        },
        payments: {
          create: {
            provider: supplier.paymentAccount.provider,
            amount: total,
            status: 'PENDING',
            idempotencyKey: randomUUID(),
          },
        },
      },
      include: { supplier: { select: { tradingName: true, users: true } } },
    });

    await this.auditLog.record({
      actorUserId: userId,
      action: 'ORDER_CREATED',
      resourceType: 'Order',
      resourceId: order.id,
      metadata: { orderNumber, total },
    });

    await this.prisma.notification.createMany({
      data: order.supplier.users.map((su) => ({
        userId: su.userId,
        type: 'NEW_ORDER',
        title: 'New order received',
        body: `Order ${orderNumber} — awaiting customer payment.`,
      })),
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      supplierName: order.supplier.tradingName,
      total: total.toString(),
    };
  }
}
