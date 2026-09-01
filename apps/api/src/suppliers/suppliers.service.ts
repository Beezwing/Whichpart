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
  type ChoosePlanInput,
  type PaymentAccountInput,
  type SupplierLocationInput,
  type UpdateSupplierProfileInput,
} from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';
import { CryptoService } from '../common/crypto.service';
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
    private readonly crypto: CryptoService,
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

  private async requireSupplierId(userId: string): Promise<string> {
    const supplierUser = await this.prisma.supplierUser.findFirst({
      where: { userId },
      select: { supplierId: true },
    });
    if (!supplierUser)
      throw new NotFoundException('No supplier account found for this user.');
    return supplierUser.supplierId;
  }

  async getMySupplier(userId: string) {
    const supplier = await this.requireOwnSupplier(userId);
    const verification = supplier.verifications[0];
    return {
      id: supplier.id,
      tradingName: supplier.tradingName,
      legalBusinessName: supplier.legalBusinessName,
      phone: supplier.phone,
      website: supplier.website,
      physicalAddress: supplier.physicalAddress,
      description: supplier.description,
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

  // ---------- Business profile ----------

  async updateProfile(userId: string, input: UpdateSupplierProfileInput) {
    const supplierId = await this.requireSupplierId(userId);
    const supplier = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        tradingName: input.tradingName,
        phone: input.phone,
        website: input.website || null,
        physicalAddress: input.physicalAddress,
        description: input.description,
      },
    });
    await this.auditLog.record({
      actorUserId: userId,
      action: 'SUPPLIER_PROFILE_UPDATED',
      resourceType: 'Supplier',
      resourceId: supplierId,
    });
    return supplier;
  }

  // ---------- Locations (Section 41) ----------

  async listLocations(userId: string) {
    const supplierId = await this.requireSupplierId(userId);
    return this.prisma.supplierLocation.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createLocation(userId: string, input: SupplierLocationInput) {
    const supplierId = await this.requireSupplierId(userId);
    return this.prisma.supplierLocation.create({
      data: {
        supplierId,
        name: input.name,
        address: input.address,
        phone: input.phone,
        latitude: input.latitude,
        longitude: input.longitude,
        openingHours: input.openingHours,
        pickupAvailable: input.pickupAvailable,
        deliveryAvailable: input.deliveryAvailable,
        deliveryZones: input.deliveryZones,
      },
    });
  }

  private async requireOwnLocation(userId: string, locationId: string) {
    const supplierId = await this.requireSupplierId(userId);
    const location = await this.prisma.supplierLocation.findFirst({
      where: { id: locationId, supplierId },
    });
    if (!location) throw new NotFoundException('Location not found.');
    return location;
  }

  async updateLocation(
    userId: string,
    locationId: string,
    input: SupplierLocationInput,
  ) {
    await this.requireOwnLocation(userId, locationId);
    return this.prisma.supplierLocation.update({
      where: { id: locationId },
      data: {
        name: input.name,
        address: input.address,
        phone: input.phone,
        latitude: input.latitude,
        longitude: input.longitude,
        openingHours: input.openingHours,
        pickupAvailable: input.pickupAvailable,
        deliveryAvailable: input.deliveryAvailable,
        deliveryZones: input.deliveryZones,
      },
    });
  }

  async deleteLocation(userId: string, locationId: string) {
    await this.requireOwnLocation(userId, locationId);
    const inventoryCount = await this.prisma.inventoryLocation.count({
      where: { locationId },
    });
    if (inventoryCount > 0) {
      throw new BadRequestException(
        'This location still has inventory assigned to it — move or remove those products first.',
      );
    }
    await this.prisma.supplierLocation.delete({ where: { id: locationId } });
  }

  // ---------- Subscription (Section 58) ----------

  async getSubscription(userId: string) {
    const supplierId = await this.requireSupplierId(userId);
    return this.prisma.subscription.findFirst({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }

  async choosePlan(userId: string, input: ChoosePlanInput) {
    const supplierId = await this.requireSupplierId(userId);
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: input.planId, isActive: true },
    });
    if (!plan) throw new BadRequestException('That plan is not available.');

    const existing = await this.prisma.subscription.findFirst({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) {
      throw new BadRequestException(
        'Your subscription starts automatically once your application is approved.',
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id: existing.id },
      data: { planId: plan.id },
      include: { plan: true },
    });
    await this.auditLog.record({
      actorUserId: userId,
      action: 'SUPPLIER_PLAN_CHANGED',
      resourceType: 'Subscription',
      resourceId: existing.id,
      metadata: { planName: plan.name },
    });
    return updated;
  }

  // ---------- Payment connection (Section 27) ----------
  // The marketplace never holds supplier sale funds (Rule 1): the supplier
  // connects their OWN LuniPay/Fygaro/DimePay account. We can't verify
  // these credentials against any provider's live API yet — that
  // integration is still pending a few confirmed details (refund
  // endpoints, exact fees) from each provider. Status here is
  // self-attested until Phase 7.

  async getPaymentAccount(userId: string) {
    const supplierId = await this.requireSupplierId(userId);
    const account = await this.prisma.supplierPaymentAccount.findUnique({
      where: { supplierId },
    });
    if (!account) return null;
    return {
      provider: account.provider,
      status: account.status,
      publicIdentifier: account.publicIdentifier,
      maskedApiKey: account.encryptedApiKey
        ? CryptoService.mask(this.crypto.decrypt(account.encryptedApiKey))
        : null,
      connectedAt: account.connectedAt,
    };
  }

  async updatePaymentAccount(userId: string, input: PaymentAccountInput) {
    const supplierId = await this.requireSupplierId(userId);
    const encryptedApiKey = this.crypto.encrypt(input.apiKey);

    await this.prisma.supplierPaymentAccount.upsert({
      where: { supplierId },
      create: {
        supplierId,
        provider: input.provider,
        publicIdentifier: input.publicIdentifier,
        encryptedApiKey,
        status: 'CONNECTED',
        connectedAt: new Date(),
      },
      update: {
        provider: input.provider,
        publicIdentifier: input.publicIdentifier,
        encryptedApiKey,
        status: 'CONNECTED',
        connectedAt: new Date(),
      },
    });

    await this.auditLog.record({
      actorUserId: userId,
      action: 'SUPPLIER_PAYMENT_CONNECTED',
      resourceType: 'Supplier',
      resourceId: supplierId,
      metadata: { provider: input.provider },
    });

    return this.getPaymentAccount(userId);
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
