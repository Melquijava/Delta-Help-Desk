import type { NextFunction, Request, Response } from 'express';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimit(request: Request, response: Response, next: NextFunction) {
  const key = request.ip ?? 'unknown';
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (current.count >= MAX_ATTEMPTS) {
    response.status(429).json({
      message: 'Muitas tentativas de login. Tente novamente em alguns minutos.'
    });
    return;
  }

  current.count += 1;
  attempts.set(key, current);
  next();
}
