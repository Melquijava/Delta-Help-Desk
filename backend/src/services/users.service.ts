import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { UserStatus } from '../types/domain.js';

const userInclude = {
  roles: {
    where: {
      deletedAt: null
    },
    include: {
      role: true
    }
  }
} as const;

export type UserListFilters = {
  q?: string;
  status?: UserStatus;
  role?: string;
};

export type UserCreateInput = {
  name: string;
  email: string;
  phone?: string | null;
  registration?: string | null;
  password: string;
  status: UserStatus;
  notes?: string | null;
  roleIds: string[];
};

export type UserUpdateInput = Omit<UserCreateInput, 'password' | 'roleIds'> & {
  password?: string;
  roleIds?: string[];
};

export class UserModuleError extends Error {
  constructor(
    public readonly code:
      | 'USER_NOT_FOUND'
      | 'EMAIL_IN_USE'
      | 'REGISTRATION_IN_USE'
      | 'LAST_ACTIVE_ADMIN'
      | 'SELF_ADMIN_REMOVAL'
      | 'ROLE_NOT_FOUND'
  ) {
    super(code);
  }
}

type UserWithRoles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function sanitizeUser(user: UserWithRoles) {
  const roles = user.roles.map((userRole) => userRole.role);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    registration: user.registration,
    status: user.status,
    notes: user.notes,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt,
    roles
  };
}

async function activeAdminCount(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      id: excludeUserId ? { not: excludeUserId } : undefined,
      status: 'ACTIVE',
      deletedAt: null,
      roles: {
        some: {
          deletedAt: null,
          role: {
            slug: 'admin',
            status: 'ACTIVE',
            deletedAt: null
          }
        }
      }
    }
  });
}

async function assertCanRemoveActiveAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userInclude
  });

  if (!user || user.deletedAt) {
    throw new UserModuleError('USER_NOT_FOUND');
  }

  const isActiveAdmin =
    user.status === 'ACTIVE' && user.roles.some((userRole) => userRole.role.slug === 'admin');

  if (isActiveAdmin && (await activeAdminCount(userId)) === 0) {
    throw new UserModuleError('LAST_ACTIVE_ADMIN');
  }
}

async function assertRolesExist(roleIds: string[]) {
  const roles = await prisma.role.findMany({
    where: {
      id: { in: roleIds },
      deletedAt: null
    }
  });

  if (roles.length !== roleIds.length) {
    throw new UserModuleError('ROLE_NOT_FOUND');
  }

  return roles;
}

async function setUserRoles(userId: string, roleIds: string[]) {
  await assertRolesExist(roleIds);

  await prisma.$transaction([
    prisma.userRole.deleteMany({
      where: { userId }
    }),
    ...roleIds.map((roleId) =>
      prisma.userRole.create({
        data: {
          userId,
          roleId
        }
      })
    )
  ]);
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listUsers(filters: UserListFilters, page: number, pageSize: number) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    status: filters.status,
    roles: filters.role
      ? {
          some: {
            deletedAt: null,
            role: {
              slug: filters.role,
              deletedAt: null
            }
          }
        }
      : undefined
  };

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { email: { contains: filters.q } },
      { phone: { contains: filters.q } },
      { registration: { contains: filters.q } }
    ];
  }

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: userInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    data: users.map(sanitizeUser),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: userInclude
  });

  if (!user) {
    throw new UserModuleError('USER_NOT_FOUND');
  }

  return sanitizeUser(user);
}

export async function createUser(input: UserCreateInput) {
  await assertRolesExist(input.roleIds);

  try {
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        phone: normalizeOptional(input.phone),
        registration: normalizeOptional(input.registration),
        passwordHash,
        status: input.status,
        notes: normalizeOptional(input.notes),
        roles: {
          create: input.roleIds.map((roleId) => ({ roleId }))
        }
      },
      include: userInclude
    });

    return sanitizeUser(user);
  } catch (error) {
    handlePrismaUserError(error);
  }
}

export async function updateUser(id: string, input: UserUpdateInput, actorId: string) {
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: userInclude
  });

  if (!existing) {
    throw new UserModuleError('USER_NOT_FOUND');
  }

  if (input.status === 'INACTIVE') {
    await assertCanRemoveActiveAdmin(id);
  }

  if (input.roleIds) {
    await assertRoleChangeAllowed(id, actorId, input.roleIds);
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        phone: normalizeOptional(input.phone),
        registration: normalizeOptional(input.registration),
        status: input.status,
        notes: normalizeOptional(input.notes),
        passwordHash: input.password ? await bcrypt.hash(input.password, 12) : undefined
      },
      include: userInclude
    });

    if (input.roleIds) {
      await setUserRoles(id, input.roleIds);
    }

    return getUserById(updated.id);
  } catch (error) {
    handlePrismaUserError(error);
  }
}

export async function updateUserStatus(id: string, status: UserStatus) {
  const existing = await prisma.user.findFirst({
    where: { id, deletedAt: null }
  });

  if (!existing) {
    throw new UserModuleError('USER_NOT_FOUND');
  }

  if (status === 'INACTIVE') {
    await assertCanRemoveActiveAdmin(id);
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { status },
      include: userInclude
    });

    return sanitizeUser(user);
  } catch (error) {
    handlePrismaUserError(error);
  }
}

async function assertRoleChangeAllowed(id: string, actorId: string, roleIds: string[]) {
  const roles = await assertRolesExist(roleIds);
  const keepsAdmin = roles.some((role) => role.slug === 'admin');
  const current = await getUserById(id);
  const isAdminNow = current.roles.some((role) => role.slug === 'admin');

  if (isAdminNow && !keepsAdmin && (await activeAdminCount(id)) === 0) {
    throw new UserModuleError('LAST_ACTIVE_ADMIN');
  }

  if (id === actorId && isAdminNow && !keepsAdmin && (await activeAdminCount(id)) === 0) {
    throw new UserModuleError('SELF_ADMIN_REMOVAL');
  }
}

export async function updateUserRoles(id: string, roleIds: string[], actorId: string) {
  await assertRoleChangeAllowed(id, actorId, roleIds);
  await setUserRoles(id, roleIds);
  return getUserById(id);
}

export async function deleteUser(id: string) {
  await assertCanRemoveActiveAdmin(id);

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        deletedAt: new Date()
      },
      include: userInclude
    });

    return sanitizeUser(user);
  } catch (error) {
    handlePrismaUserError(error);
  }
}

export async function listRoles() {
  return prisma.role.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    orderBy: { name: 'asc' }
  });
}

function handlePrismaUserError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : '';

      if (target.includes('email')) {
        throw new UserModuleError('EMAIL_IN_USE');
      }

      if (target.includes('registration')) {
        throw new UserModuleError('REGISTRATION_IN_USE');
      }
    }

    if (error.code === 'P2025') {
      throw new UserModuleError('USER_NOT_FOUND');
    }
  }

  throw error;
}
