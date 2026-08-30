import {
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
   * Registration only opens a supplier application (Section 3/4) — the
   * resulting SupplierVerification starts at SUBMITTED. Nothing here
   * grants selling access; only an admin approval action does that.
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
          verificationStatus: SupplierVerificationStatus.SUBMITTED,
          verifications: {
            create: {
              status: SupplierVerificationStatus.SUBMITTED,
              submittedAt: new Date(),
            },
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
      action: 'SUPPLIER_APPLICATION_SUBMITTED',
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
