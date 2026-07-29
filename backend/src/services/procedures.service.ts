import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { ProcedureDifficulty, ProcedureStatus } from '../types/domain.js';
import { parseJson, stringifyJson } from '../utils/json.js';
import { slugify } from '../utils/slug.js';
import { validateProcedureFlow } from './procedure-steps.service.js';

const procedureInclude = {
  author: {
    select: {
      id: true,
      name: true,
      email: true
    }
  },
  category: true,
  _count: {
    select: {
      steps: {
        where: {
          deletedAt: null
        }
      }
    }
  }
} as const;

export type ProcedureFilters = {
  q?: string;
  categoryId?: string;
  status?: ProcedureStatus;
  difficulty?: ProcedureDifficulty;
  deleted?: boolean;
};

export type ProcedureInput = {
  title: string;
  slug?: string | null;
  summary: string;
  description?: string | null;
  categoryId: string;
  keywords: string[];
  symptoms: string[];
  difficulty: ProcedureDifficulty;
  estimatedMinutes?: number | null;
  featured: boolean;
  status: ProcedureStatus;
};

export class ProcedureModuleError extends Error {
  constructor(
    public readonly code:
      | 'PROCEDURE_NOT_FOUND'
      | 'CATEGORY_NOT_FOUND'
      | 'SLUG_IN_USE'
      | 'NO_STEPS_TO_PUBLISH'
      | 'INVALID_FLOW'
  ) {
    super(code);
  }
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeTerms(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function asStringArray(value: string) {
  return parseJson<unknown[]>(value, []).filter((item): item is string => typeof item === 'string');
}

function normalizeSlug(input: Pick<ProcedureInput, 'title' | 'slug'>) {
  return slugify(input.slug || input.title);
}

function sanitizeProcedure(
  procedure: Prisma.ProcedureGetPayload<{ include: typeof procedureInclude }>
) {
  return {
    id: procedure.id,
    title: procedure.title,
    slug: procedure.slug,
    summary: procedure.summary,
    description: procedure.description,
    categoryId: procedure.categoryId,
    category: procedure.category,
    keywords: asStringArray(procedure.keywords),
    symptoms: asStringArray(procedure.symptoms),
    difficulty: procedure.difficulty,
    estimatedMinutes: procedure.estimatedMinutes,
    status: procedure.status,
    featured: procedure.featured,
    authorId: procedure.authorId,
    author: procedure.author,
    publishedAt: procedure.publishedAt,
    archivedAt: procedure.archivedAt,
    createdAt: procedure.createdAt,
    updatedAt: procedure.updatedAt,
    deletedAt: procedure.deletedAt,
    stepCount: procedure._count.steps
  };
}

async function assertCategoryExists(categoryId: string) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      deletedAt: null
    }
  });

  if (!category) {
    throw new ProcedureModuleError('CATEGORY_NOT_FOUND');
  }
}

export async function listProcedures(filters: ProcedureFilters, page: number, pageSize: number) {
  const where: Prisma.ProcedureWhereInput = {
    deletedAt: filters.deleted ? { not: null } : null,
    categoryId: filters.categoryId,
    status: filters.status,
    difficulty: filters.difficulty
  };

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q } },
      { slug: { contains: filters.q } },
      { summary: { contains: filters.q } }
    ];
  }

  const [total, procedures] = await prisma.$transaction([
    prisma.procedure.count({ where }),
    prisma.procedure.findMany({
      where,
      include: procedureInclude,
      orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    data: procedures.map(sanitizeProcedure),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

export async function getProcedureById(id: string) {
  const procedure = await prisma.procedure.findFirst({
    where: { id },
    include: procedureInclude
  });

  if (!procedure) {
    throw new ProcedureModuleError('PROCEDURE_NOT_FOUND');
  }

  return sanitizeProcedure(procedure);
}

export async function createProcedure(input: ProcedureInput, authorId: string) {
  await assertCategoryExists(input.categoryId);

  try {
    const procedure = await prisma.procedure.create({
      data: {
        title: input.title,
        slug: normalizeSlug(input),
        summary: input.summary,
        description: normalizeOptional(input.description),
        categoryId: input.categoryId,
        keywords: stringifyJson(normalizeTerms(input.keywords)),
        symptoms: stringifyJson(normalizeTerms(input.symptoms)),
        difficulty: input.difficulty,
        estimatedMinutes: input.estimatedMinutes,
        status: input.status,
        featured: input.featured,
        authorId,
        publishedAt: null
      },
      include: procedureInclude
    });

    return sanitizeProcedure(procedure);
  } catch (error) {
    handlePrismaProcedureError(error);
  }
}

export async function updateProcedure(id: string, input: ProcedureInput) {
  await getProcedureById(id);
  await assertCategoryExists(input.categoryId);

  try {
    const procedure = await prisma.procedure.update({
      where: { id },
      data: {
        title: input.title,
        slug: normalizeSlug(input),
        summary: input.summary,
        description: normalizeOptional(input.description),
        categoryId: input.categoryId,
        keywords: stringifyJson(normalizeTerms(input.keywords)),
        symptoms: stringifyJson(normalizeTerms(input.symptoms)),
        difficulty: input.difficulty,
        estimatedMinutes: input.estimatedMinutes,
        status: input.status,
        featured: input.featured,
        publishedAt: input.status === 'PUBLISHED' ? new Date() : undefined,
        archivedAt: input.status === 'ARCHIVED' ? new Date() : null
      },
      include: procedureInclude
    });

    return sanitizeProcedure(procedure);
  } catch (error) {
    handlePrismaProcedureError(error);
  }
}

export async function publishProcedure(id: string) {
  const validation = await validateProcedureFlow(id);

  if (validation.steps.length === 0) {
    throw new ProcedureModuleError('NO_STEPS_TO_PUBLISH');
  }

  if (!validation.isValid) {
    throw new ProcedureModuleError('INVALID_FLOW');
  }

  const procedure = await prisma.procedure.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      archivedAt: null
    },
    include: procedureInclude
  });

  return sanitizeProcedure(procedure);
}

export async function archiveProcedure(id: string) {
  await getProcedureById(id);

  const procedure = await prisma.procedure.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date()
    },
    include: procedureInclude
  });

  return sanitizeProcedure(procedure);
}

export async function duplicateProcedure(id: string, authorId: string) {
  const source = await prisma.procedure.findUnique({
    where: { id },
    include: procedureInclude
  });

  if (!source) {
    throw new Error('PROCEDURE_NOT_FOUND');
  }

  let suffix = 1;
  let slug = `${source.slug}-copia`;

  while (await prisma.procedure.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${source.slug}-copia-${suffix}`;
  }

  const procedure = await prisma.procedure.create({
    data: {
      title: `${source.title} (copia)`,
      slug,
      summary: source.summary,
      description: source.description,
      categoryId: source.categoryId,
      keywords: source.keywords,
      symptoms: source.symptoms,
      difficulty: source.difficulty,
      estimatedMinutes: source.estimatedMinutes,
      featured: false,
      status: 'DRAFT',
      authorId,
      publishedAt: null,
      archivedAt: null
    },
    include: procedureInclude
  });

  return sanitizeProcedure(procedure);
}

export async function deleteProcedure(id: string) {
  await getProcedureById(id);

  const procedure = await prisma.procedure.update({
    where: { id },
    data: {
      deletedAt: new Date()
    },
    include: procedureInclude
  });

  return sanitizeProcedure(procedure);
}

export async function restoreProcedure(id: string) {
  const current = await getProcedureById(id);

  if (!current.deletedAt) {
    return current;
  }

  const procedure = await prisma.procedure.update({
    where: { id },
    data: {
      deletedAt: null,
      status: 'DRAFT'
    },
    include: procedureInclude
  });

  return sanitizeProcedure(procedure);
}

function handlePrismaProcedureError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ProcedureModuleError('SLUG_IN_USE');
    }

    if (error.code === 'P2025') {
      throw new ProcedureModuleError('PROCEDURE_NOT_FOUND');
    }
  }

  throw error;
}
