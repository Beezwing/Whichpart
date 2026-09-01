import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';

const ORDER_INCLUDE = {
  items: true,
  payments: true,
  location: true,
  supplier: { select: { id: true, tradingName: true } },
} as const;

@Injectable()
export class OrdersService {
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
}
