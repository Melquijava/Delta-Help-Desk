import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { attendantRouter } from './routes/attendant.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { categoriesRouter } from './routes/categories.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { proceduresRouter } from './routes/procedures.routes.js';
import { protectedTestRouter } from './routes/protected-test.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { usersRouter } from './routes/users.routes.js';

export const app = express();

const currentDir = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: false
  })
);
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRouter);
app.use('/api/attendant', attendantRouter);
app.use('/api/audit', auditRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/health', healthRouter);
app.use('/api/procedures', proceduresRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', usersRouter);
if (env.NODE_ENV === 'test') {
  app.use('/api/test', protectedTestRouter);
}

const frontendDist = [
  path.resolve(process.cwd(), 'frontend', 'dist'),
  path.resolve(process.cwd(), '..', 'frontend', 'dist'),
  path.resolve(currentDir, '..', '..', 'frontend', 'dist')
].find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));

if (frontendDist && env.NODE_ENV !== 'test') {
  app.use(express.static(frontendDist));
  app.get('*', (_request, response) => {
    response.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((_request: Request, response: Response) => {
  response.status(404).json({ message: 'Rota nao encontrada' });
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next;

  if (env.NODE_ENV !== 'production') {
    console.error(error);
  }

  response.status(500).json({ message: 'Erro interno do servidor' });
});
