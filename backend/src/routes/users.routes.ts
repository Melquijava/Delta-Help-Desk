import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { audit } from '../services/audit.service.js';
import {
  UserModuleError,
  createUser,
  deleteUser,
  getUserById,
  listRoles,
  listUsers,
  updateUser,
  updateUserRoles,
  updateUserStatus
} from '../services/users.service.js';
import { parsePagination } from '../utils/pagination.js';

export const usersRouter = Router();

usersRouter.use(authenticate, authorize('users.manage'));

const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

const userPayloadSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  registration: z.string().optional().nullable(),
  password: z.string().min(8).optional(),
  status: userStatusSchema.default('ACTIVE'),
  notes: z.string().optional().nullable(),
  roleIds: z.array(z.string().uuid()).min(1)
});

const createUserSchema = userPayloadSchema.extend({
  password: z.string().min(8)
});

const statusSchema = z.object({
  status: userStatusSchema
});

const rolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1)
});

usersRouter.get('/roles', async (_request, response) => {
  response.json({ data: await listRoles() });
});

usersRouter.get('/', async (request, response) => {
  const { page, pageSize } = parsePagination(request.query.page, request.query.pageSize);
  const status = userStatusSchema.safeParse(request.query.status);

  const result = await listUsers(
    {
      q: typeof request.query.q === 'string' ? request.query.q : undefined,
      role: typeof request.query.role === 'string' ? request.query.role : undefined,
      status: status.success ? status.data : undefined
    },
    page,
    pageSize
  );

  response.json(result);
});

usersRouter.get('/:id', async (request, response) => {
  try {
    response.json({ data: await getUserById(request.params.id) });
  } catch (error) {
    handleUserError(error, response);
  }
});

usersRouter.post('/', async (request, response) => {
  const parsed = createUserSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para criar usuario' });
    return;
  }

  try {
    const user = await createUser(parsed.data);
    await audit({
      actorId: request.user?.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      description: `Usuario criado: ${user.name}`,
      after: user,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(201).json({ data: user });
  } catch (error) {
    handleUserError(error, response);
  }
});

usersRouter.put('/:id', async (request, response) => {
  const parsed = userPayloadSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Dados invalidos para atualizar usuario' });
    return;
  }

  try {
    const before = await getUserById(request.params.id);
    const user = await updateUser(request.params.id, parsed.data, request.user?.id ?? '');
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      description: `Usuario atualizado: ${user.name}`,
      before,
      after: user,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: user });
  } catch (error) {
    handleUserError(error, response);
  }
});

usersRouter.patch('/:id/status', async (request, response) => {
  const parsed = statusSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Status invalido' });
    return;
  }

  try {
    const before = await getUserById(request.params.id);
    const user = await updateUserStatus(request.params.id, parsed.data.status);
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      description: `Status do usuario alterado para ${parsed.data.status}`,
      before,
      after: user,
      metadata: { status: parsed.data.status },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: user });
  } catch (error) {
    handleUserError(error, response);
  }
});

usersRouter.patch('/:id/roles', async (request, response) => {
  const parsed = rolesSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Cargos invalidos' });
    return;
  }

  try {
    const before = await getUserById(request.params.id);
    const user = await updateUserRoles(request.params.id, parsed.data.roleIds, request.user?.id ?? '');
    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: user.id,
      description: `Cargos do usuario atualizados: ${user.name}`,
      before,
      after: user,
      metadata: { roleIds: parsed.data.roleIds },
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.json({ data: user });
  } catch (error) {
    handleUserError(error, response);
  }
});

usersRouter.delete('/:id', async (request, response) => {
  try {
    const before = await getUserById(request.params.id);
    const user = await deleteUser(request.params.id);
    await audit({
      actorId: request.user?.id,
      action: 'DELETE',
      entityType: 'User',
      entityId: user.id,
      description: `Usuario removido logicamente: ${user.name}`,
      before,
      after: user,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });
    response.status(204).send();
  } catch (error) {
    handleUserError(error, response);
  }
});

function handleUserError(error: unknown, response: import('express').Response) {
  if (error instanceof UserModuleError) {
    const messages: Record<UserModuleError['code'], string> = {
      USER_NOT_FOUND: 'Usuario nao encontrado',
      EMAIL_IN_USE: 'E-mail ja esta em uso',
      REGISTRATION_IN_USE: 'Matricula ja esta em uso',
      LAST_ACTIVE_ADMIN: 'Nao e permitido remover ou desativar o ultimo administrador ativo',
      SELF_ADMIN_REMOVAL: 'Nao e permitido remover seu proprio acesso sem outro administrador ativo',
      ROLE_NOT_FOUND: 'Cargo nao encontrado'
    };

    const status = error.code === 'USER_NOT_FOUND' ? 404 : 409;
    response.status(status).json({ message: messages[error.code] });
    return;
  }

  response.status(500).json({ message: 'Nao foi possivel processar usuarios agora' });
}
