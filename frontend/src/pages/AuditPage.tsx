import { Eye, Filter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Badge, Button, DataTable, EmptyState, Input, Modal, PageHeader, Pagination, Select, Skeleton, Toast } from '../components/ui';
import { api } from '../lib/api';

type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESTORE'
  | 'PUBLISH'
  | 'ARCHIVE'
  | 'DUPLICATE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'COPY_MESSAGE';

type AuditMetadata = {
  description?: string;
  before?: unknown;
  after?: unknown;
  [key: string]: unknown;
};

type AuditLog = {
  id: string;
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  procedureId: string | null;
  metadata: AuditMetadata | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
  procedure: { id: string; title: string } | null;
};

type AuditResponse = {
  data: AuditLog[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

const actions: Array<{ label: string; value: string }> = [
  { label: 'Todas', value: '' },
  { label: 'Login', value: 'LOGIN' },
  { label: 'Logout', value: 'LOGOUT' },
  { label: 'Criacao', value: 'CREATE' },
  { label: 'Edicao', value: 'UPDATE' },
  { label: 'Exclusao logica', value: 'DELETE' },
  { label: 'Restauracao', value: 'RESTORE' },
  { label: 'Publicacao', value: 'PUBLISH' },
  { label: 'Arquivamento', value: 'ARCHIVE' },
  { label: 'Duplicacao', value: 'DUPLICATE' },
  { label: 'Copia de mensagem', value: 'COPY_MESSAGE' }
];

const entityTypes = [
  { label: 'Todas', value: '' },
  { label: 'Usuario', value: 'User' },
  { label: 'Categoria', value: 'Category' },
  { label: 'Procedimento', value: 'Procedure' },
  { label: 'Etapa', value: 'ProcedureStep' },
  { label: 'Alternativa', value: 'StepOption' },
  { label: 'Mensagem copiavel', value: 'CopyableMessage' },
  { label: 'Relatorio', value: 'Report' }
];

const actionLabels: Record<AuditAction, string> = {
  CREATE: 'Criacao',
  UPDATE: 'Edicao',
  DELETE: 'Exclusao',
  RESTORE: 'Restauracao',
  PUBLISH: 'Publicacao',
  ARCHIVE: 'Arquivamento',
  DUPLICATE: 'Duplicacao',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  COPY_MESSAGE: 'Copia'
};

const actionTones: Record<AuditAction, 'blue' | 'green' | 'amber' | 'slate'> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'amber',
  RESTORE: 'green',
  PUBLISH: 'green',
  ARCHIVE: 'amber',
  DUPLICATE: 'blue',
  LOGIN: 'slate',
  LOGOUT: 'slate',
  COPY_MESSAGE: 'blue'
};

const initialFilters = {
  q: '',
  action: '',
  entityType: '',
  entityId: '',
  startDate: '',
  endDate: ''
};

export function AuditPage() {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [logs, setLogs] = useState<AuditResponse | null>(null);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAudit(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<AuditResponse>('/audit', {
        params: {
          q: filters.q || undefined,
          action: filters.action || undefined,
          entityType: filters.entityType || undefined,
          entityId: filters.entityId || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page: nextPage,
          pageSize: 15
        }
      });
      setLogs(response.data);
      setPage(response.data.meta.page);
    } catch {
      setError('Nao foi possivel carregar a auditoria agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAudit(1);
  }, []);

  if (!hasPermission('audit.view')) {
    return (
      <AppLayout>
        <EmptyState title="Acesso restrito" description="Seu perfil nao possui permissao para visualizar auditoria." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Administracao"
        title="Auditoria"
        description="Consulte registros somente leitura de acessos e alteracoes importantes do Delta Help Desk."
      />

      {error && <Toast tone="error" message={error} />}

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_180px_220px_1fr]">
          <Input label="Buscar" placeholder="Usuario, entidade ou ID" value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} />
          <Select label="Acao" value={filters.action} onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))} options={actions} />
          <Select label="Entidade" value={filters.entityType} onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))} options={entityTypes} />
          <Input label="ID da entidade" placeholder="Opcional" value={filters.entityId} onChange={(event) => setFilters((current) => ({ ...current, entityId: event.target.value }))} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_220px_auto]">
          <Input label="Data inicial" type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
          <Input label="Data final" type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
          <div className="flex items-end">
            <Button icon={<Filter size={18} aria-hidden="true" />} onClick={() => void loadAudit(1)}>
              Filtrar
            </Button>
          </div>
        </div>
      </section>

      {loading ? (
        <AuditSkeleton />
      ) : logs && logs.data.length > 0 ? (
        <section className="space-y-4">
          <DataTable
            data={logs.data}
            columns={[
              {
                key: 'createdAt',
                header: 'Data',
                render: (log) => new Date(log.createdAt).toLocaleString('pt-BR')
              },
              {
                key: 'actor',
                header: 'Usuario',
                render: (log) => (
                  <div>
                    <p className="font-medium text-slate-900">{log.actor?.name ?? 'Sistema'}</p>
                    <p className="text-xs text-slate-500">{log.actor?.email ?? '-'}</p>
                  </div>
                )
              },
              {
                key: 'action',
                header: 'Acao',
                render: (log) => <Badge tone={actionTones[log.action]}>{actionLabels[log.action]}</Badge>
              },
              {
                key: 'entity',
                header: 'Entidade',
                render: (log) => (
                  <div>
                    <p className="font-medium">{log.entityType}</p>
                    <p className="max-w-[220px] truncate text-xs text-slate-500">{log.entityId ?? '-'}</p>
                  </div>
                )
              },
              {
                key: 'description',
                header: 'Descricao',
                render: (log) => <span>{String(log.metadata?.description ?? '-')}</span>
              },
              {
                key: 'details',
                header: 'Detalhes',
                render: (log) => (
                  <Button variant="secondary" icon={<Eye size={16} aria-hidden="true" />} onClick={() => setSelected(log)}>
                    Ver
                  </Button>
                )
              }
            ]}
          />
          <Pagination page={logs.meta.page} totalPages={logs.meta.totalPages} onPageChange={(nextPage) => void loadAudit(nextPage)} />
        </section>
      ) : (
        <EmptyState title="Nenhum log encontrado" description="Ajuste os filtros para consultar outros registros de auditoria." />
      )}

      <AuditDetailsModal log={selected} onClose={() => setSelected(null)} />
    </AppLayout>
  );
}

function AuditSkeleton() {
  return (
    <section className="rounded border border-slate-200 bg-white p-5">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="mt-5 h-72 w-full" />
    </section>
  );
}

function AuditDetailsModal({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const changes = useMemo(() => buildChanges(log?.metadata?.before, log?.metadata?.after), [log]);

  return (
    <Modal open={Boolean(log)} title="Detalhes da auditoria" size="wide" onClose={onClose}>
      {log && (
        <div className="space-y-5">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Usuario" value={log.actor?.name ?? 'Sistema'} />
            <Info label="Acao" value={actionLabels[log.action]} />
            <Info label="Entidade" value={`${log.entityType} ${log.entityId ?? ''}`} />
            <Info label="Data" value={new Date(log.createdAt).toLocaleString('pt-BR')} />
            <Info label="IP" value={log.ipAddress ?? '-'} />
            <Info label="User agent" value={log.userAgent ?? '-'} />
            <Info label="Procedimento" value={log.procedure?.title ?? '-'} />
            <Info label="Descricao" value={String(log.metadata?.description ?? '-')} />
          </div>

          {changes.length > 0 ? (
            <>
              <div className="grid gap-3 md:hidden">
                {changes.map((change) => (
                  <article className="rounded border border-slate-200 bg-white p-3" key={change.path}>
                    <p className="text-xs font-semibold uppercase text-slate-500">{change.path}</p>
                    <div className="mt-3 grid gap-3">
                      <Info label="Antes" value={formatValue(change.before)} />
                      <Info label="Depois" value={formatValue(change.after)} />
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto rounded border border-slate-200 md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Campo</th>
                      <th className="px-3 py-2">Antes</th>
                      <th className="px-3 py-2">Depois</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {changes.map((change) => (
                      <tr key={change.path}>
                        <td className="px-3 py-2 font-medium text-slate-800">{change.path}</td>
                        <td className="px-3 py-2 text-slate-600">{formatValue(change.before)}</td>
                        <td className="px-3 py-2 text-slate-600">{formatValue(change.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <EmptyState title="Sem comparacao" description="Este registro nao possui dados anteriores e posteriores." />
          )}

          <details className="rounded border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Metadados sanitizados</summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
              {JSON.stringify(log.metadata ?? {}, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-slate-800">{value}</p>
    </div>
  );
}

function buildChanges(before: unknown, after: unknown) {
  const beforeFlat = flatten(before);
  const afterFlat = flatten(after);
  const keys = Array.from(new Set([...Object.keys(beforeFlat), ...Object.keys(afterFlat)])).sort();

  return keys
    .filter((key) => JSON.stringify(beforeFlat[key]) !== JSON.stringify(afterFlat[key]))
    .map((key) => ({ path: key, before: beforeFlat[key], after: afterFlat[key] }));
}

function flatten(value: unknown, prefix = ''): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return prefix ? { [prefix]: value } : {};
  }

  if (Array.isArray(value)) {
    return { [prefix || 'items']: value };
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return { ...acc, ...flatten(child, path) };
    }
    acc[path] = child;
    return acc;
  }, {});
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
