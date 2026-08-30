import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingPeriod,
  SupplierVerificationStatus,
  SubscriptionStatus,
} from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';

type Status = SupplierVerificationStatus;
type Action =
  | 'startReview'
  | 'approve'
  | 'reject'
  | 'requestInfo'
  | 'suspend'
  | 'reactivate';

const TRANSITIONS: Record<Action, Status[]> = {
  startReview: [
    SupplierVerificationStatus.SUBMITTED,
    SupplierVerificationStatus.ADDITIONAL_INFO_REQUIRED,
  ],
  approve: [
    SupplierVerificationStatus.SUBMITTED,
    SupplierVerificationStatus.UNDER_REVIEW,
    SupplierVerificationStatus.ADDITIONAL_INFO_REQUIRED,
  ],
  reject: [
    SupplierVerificationStatus.SUBMITTED,
    SupplierVerificationStatus.UNDER_REVIEW,
    SupplierVerificationStatus.ADDITIONAL_INFO_REQUIRED,
  ],
  requestInfo: [
    SupplierVerificationStatus.SUBMITTED,
    SupplierVerificationStatus.UNDER_REVIEW,
  ],
  suspend: [SupplierVerificationStatus.APPROVED],
  reactivate: [SupplierVerificationStatus.SUSPENDED],
};

const RESULT_STATUS: Record<keyof typeof TRANSITIONS, Status> = {
  startReview: SupplierVerificationStatus.UNDER_REVIEW,
  approve: SupplierVerificationStatus.APPROVED,
  reject: SupplierVerificationStatus.REJECTED,
  requestInfo: SupplierVerificationStatus.ADDITIONAL_INFO_REQUIRED,
  suspend: SupplierVerificationStatus.SUSPENDED,
  reactivate: SupplierVerificationStatus.APPROVED,
};

@Injectable()
export class AdminSuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(status: string | undefined, page: number, pageSize: number) {
    const where = status ? { verificationStatus: status as Status } : {};
    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tradingName: true,
          legalBusinessName: true,
          verificationStatus: true,
          createdAt: true,
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getDetail(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        verifications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { documents: true },
        },
        locations: true,
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');

    const history = await this.prisma.auditLog.findMany({
      where: { resourceType: 'Supplier', resourceId: id },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { email: true } } },
    });

    return { supplier, history };
  }

  private async transition(
    action: Action,
    supplierId: string,
    adminUserId: string,
    metadata?: { reason?: string; message?: string },
  ) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      include: {
        verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
        users: true,
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');

    const verification = supplier.verifications[0];
    const allowedFrom = TRANSITIONS[action];
    if (!verification || !allowedFrom.includes(verification.status)) {
      throw new BadRequestException(
        `Cannot ${action} a supplier from status "${verification?.status ?? 'unknown'}".`,
      );
    }

    const newStatus = RESULT_STATUS[action];
    await this.prisma.$transaction([
      this.prisma.supplierVerification.update({
        where: { id: verification.id },
        data: { status: newStatus },
      }),
      this.prisma.supplier.update({
        where: { id: supplierId },
        data: { verificationStatus: newStatus },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: adminUserId,
      action: `SUPPLIER_${action.replace(/([A-Z])/g, '_$1').toUpperCase()}`,
      resourceType: 'Supplier',
      resourceId: supplierId,
      metadata: metadata,
    });

    await this.prisma.notification.createMany({
      data: supplier.users.map((su) => ({
        userId: su.userId,
        type: `SUPPLIER_${newStatus}`,
        title: this.notificationTitle(action),
        body:
          metadata?.reason ??
          metadata?.message ??
          this.notificationTitle(action),
      })),
    });

    if (action === 'approve') await this.ensureTrialSubscription(supplierId);

    return { id: supplierId, verificationStatus: newStatus };
  }

  /**
   * First-ever approval starts the 30-day trial (Section 58). A supplier
   * suspended and later reactivated already has a subscription record, so
   * this only ever runs once per supplier.
   */
  private async ensureTrialSubscription(supplierId: string) {
    const existing = await this.prisma.subscription.findFirst({
      where: { supplierId },
    });
    if (existing) return;

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { billingPeriod: BillingPeriod.MONTHLY, isActive: true },
    });
    if (!plan) return; // No plans configured yet — admin needs to set pricing first.

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays);

    await this.prisma.subscription.create({
      data: {
        supplierId,
        planId: plan.id,
        status: SubscriptionStatus.TRIAL,
        trialEndsAt,
      },
    });
  }

  private notificationTitle(action: Action): string {
    switch (action) {
      case 'approve':
        return 'Your supplier application was approved';
      case 'reject':
        return 'Your supplier application was not approved';
      case 'requestInfo':
        return 'More information is needed on your application';
      case 'suspend':
        return 'Your supplier account has been suspended';
      case 'reactivate':
        return 'Your supplier account has been reactivated';
      case 'startReview':
        return 'Your application is now under review';
    }
  }

  startReview(id: string, adminUserId: string) {
    return this.transition('startReview', id, adminUserId);
  }

  approve(id: string, adminUserId: string) {
    return this.transition('approve', id, adminUserId);
  }

  reject(id: string, adminUserId: string, reason: string) {
    return this.transition('reject', id, adminUserId, { reason });
  }

  requestInfo(id: string, adminUserId: string, message: string) {
    return this.transition('requestInfo', id, adminUserId, { message });
  }

  suspend(id: string, adminUserId: string, reason: string) {
    return this.transition('suspend', id, adminUserId, { reason });
  }

  reactivate(id: string, adminUserId: string) {
    return this.transition('reactivate', id, adminUserId);
  }

  async addNote(id: string, adminUserId: string, note: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Supplier not found.');

    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'INTERNAL_NOTE_ADDED',
      resourceType: 'Supplier',
      resourceId: id,
      metadata: { note },
    });
    return { success: true };
  }
}
