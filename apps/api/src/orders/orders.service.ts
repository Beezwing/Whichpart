import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { UpdateOrderStatusInput } from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';
import { EmailService } from '../email/email.service';

const ORDER_INCLUDE = {
  items: true,
  payments: true,
  location: true,
  supplier: { select: { id: true, tradingName: true } },
} as const;

// Once an order lands here, a supplier-set status change no longer makes
// sense -- these are terminal from the dashboard's point of view (a real
// refund/dispute flow, when it exists, would be its own action, not a
// value in this dropdown).
const TERMINAL_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'REFUNDED']);

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly email: EmailService,
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

  private async requireSupplierId(userId: string): Promise<string> {
    const supplierUser = await this.prisma.supplierUser.findFirst({
      where: { userId },
      select: { supplierId: true },
    });
    if (!supplierUser)
      throw new NotFoundException('No supplier account found for this user.');
    return supplierUser.supplierId;
  }

  async listForCustomer(userId: string) {
    const customerId = await this.requireCustomerId(userId);
    return this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    });
  }

  async getForCustomer(userId: string, orderId: string) {
    const customerId = await this.requireCustomerId(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  async cancelForCustomer(userId: string, orderId: string) {
    const customerId = await this.requireCustomerId(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException(
        'Only orders awaiting payment can be cancelled here.',
      );
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', paymentStatus: 'CANCELLED' },
    });
    await this.auditLog.record({
      actorUserId: userId,
      action: 'ORDER_CANCELLED_BY_CUSTOMER',
      resourceType: 'Order',
      resourceId: orderId,
    });
  }

  async listForSupplier(userId: string) {
    const supplierId = await this.requireSupplierId(userId);
    return this.prisma.order.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      include: {
        ...ORDER_INCLUDE,
        customer: { select: { name: true, phone: true } },
      },
    });
  }

  async getForSupplier(userId: string, orderId: string) {
    const supplierId = await this.requireSupplierId(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, supplierId },
      include: {
        ...ORDER_INCLUDE,
        customer: { select: { name: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  /**
   * With no live payment-gateway webhook wired up (each supplier holds
   * their own LuniPay/Fygaro/DimePay account -- Rule: the marketplace
   * never touches the money), this manual dropdown is how an order ever
   * moves past AWAITING_PAYMENT at all. Setting PAID here means the
   * supplier is confirming they were paid directly, not that this
   * system verified a charge.
   */
  async updateStatusForSupplier(
    userId: string,
    orderId: string,
    status: UpdateOrderStatusInput['status'],
  ) {
    const supplierId = await this.requireSupplierId(userId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, supplierId },
      include: {
        supplier: { select: { tradingName: true } },
        customer: { include: { user: { select: { email: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (TERMINAL_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `This order is already ${order.status.toLowerCase()} and can't be changed.`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        paymentStatus:
          status === 'PAID'
            ? 'PAID'
            : status === 'CANCELLED'
              ? 'CANCELLED'
              : undefined,
      },
      include: {
        ...ORDER_INCLUDE,
        customer: { select: { name: true, phone: true } },
      },
    });

    await this.auditLog.record({
      actorUserId: userId,
      action: 'ORDER_STATUS_UPDATED_BY_SUPPLIER',
      resourceType: 'Order',
      resourceId: orderId,
      metadata: { from: order.status, to: status },
    });

    // Fire-and-forget -- the status change is real regardless of whether
    // the email actually lands.
    if (order.customer.user.email) {
      this.email
        .sendOrderStatusEmail(order.customer.user.email, {
          orderNumber: order.orderNumber,
          status,
          supplierName: order.supplier.tradingName,
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `Failed to email status update for ${order.orderNumber}: ${String(err)}`,
          ),
        );
    }

    return updated;
  }
}
