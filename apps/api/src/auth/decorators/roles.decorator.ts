import { SetMetadata } from '@nestjs/common';
import { OrgRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles are allowed to access a route.
 * Used in conjunction with RolesGuard.
 * 
 * @example
 * @Roles(OrgRole.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async adminOnlyRoute() {}
 * 
 * @example
 * @Roles(OrgRole.ADMIN, OrgRole.MEMBER)
 * async adminOrMemberRoute() {}
 */
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
