import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseJson, stringifyJson } from '../utils/json.js';

export const settingsSchema = z.object({
  companyName: z.string().trim().min(2).max(80),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine((value) => !value || isSafeImageReference(value), 'Logotipo invalido'),
  systemName: z.string().trim().min(2).max(80),
  welcomeMessage: z.string().trim().min(2).max(240),
  itemsPerPage: z.coerce.number().int().min(5).max(100),
  sessionTimeoutMinutes: z.coerce.number().int().min(15).max(480),
  allowFeedback: z.boolean(),
  allowFavorites: z.boolean(),
  showFeaturedProcedures: z.boolean(),
  requireNoteOnNotResolved: z.boolean(),
  requireNoteOnEscalation: z.boolean(),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor principal invalida'),
  technicalSupportContact: z.object({
    name: z.string().trim().max(80).optional().nullable(),
    email: z.string().trim().email().max(120).optional().nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
    hours: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(240).optional().nullable()
  })
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: AppSettings = {
  companyName: 'Delta',
  logoUrl: null,
  systemName: 'Delta Help Desk',
  welcomeMessage: 'Encontre rapidamente o procedimento certo para orientar o cliente.',
  itemsPerPage: 10,
  sessionTimeoutMinutes: 60,
  allowFeedback: true,
  allowFavorites: true,
  showFeaturedProcedures: true,
  requireNoteOnNotResolved: true,
  requireNoteOnEscalation: true,
  primaryColor: '#0284c7',
  technicalSupportContact: {
    name: 'Suporte tecnico Delta',
    email: null,
    phone: null,
    hours: null,
    notes: null
  }
};

const settingDescriptions: Record<keyof AppSettings, string> = {
  companyName: 'Nome da empresa exibido no sistema.',
  logoUrl: 'Referencia do logotipo da empresa.',
  systemName: 'Nome do sistema exibido na interface.',
  welcomeMessage: 'Mensagem de boas-vindas para atendentes.',
  itemsPerPage: 'Quantidade padrao de itens por pagina.',
  sessionTimeoutMinutes: 'Tempo maximo sugerido de sessao em minutos.',
  allowFeedback: 'Permite registrar feedback ao concluir atendimentos.',
  allowFavorites: 'Permite favoritar procedimentos.',
  showFeaturedProcedures: 'Exibe procedimentos em destaque na tela da atendente.',
  requireNoteOnNotResolved: 'Exige observacao ao marcar atendimento como nao resolvido.',
  requireNoteOnEscalation: 'Exige observacao ao encaminhar atendimento.',
  primaryColor: 'Cor principal da identidade visual.',
  technicalSupportContact: 'Dados de contato do suporte tecnico.'
};

function isSafeImageReference(value: string) {
  if (value.startsWith('/')) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(value)) {
    return value.length <= 300_000;
  }

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function normalizeSettings(values: Partial<Record<keyof AppSettings, unknown>>) {
  return settingsSchema.parse({
    ...defaultSettings,
    ...values,
    technicalSupportContact: {
      ...defaultSettings.technicalSupportContact,
      ...(typeof values.technicalSupportContact === 'object' && values.technicalSupportContact
        ? values.technicalSupportContact
        : {})
    }
  });
}

export async function getSettings() {
  const rows = await prisma.systemSetting.findMany({
    where: { deletedAt: null }
  });

  const values = Object.fromEntries(rows.map((row) => [row.key, parseJson<unknown>(row.value, undefined)])) as Partial<
    Record<keyof AppSettings, unknown>
  >;
  return normalizeSettings(values);
}

export async function getPublicSettings() {
  return getSettings().catch(() => defaultSettings);
}

export async function updateSettings(input: AppSettings, actorId: string) {
  const settings = settingsSchema.parse(input);

  await prisma.$transaction(
    Object.entries(settings).map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: {
          value: stringifyJson(value),
          description: settingDescriptions[key as keyof AppSettings],
          isPublic: true,
          updatedById: actorId,
          deletedAt: null
        },
        create: {
          key,
          value: stringifyJson(value),
          description: settingDescriptions[key as keyof AppSettings],
          isPublic: true,
          updatedById: actorId
        }
      })
    )
  );

  return getSettings();
}

export function getLogoUploadPolicy() {
  return {
    prepared: true,
    storage: 'pending',
    acceptedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    maxBytes: 300_000,
    currentField: 'logoUrl',
    note: 'Nesta versao, informe uma URL segura ou data URL de imagem. O armazenamento fisico sera acoplado depois.'
  };
}
