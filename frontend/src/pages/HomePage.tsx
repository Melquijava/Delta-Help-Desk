import {
  BookOpenCheck,
  CalendarClock,
  ClipboardCopy,
  Clock3,
  FileText,
  Gauge,
  Heart,
  Receipt,
  Router,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';
import {
  Badge,
  Button,
  CopyButton,
  EmptyState,
  LoadingState,
  PageHeader,
  Select,
  Skeleton,
  Toast
} from '../components/ui';
import { api } from '../lib/api';
import { useSettings } from '../settings/SettingsContext';

const healthSchema = z.object({
  status: z.string(),
  service: z.string(),
  timestamp: z.string()
});

type HealthStatus = z.infer<typeof healthSchema>;

type ProcedureDifficulty = 'EASY' | 'MEDIUM' | 'ADVANCED';

type AttendantCategory = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  procedureCount: number;
};

type AttendantProcedure = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  keywords: string[];
  symptoms: string[];
  difficulty: ProcedureDifficulty;
  estimatedMinutes: number | null;
  featured: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
  };
  stepCount: number;
  usageCount: number;
  favoriteCount: number;
  isFavorite: boolean;
  score?: number;
};

type AttendantDashboardData = {
  categories: AttendantCategory[];
  featured: AttendantProcedure[];
  favorites: AttendantProcedure[];
  recent: AttendantProcedure[];
  mostUsed: AttendantProcedure[];
};

type MessageStat = {
  id: string;
  title: string;
  copyCount: number;
  procedure: { id: string; title: string };
  step: { id: string; title: string };
};

const emptyAttendantData: AttendantDashboardData = {
  categories: [],
  featured: [],
  favorites: [],
  recent: [],
  mostUsed: []
};

type DashboardOption = { id: string; name: string; title?: string };
type ChartItem = { name: string; value: number; [key: string]: string | number };
type PeriodItem = { date: string; atendimentos: number; resolvidos: number; naoResolvidos: number; encaminhados: number };

type AdminDashboardData = {
  cards: {
    totalProcedures: number;
    published: number;
    drafts: number;
    archived: number;
    categories: number;
    activeAttendants: number;
    started: number;
    resolved: number;
    notResolved: number;
    escalated: number;
  };
  charts: {
    mostUsedProcedures: ChartItem[];
    mostCopiedMessages: ChartItem[];
    resolutionRate: ChartItem[];
    resolutionPercent: number;
    usageByAttendant: ChartItem[];
    usageByCategory: ChartItem[];
    topSearches: ChartItem[];
    noResultSearches: ChartItem[];
    ratings: Array<{ rating: string; quantidade: number }>;
    averageRating: number | null;
    attendancesByPeriod: PeriodItem[];
  };
  filters: {
    attendants: DashboardOption[];
    categories: DashboardOption[];
    procedures: DashboardOption[];
  };
};

type AdminFilterState = {
  preset: 'today' | 'last7' | 'last30' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  attendantId: string;
  categoryId: string;
  procedureId: string;
};

const chartColors = ['#0284c7', '#0f172a', '#16a34a', '#f59e0b', '#64748b'];

export function HomePage() {
  const { hasPermission, error: authError } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = hasPermission('settings.manage');

  useEffect(() => {
    api
      .get('/health')
      .then((response) => {
        setHealth(healthSchema.parse(response.data));
      })
      .catch(() => {
        setError('API indisponivel. Verifique se o backend esta em execucao.');
      });
  }, []);

  return (
    <AppLayout>
      {authError && <Toast tone="error" message={authError} />}

      {isAdmin ? (
        <AdminDashboard health={health} error={error} />
      ) : (
        <AttendantDashboard health={health} error={error} />
      )}
    </AppLayout>
  );
}

function AdminDashboard({ health, error }: { health: HealthStatus | null; error: string | null }) {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminFilterState>({
    preset: 'last30',
    startDate: '',
    endDate: '',
    attendantId: '',
    categoryId: '',
    procedureId: ''
  });

  async function loadDashboard(nextFilters = filters) {
    setLoading(true);
    setDashboardError(null);

    try {
      const response = await api.get('/reports/dashboard', {
        params: {
          preset: nextFilters.preset,
          startDate: nextFilters.preset === 'custom' ? nextFilters.startDate || undefined : undefined,
          endDate: nextFilters.preset === 'custom' ? nextFilters.endDate || undefined : undefined,
          attendantId: nextFilters.attendantId || undefined,
          categoryId: nextFilters.categoryId || undefined,
          procedureId: nextFilters.procedureId || undefined
        }
      });
      setDashboard(response.data.data);
    } catch {
      setDashboardError('Nao foi possivel carregar o dashboard administrativo.');
    } finally {
      setLoading(false);
    }
  }

  function updateFilter<K extends keyof AdminFilterState>(key: K, value: AdminFilterState[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    if (key !== 'startDate' && key !== 'endDate') {
      void loadDashboard(next);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Delta"
        title="Painel administrativo"
        description="Indicadores de procedimentos, atendimentos, buscas, mensagens e avaliacoes."
        actions={
          <Button variant="secondary" icon={<Settings size={18} aria-hidden="true" />} onClick={() => void loadDashboard()}>
            Atualizar
          </Button>
        }
      />

      {dashboardError && <Toast tone="error" message={dashboardError} />}

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_1fr_auto]">
          <Select
            aria-label="Periodo"
            value={filters.preset}
            onChange={(event) => updateFilter('preset', event.target.value as AdminFilterState['preset'])}
            options={[
              { label: 'Hoje', value: 'today' },
              { label: 'Ultimos 7 dias', value: 'last7' },
              { label: 'Ultimos 30 dias', value: 'last30' },
              { label: 'Mes atual', value: 'month' },
              { label: 'Personalizado', value: 'custom' }
            ]}
          />
          <Select
            aria-label="Atendente"
            value={filters.attendantId}
            onChange={(event) => updateFilter('attendantId', event.target.value)}
            options={[{ label: 'Todas atendentes', value: '' }, ...(dashboard?.filters.attendants ?? []).map((item) => ({ label: item.name, value: item.id }))]}
          />
          <Select
            aria-label="Categoria"
            value={filters.categoryId}
            onChange={(event) => updateFilter('categoryId', event.target.value)}
            options={[{ label: 'Todas categorias', value: '' }, ...(dashboard?.filters.categories ?? []).map((item) => ({ label: item.name, value: item.id }))]}
          />
          <Select
            aria-label="Procedimento"
            value={filters.procedureId}
            onChange={(event) => updateFilter('procedureId', event.target.value)}
            options={[{ label: 'Todos procedimentos', value: '' }, ...(dashboard?.filters.procedures ?? []).map((item) => ({ label: item.title ?? item.name, value: item.id }))]}
          />
          <Button variant="secondary" onClick={() => void loadDashboard()}>Filtrar</Button>
        </div>
        {filters.preset === 'custom' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-[220px_220px_auto]">
            <input
              className="min-h-11 rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
              aria-label="Data inicial"
            />
            <input
              className="min-h-11 rounded border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
              aria-label="Data final"
            />
            <Button onClick={() => void loadDashboard()}>Aplicar periodo</Button>
          </div>
        )}
      </section>

      {loading ? (
        <AdminDashboardSkeleton />
      ) : dashboard ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Metric title="Total procedimentos" value={String(dashboard.cards.totalProcedures)} description="Base cadastrada" />
            <Metric title="Publicados" value={String(dashboard.cards.published)} description="Visiveis para atendentes" />
            <Metric title="Rascunhos" value={String(dashboard.cards.drafts)} description="Em preparo" />
            <Metric title="Arquivados" value={String(dashboard.cards.archived)} description="Fora de uso" />
            <Metric title="Categorias" value={String(dashboard.cards.categories)} description="Ativas" />
            <Metric title="Atendentes ativos" value={String(dashboard.cards.activeAttendants)} description="Perfil operacional" />
            <Metric title="Iniciados" value={String(dashboard.cards.started)} description="No periodo" />
            <Metric title="Resolvidos" value={String(dashboard.cards.resolved)} description={`${dashboard.charts.resolutionPercent}% de resolucao`} />
            <Metric title="Nao resolvidos" value={String(dashboard.cards.notResolved)} description="Conclusoes negativas" />
            <Metric title="Encaminhados" value={String(dashboard.cards.escalated)} description="Suporte tecnico" />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <BarPanel title="Procedimentos mais utilizados" data={dashboard.charts.mostUsedProcedures} />
            <BarPanel title="Mensagens mais copiadas" data={dashboard.charts.mostCopiedMessages} />
            <PiePanel title="Taxa de resolucao" data={dashboard.charts.resolutionRate} />
            <BarPanel title="Uso por atendente" data={dashboard.charts.usageByAttendant} />
            <BarPanel title="Uso por categoria" data={dashboard.charts.usageByCategory} />
            <BarPanel title="Pesquisas mais realizadas" data={dashboard.charts.topSearches} />
            <BarPanel title="Pesquisas sem resultado" data={dashboard.charts.noResultSearches} />
            <RatingPanel average={dashboard.charts.averageRating} data={dashboard.charts.ratings} />
          </section>

          <LinePanel title="Atendimentos por periodo" data={dashboard.charts.attendancesByPeriod} />

          <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <StatusPanel health={health} error={error} />
            <div className="rounded border border-slate-200 bg-white p-5">
              <PanelTitle title="Leitura dos dados" />
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Os indicadores respeitam permissao administrativa e consideram os filtros aplicados. Atendentes nao veem este painel.
              </p>
            </div>
          </section>
        </>
      ) : (
        <EmptyState title="Dashboard indisponivel" description="Nao foi possivel carregar os indicadores administrativos." />
      )}
    </>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div className="rounded border border-slate-200 bg-white p-5" key={index}>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-3 h-8 w-1/2" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </div>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="rounded border border-slate-200 bg-white p-5" key={index}>
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="mt-4 h-64 w-full" />
          </div>
        ))}
      </section>
    </div>
  );
}

function ChartShell({ title, children, empty }: { title: string; children: ReactNode; empty: boolean }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-5">
      <PanelTitle title={title} />
      <div className="mt-4 h-72">
        {empty ? <EmptyState title="Sem dados" description="Nao ha registros para os filtros aplicados." /> : children}
      </div>
    </section>
  );
}

function BarPanel({ title, data }: { title: string; data: ChartItem[] }) {
  return (
    <ChartShell title={title} empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 54 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={62} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
          <Tooltip />
          <Bar dataKey="value" fill="#0284c7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

function PiePanel({ title, data }: { title: string; data: ChartItem[] }) {
  const visibleData = data.filter((item) => item.value > 0);
  return (
    <ChartShell title={title} empty={visibleData.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip />
          <Pie data={visibleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92} label>
            {visibleData.map((item, index) => (
              <Cell key={item.name} fill={chartColors[index % chartColors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

function RatingPanel({ average, data }: { average: number | null; data: Array<{ rating: string; quantidade: number }> }) {
  return (
    <ChartShell title={`Avaliacoes${average ? ` - media ${average}/5` : ''}`} empty={data.every((item) => item.quantidade === 0)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
          <Tooltip />
          <Bar dataKey="quantidade" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

function LinePanel({ title, data }: { title: string; data: PeriodItem[] }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-5">
      <PanelTitle title={title} />
      <div className="mt-4 h-80">
        {data.every((item) => item.atendimentos === 0) ? (
          <EmptyState title="Sem atendimentos" description="Nao ha atendimentos para o periodo selecionado." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
              <Tooltip />
              <Line type="monotone" dataKey="atendimentos" stroke="#0284c7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolvidos" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="naoResolvidos" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="encaminhados" stroke="#0f172a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function AttendantDashboard({ health, error }: { health: HealthStatus | null; error: string | null }) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [dashboard, setDashboard] = useState<AttendantDashboardData>(emptyAttendantData);
  const [results, setResults] = useState<AttendantProcedure[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [attendantError, setAttendantError] = useState<string | null>(null);
  const [messageStats, setMessageStats] = useState<MessageStat[]>([]);

  const hasSearch = search.trim().length > 0 || Boolean(categoryId);
  const selectedCategory = useMemo(
    () => dashboard.categories.find((category) => category.id === categoryId) ?? null,
    [categoryId, dashboard.categories]
  );

  async function loadDashboard() {
    setLoading(true);
    setAttendantError(null);

    try {
      const response = await api.get('/attendant/dashboard');
      setDashboard(response.data.data);
      const statsResponse = await api.get('/attendant/messages/stats');
      setMessageStats(statsResponse.data.data);
    } catch {
      setAttendantError('Nao foi possivel carregar a area de atendimento agora.');
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(query = search, nextCategoryId = categoryId) {
    setSearching(true);
    setAttendantError(null);

    try {
      const response = await api.get('/attendant/procedures/search', {
        params: {
          q: query.trim() || undefined,
          categoryId: nextCategoryId || undefined
        }
      });
      setResults(response.data.data.results);
    } catch {
      setAttendantError('Nao foi possivel buscar procedimentos agora.');
    } finally {
      setSearching(false);
    }
  }

  async function toggleFavorite(procedureId: string) {
    if (!settings.allowFavorites) {
      setAttendantError('Favoritos estao desativados nas configuracoes do sistema.');
      return;
    }

    try {
      const response = await api.patch(`/attendant/procedures/${procedureId}/favorite`);
      const isFavorite = response.data.data.isFavorite;
      const updateProcedure = (procedure: AttendantProcedure) =>
        procedure.id === procedureId ? { ...procedure, isFavorite } : procedure;

      setResults((current) => current.map(updateProcedure));
      setDashboard((current) => ({
        ...current,
        featured: current.featured.map(updateProcedure),
        recent: current.recent.map(updateProcedure),
        mostUsed: current.mostUsed.map(updateProcedure),
        favorites: isFavorite
          ? current.favorites
          : current.favorites.filter((procedure) => procedure.id !== procedureId)
      }));
      void loadDashboard();
    } catch {
      setAttendantError('Nao foi possivel atualizar o favorito.');
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (hasSearch) {
        void runSearch();
      } else {
        setResults([]);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [search, categoryId]);

  return (
    <>
      <PageHeader
        eyebrow="Atendimento"
        title="Encontre o procedimento certo"
        description={settings.welcomeMessage}
      />

      {attendantError && <Toast tone="error" message={attendantError} />}

      <section className="rounded border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
          <input
            className="min-h-14 rounded border border-slate-300 px-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            placeholder="Buscar por sem internet, boleto, roteador, lentidao..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void runSearch();
              }
            }}
            aria-label="Buscar procedimentos publicados"
          />
          <select
            className="min-h-14 rounded border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas categorias</option>
            {dashboard.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <Button className="min-h-14" onClick={() => void runSearch()}>
            Buscar
          </Button>
        </div>
        {hasSearch && (
          <p className="mt-3 text-sm text-slate-500">
            {searching ? 'Buscando...' : `${results.length} resultado(s) publicado(s)`}
            {selectedCategory ? ` em ${selectedCategory.name}` : ''}
          </p>
        )}
      </section>

      {loading ? (
        <LoadingState label="Carregando procedimentos publicados..." />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {dashboard.categories.map((category) => (
              <button
                className={`flex min-h-24 items-center gap-3 rounded border bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${
                  categoryId === category.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                }`}
                key={category.id}
                type="button"
                onClick={() => setCategoryId(categoryId === category.id ? '' : category.id)}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded bg-brand-50 text-brand-700">
                  {getCategoryIcon(category.icon)}
                </span>
                <span>
                  <span className="block font-semibold text-slate-950">{category.name}</span>
                  <span className="text-sm text-slate-500">{category.procedureCount} publicados</span>
                </span>
              </button>
            ))}
          </section>

          {hasSearch && (
            <section className="space-y-3">
              <PanelTitle title="Resultados da busca" icon={<BookOpenCheck size={18} aria-hidden="true" />} />
              {searching ? (
                <LoadingState label="Buscando procedimentos..." />
              ) : results.length > 0 ? (
                <ProcedureGrid procedures={results} query={search} onFavorite={toggleFavorite} onOpen={(procedureId) => navigate(`/procedures/${procedureId}/run`)} />
              ) : (
                <EmptyState title="Nenhum procedimento publicado encontrado" description="Tente outro termo, sintoma ou categoria." />
              )}
            </section>
          )}

          <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              {settings.showFeaturedProcedures && <ProcedureSection title="Procedimentos em destaque" procedures={dashboard.featured} query={search} onFavorite={toggleFavorite} onOpen={(procedureId) => navigate(`/procedures/${procedureId}/run`)} empty="Nenhum destaque publicado ainda." />}
              <ProcedureSection title="Procedimentos mais utilizados" procedures={dashboard.mostUsed} query={search} onFavorite={toggleFavorite} onOpen={(procedureId) => navigate(`/procedures/${procedureId}/run`)} empty="Sem usos registrados ainda." />

              <div className="rounded border border-slate-200 bg-white p-5">
                <PanelTitle title="Mensagem pronta de exemplo" />
                <p className="mt-3 rounded bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  Senhor(a), vamos realizar algumas verificacoes rapidas para identificar a origem da instabilidade.
                </p>
                <div className="mt-4">
                  <CopyButton value="Senhor(a), vamos realizar algumas verificacoes rapidas para identificar a origem da instabilidade." />
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <StatusPanel health={health} error={error} />

              {settings.allowFavorites && <CompactProcedureList title="Favoritos" icon={<Heart size={18} aria-hidden="true" />} procedures={dashboard.favorites} empty="Sem favoritos ainda." onFavorite={toggleFavorite} onOpen={(procedureId) => navigate(`/procedures/${procedureId}/run`)} />}
              <CompactProcedureList title="Usados recentemente" procedures={dashboard.recent} empty="Sem historico recente." onFavorite={toggleFavorite} onOpen={(procedureId) => navigate(`/procedures/${procedureId}/run`)} />
              <MessageStatsPanel stats={messageStats} />
            </aside>
          </section>
        </>
      )}
    </>
  );
}

function MessageStatsPanel({ stats }: { stats: MessageStat[] }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5">
      <PanelTitle title="Mensagens mais copiadas" icon={<ClipboardCopy size={18} aria-hidden="true" />} />
      {stats.length > 0 ? (
        <ol className="mt-3 space-y-2">
          {stats.map((item, index) => (
            <li className="rounded bg-slate-50 p-3 text-sm" key={item.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{index + 1}. {item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.procedure.title}</p>
                </div>
                <Badge tone="blue">{item.copyCount}</Badge>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Sem copias registradas" description="As mensagens copiadas durante atendimentos aparecerao aqui." />
      )}
    </div>
  );
}

function ProcedureSection({
  title,
  procedures,
  query,
  empty,
  onOpen,
  onFavorite
}: {
  title: string;
  procedures: AttendantProcedure[];
  query: string;
  empty: string;
  onOpen: (procedureId: string) => void;
  onFavorite: (procedureId: string) => Promise<void>;
}) {
  return (
    <section className="space-y-3">
      <PanelTitle title={title} />
      {procedures.length > 0 ? (
        <ProcedureGrid procedures={procedures} query={query} onOpen={onOpen} onFavorite={onFavorite} />
      ) : (
        <EmptyState title={empty} description="Assim que houver dados publicados, eles aparecerao aqui." />
      )}
    </section>
  );
}

function ProcedureGrid({
  procedures,
  query,
  onOpen,
  onFavorite
}: {
  procedures: AttendantProcedure[];
  query: string;
  onOpen: (procedureId: string) => void;
  onFavorite: (procedureId: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {procedures.map((procedure) => (
        <ProcedureCard key={procedure.id} procedure={procedure} query={query} onOpen={onOpen} onFavorite={onFavorite} />
      ))}
    </div>
  );
}

function ProcedureCard({
  procedure,
  query,
  onOpen,
  onFavorite
}: {
  procedure: AttendantProcedure;
  query: string;
  onOpen: (procedureId: string) => void;
  onFavorite: (procedureId: string) => Promise<void>;
}) {
  const { settings } = useSettings();

  return (
    <article className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">{procedure.category.name}</Badge>
          {procedure.featured && <Badge tone="amber">Destaque</Badge>}
        </div>
        {settings.allowFavorites && (
          <button
            className={`flex h-11 w-11 items-center justify-center rounded border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 ${
              procedure.isFavorite ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            type="button"
            title={procedure.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
            onClick={() => void onFavorite(procedure.id)}
          >
            <Heart size={18} fill={procedure.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        )}
      </div>
      <h2 className="text-base font-semibold leading-6 text-slate-950">
        <HighlightedText value={procedure.title} query={query} />
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        <HighlightedText value={procedure.summary} query={query} />
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1">
          <Clock3 size={14} aria-hidden="true" />
          {procedure.estimatedMinutes ? `${procedure.estimatedMinutes} min` : 'Tempo nao informado'}
        </span>
        <span className="rounded bg-slate-100 px-2 py-1">{difficultyLabel(procedure.difficulty)}</span>
        <span className="rounded bg-slate-100 px-2 py-1">{procedure.stepCount} etapas</span>
      </div>
      {(procedure.keywords.length > 0 || procedure.symptoms.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1">
          {[...procedure.symptoms, ...procedure.keywords].slice(0, 5).map((item) => (
            <span className="rounded bg-brand-50 px-2 py-1 text-xs text-brand-800" key={`${procedure.id}-${item}`}>
              <HighlightedText value={item} query={query} />
            </span>
          ))}
        </div>
      )}
      <Button className="mt-4 w-full" variant="secondary" icon={<BookOpenCheck size={18} aria-hidden="true" />} onClick={() => onOpen(procedure.id)}>
        Abrir procedimento
      </Button>
    </article>
  );
}

function CompactProcedureList({
  title,
  icon,
  procedures,
  empty,
  onOpen,
  onFavorite
}: {
  title: string;
  icon?: ReactNode;
  procedures: AttendantProcedure[];
  empty: string;
  onOpen: (procedureId: string) => void;
  onFavorite: (procedureId: string) => Promise<void>;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5">
      <PanelTitle title={title} icon={icon} />
      {procedures.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {procedures.map((procedure) => (
            <li className="rounded border border-slate-100 bg-slate-50 p-3" key={procedure.id}>
              <div className="flex items-start justify-between gap-2">
                <button className="text-left" type="button" onClick={() => onOpen(procedure.id)}>
                  <p className="text-sm font-semibold text-slate-950">{procedure.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {procedure.category.name} · {difficultyLabel(procedure.difficulty)}
                  </p>
                </button>
                <button
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border ${
                    procedure.isFavorite ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-500'
                  }`}
                  type="button"
                  title={procedure.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
                  onClick={() => void onFavorite(procedure.id)}
                >
                  <Heart size={16} fill={procedure.isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={empty} description="Use os procedimentos publicados para alimentar esta lista." />
      )}
    </div>
  );
}

function HighlightedText({ value, query }: { value: string; query: string }) {
  const term = query.trim();
  if (!term) return <>{value}</>;

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = value.split(new RegExp(`(${escaped})`, 'ig'));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark className="rounded bg-amber-100 px-0.5 text-slate-950" key={`${part}-${index}`}>
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function difficultyLabel(difficulty: ProcedureDifficulty) {
  const labels: Record<ProcedureDifficulty, string> = {
    EASY: 'Facil',
    MEDIUM: 'Media',
    ADVANCED: 'Avancada'
  };

  return labels[difficulty];
}

function getCategoryIcon(icon: string | null) {
  const icons: Record<string, ReactNode> = {
    gauge: <Gauge size={20} aria-hidden="true" />,
    'wifi-off': <WifiOff size={20} aria-hidden="true" />,
    wifi: <Wifi size={20} aria-hidden="true" />,
    router: <Router size={20} aria-hidden="true" />,
    settings: <Settings size={20} aria-hidden="true" />,
    receipt: <Receipt size={20} aria-hidden="true" />,
    'calendar-clock': <CalendarClock size={20} aria-hidden="true" />
  };

  return icons[icon ?? ''] ?? <FileText size={20} aria-hidden="true" />;
}

function Metric({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <article className="rounded border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </article>
  );
}

function PanelTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon ?? <ClipboardCopy size={18} aria-hidden="true" className="text-brand-700" />}
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
    </div>
  );
}

function StatusPanel({ health, error }: { health: HealthStatus | null; error: string | null }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-5">
      <PanelTitle title="Status da API" />
      <div className="mt-3">
        {!health && !error && <LoadingState label="Verificando comunicacao..." />}
        {health && <Toast tone="success" message={`Backend conectado: ${health.service}`} />}
        {error && <Toast tone="error" message={error} />}
      </div>
    </div>
  );
}
