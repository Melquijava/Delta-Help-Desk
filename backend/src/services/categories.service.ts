import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { UserStatus } from '../types/domain.js';
import { slugify } from '../utils/slug.js';

const categoryInclude = {
  _count: {
    select: {
      procedures: true
    }
  }
} as const;

export type CategoryInput = {
  name: string;
  slug?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  order?: number;
  status: UserStatus;
};

export type CategoryFilters = {
  q?: string;
  status?: UserStatus;
};

export class CategoryModuleError extends Error {
  constructor(
    public readonly code:
      | 'CATEGORY_NOT_FOUND'
      | 'SLUG_IN_USE'
      | 'INVALID_MOVE'
  ) {
    super(code);
  }
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeSlug(input: CategoryInput) {
  return slugify(input.slug || input.name);
}

function sanitizeCategory(category: Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    icon: category.icon,
    color: category.color,
    order: category.order,
    status: category.status,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    deletedAt: category.deletedAt,
    procedureCount: category._count.procedures
  };
}

export async function listCategories(filters: CategoryFilters) {
  const where: Prisma.CategoryWhereInput = {
    deletedAt: null,
    status: filters.status
  };

  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { slug: { contains: filters.q } },
      { description: { contains: filters.q } }
    ];
  }

  const categories = await prisma.category.findMany({
    where,
    include: categoryInclude,
    orderBy: [{ order: 'asc' }, { name: 'asc' }]
  });

  return categories.map(sanitizeCategory);
}

export async function getCategoryById(id: string) {
  const category = await prisma.category.findFirst({
    where: { id, deletedAt: null },
    include: categoryInclude
  });

  if (!category) {
    throw new CategoryModuleError('CATEGORY_NOT_FOUND');
  }

  return sanitizeCategory(category);
}

async function nextOrder() {
  const latest = await prisma.category.findFirst({
    where: { deletedAt: null },
    orderBy: { order: 'desc' }
  });

  return (latest?.order ?? 0) + 1;
}

export async function createCategory(input: CategoryInput) {
  try {
    const category = await prisma.category.create({
      data: {
        name: input.name,
        slug: normalizeSlug(input),
        description: normalizeOptional(input.description),
        icon: normalizeOptional(input.icon),
        color: normalizeOptional(input.color),
        order: input.order ?? (await nextOrder()),
        status: input.status
      },
      include: categoryInclude
    });

    return sanitizeCategory(category);
  } catch (error) {
    handlePrismaCategoryError(error);
  }
}

export async function updateCategory(id: string, input: CategoryInput) {
  await getCategoryById(id);

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: input.name,
        slug: normalizeSlug(input),
        description: normalizeOptional(input.description),
        icon: normalizeOptional(input.icon),
        color: normalizeOptional(input.color),
        order: input.order,
        status: input.status
      },
      include: categoryInclude
    });

    return sanitizeCategory(category);
  } catch (error) {
    handlePrismaCategoryError(error);
  }
}

export async function updateCategoryStatus(id: string, status: UserStatus) {
  await getCategoryById(id);

  const category = await prisma.category.update({
    where: { id },
    data: { status },
    include: categoryInclude
  });

  return sanitizeCategory(category);
}

export async function moveCategory(id: string, direction: 'up' | 'down') {
  const category = await prisma.category.findFirst({
    where: { id, deletedAt: null }
  });

  if (!category) {
    throw new CategoryModuleError('CATEGORY_NOT_FOUND');
  }

  const neighbor = await prisma.category.findFirst({
    where: {
      deletedAt: null,
      order: direction === 'up' ? { lt: category.order } : { gt: category.order }
    },
    orderBy: {
      order: direction === 'up' ? 'desc' : 'asc'
    }
  });

  if (!neighbor) {
    throw new CategoryModuleError('INVALID_MOVE');
  }

  await prisma.$transaction([
    prisma.category.update({
      where: { id: category.id },
      data: { order: neighbor.order }
    }),
    prisma.category.update({
      where: { id: neighbor.id },
      data: { order: category.order }
    })
  ]);

  return getCategoryById(id);
}

export async function deleteCategory(id: string) {
  await getCategoryById(id);

  const category = await prisma.category.update({
    where: { id },
    data: {
      status: 'INACTIVE',
      deletedAt: new Date()
    },
    include: categoryInclude
  });

  return sanitizeCategory(category);
}

function handlePrismaCategoryError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new CategoryModuleError('SLUG_IN_USE');
    }

    if (error.code === 'P2025') {
      throw new CategoryModuleError('CATEGORY_NOT_FOUND');
    }
  }

  throw error;
}
