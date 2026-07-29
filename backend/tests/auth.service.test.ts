import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authorize } from '../src/middlewares/authorize.middleware.js';
import { authenticate } from '../src/middlewares/auth.middleware.js';
import {
  AuthError,
  type AuthRepository,
  type LoginUser,
  type RefreshTokenRecord,
  login,
  refreshSession,
  signAccessToken
} from '../src/services/auth.service.js';
import type { AuthenticatedUser } from '../src/types/auth.js';
import { hashToken } from '../src/utils/token.js';

function createUser(overrides: Partial<LoginUser> = {}): LoginUser {
  return {
    id: 'user-1',
    name: 'Atendente Teste',
    email: 'atendente@deltahelpdesk.local',
    passwordHash: '',
    status: 'ACTIVE',
    roles: ['attendant'],
    permissions: ['procedures.search'],
    deletedAt: null,
    ...overrides
  };
}

function createRepository(user: LoginUser): AuthRepository {
  const refreshTokens = new Map<string, RefreshTokenRecord>();

  return {
    async findUserByEmail(email) {
      return email === user.email ? user : null;
    },

    async findUserById(id) {
      if (id !== user.id || user.deletedAt) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        roles: user.roles,
        permissions: user.permissions
      };
    },

    async createRefreshToken(input) {
      refreshTokens.set(input.tokenHash, {
        id: `token-${refreshTokens.size + 1}`,
        userId: input.userId,
        expiresAt: input.expiresAt,
        revokedAt: null,
        deletedAt: null,
        user
      });
    },

    async findRefreshToken(tokenHash) {
      return refreshTokens.get(tokenHash) ?? null;
    },

    async revokeRefreshToken(id) {
      for (const [key, token] of refreshTokens.entries()) {
        if (token.id === id) {
          refreshTokens.set(key, { ...token, revokedAt: new Date() });
        }
      }
    }
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
}

test('login valido retorna usuario sem passwordHash e tokens', async () => {
  const user = createUser({
    passwordHash: await bcrypt.hash('senha-correta', 4)
  });
  const repository = createRepository(user);

  const session = await login(repository, user.email, 'senha-correta');

  assert.equal(session.user.email, user.email);
  assert.equal('passwordHash' in session.user, false);
  assert.equal(typeof session.accessToken, 'string');
  assert.equal(typeof session.refreshToken, 'string');
});

test('senha invalida bloqueia login', async () => {
  const user = createUser({
    passwordHash: await bcrypt.hash('senha-correta', 4)
  });
  const repository = createRepository(user);

  await assert.rejects(() => login(repository, user.email, 'senha-errada'), (error) => {
    assert.ok(error instanceof AuthError);
    assert.equal(error.code, 'INVALID_CREDENTIALS');
    return true;
  });
});

test('usuario inativo bloqueia login', async () => {
  const user = createUser({
    status: 'INACTIVE',
    passwordHash: await bcrypt.hash('senha-correta', 4)
  });
  const repository = createRepository(user);

  await assert.rejects(() => login(repository, user.email, 'senha-correta'), (error) => {
    assert.ok(error instanceof AuthError);
    assert.equal(error.code, 'USER_INACTIVE');
    return true;
  });
});

test('refresh token renova sessao e revoga token anterior', async () => {
  const user = createUser({
    passwordHash: await bcrypt.hash('senha-correta', 4)
  });
  const repository = createRepository(user);
  const firstSession = await login(repository, user.email, 'senha-correta');
  const firstHash = hashToken(firstSession.refreshToken);

  const secondSession = await refreshSession(repository, firstSession.refreshToken);
  const oldToken = await repository.findRefreshToken(firstHash);

  assert.equal(oldToken?.revokedAt instanceof Date, true);
  assert.equal(typeof secondSession.accessToken, 'string');
  assert.equal(typeof secondSession.refreshToken, 'string');
});

test('token invalido e rejeitado pelo middleware de autenticacao', async () => {
  const response = createResponse();
  let nextCalled = false;

  await authenticate(
    { headers: { authorization: 'Bearer token-invalido' } } as never,
    response as never,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('rota protegida sem token retorna 401', async () => {
  const response = createResponse();
  let nextCalled = false;

  await authenticate(
    { headers: {} } as never,
    response as never,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('falta de permissao retorna 403', () => {
  const response = createResponse();
  let nextCalled = false;
  const user: AuthenticatedUser = {
    id: 'user-1',
    name: 'Atendente Teste',
    email: 'atendente@deltahelpdesk.local',
    status: 'ACTIVE',
    roles: ['attendant'],
    permissions: ['procedures.search']
  };

  authorize('settings.manage')(
    { user } as never,
    response as never,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('access token valido contem permissoes', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    name: 'Atendente Teste',
    email: 'atendente@deltahelpdesk.local',
    status: 'ACTIVE',
    roles: ['attendant'],
    permissions: ['procedures.search', 'messages.copy']
  };

  const token = signAccessToken(user);
  const payload = jwt.decode(token);

  assert.equal(typeof payload, 'object');
  assert.deepEqual((payload as { permissions: string[] }).permissions, user.permissions);
});
