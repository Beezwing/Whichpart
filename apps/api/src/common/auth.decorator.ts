import { UseGuards, applyDecorators } from '@nestjs/common';
import type { UserRole } from '@autoparts/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

/**
 * Requires a logged-in user, optionally restricted to specific roles.
 * @Auth() just requires authentication; @Auth('ADMIN', 'SUPER_ADMIN')
 * additionally requires one of those roles (Section 54).
 */
export const Auth = (...roles: UserRole[]) =>
  applyDecorators(Roles(...roles), UseGuards(JwtAuthGuard, RolesGuard));
