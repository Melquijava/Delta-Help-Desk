import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AccessTokenPayload, AuthenticatedUser } from '../types/auth.js';
import { createOpaqueToken, hashToken } from '../utils/token.js';
import { defaultSettings, getSettings } from './settings.service.js';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USER_INACTIVE'
  | 'INVALID_REFRESH_TOKEN'
  | 'USER_NOT_FOUND';

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
  }
}

export type LoginUser = AuthenticatedUser & {
  passwordHash: string;
  deletedAt?: Date | null;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  deletedAt?: Date | null;
  user: LoginUser;
};

export type AuthRepository = {
  findUserByEmail(email: string): Promise<LoginUser | null>;
  findUserById(id: string): Promise<AuthenticatedUser | null>;
  createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revokeRefreshToken(id: string): Promise<void>;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

function sanitizeUser(user: LoginUser): AuthenticatedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    roles: user.roles,
    permissions: user.permissions
  };
}

export function signAccessToken(user: AuthenticatedUser, expiresIn = env.ACCESS_TOKEN_EXPIRES_IN) {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    permissions: user.permissions
  };

  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn']
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

function getRefreshTokenExpiration() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);
  return expiresAt;
}

async function issueTokens(repository: AuthRepository, user: AuthenticatedUser): Promise<TokenPair> {
  const settings = await getSettings().catch(() => defaultSettings);
  const accessToken = signAccessToken(user, `${settings.sessionTimeoutMinutes}m`);
  const refreshToken = createOpaqueToken();

  await repository.createRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: getRefreshTokenExpiration()
  });

  return { accessToken, refreshToken };
}

export async function login(repository: AuthRepository, email: string, password: string) {
  const user = await repository.findUserByEmail(email.toLowerCase().trim());

  if (!user || user.deletedAt) {
    throw new AuthError('INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    throw new AuthError('USER_INACTIVE');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AuthError('INVALID_CREDENTIALS');
  }

  const safeUser = sanitizeUser(user);
  const tokens = await issueTokens(repository, safeUser);

  return {
    user: safeUser,
    ...tokens
  };
}

export async function refreshSession(repository: AuthRepository, refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  const storedToken = await repository.findRefreshToken(tokenHash);

  if (
    !storedToken ||
    storedToken.deletedAt ||
    storedToken.revokedAt ||
    storedToken.expiresAt.getTime() <= Date.now()
  ) {
    throw new AuthError('INVALID_REFRESH_TOKEN');
  }

  if (storedToken.user.deletedAt) {
    throw new AuthError('USER_NOT_FOUND');
  }

  if (storedToken.user.status !== 'ACTIVE') {
    throw new AuthError('USER_INACTIVE');
  }

  await repository.revokeRefreshToken(storedToken.id);

  const safeUser = sanitizeUser(storedToken.user);
  const tokens = await issueTokens(repository, safeUser);

  return {
    user: safeUser,
    ...tokens
  };
}

export async function logout(repository: AuthRepository, refreshToken?: string) {
  if (!refreshToken) {
    return;
  }

  const storedToken = await repository.findRefreshToken(hashToken(refreshToken));

  if (storedToken && !storedToken.revokedAt) {
    await repository.revokeRefreshToken(storedToken.id);
  }
}
