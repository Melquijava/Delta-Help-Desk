import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { getAuditLogById, listAuditLogs } from '../services/audit.service.js';
import { parsePagination } from '../utils/pagination.js';

export const auditRouter = Router();

auditRouter.use(authenticate, authorize('audit.view'));

const auditActionSchema = z.enum([
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'PUBLISH',
  'ARCHIVE',
  'DUPLICATE',
  'LOGIN',
  'LOGOUT',
  'COPY_MESSAGE'
]);

const auditQuerySchema = z.object({
  q: z.string().optional(),
  actorId: z.string().uuid().optional(),
  action: auditActionSchema.optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  procedureId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional()
});

auditRouter.get('/', async (request, response) => {
  const parsed = auditQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    response.status(400).json({ message: 'Filtros de auditoria invalidos' });
    return;
  }

  const { page, pageSize } = parsePagination(request.query.page, request.query.pageSize);

  const endDate = parsed.data.endDate ? new Date(`${parsed.data.endDate}T23:59:59.999Z`) : undefined;

  response.json(
    await listAuditLogs(
      {
        ...parsed.data,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
        endDate
      },
      page,
      pageSize
    )
  );
});

auditRouter.get('/:id', async (request, response) => {
  try {
    response.json({ data: await getAuditLogById(request.params.id) });
  } catch (error) {
    if (error instanceof Error && error.message === 'AUDIT_LOG_NOT_FOUND') {
      response.status(404).json({ message: 'Registro de auditoria nao encontrado' });
      return;
    }

    response.status(500).json({ message: 'Nao foi possivel carregar auditoria agora' });
  }
});
