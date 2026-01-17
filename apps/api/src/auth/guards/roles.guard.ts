import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PrismaService } from '../../prisma';

/**
 * Guard that checks if the user has the required role in the organization.
 * 
 * Prerequisites:
 * - Must be used after JwtAuthGuard (user must be authenticated)
 * - Route must have :orgId parameter
 * - Route must be decorated with @Roles() decorator
 * 
 * @example
 * @Roles(OrgRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Post(':orgId/something')
 * async adminOnlyAction() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.params.orgId;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!orgId) {
      throw new ForbiddenException('Organization ID is required');
    }

    // Check user's membership and role in the org
    const membership = await this.prisma.orgMember.findUnique({
      where: {
        orgId_userId: { orgId, userId: user.id },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // Check if user's role is in the required roles
    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `This action requires one of these roles: ${requiredRoles.join(', ')}`,
      );
    }

    // Attach membership to request for later use
    request.orgMembership = membership;

    return true;
  }
}
