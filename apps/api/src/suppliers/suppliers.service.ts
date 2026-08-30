import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SupplierVerificationStatus,
  UserRole,
  documentTypes,
} from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';
import { StorageService } from '../storage/storage.service';
import type { AuthenticatedUser } from '../common/current-user.decorator';

const SUBMITTABLE_STATUSES: string[] = [
  SupplierVerificationStatus.DRAFT,
  SupplierVerificationStatus.ADDITIONAL_INFO_REQUIRED,
];

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly storage: StorageService,
  ) {}

  private async requireOwnSupplier(userId: string) {
    const supplierUser = await this.prisma.supplierUser.findFirst({
      where: { userId },
      include: {
        supplier: {
          include: {
            verifications: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { documents: true },
            },
          },
        },
      },
    });
    if (!supplierUser)
      throw new NotFoundException('No supplier account found for this user.');
    return supplierUser.supplier;
  }

  async getMySupplier(userId: string) {
    const supplier = await this.requireOwnSupplier(userId);
    const verification = supplier.verifications[0];
    return {
      id: supplier.id,
      tradingName: supplier.tradingName,
      legalBusinessName: supplier.legalBusinessName,
      verificationStatus: supplier.verificationStatus,
      verification: verification
        ? {
            id: verification.id,
            status: verification.status,
            submittedAt: verification.submittedAt,
            documents: verification.documents.map((doc) => ({
              id: doc.id,
              documentType: doc.documentType,
              uploadedAt: doc.uploadedAt,
            })),
          }
        : null,
    };
  }

  async addDocument(
    userId: string,
    documentType: string,
    file: { buffer: Buffer; originalname: string },
  ) {
    const supplier = await this.requireOwnSupplier(userId);
    const verification = supplier.verifications[0];
    if (!verification || !SUBMITTABLE_STATUSES.includes(verification.status)) {
      throw new BadRequestException(
        'Documents can only be added while your application is in draft or needs more information.',
      );
    }

    const key = await this.storage.save(file.buffer, file.originalname);
    return this.prisma.supplierDocument.create({
      data: { verificationId: verification.id, documentType, fileUrl: key },
    });
  }

  async deleteDocument(userId: string, documentId: string) {
    const supplier = await this.requireOwnSupplier(userId);
    const verification = supplier.verifications[0];
    const document = verification?.documents.find(
      (doc) => doc.id === documentId,
    );
    if (!document) throw new NotFoundException('Document not found.');

    await this.storage.delete(document.fileUrl);
    await this.prisma.supplierDocument.delete({ where: { id: documentId } });
  }

  async submitApplication(userId: string) {
    const supplier = await this.requireOwnSupplier(userId);
    const verification = supplier.verifications[0];
    if (!verification || !SUBMITTABLE_STATUSES.includes(verification.status)) {
      throw new BadRequestException(
        'Your application has already been submitted.',
      );
    }

    const hasBusinessRegistration = verification.documents.some(
      (doc) => doc.documentType === documentTypes[0],
    );
    if (!hasBusinessRegistration) {
      throw new BadRequestException(
        'Please upload proof of business registration before submitting.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.supplierVerification.update({
        where: { id: verification.id },
        data: {
          status: SupplierVerificationStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      }),
      this.prisma.supplier.update({
        where: { id: supplier.id },
        data: { verificationStatus: SupplierVerificationStatus.SUBMITTED },
      }),
    ]);

    await this.auditLog.record({
      actorUserId: userId,
      action: 'SUPPLIER_APPLICATION_SUBMITTED',
      resourceType: 'Supplier',
      resourceId: supplier.id,
    });

    const admins = await this.prisma.user.findMany({
      where: { role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } },
      select: { id: true },
    });
    await this.prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'SUPPLIER_APPLICATION_SUBMITTED',
        title: 'New supplier application',
        body: `${supplier.tradingName} submitted their application for review.`,
      })),
    });
  }

  /** Any authenticated request for a document's bytes goes through here. */
  async getDocumentFile(documentId: string, requester: AuthenticatedUser) {
    const document = await this.prisma.supplierDocument.findUnique({
      where: { id: documentId },
      include: {
        verification: { include: { supplier: { include: { users: true } } } },
      },
    });
    if (!document) throw new NotFoundException('Document not found.');

    const isAdmin =
      requester.role === UserRole.ADMIN ||
      requester.role === UserRole.SUPER_ADMIN;
    const isOwner = document.verification.supplier.users.some(
      (u) => u.userId === requester.id,
    );
    if (!isAdmin && !isOwner) throw new ForbiddenException();

    const buffer = await this.storage.read(document.fileUrl);
    return { buffer, documentType: document.documentType };
  }
}
