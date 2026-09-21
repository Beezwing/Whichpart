import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';

@Injectable()
export class AdminInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  list(status?: string) {
    return this.prisma.supplierInvoice.findMany({
      where: status ? { status } : undefined,
      include: { supplier: { select: { tradingName: true } } },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * One invoice per supplier per calendar month (Section: pricing overhaul).
   * Re-running this for a month already generated just skips suppliers who
   * already have one (the @@unique([supplierId, periodStart]) constraint
   * backs this up) -- safe to run again if a new supplier joins mid-month
   * or an order gets marked paid after the first run.
   */
  async generateForMonth(actorUserId: string, month: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) {
      throw new BadRequestException('month must be in YYYY-MM format.');
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const periodStart = new Date(Date.UTC(year, monthIndex, 1));
    const periodEnd = new Date(Date.UTC(year, monthIndex + 1, 1));
    if (periodEnd > new Date()) {
      throw new BadRequestException(
        "Can't generate invoices for a month that hasn't ended yet.",
      );
    }

    const suppliers = await this.prisma.supplier.findMany({
      where: { verificationStatus: 'APPROVED' },
      select: {
        id: true,
        subscriptions: {
          where: { status: { in: ['TRIAL', 'ACTIVE'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });

    let created = 0;
    let skipped = 0;
    for (const supplier of suppliers) {
      const existing = await this.prisma.supplierInvoice.findUnique({
        where: {
          supplierId_periodStart: { supplierId: supplier.id, periodStart },
        },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const plan = supplier.subscriptions[0]?.plan;
      // Only a supplier on a MONTHLY plan owes a service fee this invoice --
      // an ANNUAL plan's fee was already paid upfront and doesn't repeat.
      const serviceFeeAmount =
        plan?.billingPeriod === 'MONTHLY' ? Number(plan.price) : 0;

      const paidOrders = await this.prisma.order.findMany({
        where: {
          supplierId: supplier.id,
          paidAt: { gte: periodStart, lt: periodEnd },
        },
        select: { commissionAmount: true },
      });
      const commissionAmount = paidOrders.reduce(
        (sum, o) => sum + Number(o.commissionAmount ?? 0),
        0,
      );

      const totalDue = serviceFeeAmount + commissionAmount;
      if (totalDue === 0) {
        // Nothing owed (no active paid plan, no sales that month) -- don't
        // clutter every supplier's statement history with $0 invoices.
        skipped++;
        continue;
      }

      await this.prisma.supplierInvoice.create({
        data: {
          supplierId: supplier.id,
          periodStart,
          periodEnd,
          serviceFeeAmount,
          commissionAmount,
          totalDue,
        },
      });
      created++;
    }

    await this.auditLog.record({
      actorUserId,
      action: 'SUPPLIER_INVOICES_GENERATED',
      resourceType: 'SupplierInvoice',
      resourceId: month,
      metadata: { month, created, skipped },
    });

    return { created, skipped };
  }

  async markPaid(actorUserId: string, id: string) {
    const invoice = await this.prisma.supplierInvoice.findUnique({
      where: { id },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');

    const updated = await this.prisma.supplierInvoice.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    await this.auditLog.record({
      actorUserId,
      action: 'SUPPLIER_INVOICE_MARKED_PAID',
      resourceType: 'SupplierInvoice',
      resourceId: id,
    });

    return updated;
  }
}
