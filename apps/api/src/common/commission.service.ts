import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Falls back to this only if a supplier somehow has no subscription record
// at all (shouldn't normally happen -- every supplier gets one on approval)
// -- never leaves commission entirely uncalculated for a paid order.
const DEFAULT_COMMISSION_RATE = 0.05;

/**
 * Snapshots commission onto an Order the moment it's first marked PAID
 * (Section: pricing overhaul). Called from both places an order can become
 * PAID -- the DimePay webhook and a supplier manually marking an order paid
 * (most suppliers don't have DimePay connected yet, so this is the common
 * path in practice). Idempotent: an order that already has a commission
 * snapshot is left alone, so a status update that re-fires PAID (or a
 * webhook redelivery) never double-counts it.
 */
@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async applyOnFirstPaid(orderId: string): Promise<{
    commissionRate: number;
    commissionAmount: number;
    paidAt: Date;
  } | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        supplierId: true,
        subtotal: true,
        commissionRate: true,
      },
    });
    if (!order || order.commissionRate !== null) return null;

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        supplierId: order.supplierId,
        status: { in: ['TRIAL', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { commissionRate: true } } },
    });
    const rate = subscription
      ? Number(subscription.plan.commissionRate)
      : DEFAULT_COMMISSION_RATE;
    const amount = Math.round(Number(order.subtotal) * rate * 100) / 100;

    const paidAt = new Date();
    await this.prisma.order.update({
      where: { id: order.id },
      data: { commissionRate: rate, commissionAmount: amount, paidAt },
    });
    this.logger.log(
      `Commission applied to order ${order.id}: ${amount} (${(rate * 100).toFixed(1)}% of ${Number(order.subtotal)})`,
    );
    return { commissionRate: rate, commissionAmount: amount, paidAt };
  }
}
