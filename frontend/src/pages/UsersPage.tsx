import { Edit, Eye, Plus, Power, Search, Trash2, UserCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

type Role = {
  id: string;
  name: string;
  slug: string;
};

type UserStatus = 'ACTIVE' | 'INACTIVE';

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  registration: string | null;
  status: UserStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Role[];
};

type UserForm = {
  name: string;
  email: string;
  phone: string;
  registration: string;
  password: string;
  status: UserStatus;
  notes: string;
  roleIds: string[];
};

const emptyForm: UserForm = {
  name: '',
  email: '',
  phone: '',
  registration: '',
  password: '',
  status: 'ACTIVE',
  notes: '',
  roleIds: []
};

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

export function UsersPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsUser, setDetailsUser] = useState<ManagedUser | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  const roleOptions = useMemo(
    () => [{ label: 'Todos os cargos', value: '' }, ...roles.map((item) => ({ label: item.name, value: item.slug }))],
    [roles]
  );

  async function loadUsers(nextPage = page) {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/users', {
        params: {
          page: nextPage,
          pageSize: 10,
          q: search || undefined,
          status: status || undefined,
          role: role || undefined
        }
      });

      setUsers(response.data.data);
      setTotalPages(response.data.meta.totalPages);
      setPage(response.data.meta.page);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get('/users/roles')
      .then((response) => setRoles(response.data.data))
      .catch(() => setError('Nao foi possivel carregar cargos.'));
  }, []);

  useEffect(() => {
    void loadUsers(1);
  }, [status, role]);

  if (!hasPermission('users.manage')) {
    return (
      <AppLayout>
        <EmptyState title="Acesso restrito" description="Seu perfil nao possui permissao para gerenciar usuarios." />
      </AppLayout>
    );
  }

  function openCreate() {
    setEditingUser(null);
    setFormOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditingUser(user);
    setFormOpen(true);
  }

  async function toggleStatus(user: ManagedUser) {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    await api.patch(`/users/${user.id}/status`, { status: nextStatus });
    setMessage(nextStatus === 'ACTIVE' ? 'Usuario ativado.' : 'Usuario desativado.');
    await loadUsers();
  }

  async function deleteUser(user: ManagedUser) {
    await api.delete(`/users/${user.id}`);
    setMessage('Usuario removido.');
    await loadUsers();
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Administracao"
        title="Usuarios"
        description="Gerencie atendentes, administradores, cargos e acesso ao Delta Help Desk."
        actions={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={openCreate}>Novo usuario</Button>}
      />

      {message && <Toast tone="success" message={message} />}
      {error && <Toast tone="error" message={error} />}

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_220px_auto]">
          <Input
            aria-label="Buscar usuarios"
            placeholder="Buscar por nome, e-mail, telefone ou matricula"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Select
            aria-label="Filtrar por status"
            options={[
              { label: 'Todos status', value: '' },
              { label: 'Ativos', value: 'ACTIVE' },
              { label: 'Inativos', value: 'INACTIVE' }
            ]}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
          <Select aria-label="Filtrar por cargo" options={roleOptions} value={role} onChange={(event) => setRole(event.target.value)} />
          <Button variant="secondary" icon={<Search size={18} aria-hidden="true" />} onClick={() => void loadUsers(1)}>
            Buscar
          </Button>
        </div>
      </section>

      {loading ? (
        <LoadingState label="Carregando usuarios..." />
      ) : (
        <DataTable
          data={users}
          emptyTitle="Nenhum usuario encontrado"
          emptyDescription="Ajuste os filtros ou cadastre um novo usuario."
          columns={[
            {
              key: 'name',
              header: 'Usuario',
              render: (user) => (
                <div>
                  <p className="font-medium text-slate-950">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              )
            },
            {
              key: 'registration',
              header: 'Matricula',
              render: (user) => user.registration ?? '-'
            },
            {
              key: 'roles',
              header: 'Cargos',
              render: (user) => (
                <div className="flex flex-wrap gap-1">
                  {user.roles.map((item) => (
                    <Badge key={item.id} tone={item.slug === 'admin' ? 'blue' : 'slate'}>
                      {item.name}
                    </Badge>
                  ))}
                </div>
              )
            },
            {
              key: 'status',
              header: 'Status',
              render: (user) => <Badge tone={user.status === 'ACTIVE' ? 'green' : 'amber'}>{user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</Badge>
            },
            {
              key: 'actions',
              header: 'Acoes',
              render: (user) => (
                <div className="flex flex-wrap gap-2">
                  <Button className="h-10 w-10 px-0" variant="secondary" title="Detalhes" icon={<Eye size={16} aria-hidden="true" />} onClick={() => setDetailsUser(user)} />
                  <Button className="h-10 w-10 px-0" variant="secondary" title="Editar" icon={<Edit size={16} aria-hidden="true" />} onClick={() => openEdit(user)} />
                  <Button
                    className="h-10 w-10 px-0"
                    variant="secondary"
                    title={user.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                    icon={<Power size={16} aria-hidden="true" />}
                    onClick={() =>
                      setConfirmAction({
                        title: user.status === 'ACTIVE' ? 'Desativar usuario' : 'Ativar usuario',
                        description: `Confirma ${user.status === 'ACTIVE' ? 'desativar' : 'ativar'} ${user.name}?`,
                        action: () => toggleStatus(user)
                      })
                    }
                  />
                  <Button
                    className="h-10 w-10 px-0"
                    variant="danger"
                    title="Excluir"
                    icon={<Trash2 size={16} aria-hidden="true" />}
                    onClick={() =>
                      setConfirmAction({
                        title: 'Excluir usuario',
                        description: `Esta acao remove logicamente ${user.name}. Confirma?`,
                        action: () => deleteUser(user)
                      })
                    }
                  />
                </div>
              )
            }
          ]}
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={(nextPage) => void loadUsers(nextPage)} />

      <UserFormModal
        open={formOpen}
        user={editingUser}
        roles={roles}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setMessage(editingUser ? 'Usuario atualizado.' : 'Usuario criado.');
          setFormOpen(false);
          await loadUsers(editingUser ? page : 1);
        }}
      />

      <UserDetailsModal user={detailsUser} onClose={() => setDetailsUser(null)} />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.description ?? ''}
        confirmLabel="Confirmar"
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

function UserFormModal({
  open,
  user,
  roles,
  onClose,
  onSaved
}: {
  open: boolean;
  user: ManagedUser | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setForm(
      user
        ? {
            name: user.name,
            email: user.email,
            phone: user.phone ?? '',
            registration: user.registration ?? '',
            password: '',
            status: user.status,
            notes: user.notes ?? '',
            roleIds: user.roles.map((role) => role.id)
          }
        : {
            ...emptyForm,
            roleIds: roles.filter((role) => role.slug === 'attendant').map((role) => role.id)
          }
    );
  }, [open, roles, user]);

  function updateField<K extends keyof UserForm>(key: K, value: UserForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const payload = {
        ...form,
        phone: form.phone || null,
        registration: form.registration || null,
        notes: form.notes || null,
        password: form.password || undefined
      };

      if (user) {
        await api.put(`/users/${user.id}`, payload);
      } else {
        await api.post('/users', payload);
      }

      await onSaved();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={user ? 'Editar usuario' : 'Novo usuario'} onClose={onClose}>
      {error && <div className="mb-4"><Toast tone="error" message={error} /></div>}
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <Input label="Nome" value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
        <Input label="E-mail" type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefone" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
          <Input label="Matricula" value={form.registration} onChange={(event) => updateField('registration', event.target.value)} />
        </div>
        <Input
          label={user ? 'Nova senha' : 'Senha'}
          type="password"
          value={form.password}
          onChange={(event) => updateField('password', event.target.value)}
          required={!user}
          placeholder={user ? 'Preencha apenas para trocar' : undefined}
        />
        <Select
          label="Status"
          options={[
            { label: 'Ativo', value: 'ACTIVE' },
            { label: 'Inativo', value: 'INACTIVE' }
          ]}
          value={form.status}
          onChange={(event) => updateField('status', event.target.value as UserStatus)}
        />
        <fieldset className="rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Cargos</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {roles.map((role) => (
              <label className="flex min-h-11 items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm" key={role.id}>
                <input
                  className="h-4 w-4"
                  type="checkbox"
                  checked={form.roleIds.includes(role.id)}
                  onChange={(event) => {
                    updateField(
                      'roleIds',
                      event.target.checked
                        ? [...form.roleIds, role.id]
                        : form.roleIds.filter((roleId) => roleId !== role.id)
                    );
                  }}
                />
                {role.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Textarea label="Observacoes" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={saving} icon={<UserCog size={18} aria-hidden="true" />}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function UserDetailsModal({ user, onClose }: { user: ManagedUser | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(user)} title="Detalhes do usuario" onClose={onClose}>
      {user && (
        <dl className="grid gap-3 text-sm">
          <Detail label="Nome" value={user.name} />
          <Detail label="E-mail" value={user.email} />
          <Detail label="Telefone" value={user.phone ?? '-'} />
          <Detail label="Matricula" value={user.registration ?? '-'} />
          <Detail label="Status" value={user.status === 'ACTIVE' ? 'Ativo' : 'Inativo'} />
          <Detail label="Cargos" value={user.roles.map((role) => role.name).join(', ')} />
          <Detail label="Observacoes" value={user.notes ?? '-'} />
        </dl>
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
