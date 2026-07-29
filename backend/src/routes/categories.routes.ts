import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import {
  CategoryModuleError,
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  moveCategory,
  updateCategory,
  updateCategoryStatus
} from '../services/categories.service.js';
import { audit } from '../services/audit.service.js';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate, authorize('categories.manage'));

const statusSchema = z.enum(['ACTIVE', 'INACTIVE']);

const categoryPayloadSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  order: z.coerce.number().int().min(0).optional(),
  status: statusSchema.default('ACTIVE')
});

const statusPayloadSchema = z.object({
  status: statusSchema
});

const movePayloadSchema = z.object({
  direction: z.enum(['up', 'down'])
});

categoriesRouter.get('/', async (request, response) => {
  const status = statusSchema.safeParse(request.query.status);

  const data = await listCategories({
    q: typeof request.query.q === 'string' ? request.query.q : undefined,
    status: status.success ? status.data : undefined
  });

  response.json({ data });
});

categoriesRouter.get('/:id', async (request, response) => {
  try {
    response.json({ data: await getCategoryById(request.params.id) });
  } catch (error) {
    handleCategoryError(error, response);
  }
});

categoriesRouter.post('/', async (request, response) => {
  const parsed = categoryPayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para criar categoria' });
    return;
  }

  try {
    const category = await createCategory(parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'CREATE',
      entityType: 'Category',
      entityId: category.id,
      description: `Categoria criada: ${category.name}`,
      after: category,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: category });
  } catch (error) {
    handleCategoryError(error, response);
  }
});

categoriesRouter.put('/:id', async (request, response) => {
  const parsed = categoryPayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para atualizar categoria' });
    return;
  }

  try {
    const before = await getCategoryById(request.params.id);
    const category = await updateCategory(request.params.id, parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'Category',
      entityId: category.id,
      description: `Categoria atualizada: ${category.name}`,
      before,
      after: category,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: category });
  } catch (error) {
    handleCategoryError(error, response);
  }
});

categoriesRouter.patch('/:id/status', async (request, response) => {
  const parsed = statusPayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Status invalido' });
    return;
  }

  try {
    const before = await getCategoryById(request.params.id);
    const category = await updateCategoryStatus(request.params.id, parsed.data.status);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'Category',
      entityId: category.id,
      description: `Status da categoria alterado para ${parsed.data.status}`,
      before,
      after: category,
      metadata: { status: parsed.data.status },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: category });
  } catch (error) {
    handleCategoryError(error, response);
  }
});

categoriesRouter.patch('/:id/move', async (request, response) => {
  const parsed = movePayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Direcao invalida' });
    return;
  }

  try {
    const before = await getCategoryById(request.params.id);
    const category = await moveCategory(request.params.id, parsed.data.direction);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'Category',
      entityId: category.id,
      description: `Categoria reordenada: ${category.name}`,
      before,
      after: category,
      metadata: { direction: parsed.data.direction },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: category });
  } catch (error) {
    handleCategoryError(error, response);
  }
});

categoriesRouter.delete('/:id', async (request, response) => {
  try {
    const before = await getCategoryById(request.params.id);
    const category = await deleteCategory(request.params.id);
    await audit({
      actorId: request.user?.id,
      action: 'DELETE',
      entityType: 'Category',
      entityId: category.id,
      description: `Categoria removida logicamente: ${category.name}`,
      before,
      after: category,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(204).send();
  } catch (error) {
    handleCategoryError(error, response);
  }
});

function handleCategoryError(error: unknown, response: import('express').Response) {
  if (error instanceof CategoryModuleError) {
    const messages: Record<CategoryModuleError['code'], string> = {
      CATEGORY_NOT_FOUND: 'Categoria nao encontrada',
      SLUG_IN_USE: 'Slug ja esta em uso',
      INVALID_MOVE: 'Categoria ja esta no limite da ordenacao'
    };

    const status = error.code === 'CATEGORY_NOT_FOUND' ? 404 : 409;
    response.status(status).json({ message: messages[error.code] });
    return;
  }

  response.status(500).json({ message: 'Nao foi possivel processar categorias agora' });
}
