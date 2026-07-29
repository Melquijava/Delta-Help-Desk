import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { authRepository } from '../repositories/auth.repository.js';
import type { AccessTokenPayload } from '../types/auth.js';

export async function authenticate(request: Request, response: Response, next: NextFunction) {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    response.status(401).json({ message: 'Autenticacao necessaria' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    const user = await authRepository.findUserById(payload.sub);

    if (!user || user.status !== 'ACTIVE') {
      response.status(401).json({ message: 'Sessao invalida ou usuario inativo' });
      return;
    }

    request.user = user;
    next();
  } catch {
    response.status(401).json({ message: 'Sessao expirada ou invalida' });
  }
}
