import {
  Archive,
  Copy,
  Edit,
  Eye,
  FilePlus2,
  GitBranch,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Upload
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  Toast
} from '../components/ui';
import { api } from '../lib/api';

type ProcedureStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type ProcedureDifficulty = 'EASY' | 'MEDIUM' | 'ADVANCED';

type Category = {
  id: string;
  name: string;
};

type Procedure = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  description: string | null;
  categoryId: string;
  category: Category;
  keywords: string[];
  symptoms: string[];
  difficulty: ProcedureDifficulty;
  estimatedMinutes: number | null;
  status: ProcedureStatus;
  featured: boolean;
  author: { id: string; name: string; email: string };
  publishedAt: string | null;
  deletedAt: string | null;
  stepCount: number;
};

type ProcedureForm = {
  title: string;
  slug: string;
  summary: string;
  description: string;
  categoryId: string;
  keywords: string;
  symptoms: string;
  difficulty: ProcedureDifficulty;
  estimatedMinutes: string;
  featured: boolean;
  status: ProcedureStatus;
};

const emptyForm: ProcedureForm = {
  title: '',
  slug: '',
  summary: '',
  description: '',
  categoryId: '',
  keywords: '',
  symptoms: '',
  difficulty: 'EASY',
  estimatedMinutes: '',
  featured: false,
  status: 'DRAFT'
};

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function csvToArray(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'data' in error.response &&
    typeof error.response.data === 'object' &&
    error.response.data !== null &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  return 'Nao foi possivel completar a acao agora.';
}

export function ProceduresPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [deleted, setDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);
  const [previewProcedure, setPreviewProcedure] = useState<Procedure | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  async function loadProcedures(nextPage = page) {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/procedures', {
        params: {
          page: nextPage,
          pageSize: 10,
          q: search || undefined,
          categoryId: categoryId || undefined,
          status: status || undefined,
          difficulty: difficulty || undefined,
          deleted
        }
      });

      setProcedures(response.data.data);
      setPage(response.data.meta.page);
      setTotalPages(response.data.meta.totalPages);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get('/categories', { params: { status: 'ACTIVE' } })
      .then((response) => setCategories(response.data.data))
      .catch(() => setError('Nao foi possivel carregar categorias.'));
  }, []);

  useEffect(() => {
    void loadProcedures(1);
  }, [categoryId, status, difficulty, deleted]);

  if (!hasPermission('procedures.manage')) {
    return (
      <AppLayout>
        <EmptyState title="Acesso restrito" description="Seu perfil nao possui permissao para gerenciar procedimentos." />
      </AppLayout>
    );
  }

  function openCreate() {
    setEditingProcedure(null);
    setFormOpen(true);
  }

  function openEdit(procedure: Procedure) {
    setEditingProcedure(procedure);
    setFormOpen(true);
  }

  async function runAction(path: string, successMessage: string, method: 'post' | 'patch' | 'delete' = 'patch') {
    if (method === 'post') {
      await api.post(path);
    } else if (method === 'delete') {
      await api.delete(path);
    } else {
      await api.patch(path);
    }

    setMessage(successMessage);
    await loadProcedures();
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Administracao"
        title="Procedimentos"
        description="Cadastre dados gerais dos procedimentos. O editor completo de fluxo entra em uma etapa posterior."
        actions={<Button icon={<FilePlus2 size={18} aria-hidden="true" />} onClick={openCreate}>Novo procedimento</Button>}
      />

      {message && <Toast tone="success" message={message} />}
      {error && <Toast tone="error" message={error} />}

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_170px_170px_140px_auto]">
          <Input placeholder="Buscar por titulo ou palavra-chave" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar procedimentos" />
          <Select
            aria-label="Categoria"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            options={[{ label: 'Todas categorias', value: '' }, ...categories.map((item) => ({ label: item.name, value: item.id }))]}
          />
          <Select
            aria-label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { label: 'Todos status', value: '' },
              { label: 'Rascunho', value: 'DRAFT' },
              { label: 'Publicado', value: 'PUBLISHED' },
              { label: 'Arquivado', value: 'ARCHIVED' }
            ]}
          />
          <Select
            aria-label="Dificuldade"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
            options={[
              { label: 'Todas dificuldades', value: '' },
              { label: 'Facil', value: 'EASY' },
              { label: 'Media', value: 'MEDIUM' },
              { label: 'Avancada', value: 'ADVANCED' }
            ]}
          />
          <label className="flex min-h-11 items-center gap-2 rounded border border-slate-300 px-3 text-sm text-slate-700">
            <input type="checkbox" checked={deleted} onChange={(event) => setDeleted(event.target.checked)} />
            Excluidos
          </label>
          <Button variant="secondary" icon={<Search size={18} aria-hidden="true" />} onClick={() => void loadProcedures(1)}>
            Buscar
          </Button>
        </div>
      </section>

      {loading ? (
        <LoadingState label="Carregando procedimentos..." />
      ) : (
        <DataTable
          data={procedures}
          emptyTitle="Nenhum procedimento encontrado"
          emptyDescription="Crie um procedimento ou ajuste os filtros."
          columns={[
            {
              key: 'title',
              header: 'Procedimento',
              render: (procedure) => (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-950">{procedure.title}</p>
                    {procedure.featured && <Star className="text-amber-500" size={15} aria-hidden="true" />}
                  </div>
                  <p className="text-xs text-slate-500">/{procedure.slug}</p>
                </div>
              )
            },
            { key: 'category', header: 'Categoria', render: (procedure) => procedure.category.name },
            { key: 'steps', header: 'Etapas', render: (procedure) => procedure.stepCount },
            { key: 'difficulty', header: 'Dificuldade', render: (procedure) => difficultyBadge(procedure.difficulty) },
            { key: 'status', header: 'Status', render: (procedure) => statusBadge(procedure.status, procedure.deletedAt) },
            {
              key: 'actions',
              header: 'Acoes',
              render: (procedure) => (
                <div className="flex flex-wrap gap-2">
                  <Button className="h-10 w-10 px-0" variant="secondary" title="Preview" icon={<Eye size={16} aria-hidden="true" />} onClick={() => setPreviewProcedure(procedure)} />
                  {!procedure.deletedAt && (
                    <Button className="h-10 w-10 px-0" variant="secondary" title="Editar etapas" icon={<GitBranch size={16} aria-hidden="true" />} onClick={() => navigate(`/procedures/${procedure.id}/steps`)} />
                  )}
                  {!procedure.deletedAt && (
                    <Button className="h-10 w-10 px-0" variant="secondary" title="Editar" icon={<Edit size={16} aria-hidden="true" />} onClick={() => openEdit(procedure)} />
                  )}
                  {!procedure.deletedAt && (
                    <Button
                      className="h-10 w-10 px-0"
                      variant="secondary"
                      title="Duplicar"
                      icon={<Copy size={16} aria-hidden="true" />}
                      onClick={() =>
                        setConfirmAction({
                          title: 'Duplicar procedimento',
                          description: `Criar uma copia em rascunho de ${procedure.title}?`,
                          action: () => runAction(`/procedures/${procedure.id}/duplicate`, 'Procedimento duplicado.', 'post')
                        })
                      }
                    />
                  )}
                  {!procedure.deletedAt && procedure.status !== 'PUBLISHED' && (
                    <Button
                      className="h-10 w-10 px-0"
                      variant="secondary"
                      title="Publicar"
                      icon={<Upload size={16} aria-hidden="true" />}
                      onClick={() =>
                        setConfirmAction({
                          title: 'Publicar procedimento',
                          description: 'A publicacao sera bloqueada se o procedimento ainda nao tiver etapas.',
                          action: () => runAction(`/procedures/${procedure.id}/publish`, 'Procedimento publicado.')
                        })
                      }
                    />
                  )}
                  {!procedure.deletedAt && procedure.status !== 'ARCHIVED' && (
                    <Button
                      className="h-10 w-10 px-0"
                      variant="secondary"
                      title="Arquivar"
                      icon={<Archive size={16} aria-hidden="true" />}
                      onClick={() =>
                        setConfirmAction({
                          title: 'Arquivar procedimento',
                          description: `Arquivar ${procedure.title}?`,
                          action: () => runAction(`/procedures/${procedure.id}/archive`, 'Procedimento arquivado.')
                        })
                      }
                    />
                  )}
                  {procedure.deletedAt ? (
                    <Button
                      className="h-10 w-10 px-0"
                      variant="secondary"
                      title="Restaurar"
                      icon={<RotateCcw size={16} aria-hidden="true" />}
                      onClick={() =>
                        setConfirmAction({
                          title: 'Restaurar procedimento',
                          description: `Restaurar ${procedure.title} como rascunho?`,
                          action: () => runAction(`/procedures/${procedure.id}/restore`, 'Procedimento restaurado.')
                        })
                      }
                    />
                  ) : (
                    <Button
                      className="h-10 w-10 px-0"
                      variant="danger"
                      title="Excluir"
                      icon={<Trash2 size={16} aria-hidden="true" />}
                      onClick={() =>
                        setConfirmAction({
                          title: 'Excluir procedimento',
                          description: `Remover logicamente ${procedure.title}?`,
                          action: () => runAction(`/procedures/${procedure.id}`, 'Procedimento removido.', 'delete')
                        })
                      }
                    />
                  )}
                </div>
              )
            }
          ]}
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadProcedures(nextPage)} />

      <ProcedureFormModal
        open={formOpen}
        procedure={editingProcedure}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setMessage(editingProcedure ? 'Procedimento atualizado.' : 'Procedimento criado como rascunho.');
          setFormOpen(false);
          await loadProcedures(editingProcedure ? page : 1);
        }}
      />

      <ProcedurePreviewModal procedure={previewProcedure} onClose={() => setPreviewProcedure(null)} />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.description ?? ''}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) {
            return;
          }

          confirmAction
            .action()
            .catch((actionError) => setError(getErrorMessage(actionError)))
            .finally(() => setConfirmAction(null));
        }}
      />
    </AppLayout>
  );
}

function statusBadge(status: ProcedureStatus, deletedAt: string | null) {
  if (deletedAt) {
    return <Badge tone="amber">Excluido</Badge>;
  }

  const labels = {
    DRAFT: 'Rascunho',
    PUBLISHED: 'Publicado',
    ARCHIVED: 'Arquivado'
  };

  return <Badge tone={status === 'PUBLISHED' ? 'green' : status === 'ARCHIVED' ? 'amber' : 'slate'}>{labels[status]}</Badge>;
}

function difficultyBadge(difficulty: ProcedureDifficulty) {
  const labels = {
    EASY: 'Facil',
    MEDIUM: 'Media',
    ADVANCED: 'Avancada'
  };

  return <Badge tone={difficulty === 'ADVANCED' ? 'amber' : difficulty === 'MEDIUM' ? 'blue' : 'green'}>{labels[difficulty]}</Badge>;
}

function ProcedureFormModal({
  open,
  procedure,
  categories,
  onClose,
  onSaved
}: {
  open: boolean;
  procedure: Procedure | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<ProcedureForm>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setSlugTouched(Boolean(procedure));
    setForm(
      procedure
        ? {
            title: procedure.title,
            slug: procedure.slug,
            summary: procedure.summary,
            description: procedure.description ?? '',
            categoryId: procedure.categoryId,
            keywords: procedure.keywords.join(', '),
            symptoms: procedure.symptoms.join(', '),
            difficulty: procedure.difficulty,
            estimatedMinutes: procedure.estimatedMinutes ? String(procedure.estimatedMinutes) : '',
            featured: procedure.featured,
            status: procedure.status
          }
        : { ...emptyForm, categoryId: categories[0]?.id ?? '' }
    );
  }, [categories, open, procedure]);

  function updateTitle(title: string) {
    setForm((current) => ({
      ...current,
      title,
      slug: slugTouched ? current.slug : slugify(title)
    }));
  }

  function updateField<K extends keyof ProcedureForm>(key: K, value: ProcedureForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload = {
        title: form.title,
        slug: form.slug,
        summary: form.summary,
        description: form.description || null,
        categoryId: form.categoryId,
        keywords: csvToArray(form.keywords),
        symptoms: csvToArray(form.symptoms),
        difficulty: form.difficulty,
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : null,
        featured: form.featured,
        status: form.status
      };

      if (procedure) {
        await api.put(`/procedures/${procedure.id}`, payload);
      } else {
        await api.post('/procedures', payload);
      }

      await onSaved();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={procedure ? 'Editar procedimento' : 'Novo procedimento'} onClose={onClose}>
      {error && <div className="mb-4"><Toast tone="error" message={error} /></div>}
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <Input label="Titulo" value={form.title} onChange={(event) => updateTitle(event.target.value)} required />
        <Input
          label="Slug"
          value={form.slug}
          onChange={(event) => {
            setSlugTouched(true);
            updateField('slug', slugify(event.target.value));
          }}
          required
        />
        <Textarea label="Resumo" value={form.summary} onChange={(event) => updateField('summary', event.target.value)} required />
        <Textarea label="Descricao" value={form.description} onChange={(event) => updateField('description', event.target.value)} />
        <Select
          label="Categoria"
          value={form.categoryId}
          onChange={(event) => updateField('categoryId', event.target.value)}
          options={categories.map((item) => ({ label: item.name, value: item.id }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Palavras-chave" value={form.keywords} onChange={(event) => updateField('keywords', event.target.value)} placeholder="boleto, lentidao, wifi" />
          <Input label="Sintomas relacionados" value={form.symptoms} onChange={(event) => updateField('symptoms', event.target.value)} placeholder="sem sinal, oscilando" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Dificuldade"
            value={form.difficulty}
            onChange={(event) => updateField('difficulty', event.target.value as ProcedureDifficulty)}
            options={[
              { label: 'Facil', value: 'EASY' },
              { label: 'Media', value: 'MEDIUM' },
              { label: 'Avancada', value: 'ADVANCED' }
            ]}
          />
          <Input label="Tempo estimado" type="number" min={1} value={form.estimatedMinutes} onChange={(event) => updateField('estimatedMinutes', event.target.value)} />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => updateField('status', event.target.value as ProcedureStatus)}
            options={[
              { label: 'Rascunho', value: 'DRAFT' },
              { label: 'Arquivado', value: 'ARCHIVED' }
            ]}
          />
        </div>
        <label className="flex min-h-11 items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(event) => updateField('featured', event.target.checked)} />
          Procedimento em destaque
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar rascunho'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ProcedurePreviewModal({ procedure, onClose }: { procedure: Procedure | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(procedure)} title="Previa do procedimento" onClose={onClose}>
      {procedure && (
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {statusBadge(procedure.status, procedure.deletedAt)}
              {difficultyBadge(procedure.difficulty)}
              {procedure.featured && <Badge tone="blue">Destaque</Badge>}
            </div>
            <h2 className="text-xl font-semibold text-slate-950">{procedure.title}</h2>
            <p className="mt-1 text-sm text-slate-500">/{procedure.slug}</p>
          </div>
          <p className="rounded bg-slate-50 p-3 text-sm leading-6 text-slate-700">{procedure.summary}</p>
          {procedure.description && <p className="text-sm leading-6 text-slate-700">{procedure.description}</p>}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Categoria" value={procedure.category.name} />
            <Detail label="Autor" value={procedure.author.name} />
            <Detail label="Etapas" value={String(procedure.stepCount)} />
            <Detail label="Tempo" value={procedure.estimatedMinutes ? `${procedure.estimatedMinutes} min` : '-'} />
            <Detail label="Publicado em" value={procedure.publishedAt ? new Date(procedure.publishedAt).toLocaleString('pt-BR') : '-'} />
            <Detail label="Palavras-chave" value={procedure.keywords.join(', ') || '-'} />
            <Detail label="Sintomas" value={procedure.symptoms.join(', ') || '-'} />
          </dl>
        </div>
      )}
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-800">{value}</dd>
    </div>
  );
}
