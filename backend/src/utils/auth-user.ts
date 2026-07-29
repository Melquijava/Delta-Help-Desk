import type { AuthenticatedUser } from '../types/auth.js';
import type { UserStatus } from '../types/domain.js';

type UserWithRoles = {
  id: string;
  name: string;
  email: string;
  status: string;
  roles: Array<{
    deletedAt: Date | null;
    role: {
      slug: string;
      status: string;
      deletedAt: Date | null;
      permissions: Array<{
        deletedAt: Date | null;
        permission: {
          key: string;
          deletedAt: Date | null;
        };
      }>;
    };
  }>;
};

export function toAuthenticatedUser(user: UserWithRoles): AuthenticatedUser {
  const activeRoles = user.roles.filter(
    (userRole) =>
      !userRole.deletedAt &&
      userRole.role.status === 'ACTIVE' &&
      !userRole.role.deletedAt
  );

  const roles = activeRoles.map((userRole) => userRole.role.slug);
  const permissions = Array.from(
    new Set(
      activeRoles.flatMap((userRole) =>
        userRole.role.permissions
          .filter((rolePermission) => !rolePermission.deletedAt && !rolePermission.permission.deletedAt)
          .map((rolePermission) => rolePermission.permission.key)
      )
    )
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status as UserStatus,
    roles,
    permissions
  };
}
