import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface RecordAuditEntryInput {
  actorUserId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/**
 * The only way anything in the API should write to audit_logs (Section 55).
 * Rows are append-only — nothing here ever updates or deletes an entry.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: RecordAuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
      },
    });
  }
}
