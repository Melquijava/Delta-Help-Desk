import type { NextFunction, Request, Response } from 'express';

export function authorize(requiredPermission: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.user) {
      response.status(401).json({ message: 'Autenticacao necessaria' });
      return;
    }

    if (!request.user.permissions.includes(requiredPermission)) {
      response.status(403).json({ message: 'Permissao insuficiente' });
      return;
    }

    next();
  };
}
