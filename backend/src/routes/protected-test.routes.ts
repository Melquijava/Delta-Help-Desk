import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';

export const protectedTestRouter = Router();

protectedTestRouter.get('/protected', authenticate, (request, response) => {
  response.json({ user: request.user });
});

protectedTestRouter.get(
  '/admin',
  authenticate,
  authorize('settings.manage'),
  (_request, response) => {
    response.json({ status: 'ok' });
  }
);
