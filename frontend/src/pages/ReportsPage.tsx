import { Download, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import { Button, EmptyState, PageHeader, Pagination, Select, Skeleton, Toast } from '../components/ui';
import { api } from '../lib/api';

type ReportType =
  | 'usage_by_attendant'
  | 'usage_by_procedure'
  | 'resolution_rate'
  | 'technical_escalations'
  | 'most_copied_messages'
  | 'most_accessed_procedures'
  | 'worst_rated_procedures'
  | 'procedures_without_result'
  | 'top_searches'
  | 'no_result_searches'
  | 'audit_history'
  | 'attendances_by_period';

type ReportColumn = { key: string; label: string };
type ReportRow = Record<string, string | number | null>;

type ReportResponse = {
  data: {
    company: string;
    title: string;
    emittedAt: string;
    emittedBy: string;
    filters: Record<string, string>;
    totals: Record<string, string | number>;
    columns: ReportColumn[];
    rows: ReportRow[];
  };
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

type Option = { id: string; name: string; title?: string };

type DashboardFilters = {
  attendants: Option[];
  categories: Option[];
  procedures: Option[];
};

const reportTypes: Array<{ label: string; value: ReportType }> = [
  { label: 'Uso por atendente', value: 'usage_by_attendant' },
  { label: 'Uso por procedimento', value: 'usage_by_procedure' },
  { label: 'Taxa de resolucao', value: 'resolution_rate' },
  { label: 'Encaminhamentos tecnicos', value: 'technical_escalations' },
  { label: 'Mensagens mais copiadas', value: 'most_copied_messages' },
  { label: 'Procedimentos mais acessados', value: 'most_accessed_procedures' },
  { label: 'Procedimentos com pior avaliacao', value: 'worst_rated_procedures' },
  { label: 'Procedimentos sem resultado', value: 'procedures_without_result' },
  { label: 'Pesquisas mais frequentes', value: 'top_searches' },
  { label: 'Pesquisas sem resultado', value: 'no_result_searches' },
  { label: 'Historico de alteracoes', value: 'audit_history' },
  { label: 'Atendimentos por periodo', value: 'attendances_by_period' }
];

const initialFilters = {
  type: 'usage_by_attendant' as ReportType,
  preset: 'last30',
  startDate: '',
  endDate: '',
  attendantId: '',
  categoryId: '',
  procedureId: '',
  result: ''
};

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [options, setOptions] = useState<DashboardFilters>({ attendants: [], categories: [], procedures: [] });
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function params(nextPage = page) {
    return {
      type: filters.type,
      preset: filters.preset,
      startDate: filters.preset === 'custom' ? filters.startDate || undefined : undefined,
      endDate: filters.preset === 'custom' ? filters.endDate || undefined : undefined,
      attendantId: filters.attendantId || undefined,
      categoryId: filters.categoryId || undefined,
      procedureId: filters.procedureId || undefined,
      result: filters.result || undefined,
      page: nextPage,
      pageSize: 25
    };
  }

  async function loadReport(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/reports/generate', { params: params(nextPage) });
      setReport(response.data);
      setPage(response.data.meta.page);
    } catch {
      setError('Nao foi possivel gerar o relatorio agora.');
    } finally {
      setLoading(false);
    }
  }

  async function exportReport(format: 'pdf' | 'xlsx' | 'csv') {
    setExporting(format);
    setError(null);
    try {
      const response = await api.get('/reports/export', { params: { ...params(1), format }, responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filters.type}.${format}`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Nao foi possivel exportar o relatorio.');
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    api
      .get('/reports/dashboard')
      .then((response) => setOptions(response.data.data.filters))
      .catch(() => setError('Nao foi possivel carregar filtros.'))
      .finally(() => void loadReport(1));
  }, []);

  if (!hasPermission('reports.view')) {
    return (
      <AppLayout>
        <EmptyState title="Acesso restrito" description="Seu perfil nao possui permissao para visualizar relatorios." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Administracao"
        title="Relatorios"
        description="Gere relatorios visuais e exporte em PDF, Excel ou CSV sem bloquear a interface."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<FileText size={18} aria-hidden="true" />} disabled={Boolean(exporting)} onClick={() => void exportReport('pdf')}>
              {exporting === 'pdf' ? 'Gerando...' : 'PDF'}
            </Button>
            <Button variant="secondary" icon={<FileSpreadsheet size={18} aria-hidden="true" />} disabled={Boolean(exporting)} onClick={() => void exportReport('xlsx')}>
              {exporting === 'xlsx' ? 'Gerando...' : 'Excel'}
            </Button>
            <Button variant="secondary" icon={<Download size={18} aria-hidden="true" />} disabled={Boolean(exporting)} onClick={() => void exportReport('csv')}>
              {exporting === 'csv' ? 'Gerando...' : 'CSV'}
            </Button>
          </div>
        }
      />

      {error && <Toast tone="error" message={error} />}

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_180px_1fr_1fr]">
          <Select label="Relatorio" value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value as ReportType }))} options={reportTypes} />
          <Select
            label="Periodo"
            value={filters.preset}
            onChange={(event) => setFilters((current) => ({ ...current, preset: event.target.value }))}
            options={[
              { label: 'Hoje', value: 'today' },
              { label: 'Ultimos 7 dias', value: 'last7' },
              { label: 'Ultimos 30 dias', value: 'last30' },
              { label: 'Mes atual', value: 'month' },
              { label: 'Personalizado', value: 'custom' }
            ]}
          />
          <Select label="Atendente" value={filters.attendantId} onChange={(event) => setFilters((current) => ({ ...current, attendantId: event.target.value }))} options={[{ label: 'Todas', value: '' }, ...options.attendants.map((item) => ({ label: item.name, value: item.id }))]} />
          <Select label="Resultado" value={filters.result} onChange={(event) => setFilters((current) => ({ ...current, result: event.target.value }))} options={[
            { label: 'Todos', value: '' },
            { label: 'Em andamento', value: 'IN_PROGRESS' },
            { label: 'Resolvido', value: 'RESOLVED' },
            { label: 'Nao resolvido', value: 'NOT_RESOLVED' },
            { label: 'Encaminhado', value: 'ESCALATED' },
            { label: 'Abandonado', value: 'ABANDONED' }
          ]} />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_220px_220px_auto]">
          <Select label="Categoria" value={filters.categoryId} onChange={(event) => setFilters((current) => ({ ...current, categoryId: event.target.value }))} options={[{ label: 'Todas', value: '' }, ...options.categories.map((item) => ({ label: item.name, value: item.id }))]} />
          <Select label="Procedimento" value={filters.procedureId} onChange={(event) => setFilters((current) => ({ ...current, procedureId: event.target.value }))} options={[{ label: 'Todos', value: '' }, ...options.procedures.map((item) => ({ label: item.title ?? item.name, value: item.id }))]} />
          <input className="min-h-11 rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" type="date" disabled={filters.preset !== 'custom'} value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} aria-label="Data inicial" />
          <input className="min-h-11 rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100" type="date" disabled={filters.preset !== 'custom'} value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} aria-label="Data final" />
          <Button icon={<Search size={18} aria-hidden="true" />} onClick={() => void loadReport(1)}>Gerar</Button>
        </div>
      </section>

      {loading ? (
        <ReportSkeleton />
      ) : report ? (
        <ReportViewer report={report} onPageChange={(nextPage) => void loadReport(nextPage)} />
      ) : (
        <EmptyState title="Nenhum relatorio" description="Selecione os filtros e gere uma visualizacao." />
      )}
    </AppLayout>
  );
}

function ReportSkeleton() {
  return (
    <section className="rounded border border-slate-200 bg-white p-5">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-6 h-72 w-full" />
    </section>
  );
}

function ReportViewer({ report, onPageChange }: { report: ReportResponse; onPageChange: (page: number) => void }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-brand-700">{report.data.company}</p>
          <h2 className="text-xl font-semibold text-slate-950">{report.data.title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Emitido em {new Date(report.data.emittedAt).toLocaleString('pt-BR')} por {report.data.emittedBy}
          </p>
        </div>
        <div className="grid gap-1 text-sm text-slate-600">
          {Object.entries(report.data.totals).map(([key, value]) => (
            <span key={key}>{key}: <strong>{value}</strong></span>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(report.data.filters).map(([key, value]) => (
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600" key={key}>
            {key}: {value}
          </span>
        ))}
      </div>

      {report.data.rows.length === 0 ? (
        <EmptyState title="Sem dados" description="Nao ha registros para os filtros selecionados." />
      ) : (
        <>
          <div className="mt-5 grid gap-3 md:hidden">
            {report.data.rows.map((row, index) => (
              <article className="rounded border border-slate-200 bg-white p-4" key={index}>
                <dl className="space-y-3">
                  {report.data.columns.map((column) => (
                    <div className="grid gap-1" key={column.key}>
                      <dt className="text-xs font-semibold uppercase text-slate-500">{column.label}</dt>
                      <dd className="break-words text-sm text-slate-800">{row[column.key] ?? '-'}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {report.data.columns.map((column) => (
                  <th className="px-3 py-3 font-semibold text-slate-700" key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.data.rows.map((row, index) => (
                <tr className="border-b border-slate-100" key={index}>
                  {report.data.columns.map((column) => (
                    <td className="px-3 py-3 text-slate-700" key={column.key}>{row[column.key] ?? '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </>
      )}

      <div className="mt-4">
        <Pagination page={report.meta.page} totalPages={report.meta.totalPages} onPageChange={onPageChange} />
      </div>
    </section>
  );
}
