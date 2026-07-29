import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { parseJson } from '../utils/json.js';

type ProcedureAggregate = {
  procedureId: string;
  procedureTitle: string;
  feedbackCount: number;
  ratingCount: number;
  averageRating: number | null;
  resolvedCount: number;
  totalCompleted: number;
  resolutionRate: number;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export type DashboardPeriodPreset = 'today' | 'last7' | 'last30' | 'month' | 'custom';

export type DashboardFilters = {
  preset?: DashboardPeriodPreset;
  startDate?: Date;
  endDate?: Date;
  attendantId?: string;
  categoryId?: string;
  procedureId?: string;
};

export type ReportType =
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

export type ReportFormat = 'pdf' | 'xlsx' | 'csv';

export type ReportFilters = DashboardFilters & {
  result?: 'IN_PROGRESS' | 'RESOLVED' | 'NOT_RESOLVED' | 'ESCALATED' | 'ABANDONED';
};

type ReportColumn = {
  key: string;
  label: string;
};

type ReportRow = Record<string, string | number | null>;

type ReportData = {
  company: string;
  title: string;
  emittedAt: string;
  emittedBy: string;
  filters: Record<string, string>;
  totals: Record<string, number | string>;
  columns: ReportColumn[];
  rows: ReportRow[];
};

const reportTitles: Record<ReportType, string> = {
  usage_by_attendant: 'Uso por atendente',
  usage_by_procedure: 'Uso por procedimento',
  resolution_rate: 'Taxa de resolucao',
  technical_escalations: 'Encaminhamentos tecnicos',
  most_copied_messages: 'Mensagens mais copiadas',
  most_accessed_procedures: 'Procedimentos mais acessados',
  worst_rated_procedures: 'Procedimentos com pior avaliacao',
  procedures_without_result: 'Procedimentos sem resultado',
  top_searches: 'Pesquisas mais frequentes',
  no_result_searches: 'Pesquisas sem resultado',
  audit_history: 'Historico de alteracoes',
  attendances_by_period: 'Atendimentos por periodo'
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getDateRange(filters: DashboardFilters) {
  const now = new Date();
  const preset = filters.preset ?? 'last30';

  if (preset === 'custom' && filters.startDate && filters.endDate) {
    return { gte: startOfDay(filters.startDate), lte: endOfDay(filters.endDate) };
  }

  if (preset === 'today') {
    return { gte: startOfDay(now), lte: endOfDay(now) };
  }

  if (preset === 'last7') {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return { gte: start, lte: endOfDay(now) };
  }

  if (preset === 'month') {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1), lte: endOfDay(now) };
  }

  const start = startOfDay(now);
  start.setDate(start.getDate() - 29);
  return { gte: start, lte: endOfDay(now) };
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildUsageWhere(filters: DashboardFilters) {
  const range = getDateRange(filters);

  return {
    startedAt: range,
    attendantId: filters.attendantId,
    procedureId: filters.procedureId,
    procedure: {
      deletedAt: null,
      categoryId: filters.categoryId
    }
  };
}

function buildProcedureWhere(filters: DashboardFilters) {
  return {
    deletedAt: null,
    id: filters.procedureId,
    categoryId: filters.categoryId
  };
}

function buildSearchWhere(filters: DashboardFilters) {
  const range = getDateRange(filters);
  return {
    createdAt: range,
    userId: filters.attendantId,
    selectedProcedureId: filters.procedureId
  };
}

function buildFeedbackWhere(filters: DashboardFilters) {
  const range = getDateRange(filters);
  return {
    createdAt: range,
    userId: filters.attendantId,
    procedureId: filters.procedureId,
    procedure: {
      deletedAt: null,
      categoryId: filters.categoryId
    }
  };
}

function buildReportUsageWhere(filters: ReportFilters) {
  return {
    ...buildUsageWhere(filters),
    status: filters.result
  };
}

function filterLabel(value?: string) {
  return value && value.trim() ? value : 'Todos';
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    IN_PROGRESS: 'Em andamento',
    RESOLVED: 'Resolvido',
    NOT_RESOLVED: 'Nao resolvido',
    ESCALATED: 'Encaminhado',
    ABANDONED: 'Abandonado',
    CREATE: 'Criacao',
    UPDATE: 'Atualizacao',
    DELETE: 'Exclusao',
    RESTORE: 'Restauracao',
    PUBLISH: 'Publicacao',
    ARCHIVE: 'Arquivamento',
    DUPLICATE: 'Duplicacao',
    LOGIN: 'Login',
    LOGOUT: 'Logout',
    COPY_MESSAGE: 'Copia de mensagem'
  };

  return labels[value] ?? value;
}

async function getCompanyName() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'companyName' }, select: { value: true } });
  return parseJson<string>(setting?.value, 'Delta');
}

function summarizeRows(rows: ReportRow[]) {
  return { registros: rows.length };
}

function paginateRows(rows: ReportRow[], page: number, pageSize: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    meta: { page: safePage, pageSize, total, totalPages }
  };
}

function reportFilterSummary(filters: ReportFilters) {
  const range = getDateRange(filters);
  return {
    periodo: `${formatDateKey(range.gte)} ate ${formatDateKey(range.lte)}`,
    preset: filters.preset ?? 'last30',
    atendente: filterLabel(filters.attendantId),
    categoria: filterLabel(filters.categoryId),
    procedimento: filterLabel(filters.procedureId),
    resultado: filters.result ? statusLabel(filters.result) : 'Todos'
  };
}

function getReportColumns(type: ReportType): ReportColumn[] {
  const map: Record<ReportType, ReportColumn[]> = {
    usage_by_attendant: [
      { key: 'atendente', label: 'Atendente' },
      { key: 'atendimentos', label: 'Atendimentos' },
      { key: 'resolvidos', label: 'Resolvidos' },
      { key: 'naoResolvidos', label: 'Nao resolvidos' },
      { key: 'encaminhados', label: 'Encaminhados' },
      { key: 'taxaResolucao', label: 'Taxa de resolucao' }
    ],
    usage_by_procedure: [
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'atendimentos', label: 'Atendimentos' },
      { key: 'resolvidos', label: 'Resolvidos' },
      { key: 'encaminhados', label: 'Encaminhados' }
    ],
    resolution_rate: [
      { key: 'resultado', label: 'Resultado' },
      { key: 'quantidade', label: 'Quantidade' },
      { key: 'percentual', label: 'Percentual' }
    ],
    technical_escalations: [
      { key: 'data', label: 'Data' },
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'atendente', label: 'Atendente' },
      { key: 'observacao', label: 'Observacao' }
    ],
    most_copied_messages: [
      { key: 'mensagem', label: 'Mensagem' },
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'etapa', label: 'Etapa' },
      { key: 'copias', label: 'Copias' }
    ],
    most_accessed_procedures: [
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'acessos', label: 'Acessos' }
    ],
    worst_rated_procedures: [
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'avaliacoes', label: 'Avaliacoes' },
      { key: 'media', label: 'Media' }
    ],
    procedures_without_result: [
      { key: 'procedimento', label: 'Procedimento' },
      { key: 'categoria', label: 'Categoria' },
      { key: 'semResultado', label: 'Sem resultado' }
    ],
    top_searches: [
      { key: 'pesquisa', label: 'Pesquisa' },
      { key: 'quantidade', label: 'Quantidade' }
    ],
    no_result_searches: [
      { key: 'pesquisa', label: 'Pesquisa' },
      { key: 'quantidade', label: 'Quantidade' }
    ],
    audit_history: [
      { key: 'data', label: 'Data' },
      { key: 'usuario', label: 'Usuario' },
      { key: 'acao', label: 'Acao' },
      { key: 'entidade', label: 'Entidade' },
      { key: 'procedimento', label: 'Procedimento' }
    ],
    attendances_by_period: [
      { key: 'data', label: 'Data' },
      { key: 'atendimentos', label: 'Atendimentos' },
      { key: 'resolvidos', label: 'Resolvidos' },
      { key: 'naoResolvidos', label: 'Nao resolvidos' },
      { key: 'encaminhados', label: 'Encaminhados' }
    ]
  };

  return map[type];
}

function makePeriodBuckets(filters: DashboardFilters) {
  const range = getDateRange(filters);
  const buckets: Array<{ date: string; atendimentos: number; resolvidos: number; naoResolvidos: number; encaminhados: number }> = [];
  const cursor = startOfDay(range.gte);
  const end = startOfDay(range.lte);

  while (cursor <= end) {
    buckets.push({ date: formatDateKey(cursor), atendimentos: 0, resolvidos: 0, naoResolvidos: 0, encaminhados: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

async function buildReportRows(type: ReportType, filters: ReportFilters): Promise<ReportRow[]> {
  const usageWhere = buildReportUsageWhere(filters);
  const searchWhere = buildSearchWhere(filters);
  const feedbackWhere = buildFeedbackWhere(filters);
  const range = getDateRange(filters);

  if (type === 'usage_by_attendant') {
    const usages = await prisma.procedureUsage.findMany({
      where: usageWhere,
      select: { status: true, attendant: { select: { id: true, name: true } } },
      take: 10000
    });
    const map = new Map<string, { atendente: string; atendimentos: number; resolvidos: number; naoResolvidos: number; encaminhados: number }>();
    for (const usage of usages) {
      const item = map.get(usage.attendant.id) ?? { atendente: usage.attendant.name, atendimentos: 0, resolvidos: 0, naoResolvidos: 0, encaminhados: 0 };
      item.atendimentos += 1;
      if (usage.status === 'RESOLVED') item.resolvidos += 1;
      if (usage.status === 'NOT_RESOLVED') item.naoResolvidos += 1;
      if (usage.status === 'ESCALATED') item.encaminhados += 1;
      map.set(usage.attendant.id, item);
    }
    return Array.from(map.values())
      .map((item) => ({ ...item, taxaResolucao: item.atendimentos ? `${round((item.resolvidos / item.atendimentos) * 100)}%` : '0%' }))
      .sort((first, second) => second.atendimentos - first.atendimentos);
  }

  if (type === 'usage_by_procedure') {
    const usages = await prisma.procedureUsage.findMany({
      where: usageWhere,
      select: { status: true, procedure: { select: { id: true, title: true, category: { select: { name: true } } } } },
      take: 10000
    });
    const map = new Map<string, { procedimento: string; categoria: string; atendimentos: number; resolvidos: number; encaminhados: number }>();
    for (const usage of usages) {
      const item = map.get(usage.procedure.id) ?? { procedimento: usage.procedure.title, categoria: usage.procedure.category.name, atendimentos: 0, resolvidos: 0, encaminhados: 0 };
      item.atendimentos += 1;
      if (usage.status === 'RESOLVED') item.resolvidos += 1;
      if (usage.status === 'ESCALATED') item.encaminhados += 1;
      map.set(usage.procedure.id, item);
    }
    return Array.from(map.values()).sort((first, second) => second.atendimentos - first.atendimentos);
  }

  if (type === 'resolution_rate') {
    const grouped = await prisma.procedureUsage.groupBy({ by: ['status'], where: usageWhere, _count: { _all: true } });
    const total = grouped.reduce((sum, item) => sum + item._count._all, 0);
    return grouped.map((item) => ({
      resultado: statusLabel(item.status),
      quantidade: item._count._all,
      percentual: total ? `${round((item._count._all / total) * 100)}%` : '0%'
    }));
  }

  if (type === 'technical_escalations') {
    const rows = await prisma.procedureUsage.findMany({
      where: { ...usageWhere, status: 'ESCALATED' },
      select: { completedAt: true, startedAt: true, resolutionNote: true, procedure: { select: { title: true, category: { select: { name: true } } } }, attendant: { select: { name: true } } },
      orderBy: { completedAt: 'desc' },
      take: 10000
    });
    return rows.map((item) => ({
      data: (item.completedAt ?? item.startedAt).toISOString(),
      procedimento: item.procedure.title,
      categoria: item.procedure.category.name,
      atendente: item.attendant.name,
      observacao: item.resolutionNote
    }));
  }

  if (type === 'most_copied_messages') {
    const rows = await prisma.copyableMessage.findMany({
      where: { deletedAt: null, procedureId: filters.procedureId, procedure: { deletedAt: null, categoryId: filters.categoryId }, copyCount: { gt: 0 } },
      select: { title: true, copyCount: true, procedure: { select: { title: true } }, step: { select: { title: true } } },
      orderBy: [{ copyCount: 'desc' }, { updatedAt: 'desc' }],
      take: 10000
    });
    return rows.map((item) => ({ mensagem: item.title, procedimento: item.procedure.title, etapa: item.step.title, copias: item.copyCount }));
  }

  if (type === 'most_accessed_procedures') {
    const rows = await buildReportRows('usage_by_procedure', filters);
    return rows.map((row) => ({ procedimento: row.procedimento, categoria: row.categoria, acessos: row.atendimentos }));
  }

  if (type === 'worst_rated_procedures') {
    const feedbacks = await prisma.procedureFeedback.findMany({
      where: { ...feedbackWhere, rating: { not: null } },
      select: { rating: true, procedure: { select: { id: true, title: true } } },
      take: 10000
    });
    const map = new Map<string, { procedimento: string; avaliacoes: number; total: number }>();
    for (const feedback of feedbacks) {
      const item = map.get(feedback.procedure.id) ?? { procedimento: feedback.procedure.title, avaliacoes: 0, total: 0 };
      item.avaliacoes += 1;
      item.total += feedback.rating ?? 0;
      map.set(feedback.procedure.id, item);
    }
    return Array.from(map.values())
      .map((item) => ({ procedimento: item.procedimento, avaliacoes: item.avaliacoes, media: round(item.total / item.avaliacoes) }))
      .sort((first, second) => Number(first.media) - Number(second.media));
  }

  if (type === 'procedures_without_result') {
    const usages = await prisma.procedureUsage.findMany({
      where: { ...usageWhere, status: { in: ['NOT_RESOLVED', 'ABANDONED'] } },
      select: { procedure: { select: { id: true, title: true, category: { select: { name: true } } } } },
      take: 10000
    });
    const map = new Map<string, { procedimento: string; categoria: string; semResultado: number }>();
    for (const usage of usages) {
      const item = map.get(usage.procedure.id) ?? { procedimento: usage.procedure.title, categoria: usage.procedure.category.name, semResultado: 0 };
      item.semResultado += 1;
      map.set(usage.procedure.id, item);
    }
    return Array.from(map.values()).sort((first, second) => second.semResultado - first.semResultado);
  }

  if (type === 'top_searches' || type === 'no_result_searches') {
    const grouped = await prisma.searchLog.groupBy({
      by: ['normalizedQuery'],
      where: type === 'no_result_searches' ? { ...searchWhere, resultsCount: 0 } : searchWhere,
      _count: { _all: true },
      orderBy: { _count: { normalizedQuery: 'desc' } },
      take: 1000
    });
    return grouped.map((item) => ({ pesquisa: item.normalizedQuery, quantidade: item._count._all }));
  }

  if (type === 'audit_history') {
    const rows = await prisma.auditLog.findMany({
      where: {
        createdAt: range,
        actorId: filters.attendantId,
        procedureId: filters.procedureId
      },
      select: { createdAt: true, action: true, entityType: true, actor: { select: { name: true } }, procedure: { select: { title: true, categoryId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000
    });
    return rows
      .filter((item) => !filters.categoryId || item.procedure?.categoryId === filters.categoryId)
      .map((item) => ({
        data: item.createdAt.toISOString(),
        usuario: item.actor?.name ?? 'Sistema',
        acao: statusLabel(item.action),
        entidade: item.entityType,
        procedimento: item.procedure?.title ?? '-'
      }));
  }

  const buckets = makePeriodBuckets(filters);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  const rows = await prisma.procedureUsage.findMany({
    where: usageWhere,
    select: { startedAt: true, status: true },
    take: 10000
  });
  for (const usage of rows) {
    const bucket = bucketMap.get(formatDateKey(usage.startedAt));
    if (!bucket) continue;
    bucket.atendimentos += 1;
    if (usage.status === 'RESOLVED') bucket.resolvidos += 1;
    if (usage.status === 'NOT_RESOLVED') bucket.naoResolvidos += 1;
    if (usage.status === 'ESCALATED') bucket.encaminhados += 1;
  }
  return buckets.map((item) => ({ data: item.date, atendimentos: item.atendimentos, resolvidos: item.resolvidos, naoResolvidos: item.naoResolvidos, encaminhados: item.encaminhados }));
}

export async function getReportData(type: ReportType, filters: ReportFilters, emittedBy: string, page = 1, pageSize = 25) {
  const [company, rows] = await Promise.all([getCompanyName(), buildReportRows(type, filters)]);
  const paginated = paginateRows(rows, page, pageSize);
  const totals = summarizeRows(rows);

  return {
    data: {
      company,
      title: reportTitles[type],
      emittedAt: new Date().toISOString(),
      emittedBy,
      filters: reportFilterSummary(filters),
      totals,
      columns: getReportColumns(type),
      rows: paginated.rows
    },
    meta: paginated.meta
  };
}

function stringifyCell(value: string | number | null) {
  return value === null || value === undefined ? '' : String(value);
}

export function createCsv(report: ReportData) {
  const lines = [
    [report.company],
    [report.title],
    ['Emitido em', report.emittedAt],
    ['Responsavel', report.emittedBy],
    [],
    ['Filtros'],
    ...Object.entries(report.filters).map(([key, value]) => [key, value]),
    [],
    ['Totais'],
    ...Object.entries(report.totals).map(([key, value]) => [key, String(value)]),
    [],
    report.columns.map((column) => column.label),
    ...report.rows.map((row) => report.columns.map((column) => stringifyCell(row[column.key])))
  ];

  return lines
    .map((line) =>
      line
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
}

export async function createXlsx(report: ReportData) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Relatorio');

  sheet.addRow([report.company]);
  sheet.addRow([report.title]);
  sheet.addRow(['Emitido em', report.emittedAt]);
  sheet.addRow(['Responsavel', report.emittedBy]);
  sheet.addRow([]);
  sheet.addRow(['Filtros']);
  Object.entries(report.filters).forEach(([key, value]) => sheet.addRow([key, value]));
  sheet.addRow([]);
  sheet.addRow(['Totais']);
  Object.entries(report.totals).forEach(([key, value]) => sheet.addRow([key, value]));
  sheet.addRow([]);
  sheet.addRow(report.columns.map((column) => column.label));
  report.rows.forEach((row) => sheet.addRow(report.columns.map((column) => row[column.key])));
  sheet.columns.forEach((column) => {
    column.width = 24;
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createPdf(report: ReportData) {
  const document = new PDFDocument({ size: 'A4', margin: 36 });
  const chunks: Buffer[] = [];

  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    document.on('end', () => resolve(Buffer.concat(chunks)));
  });

  let page = 1;
  function footer() {
    document.fontSize(8).fillColor('#64748b').text(`Pagina ${page}`, 36, 806, { align: 'right' });
  }
  function ensureSpace(height = 28) {
    if (document.y + height > 790) {
      footer();
      document.addPage();
      page += 1;
    }
  }

  document.fontSize(16).fillColor('#0f172a').text(report.company);
  document.fontSize(13).text(report.title);
  document.fontSize(9).fillColor('#475569').text(`Emitido em: ${new Date(report.emittedAt).toLocaleString('pt-BR')}`);
  document.text(`Responsavel: ${report.emittedBy}`);
  document.moveDown();
  document.fontSize(10).fillColor('#0f172a').text('Filtros utilizados', { underline: true });
  Object.entries(report.filters).forEach(([key, value]) => document.fontSize(9).fillColor('#475569').text(`${key}: ${value}`));
  document.moveDown();
  document.fontSize(10).fillColor('#0f172a').text('Totais', { underline: true });
  Object.entries(report.totals).forEach(([key, value]) => document.fontSize(9).fillColor('#475569').text(`${key}: ${value}`));
  document.moveDown();

  const headers = report.columns.map((column) => column.label).join(' | ');
  document.fontSize(8).fillColor('#0f172a').text(headers);
  document.moveDown(0.5);
  for (const row of report.rows) {
    ensureSpace(36);
    const line = report.columns.map((column) => stringifyCell(row[column.key])).join(' | ');
    document.fontSize(8).fillColor('#334155').text(line, { width: 520 });
    document.moveDown(0.35);
  }
  footer();
  document.end();

  return done;
}

export async function createReportFile(type: ReportType, filters: ReportFilters, emittedBy: string, format: ReportFormat) {
  const { data } = await getReportData(type, filters, emittedBy, 1, 10000);
  if (format === 'csv') {
    return { buffer: Buffer.from(createCsv(data), 'utf8'), contentType: 'text/csv; charset=utf-8', extension: 'csv' };
  }
  if (format === 'xlsx') {
    return {
      buffer: await createXlsx(data),
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx'
    };
  }
  return { buffer: await createPdf(data), contentType: 'application/pdf', extension: 'pdf' };
}

export async function getAdminDashboard(filters: DashboardFilters) {
  const usageWhere = buildUsageWhere(filters);
  const procedureWhere = buildProcedureWhere(filters);
  const searchWhere = buildSearchWhere(filters);
  const feedbackWhere = buildFeedbackWhere(filters);
  const categoryWhere = { deletedAt: null, status: 'ACTIVE' as const, id: filters.categoryId };

  const [
    procedureStatus,
    categoryCount,
    activeAttendants,
    usageStatus,
    usageRows,
    messageRows,
    searchRows,
    noResultSearchRows,
    feedbackRows,
    attendants,
    categories,
    procedures
  ] = await Promise.all([
    prisma.procedure.groupBy({
      by: ['status'],
      where: procedureWhere,
      _count: { _all: true }
    }),
    prisma.category.count({ where: categoryWhere }),
    prisma.user.count({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { deletedAt: null, role: { slug: 'attendant', deletedAt: null } } }
      }
    }),
    prisma.procedureUsage.groupBy({
      by: ['status'],
      where: usageWhere,
      _count: { _all: true }
    }),
    prisma.procedureUsage.findMany({
      where: usageWhere,
      select: {
        id: true,
        status: true,
        startedAt: true,
        procedure: { select: { id: true, title: true, category: { select: { id: true, name: true } } } },
        attendant: { select: { id: true, name: true } }
      },
      orderBy: { startedAt: 'asc' },
      take: 5000
    }),
    prisma.copyableMessage.findMany({
      where: {
        deletedAt: null,
        procedureId: filters.procedureId,
        procedure: { deletedAt: null, categoryId: filters.categoryId },
        copyCount: { gt: 0 }
      },
      select: { id: true, title: true, copyCount: true, procedure: { select: { id: true, title: true } } },
      orderBy: [{ copyCount: 'desc' }, { updatedAt: 'desc' }],
      take: 10
    }),
    prisma.searchLog.groupBy({
      by: ['normalizedQuery'],
      where: searchWhere,
      _count: { _all: true },
      orderBy: { _count: { normalizedQuery: 'desc' } },
      take: 10
    }),
    prisma.searchLog.groupBy({
      by: ['normalizedQuery'],
      where: { ...searchWhere, resultsCount: 0 },
      _count: { _all: true },
      orderBy: { _count: { normalizedQuery: 'desc' } },
      take: 10
    }),
    prisma.procedureFeedback.findMany({
      where: feedbackWhere,
      select: {
        rating: true,
        wasResolved: true,
        procedureId: true,
        procedure: { select: { title: true } }
      },
      take: 5000
    }),
    prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { deletedAt: null, role: { slug: 'attendant', deletedAt: null } } }
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.category.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }]
    }),
    prisma.procedure.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
      take: 300
    })
  ]);

  const procedureStatusMap = new Map(procedureStatus.map((item) => [item.status, item._count._all]));
  const usageStatusMap = new Map(usageStatus.map((item) => [item.status, item._count._all]));
  const totalCompleted =
    (usageStatusMap.get('RESOLVED') ?? 0) +
    (usageStatusMap.get('NOT_RESOLVED') ?? 0) +
    (usageStatusMap.get('ESCALATED') ?? 0);
  const resolvedCount = usageStatusMap.get('RESOLVED') ?? 0;

  const procedureUsage = new Map<string, { name: string; value: number }>();
  const attendantUsage = new Map<string, { name: string; value: number }>();
  const categoryUsage = new Map<string, { name: string; value: number }>();
  const periodMap = new Map(makePeriodBuckets(filters).map((bucket) => [bucket.date, bucket]));

  for (const usage of usageRows) {
    const procedure = procedureUsage.get(usage.procedure.id) ?? { name: usage.procedure.title, value: 0 };
    procedure.value += 1;
    procedureUsage.set(usage.procedure.id, procedure);

    const attendant = attendantUsage.get(usage.attendant.id) ?? { name: usage.attendant.name, value: 0 };
    attendant.value += 1;
    attendantUsage.set(usage.attendant.id, attendant);

    const category = categoryUsage.get(usage.procedure.category.id) ?? { name: usage.procedure.category.name, value: 0 };
    category.value += 1;
    categoryUsage.set(usage.procedure.category.id, category);

    const bucket = periodMap.get(formatDateKey(usage.startedAt));
    if (bucket) {
      bucket.atendimentos += 1;
      if (usage.status === 'RESOLVED') bucket.resolvidos += 1;
      if (usage.status === 'NOT_RESOLVED') bucket.naoResolvidos += 1;
      if (usage.status === 'ESCALATED') bucket.encaminhados += 1;
    }
  }

  const ratings = [1, 2, 3, 4, 5].map((rating) => ({
    rating: String(rating),
    quantidade: feedbackRows.filter((item) => item.rating === rating).length
  }));
  const rated = feedbackRows.filter((item) => item.rating).map((item) => item.rating ?? 0);

  return {
    cards: {
      totalProcedures: Array.from(procedureStatusMap.values()).reduce((sum, item) => sum + item, 0),
      published: procedureStatusMap.get('PUBLISHED') ?? 0,
      drafts: procedureStatusMap.get('DRAFT') ?? 0,
      archived: procedureStatusMap.get('ARCHIVED') ?? 0,
      categories: categoryCount,
      activeAttendants,
      started: usageRows.length,
      resolved: resolvedCount,
      notResolved: usageStatusMap.get('NOT_RESOLVED') ?? 0,
      escalated: usageStatusMap.get('ESCALATED') ?? 0
    },
    charts: {
      mostUsedProcedures: Array.from(procedureUsage.values()).sort((a, b) => b.value - a.value).slice(0, 10),
      mostCopiedMessages: messageRows.map((item) => ({ name: item.title, value: item.copyCount, procedure: item.procedure.title })),
      resolutionRate: [
        { name: 'Resolvidos', value: resolvedCount },
        { name: 'Nao resolvidos', value: usageStatusMap.get('NOT_RESOLVED') ?? 0 },
        { name: 'Encaminhados', value: usageStatusMap.get('ESCALATED') ?? 0 }
      ],
      resolutionPercent: totalCompleted ? round((resolvedCount / totalCompleted) * 100) : 0,
      usageByAttendant: Array.from(attendantUsage.values()).sort((a, b) => b.value - a.value).slice(0, 10),
      usageByCategory: Array.from(categoryUsage.values()).sort((a, b) => b.value - a.value).slice(0, 10),
      topSearches: searchRows.map((item) => ({ name: item.normalizedQuery, value: item._count._all })),
      noResultSearches: noResultSearchRows.map((item) => ({ name: item.normalizedQuery, value: item._count._all })),
      ratings,
      averageRating: rated.length ? round(rated.reduce((sum, item) => sum + item, 0) / rated.length) : null,
      attendancesByPeriod: Array.from(periodMap.values())
    },
    filters: {
      attendants,
      categories,
      procedures
    }
  };
}

export async function getFeedbackReport() {
  const [feedbacks, usages] = await Promise.all([
    prisma.procedureFeedback.findMany({
      include: {
        procedure: { select: { id: true, title: true, category: { select: { name: true } } } },
        user: { select: { id: true, name: true, email: true } },
        usage: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            steps: {
              include: {
                step: { select: { title: true } },
                selectedOption: { select: { label: true } }
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    }),
    prisma.procedureUsage.findMany({
      where: {
        status: { in: ['RESOLVED', 'NOT_RESOLVED', 'ESCALATED'] },
        procedure: { deletedAt: null }
      },
      include: {
        procedure: { select: { id: true, title: true } },
        feedback: true
      }
    })
  ]);

  const aggregates = new Map<string, ProcedureAggregate>();

  for (const usage of usages) {
    const current =
      aggregates.get(usage.procedureId) ??
      {
        procedureId: usage.procedureId,
        procedureTitle: usage.procedure.title,
        feedbackCount: 0,
        ratingCount: 0,
        averageRating: null,
        resolvedCount: 0,
        totalCompleted: 0,
        resolutionRate: 0
      };

    current.totalCompleted += 1;
    if (usage.status === 'RESOLVED') current.resolvedCount += 1;
    if (usage.feedback) {
      current.feedbackCount += 1;
      if (usage.feedback.rating) {
        const previousTotal = (current.averageRating ?? 0) * current.ratingCount;
        current.ratingCount += 1;
        current.averageRating = round((previousTotal + usage.feedback.rating) / current.ratingCount);
      }
    }
    current.resolutionRate = round((current.resolvedCount / current.totalCompleted) * 100);
    aggregates.set(usage.procedureId, current);
  }

  const aggregateList = Array.from(aggregates.values());

  return {
    feedbacks: feedbacks.map((feedback) => ({
      id: feedback.id,
      procedure: feedback.procedure,
      attendant: feedback.user,
      status: feedback.usage.status,
      wasResolved: feedback.wasResolved,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt,
      path: feedback.usage.steps.map((step) => ({
        order: step.order,
        stepTitle: step.step.title,
        selectedOptionLabel: step.selectedOption?.label ?? null
      }))
    })),
    worstRated: aggregateList
      .filter((item) => item.ratingCount > 0)
      .sort((first, second) => (first.averageRating ?? 0) - (second.averageRating ?? 0) || second.feedbackCount - first.feedbackCount)
      .slice(0, 10),
    bestResolution: aggregateList
      .filter((item) => item.totalCompleted > 0)
      .sort((first, second) => second.resolutionRate - first.resolutionRate || second.totalCompleted - first.totalCompleted)
      .slice(0, 10)
  };
}
