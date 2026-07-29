import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { audit } from '../services/audit.service.js';
import {
  StepModuleError,
  createMessage,
  createOption,
  createStep,
  deleteMessage,
  deleteOption,
  deleteStep,
  duplicateMessage,
  duplicateStep,
  listSteps,
  moveStep,
  setInitialStep,
  updateMessage,
  updateOption,
  updateStep,
  validateProcedureFlow
} from '../services/procedure-steps.service.js';
import {
  ProcedureModuleError,
  archiveProcedure,
  createProcedure,
  deleteProcedure,
  duplicateProcedure,
  getProcedureById,
  listProcedures,
  publishProcedure,
  restoreProcedure,
  updateProcedure
} from '../services/procedures.service.js';
import { parsePagination } from '../utils/pagination.js';

export const proceduresRouter = Router();

proceduresRouter.use(authenticate, authorize('procedures.manage'));

const procedureStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const difficultySchema = z.enum(['EASY', 'MEDIUM', 'ADVANCED']);

const procedurePayloadSchema = z.object({
  title: z.string().min(3),
  slug: z.string().optional().nullable(),
  summary: z.string().min(3),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid(),
  keywords: z.array(z.string()).default([]),
  symptoms: z.array(z.string()).default([]),
  difficulty: difficultySchema.default('EASY'),
  estimatedMinutes: z.coerce.number().int().positive().optional().nullable(),
  featured: z.boolean().default(false),
  status: procedureStatusSchema.default('DRAFT')
});

const stepTypeSchema = z.enum([
  'INFORMATION',
  'QUESTION',
  'ACTION',
  'COPYABLE_MESSAGE',
  'ALERT',
  'CHECK',
  'FINAL_SOLUTION',
  'TECHNICAL_ESCALATION'
]);

const stepPayloadSchema = z.object({
  title: z.string().min(2),
  instruction: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  position: z.coerce.number().int().min(0).optional(),
  type: stepTypeSchema,
  highlighted: z.boolean().default(false),
  helperMessage: z.string().optional().nullable(),
  nextStepId: z.string().uuid().optional().nullable(),
  isFinal: z.boolean().default(false)
});

const optionPayloadSchema = z.object({
  label: z.string().min(1),
  value: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).optional(),
  nextStepId: z.string().uuid().optional().nullable()
});

const messagePayloadSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  order: z.coerce.number().int().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

const movePayloadSchema = z.object({
  direction: z.enum(['up', 'down'])
});

const initialStepPayloadSchema = z.object({
  stepId: z.string().uuid().nullable()
});

async function findStepSnapshot(procedureId: string, stepId: string) {
  const steps = await listSteps(procedureId);
  return steps.find((step) => step.id === stepId);
}

async function findOptionSnapshot(procedureId: string, optionId: string) {
  const steps = await listSteps(procedureId);
  return steps.flatMap((step) => step.options).find((option) => option.id === optionId);
}

async function findMessageSnapshot(procedureId: string, messageId: string) {
  const steps = await listSteps(procedureId);
  return steps.flatMap((step) => step.messages).find((message) => message.id === messageId);
}

proceduresRouter.get('/', async (request, response) => {
  const { page, pageSize } = parsePagination(request.query.page, request.query.pageSize);
  const status = procedureStatusSchema.safeParse(request.query.status);
  const difficulty = difficultySchema.safeParse(request.query.difficulty);

  const result = await listProcedures(
    {
      q: typeof request.query.q === 'string' ? request.query.q : undefined,
      categoryId: typeof request.query.categoryId === 'string' ? request.query.categoryId : undefined,
      status: status.success ? status.data : undefined,
      difficulty: difficulty.success ? difficulty.data : undefined,
      deleted: request.query.deleted === 'true'
    },
    page,
    pageSize
  );

  response.json(result);
});

proceduresRouter.get('/:id', async (request, response) => {
  try {
    response.json({ data: await getProcedureById(request.params.id) });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.get('/:id/steps', async (request, response) => {
  try {
    response.json({ data: await listSteps(request.params.id) });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.get('/:id/flow/validation', async (request, response) => {
  try {
    response.json({ data: await validateProcedureFlow(request.params.id) });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.patch('/:id/initial-step', async (request, response) => {
  const parsed = initialStepPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Etapa inicial invalida' });
    return;
  }
  try {
    const before = await getProcedureById(request.params.id);
    const data = await setInitialStep(request.params.id, parsed.data.stepId);
    const after = await getProcedureById(request.params.id);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'Procedure',
      entityId: request.params.id,
      procedureId: request.params.id,
      description: 'Etapa inicial do procedimento alterada',
      before,
      after,
      metadata: { initialStepId: parsed.data.stepId },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.post('/:id/steps', async (request, response) => {
  const parsed = stepPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para criar etapa' });
    return;
  }
  try {
    const step = await createStep(request.params.id, parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'CREATE',
      entityType: 'ProcedureStep',
      entityId: step.id,
      procedureId: request.params.id,
      description: `Etapa criada: ${step.title}`,
      after: step,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: step });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.put('/:id/steps/:stepId', async (request, response) => {
  const parsed = stepPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para atualizar etapa' });
    return;
  }
  try {
    const before = await findStepSnapshot(request.params.id, request.params.stepId);
    const step = await updateStep(request.params.id, request.params.stepId, parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'ProcedureStep',
      entityId: step.id,
      procedureId: request.params.id,
      description: `Etapa atualizada: ${step.title}`,
      before,
      after: step,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: step });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.delete('/:id/steps/:stepId', async (request, response) => {
  try {
    const before = await findStepSnapshot(request.params.id, request.params.stepId);
    await deleteStep(request.params.id, request.params.stepId);
    await audit({
      actorId: request.user?.id,
      action: 'DELETE',
      entityType: 'ProcedureStep',
      entityId: request.params.stepId,
      procedureId: request.params.id,
      description: `Etapa removida logicamente: ${before?.title ?? request.params.stepId}`,
      before,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(204).send();
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.post('/:id/steps/:stepId/duplicate', async (request, response) => {
  try {
    const before = await findStepSnapshot(request.params.id, request.params.stepId);
    const step = await duplicateStep(request.params.id, request.params.stepId);
    await audit({
      actorId: request.user?.id,
      action: 'DUPLICATE',
      entityType: 'ProcedureStep',
      entityId: step.id,
      procedureId: request.params.id,
      description: `Etapa duplicada: ${step.title}`,
      before,
      after: step,
      metadata: { sourceId: request.params.stepId },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: step });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.patch('/:id/steps/:stepId/move', async (request, response) => {
  const parsed = movePayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Direcao invalida' });
    return;
  }
  try {
    const before = await findStepSnapshot(request.params.id, request.params.stepId);
    const step = await moveStep(request.params.id, request.params.stepId, parsed.data.direction);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'ProcedureStep',
      entityId: step.id,
      procedureId: request.params.id,
      description: `Etapa reordenada: ${step.title}`,
      before,
      after: step,
      metadata: { direction: parsed.data.direction },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: step });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.post('/:id/steps/:stepId/options', async (request, response) => {
  const parsed = optionPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para criar alternativa' });
    return;
  }
  try {
    const option = await createOption(request.params.id, request.params.stepId, parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'CREATE',
      entityType: 'StepOption',
      entityId: option.id,
      procedureId: request.params.id,
      description: `Alternativa criada: ${option.label}`,
      after: option,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: option });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.put('/:id/steps/:stepId/options/:optionId', async (request, response) => {
  const parsed = optionPayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para atualizar alternativa' });
    return;
  }
  try {
    const before = await findOptionSnapshot(request.params.id, request.params.optionId);
    const option = await updateOption(request.params.id, request.params.stepId, request.params.optionId, parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'StepOption',
      entityId: option.id,
      procedureId: request.params.id,
      description: `Alternativa atualizada: ${option.label}`,
      before,
      after: option,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: option });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.delete('/:id/steps/:stepId/options/:optionId', async (request, response) => {
  try {
    const before = await findOptionSnapshot(request.params.id, request.params.optionId);
    await deleteOption(request.params.id, request.params.stepId, request.params.optionId);
    await audit({
      actorId: request.user?.id,
      action: 'DELETE',
      entityType: 'StepOption',
      entityId: request.params.optionId,
      procedureId: request.params.id,
      description: `Alternativa removida logicamente: ${before?.label ?? request.params.optionId}`,
      before,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(204).send();
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.post('/:id/steps/:stepId/messages', async (request, response) => {
  const parsed = messagePayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para criar mensagem' });
    return;
  }
  try {
    const message = await createMessage(request.params.id, request.params.stepId, parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'CREATE',
      entityType: 'CopyableMessage',
      entityId: message.id,
      procedureId: request.params.id,
      description: `Mensagem criada: ${message.title}`,
      after: message,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: message });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.put('/:id/steps/:stepId/messages/:messageId', async (request, response) => {
  const parsed = messagePayloadSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para atualizar mensagem' });
    return;
  }
  try {
    const before = await findMessageSnapshot(request.params.id, request.params.messageId);
    const message = await updateMessage(request.params.id, request.params.stepId, request.params.messageId, parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'CopyableMessage',
      entityId: message.id,
      procedureId: request.params.id,
      description: `Mensagem atualizada: ${message.title}`,
      before,
      after: message,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: message });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.post('/:id/steps/:stepId/messages/:messageId/duplicate', async (request, response) => {
  try {
    const before = await findMessageSnapshot(request.params.id, request.params.messageId);
    const message = await duplicateMessage(request.params.id, request.params.stepId, request.params.messageId);
    await audit({
      actorId: request.user?.id,
      action: 'DUPLICATE',
      entityType: 'CopyableMessage',
      entityId: message.id,
      procedureId: request.params.id,
      description: `Mensagem duplicada: ${message.title}`,
      before,
      after: message,
      metadata: { sourceId: request.params.messageId },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: message });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.delete('/:id/steps/:stepId/messages/:messageId', async (request, response) => {
  try {
    const before = await findMessageSnapshot(request.params.id, request.params.messageId);
    await deleteMessage(request.params.id, request.params.stepId, request.params.messageId);
    await audit({
      actorId: request.user?.id,
      action: 'DELETE',
      entityType: 'CopyableMessage',
      entityId: request.params.messageId,
      procedureId: request.params.id,
      description: `Mensagem removida logicamente: ${before?.title ?? request.params.messageId}`,
      before,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(204).send();
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.post('/', async (request, response) => {
  const parsed = procedurePayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para criar procedimento' });
    return;
  }

  try {
    const procedure = await createProcedure(parsed.data, request.user?.id ?? '');
    await audit({
      actorId: request.user?.id,
      action: 'CREATE',
      entityType: 'Procedure',
      entityId: procedure.id,
      procedureId: procedure.id,
      description: `Procedimento criado: ${procedure.title}`,
      after: procedure,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: procedure });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.put('/:id', async (request, response) => {
  const parsed = procedurePayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para atualizar procedimento' });
    return;
  }

  try {
    const before = await getProcedureById(request.params.id);
    const procedure = await updateProcedure(request.params.id, parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'Procedure',
      entityId: procedure.id,
      procedureId: procedure.id,
      description: `Procedimento atualizado: ${procedure.title}`,
      before,
      after: procedure,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: procedure });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.patch('/:id/publish', async (request, response) => {
  try {
    const before = await getProcedureById(request.params.id);
    const procedure = await publishProcedure(request.params.id);
    await audit({
      actorId: request.user?.id,
      action: 'PUBLISH',
      entityType: 'Procedure',
      entityId: procedure.id,
      procedureId: procedure.id,
      description: `Procedimento publicado: ${procedure.title}`,
      before,
      after: procedure,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: procedure });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.patch('/:id/archive', async (request, response) => {
  try {
    const before = await getProcedureById(request.params.id);
    const procedure = await archiveProcedure(request.params.id);
    await audit({
      actorId: request.user?.id,
      action: 'ARCHIVE',
      entityType: 'Procedure',
      entityId: procedure.id,
      procedureId: procedure.id,
      description: `Procedimento arquivado: ${procedure.title}`,
      before,
      after: procedure,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: procedure });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.post('/:id/duplicate', async (request, response) => {
  try {
    const before = await getProcedureById(request.params.id);
    const procedure = await duplicateProcedure(request.params.id, request.user?.id ?? '');
    await audit({
      actorId: request.user?.id,
      action: 'DUPLICATE',
      entityType: 'Procedure',
      entityId: procedure.id,
      procedureId: procedure.id,
      description: `Procedimento duplicado: ${procedure.title}`,
      before,
      after: procedure,
      metadata: { sourceId: request.params.id },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: procedure });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.patch('/:id/restore', async (request, response) => {
  try {
    const before = await getProcedureById(request.params.id);
    const procedure = await restoreProcedure(request.params.id);
    await audit({
      actorId: request.user?.id,
      action: 'RESTORE',
      entityType: 'Procedure',
      entityId: procedure.id,
      procedureId: procedure.id,
      description: `Procedimento restaurado: ${procedure.title}`,
      before,
      after: procedure,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: procedure });
  } catch (error) {
    handleProcedureError(error, response);
  }
});

proceduresRouter.delete('/:id', async (request, response) => {
  try {
    const before = await getProcedureById(request.params.id);
    const procedure = await deleteProcedure(request.params.id);
    await audit({
      actorId: request.user?.id,
      action: 'DELETE',
      entityType: 'Procedure',
      entityId: procedure.id,
      procedureId: procedure.id,
      description: `Procedimento removido logicamente: ${procedure.title}`,
      before,
      after: procedure,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(204).send();
  } catch (error) {
    handleProcedureError(error, response);
  }
});

function handleProcedureError(error: unknown, response: import('express').Response) {
  if (error instanceof ProcedureModuleError) {
    const messages: Record<ProcedureModuleError['code'], string> = {
      PROCEDURE_NOT_FOUND: 'Procedimento nao encontrado',
      CATEGORY_NOT_FOUND: 'Categoria nao encontrada',
      SLUG_IN_USE: 'Slug ja esta em uso',
      NO_STEPS_TO_PUBLISH: 'Nao e possivel publicar um procedimento sem etapas',
      INVALID_FLOW: 'Nao e possivel publicar um fluxo invalido'
    };

    const status = error.code === 'PROCEDURE_NOT_FOUND' ? 404 : 409;
    response.status(status).json({ message: messages[error.code] });
    return;
  }

  if (error instanceof StepModuleError) {
    const messages: Record<StepModuleError['code'], string> = {
      PROCEDURE_NOT_FOUND: 'Procedimento nao encontrado',
      STEP_NOT_FOUND: 'Etapa nao encontrada',
      OPTION_NOT_FOUND: 'Alternativa nao encontrada',
      MESSAGE_NOT_FOUND: 'Mensagem nao encontrada',
      INVALID_TARGET: 'Destino invalido para este procedimento'
    };

    response.status(error.code.endsWith('NOT_FOUND') ? 404 : 409).json({ message: messages[error.code] });
    return;
  }

  response.status(500).json({ message: 'Nao foi possivel processar procedimentos agora' });
}
