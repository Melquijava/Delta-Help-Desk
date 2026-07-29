import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorize } from '../middlewares/authorize.middleware.js';
import { audit } from '../services/audit.service.js';
import { getLogoUploadPolicy, getPublicSettings, getSettings, settingsSchema, updateSettings } from '../services/settings.service.js';

export const settingsRouter = Router();

settingsRouter.get('/public', async (_request, response) => {
  response.json({ data: await getPublicSettings() });
});

settingsRouter.get('/logo-upload-policy', authenticate, authorize('settings.manage'), (_request, response) => {
  response.json({ data: getLogoUploadPolicy() });
});

settingsRouter.get('/', authenticate, authorize('settings.manage'), async (_request, response) => {
  try {
    response.json({ data: await getSettings() });
  } catch {
    response.status(503).json({ message: 'Banco de dados indisponivel para carregar configuracoes' });
  }
});

settingsRouter.put('/', authenticate, authorize('settings.manage'), async (request, response) => {
  const parsed = settingsSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ message: 'Configuracoes invalidas', issues: parsed.error.flatten().fieldErrors });
    return;
  }

  try {
    const before = await getSettings();
    const after = await updateSettings(parsed.data, request.user?.id ?? '');

    await audit({
      actorId: request.user?.id,
      action: 'UPDATE',
      entityType: 'SystemSetting',
      description: 'Configuracoes do sistema atualizadas',
      before,
      after,
      ipAddress: request.ip,
      userAgent: request.get('user-agent')
    });

    response.json({ data: after });
  } catch {
    response.status(500).json({ message: 'Nao foi possivel salvar configuracoes agora' });
  }
});
