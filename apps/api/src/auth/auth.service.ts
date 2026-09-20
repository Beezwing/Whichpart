import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import {
  SupplierVerificationStatus,
  UserRole,
  type LoginInput,
  type RegisterCustomerInput,
  type RegisterSupplierInput,
} from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  async registerCustomer(input: RegisterCustomerInput) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existing)
      throw new ConflictException('An account with this email already exists.');

    const passwordHash = await argon2.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: UserRole.CUSTOMER,
        customer: { create: { name: input.name, phone: input.phone } },
      },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  /**
   * Registration only opens a supplier APPLICATION — it starts at DRAFT
   * and grants no selling access (Section 3/4, Rule 9). The owner uploads
   * documents and calls submitApplication() when ready; only an admin
   * approval action after that ever flips verificationStatus to APPROVED.
   */
  async registerSupplier(
    input: RegisterSupplierInput,
    ownerEmail: string,
    ownerPassword: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
    });
    if (existing)
      throw new ConflictException('An account with this email already exists.');

    const passwordHash = await argon2.hash(ownerPassword);

    const user = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          legalBusinessName: input.legalBusinessName,
          tradingName: input.tradingName,
          businessType: input.businessType,
          businessRegistrationNumber: input.businessRegistrationNumber,
          physicalAddress: input.physicalAddress,
          phone: input.phone,
          email: input.email,
          website: input.website,
          authorizedRepresentativeName: input.authorizedRepresentativeName,
          verificationStatus: SupplierVerificationStatus.DRAFT,
          verifications: {
            create: { status: SupplierVerificationStatus.DRAFT },
          },
        },
      });

      const createdUser = await tx.user.create({
        data: {
          email: ownerEmail,
          passwordHash,
          role: UserRole.SUPPLIER_OWNER,
          supplierUsers: { create: { supplierId: supplier.id } },
        },
      });

      return createdUser;
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'SUPPLIER_APPLICATION_STARTED',
      resourceType: 'Supplier',
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Invalid email or password.');

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      input.password,
    );
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid email or password.');

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken)
      throw new UnauthorizedException('No refresh token provided.');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive)
      throw new UnauthorizedException('Account no longer active.');

    return this.issueTokens(user.id, user.email, user.role);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        customer: true,
        supplierUsers: { include: { supplier: true } },
      },
    });
    if (!user) throw new UnauthorizedException('Account no longer active.');

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      toursSeen: user.toursSeen,
      customer: user.customer
        ? { name: user.customer.name, phone: user.customer.phone }
        : null,
      supplier: user.supplierUsers[0]?.supplier
        ? {
            id: user.supplierUsers[0].supplier.id,
            tradingName: user.supplierUsers[0].supplier.tradingName,
            verificationStatus:
              user.supplierUsers[0].supplier.verificationStatus,
          }
        : null,
    };
  }

  /**
   * Idempotent by design -- the tour UI calls this once on finish/skip,
   * but a double-click or retry should never duplicate the id.
   */
  async markTourSeen(userId: string, tourId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { toursSeen: true },
    });
    if (!user.toursSeen.includes(tourId)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { toursSeen: { set: [...user.toursSeen, tourId] } },
      });
    }
    return {
      toursSeen: user.toursSeen.includes(tourId)
        ? user.toursSeen
        : [...user.toursSeen, tourId],
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const matches = await argon2.verify(user.passwordHash, currentPassword);
    if (!matches)
      throw new BadRequestException('Current password is incorrect.');

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.auditLog.record({
      actorUserId: userId,
      action: 'PASSWORD_CHANGED',
      resourceType: 'User',
      resourceId: userId,
    });
  }

  private async issueTokens(sub: string, email: string, role: string) {
    const payload = { sub, email, role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_TTL',
        '15m',
      ) as JwtSignOptions['expiresIn'],
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_TTL',
        '30d',
      ) as JwtSignOptions['expiresIn'],
    });
    return { accessToken, refreshToken, user: { id: sub, email, role } };
  }
}
