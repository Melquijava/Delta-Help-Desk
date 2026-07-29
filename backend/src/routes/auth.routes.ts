import { Router } from 'express';
import { z } from 'zod';
import { loginRateLimit } from '../middlewares/login-rate-limit.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AuthError, login, logout, refreshSession } from '../services/auth.service.js';
import { audit } from '../services/audit.service.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

function authErrorStatus(error: AuthError) {
  if (error.code === 'USER_INACTIVE') {
    return 403;
  }

  return 401;
}

function authErrorMessage(error: AuthError) {
  if (error.code === 'USER_INACTIVE') {
    return 'Usuario inativo';
  }

  return 'Credenciais invalidas';
}

authRouter.post('/login', loginRateLimit, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'E-mail e senha sao obrigatorios' });
    return;
  }

  try {
    const session = await login(authRepository, parsed.data.email, parsed.data.password);

    await audit({
      actorId: session.user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: session.user.id,
      description: `Login realizado: ${session.user.email}`,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });

    response.json(session);
  } catch (error) {
    if (error instanceof AuthError) {
      response.status(authErrorStatus(error)).json({ message: authErrorMessage(error) });
      return;
    }

    response.status(500).json({ message: 'Nao foi possivel entrar agora' });
  }
});

authRouter.post('/refresh', async (request, response) => {
  const parsed = refreshSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Refresh token obrigatorio' });
    return;
  }

  try {
    const session = await refreshSession(authRepository, parsed.data.refreshToken);
    response.json(session);
  } catch (error) {
    if (error instanceof AuthError) {
      response.status(authErrorStatus(error)).json({ message: 'Sessao expirada ou invalida' });
      return;
    }

    response.status(500).json({ message: 'Nao foi possivel renovar a sessao' });
  }
});

authRouter.post('/logout', authenticate, async (request, response) => {
  const parsed = refreshSchema.safeParse(request.body);

  await logout(authRepository, parsed.success ? parsed.data.refreshToken : undefined);

  await audit({
    actorId: request.user?.id,
    action: 'LOGOUT',
    entityType: 'User',
    entityId: request.user?.id,
    description: `Logout realizado: ${request.user?.email ?? request.user?.id ?? 'usuario'}`,
    ipAddress: request.ip,
    userAgent: request.get('user-agent')
  });

  response.status(204).send();
});

authRouter.get('/me', authenticate, (request, response) => {
  response.json({ user: request.user });
});
