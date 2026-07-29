import { prisma } from '../lib/prisma.js';
import type { AuthRepository } from '../services/auth.service.js';
import { toAuthenticatedUser } from '../utils/auth-user.js';

const userInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  }
} as const;

function toLoginUser(
  user: Awaited<ReturnType<typeof prisma.user.findUnique<{ where: { email: string }; include: typeof userInclude }>>>
) {
  if (!user) {
    return null;
  }

  return {
    ...toAuthenticatedUser(user),
    passwordHash: user.passwordHash,
    deletedAt: user.deletedAt
  };
}

export const authRepository: AuthRepository = {
  async findUserByEmail(email) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: userInclude
    });

    return toLoginUser(user);
  },

  async findUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: userInclude
    });

    if (!user || user.deletedAt) {
      return null;
    }

    return toAuthenticatedUser(user);
  },

  async createRefreshToken(input) {
    await prisma.refreshToken.create({
      data: input
    });
  },

  async findRefreshToken(tokenHash) {
    const token = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: userInclude
        }
      }
    });

    if (!token) {
      return null;
    }

    return {
      id: token.id,
      userId: token.userId,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      deletedAt: token.deletedAt,
      user: {
        ...toAuthenticatedUser(token.user),
        passwordHash: token.user.passwordHash,
        deletedAt: token.user.deletedAt
      }
    };
  },

  async revokeRefreshToken(id) {
    await prisma.refreshToken.update({
      where: { id },
      data: {
        revokedAt: new Date()
      }
    });
  }
};
