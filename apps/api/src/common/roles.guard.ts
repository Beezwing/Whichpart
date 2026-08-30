import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@autoparts/shared';
import type { AuthenticatedUser } from './current-user.decorator';
import { ROLES_KEY } from './roles.decorator';

/**
 * Runs after JwtAuthGuard. Denies by default: a route with no @Roles()
 * decorator is only reachable by an authenticated user, and a route WITH
 * @Roles() is reachable only by those exact roles (Section 54).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    return Boolean(user && requiredRoles.includes(user.role as UserRole));
  }
}
