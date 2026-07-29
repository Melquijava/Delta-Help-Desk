import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpenCheck, Save, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Button, EmptyState, Input, LoadingState, PageHeader, Textarea, Toast } from '../components/ui';
import { api } from '../lib/api';
import { appSettingsSchema, type AppSettings, useSettings } from '../settings/SettingsContext';

const settingsFormSchema = appSettingsSchema.extend({
  logoUrl: z.string().optional().nullable()
});

type SettingsForm = z.infer<typeof settingsFormSchema>;

type LogoPolicy = {
  prepared: boolean;
  acceptedTypes: string[];
  maxBytes: number;
  note: string;
};

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const { settings, refreshSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoPolicy, setLogoPolicy] = useState<LogoPolicy | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: settings
  });

  const preview = watch();

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError(null);
      try {
        const [settingsResponse, policyResponse] = await Promise.all([
          api.get('/settings'),
          api.get('/settings/logo-upload-policy')
        ]);
        reset(settingsFormSchema.parse(settingsResponse.data.data));
        setLogoPolicy(policyResponse.data.data);
      } catch {
        setError('Nao foi possivel carregar configuracoes.');
      } finally {
        setLoading(false);
      }
    }

    if (hasPermission('settings.manage')) {
      void loadSettings();
    }
  }, [hasPermission, reset]);

  if (!hasPermission('settings.manage')) {
    return (
      <AppLayout>
        <EmptyState title="Acesso restrito" description="Seu perfil nao possui permissao para alterar configuracoes." />
      </AppLayout>
    );
  }

  async function onSubmit(data: SettingsForm) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: AppSettings = {
        ...data,
        logoUrl: data.logoUrl?.trim() || null,
        technicalSupportContact: {
          name: data.technicalSupportContact.name?.trim() || null,
          email: data.technicalSupportContact.email?.trim() || null,
          phone: data.technicalSupportContact.phone?.trim() || null,
          hours: data.technicalSupportContact.hours?.trim() || null,
          notes: data.technicalSupportContact.notes?.trim() || null
        }
      };

      await api.put('/settings', payload);
      await refreshSettings();
      reset(payload);
      setSuccess('Configuracoes salvas e aplicadas.');
    } catch {
      setError('Nao foi possivel salvar. Verifique os valores informados.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogoFile(file: File | undefined) {
    if (!file || !logoPolicy) return;

    if (!logoPolicy.acceptedTypes.includes(file.type)) {
      setError('Formato de logotipo nao permitido.');
      return;
    }

    if (file.size > logoPolicy.maxBytes) {
      setError('Arquivo maior que o limite preparado para esta versao.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setValue('logoUrl', String(reader.result), { shouldDirty: true, shouldValidate: true });
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Administracao"
        title="Configuracoes"
        description="Ajuste identidade visual, comportamento do atendimento e contato do suporte tecnico."
        actions={
          <Button type="submit" form="settings-form" disabled={saving} icon={<Save size={18} aria-hidden="true" />}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        }
      />

      {error && <Toast tone="error" message={error} />}
      {success && <Toast tone="success" message={success} />}

      {loading ? (
        <LoadingState label="Carregando configuracoes..." />
      ) : (
        <form id="settings-form" className="grid gap-5 xl:grid-cols-[1fr_380px]" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-5">
            <section className="rounded border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-950">Identidade</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input label="Nome da empresa" error={errors.companyName?.message} {...register('companyName')} />
                <Input label="Nome do sistema" error={errors.systemName?.message} {...register('systemName')} />
                <Input label="Cor principal" type="color" className="h-12 p-1" error={errors.primaryColor?.message} {...register('primaryColor')} />
                <Input label="URL do logotipo" placeholder="https://... ou /logo.png" error={errors.logoUrl?.message} {...register('logoUrl')} />
              </div>
              <div className="mt-4">
                <Textarea label="Mensagem de boas-vindas" error={errors.welcomeMessage?.message} {...register('welcomeMessage')} />
              </div>
              <div className="mt-4 rounded border border-dashed border-slate-300 p-4">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  <Upload size={18} aria-hidden="true" />
                  Preparar logotipo
                  <input
                    className="sr-only"
                    type="file"
                    accept={logoPolicy?.acceptedTypes.join(',')}
                    onChange={(event) => handleLogoFile(event.target.files?.[0])}
                  />
                </label>
                <p className="mt-2 text-sm text-slate-500">
                  {logoPolicy?.note ?? 'Upload preparado para uma etapa posterior de armazenamento.'}
                </p>
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-950">Comportamento</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input label="Itens por pagina" type="number" min={5} max={100} error={errors.itemsPerPage?.message} {...register('itemsPerPage', { valueAsNumber: true })} />
                <Input label="Tempo de sessao em minutos" type="number" min={15} max={480} error={errors.sessionTimeoutMinutes?.message} {...register('sessionTimeoutMinutes', { valueAsNumber: true })} />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Switch label="Permitir feedback" checked={preview.allowFeedback} onChange={(checked) => setValue('allowFeedback', checked, { shouldDirty: true })} />
                <Switch label="Permitir favoritos" checked={preview.allowFavorites} onChange={(checked) => setValue('allowFavorites', checked, { shouldDirty: true })} />
                <Switch label="Exibir destaques" checked={preview.showFeaturedProcedures} onChange={(checked) => setValue('showFeaturedProcedures', checked, { shouldDirty: true })} />
                <Switch label="Exigir observacao ao nao resolver" checked={preview.requireNoteOnNotResolved} onChange={(checked) => setValue('requireNoteOnNotResolved', checked, { shouldDirty: true })} />
                <Switch label="Exigir observacao ao encaminhar" checked={preview.requireNoteOnEscalation} onChange={(checked) => setValue('requireNoteOnEscalation', checked, { shouldDirty: true })} />
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-950">Suporte tecnico</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input label="Nome do contato" {...register('technicalSupportContact.name')} />
                <Input label="E-mail" type="email" error={errors.technicalSupportContact?.email?.message} {...register('technicalSupportContact.email')} />
                <Input label="Telefone" {...register('technicalSupportContact.phone')} />
                <Input label="Horario de atendimento" {...register('technicalSupportContact.hours')} />
              </div>
              <div className="mt-4">
                <Textarea label="Observacoes do suporte" {...register('technicalSupportContact.notes')} />
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <IdentityPreview settings={preview} />
            <section className="rounded border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-950">Seguranca</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                O backend valida limites seguros: sessao entre 15 e 480 minutos, paginacao entre 5 e 100 itens,
                logotipo apenas em URL segura, caminho local ou data URL de imagem limitada.
              </p>
            </section>
          </aside>
        </form>
      )}
    </AppLayout>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
      <span>{label}</span>
      <button
        className={`relative h-7 w-12 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${checked ? 'bg-brand-600' : 'bg-slate-300'}`}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </label>
  );
}

function IdentityPreview({ settings }: { settings: SettingsForm }) {
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white">
      <div className="p-5" style={{ backgroundColor: settings.primaryColor || '#0284c7' }}>
        <div className="flex items-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-white text-slate-950">
            {settings.logoUrl ? <img className="h-9 w-9 object-contain" src={settings.logoUrl} alt="" /> : <BookOpenCheck size={24} aria-hidden="true" />}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase opacity-80">{settings.companyName || 'Empresa'}</p>
            <p className="text-lg font-semibold">{settings.systemName || 'Sistema'}</p>
          </div>
        </div>
      </div>
      <div className="p-5">
        <p className="text-sm font-semibold text-slate-950">Preview da atendente</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{settings.welcomeMessage || 'Mensagem de boas-vindas'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {settings.allowFavorites && <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">Favoritos ativos</span>}
          {settings.allowFeedback && <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">Feedback ativo</span>}
          {settings.showFeaturedProcedures && <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">Destaques ativos</span>}
        </div>
      </div>
    </section>
  );
}
