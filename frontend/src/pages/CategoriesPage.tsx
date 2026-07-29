import {
  CalendarClock,
  Edit,
  Gauge,
  Plus,
  Power,
  Receipt,
  Router,
  Search,
  Settings,
  Trash2,
  Wifi,
  WifiOff,
  ArrowDown,
  ArrowUp
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  Textarea,
  Toast
} from '../components/ui';
import { api } from '../lib/api';

type CategoryStatus = 'ACTIVE' | 'INACTIVE';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  order: number;
  status: CategoryStatus;
  procedureCount: number;
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  status: CategoryStatus;
};

const iconOptions = [
  { label: 'Velocidade', value: 'gauge' },
  { label: 'Sem Wi-Fi', value: 'wifi-off' },
  { label: 'Wi-Fi', value: 'wifi' },
  { label: 'Roteador', value: 'router' },
  { label: 'Configuracao', value: 'settings' },
  { label: 'Financeiro', value: 'receipt' },
  { label: 'Visita tecnica', value: 'calendar-clock' }
];

const colorOptions = ['#0284c7', '#0f172a', '#0ea5e9', '#0369a1', '#334155', '#16a34a', '#f59e0b'];

const iconMap = {
  gauge: Gauge,
  'wifi-off': WifiOff,
  wifi: Wifi,
  router: Router,
  settings: Settings,
  receipt: Receipt,
  'calendar-clock': CalendarClock
};

const emptyForm: CategoryForm = {
  name: '',
  slug: '',
  description: '',
  icon: 'gauge',
  color: '#0284c7',
  order: 0,
  status: 'ACTIVE'
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

export function CategoriesPage() {
  const { hasPermission } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  async function loadCategories() {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/categories', {
        params: {
          q: search || undefined,
          status: status || undefined
        }
      });
      setCategories(response.data.data);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [status]);

  if (!hasPermission('categories.manage')) {
    return (
      <AppLayout>
        <EmptyState title="Acesso restrito" description="Seu perfil nao possui permissao para gerenciar categorias." />
      </AppLayout>
    );
  }

  function openCreate() {
    setEditingCategory(null);
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditingCategory(category);
    setFormOpen(true);
  }

  async function toggleStatus(category: Category) {
    const nextStatus = category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await api.patch(`/categories/${category.id}/status`, { status: nextStatus });
    setMessage(nextStatus === 'ACTIVE' ? 'Categoria ativada.' : 'Categoria desativada.');
    await loadCategories();
  }

  async function deleteCategory(category: Category) {
    await api.delete(`/categories/${category.id}`);
    setMessage('Categoria removida logicamente.');
    await loadCategories();
  }

  async function moveCategory(category: Category, direction: 'up' | 'down') {
    await api.patch(`/categories/${category.id}/move`, { direction });
    setMessage('Ordenacao atualizada.');
    await loadCategories();
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Administracao"
        title="Categorias"
        description="Organize os assuntos usados nos procedimentos do Delta Help Desk."
        actions={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={openCreate}>Nova categoria</Button>}
      />

      {message && <Toast tone="success" message={message} />}
      {error && <Toast tone="error" message={error} />}

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
          <Input
            aria-label="Buscar categorias"
            placeholder="Buscar por nome, slug ou descricao"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            aria-label="Filtrar status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { label: 'Todos status', value: '' },
              { label: 'Ativas', value: 'ACTIVE' },
              { label: 'Inativas', value: 'INACTIVE' }
            ]}
          />
          <Button variant="secondary" icon={<Search size={18} aria-hidden="true" />} onClick={() => void loadCategories()}>
            Buscar
          </Button>
        </div>
      </section>

      {loading ? (
        <LoadingState label="Carregando categorias..." />
      ) : categories.length === 0 ? (
        <EmptyState title="Nenhuma categoria encontrada" description="Crie categorias para organizar procedimentos por assunto." action={<Button onClick={openCreate}>Criar categoria</Button>} />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {categories.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              isFirst={index === 0}
              isLast={index === categories.length - 1}
              onEdit={() => openEdit(category)}
              onMove={(direction) => void moveCategory(category, direction)}
              onToggle={() =>
                setConfirmAction({
                  title: category.status === 'ACTIVE' ? 'Desativar categoria' : 'Ativar categoria',
                  description: `Confirma ${category.status === 'ACTIVE' ? 'desativar' : 'ativar'} ${category.name}?`,
                  action: () => toggleStatus(category)
                })
              }
              onDelete={() =>
                setConfirmAction({
                  title: 'Excluir categoria',
                  description: `A categoria ${category.name} sera removida logicamente. Procedimentos vinculados nao serao apagados.`,
                  action: () => deleteCategory(category)
                })
              }
            />
          ))}
        </section>
      )}

      <CategoryFormModal
        open={formOpen}
        category={editingCategory}
        nextOrder={categories.length + 1}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setMessage(editingCategory ? 'Categoria atualizada.' : 'Categoria criada.');
          setFormOpen(false);
          await loadCategories();
        }}
      />

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

function CategoryCard({
  category,
  isFirst,
  isLast,
  onEdit,
  onToggle,
  onDelete,
  onMove
}: {
  category: Category;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (direction: 'up' | 'down') => void;
}) {
  const Icon = iconMap[(category.icon ?? 'gauge') as keyof typeof iconMap] ?? Gauge;
  const color = category.color ?? '#0284c7';

  return (
    <article className="rounded border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded text-white" style={{ backgroundColor: color }}>
            <Icon size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold text-slate-950">{category.name}</h2>
              <Badge tone={category.status === 'ACTIVE' ? 'green' : 'amber'}>{category.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">/{category.slug}</p>
          </div>
        </div>
        <Badge tone="blue">{category.procedureCount} procedimentos</Badge>
      </div>

      <p className="mt-3 min-h-10 text-sm leading-5 text-slate-600">{category.description ?? 'Sem descricao.'}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="h-10 w-10 px-0" variant="secondary" title="Subir" disabled={isFirst} icon={<ArrowUp size={16} aria-hidden="true" />} onClick={() => onMove('up')} />
        <Button className="h-10 w-10 px-0" variant="secondary" title="Descer" disabled={isLast} icon={<ArrowDown size={16} aria-hidden="true" />} onClick={() => onMove('down')} />
        <Button className="h-10 w-10 px-0" variant="secondary" title="Editar" icon={<Edit size={16} aria-hidden="true" />} onClick={onEdit} />
        <Button className="h-10 w-10 px-0" variant="secondary" title={category.status === 'ACTIVE' ? 'Desativar' : 'Ativar'} icon={<Power size={16} aria-hidden="true" />} onClick={onToggle} />
        <Button className="h-10 w-10 px-0" variant="danger" title="Excluir" icon={<Trash2 size={16} aria-hidden="true" />} onClick={onDelete} />
      </div>
    </article>
  );
}

function CategoryFormModal({
  open,
  category,
  nextOrder,
  onClose,
  onSaved
}: {
  open: boolean;
  category: Category | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const Icon = iconMap[form.icon as keyof typeof iconMap] ?? Gauge;

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setSlugTouched(Boolean(category));
    setForm(
      category
        ? {
            name: category.name,
            slug: category.slug,
            description: category.description ?? '',
            icon: category.icon ?? 'gauge',
            color: category.color ?? '#0284c7',
            order: category.order,
            status: category.status
          }
        : { ...emptyForm, order: nextOrder }
    );
  }, [category, nextOrder, open]);

  function updateName(name: string) {
    setForm((current) => ({
      ...current,
      name,
      slug: slugTouched ? current.slug : slugify(name)
    }));
  }

  function updateField<K extends keyof CategoryForm>(key: K, value: CategoryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload = {
        ...form,
        description: form.description || null,
        icon: form.icon || null,
        color: form.color || null
      };

      if (category) {
        await api.put(`/categories/${category.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }

      await onSaved();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={category ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
      {error && <div className="mb-4"><Toast tone="error" message={error} /></div>}

      <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-medium text-slate-700">Preview</p>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded text-white" style={{ backgroundColor: form.color }}>
            <Icon size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-slate-950">{form.name || 'Nome da categoria'}</p>
            <p className="text-xs text-slate-500">/{form.slug || 'slug-da-categoria'}</p>
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <Input label="Nome" value={form.name} onChange={(event) => updateName(event.target.value)} required />
        <Input
          label="Slug"
          value={form.slug}
          onChange={(event) => {
            setSlugTouched(true);
            updateField('slug', slugify(event.target.value));
          }}
          required
        />
        <Textarea label="Descricao" value={form.description} onChange={(event) => updateField('description', event.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Icone" value={form.icon} onChange={(event) => updateField('icon', event.target.value)} options={iconOptions} />
          <Select
            label="Status"
            value={form.status}
            onChange={(event) => updateField('status', event.target.value as CategoryStatus)}
            options={[
              { label: 'Ativa', value: 'ACTIVE' },
              { label: 'Inativa', value: 'INACTIVE' }
            ]}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Cor visual</p>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((color) => (
              <button
                aria-label={`Selecionar cor ${color}`}
                className="h-11 w-11 rounded border border-slate-300 ring-offset-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
                key={color}
                onClick={() => updateField('color', color)}
                style={{
                  backgroundColor: color,
                  outline: form.color === color ? '3px solid #0ea5e9' : undefined
                }}
                type="button"
              />
            ))}
          </div>
        </div>
        <Input label="Ordem" type="number" min={0} value={form.order} onChange={(event) => updateField('order', Number(event.target.value))} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  );
}
