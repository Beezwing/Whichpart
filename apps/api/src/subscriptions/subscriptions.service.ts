import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminUpdatePlanInput } from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Public — a supplier must be able to see current pricing before choosing a plan. */
  listActivePlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  listAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async updatePlan(
    id: string,
    adminUserId: string,
    input: AdminUpdatePlanInput,
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!plan) throw new NotFoundException('Plan not found.');

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        price: input.price,
        currency: input.currency,
        commissionRate: input.commissionRate,
        trialDays: input.trialDays,
        isActive: input.isActive,
      },
    });

    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'SUBSCRIPTION_PLAN_UPDATED',
      resourceType: 'SubscriptionPlan',
      resourceId: id,
      metadata: {
        price: input.price,
        currency: input.currency,
        commissionRate: input.commissionRate,
        trialDays: input.trialDays,
        isActive: input.isActive,
      },
    });

    return updated;
  }
}
