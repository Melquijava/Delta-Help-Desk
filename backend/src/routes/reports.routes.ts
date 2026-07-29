import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { audit } from '../services/audit.service.js';
import { createReportFile, getAdminDashboard, getFeedbackReport, getReportData } from '../services/reports.service.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate, authorize('reports.view'));

reportsRouter.get('/feedback', async (_request, response) => {
  response.json({ data: await getFeedbackReport() });
});

const dashboardQuerySchema = z.object({
  preset: z.enum(['today', 'last7', 'last30', 'month', 'custom']).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  attendantId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  procedureId: z.string().uuid().optional()
});

const reportQuerySchema = dashboardQuerySchema.extend({
  type: z.enum([
    'usage_by_attendant',
    'usage_by_procedure',
    'resolution_rate',
    'technical_escalations',
    'most_copied_messages',
    'most_accessed_procedures',
    'worst_rated_procedures',
    'procedures_without_result',
    'top_searches',
    'no_result_searches',
    'audit_history',
    'attendances_by_period'
  ]),
  result: z.enum(['IN_PROGRESS', 'RESOLVED', 'NOT_RESOLVED', 'ESCALATED', 'ABANDONED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional()
});

const exportQuerySchema = reportQuerySchema.extend({
  format: z.enum(['pdf', 'xlsx', 'csv'])
});

function toFilters(parsed: z.infer<typeof reportQuerySchema>) {
  return {
    preset: parsed.preset,
    startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
    endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    attendantId: parsed.attendantId,
    categoryId: parsed.categoryId,
    procedureId: parsed.procedureId,
    result: parsed.result
  };
}

reportsRouter.get('/dashboard', async (request, response) => {
  const parsed = dashboardQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ message: 'Filtros invalidos' });
    return;
  }

  response.json({
    data: await getAdminDashboard({
      preset: parsed.data.preset,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      attendantId: parsed.data.attendantId,
      categoryId: parsed.data.categoryId,
      procedureId: parsed.data.procedureId
    })
  });
});

reportsRouter.get('/generate', async (request, response) => {
  const parsed = reportQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ message: 'Filtros invalidos' });
    return;
  }

  const result = await getReportData(
    parsed.data.type,
    toFilters(parsed.data),
    request.user?.name ?? 'Usuario',
    parsed.data.page ?? 1,
    parsed.data.pageSize ?? 25
  );

  await audit({
    actorId: request.user?.id,
    action: 'CREATE',
    entityType: 'Report',
    metadata: { type: parsed.data.type, format: 'visual', filters: toFilters(parsed.data) }
  });

  response.json(result);
});

reportsRouter.get('/export', async (request, response) => {
  const parsed = exportQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ message: 'Filtros invalidos' });
    return;
  }

  const file = await createReportFile(parsed.data.type, toFilters(parsed.data), request.user?.name ?? 'Usuario', parsed.data.format);
  const filename = `${parsed.data.type}-${new Date().toISOString().slice(0, 10)}.${file.extension}`;

  await audit({
    actorId: request.user?.id,
    action: 'CREATE',
    entityType: 'Report',
    metadata: { type: parsed.data.type, format: parsed.data.format, filters: toFilters(parsed.data) }
  });

  response.setHeader('Content-Type', file.contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  response.send(file.buffer);
});
