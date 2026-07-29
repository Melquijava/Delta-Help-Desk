import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'delta-help-desk-api',
    timestamp: new Date().toISOString()
  });
});

healthRouter.get('/database', async (_request, response) => {
  if (!process.env.DATABASE_URL) {
    response.status(503).json({
      status: 'error',
      database: 'not_configured',
      message: 'DATABASE_URL is not configured'
    });
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    response.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch {
    response.status(503).json({
      status: 'error',
      database: 'unavailable',
      message: 'Database connection failed'
    });
  }
});
