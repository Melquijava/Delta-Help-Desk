import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { audit } from '../services/audit.service.js';
import {
  abandonProcedureUsage,
  finishProcedureUsage,
  getAttendantDashboard,
  getMostCopiedMessages,
  getProcedureUsage,
  getRunnableProcedure,
  listFavoriteProcedures,
  listRecentProcedures,
  goBackUsageStep,
  recordUsageStep,
  registerCopiedMessage,
  restartProcedureUsage,
  searchPublishedProcedures,
  startProcedureUsage,
  toggleFavoriteProcedure
} from '../services/attendant.service.js';

export const attendantRouter = Router();

attendantRouter.use(authenticate);

attendantRouter.get('/dashboard', authorize('procedures.search'), async (request, response) => {
  response.json({ data: await getAttendantDashboard(request.user?.id ?? '') });
});

attendantRouter.get('/messages/stats', authorize('messages.copy'), async (_request, response) => {
  response.json({ data: await getMostCopiedMessages() });
});

attendantRouter.get('/favorites', authorize('favorites.manage'), async (request, response) => {
  response.json({ data: await listFavoriteProcedures(request.user?.id ?? '') });
});

attendantRouter.get('/recent', authorize('history.view_own'), async (request, response) => {
  response.json({ data: await listRecentProcedures(request.user?.id ?? '') });
});

attendantRouter.get('/procedures/search', authorize('procedures.search'), async (request, response) => {
  const parsed = z
    .object({
      q: z.string().optional().default(''),
      categoryId: z.string().uuid().optional()
    })
    .safeParse(request.query);

  if (!parsed.success) {
    response.status(400).json({ message: 'Parametros de busca invalidos' });
    return;
  }

  const data = await searchPublishedProcedures(request.user?.id ?? '', parsed.data.q, parsed.data.categoryId);
  response.json({ data });
});

attendantRouter.get('/procedures/:id', authorize('procedures.follow'), async (request, response) => {
  try {
    response.json({ data: await getRunnableProcedure(request.user?.id ?? '', String(request.params.id)) });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

attendantRouter.post('/procedures/:id/usages', authorize('procedures.follow'), async (request, response) => {
  try {
    const data = await startProcedureUsage(request.user?.id ?? '', String(request.params.id));
    response.status(201).json({ data });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

attendantRouter.get('/usages/:usageId', authorize('procedures.follow'), async (request, response) => {
  try {
    response.json({ data: await getProcedureUsage(request.user?.id ?? '', String(request.params.usageId)) });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

const stepProgressSchema = z.object({
  stepId: z.string().uuid(),
  selectedOptionId: z.string().uuid().optional().nullable()
});

attendantRouter.post('/usages/:usageId/steps', authorize('procedures.follow'), async (request, response) => {
  const parsed = stepProgressSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Etapa invalida' });
    return;
  }

  try {
    const data = await recordUsageStep(
      request.user?.id ?? '',
      String(request.params.usageId),
      parsed.data.stepId,
      parsed.data.selectedOptionId
    );
    response.status(201).json({ data });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

attendantRouter.patch('/usages/:usageId/back', authorize('procedures.follow'), async (request, response) => {
  try {
    response.json({ data: await goBackUsageStep(request.user?.id ?? '', String(request.params.usageId)) });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

attendantRouter.patch('/usages/:usageId/restart', authorize('procedures.follow'), async (request, response) => {
  try {
    response.json({ data: await restartProcedureUsage(request.user?.id ?? '', String(request.params.usageId)) });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

const finishUsageSchema = z.object({
  status: z.enum(['RESOLVED', 'NOT_RESOLVED', 'ESCALATED']),
  resolutionNote: z.string().optional().nullable(),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  feedbackComment: z.string().optional().nullable()
});

attendantRouter.patch('/usages/:usageId/finish', authorize('usage.resolve'), async (request, response) => {
  const parsed = finishUsageSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Resultado invalido' });
    return;
  }

  try {
    const data = await finishProcedureUsage(
      request.user?.id ?? '',
      String(request.params.usageId),
      parsed.data.status,
      parsed.data.resolutionNote,
      parsed.data.rating,
      parsed.data.feedbackComment
    );
    response.json({ data });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

attendantRouter.patch('/usages/:usageId/abandon', authorize('procedures.follow'), async (request, response) => {
  const parsed = z.object({ resolutionNote: z.string().optional().nullable() }).safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Observacao invalida' });
    return;
  }

  try {
    const data = await abandonProcedureUsage(request.user?.id ?? '', String(request.params.usageId), parsed.data.resolutionNote);
    response.json({ data });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

attendantRouter.post('/usages/:usageId/messages/:messageId/copy', authorize('messages.copy'), async (request, response) => {
  try {
    const data = await registerCopiedMessage(
      request.user?.id ?? '',
      String(request.params.usageId),
      String(request.params.messageId)
    );
    await audit({
      actorId: request.user?.id,
      action: 'COPY_MESSAGE',
      entityType: 'CopyableMessage',
      entityId: data.messageId,
      procedureId: data.procedureId,
      description: 'Mensagem pronta copiada durante atendimento',
      metadata: {
        usageId: request.params.usageId,
        stepId: data.stepId
      },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data });
  } catch (error) {
    handleAttendantError(error, response);
  }
});

attendantRouter.patch('/procedures/:id/favorite', authorize('favorites.manage'), async (request, response) => {
  try {
    const procedureId = String(request.params.id);
    const data = await toggleFavoriteProcedure(request.user?.id ?? '', procedureId);
    response.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message === 'PROCEDURE_NOT_FOUND') {
      response.status(404).json({ message: 'Procedimento publicado nao encontrado' });
      return;
    }

    response.status(500).json({ message: 'Nao foi possivel atualizar favorito agora' });
  }
});

function handleAttendantError(error: unknown, response: import('express').Response) {
  if (error instanceof Error) {
    const messages: Record<string, string> = {
      PROCEDURE_NOT_FOUND: 'Procedimento publicado nao encontrado',
      PROCEDURE_WITHOUT_STEPS: 'Procedimento sem etapas para executar',
      USAGE_NOT_FOUND: 'Atendimento nao encontrado',
      STEP_NOT_FOUND: 'Etapa nao encontrada',
      OPTION_NOT_FOUND: 'Alternativa nao encontrada',
      MESSAGE_NOT_FOUND: 'Mensagem nao encontrada',
      INVALID_STATUS: 'Resultado invalido',
      RESOLUTION_NOTE_REQUIRED: 'Observacao obrigatoria para este resultado',
      FAVORITES_DISABLED: 'Favoritos desativados nas configuracoes do sistema'
    };

    if (messages[error.message]) {
      response.status(error.message.endsWith('NOT_FOUND') ? 404 : 409).json({ message: messages[error.message] });
      return;
    }
  }

  response.status(500).json({ message: 'Nao foi possivel processar atendimento agora' });
}
