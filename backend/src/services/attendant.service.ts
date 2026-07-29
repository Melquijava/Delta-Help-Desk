import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { UsageStatus } from '../types/domain.js';
import { parseJson } from '../utils/json.js';
import { getSettings } from './settings.service.js';

const procedureSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  keywords: true,
  symptoms: true,
  difficulty: true,
  estimatedMinutes: true,
  featured: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      color: true
    }
  },
  steps: {
    where: { deletedAt: null },
    select: {
      title: true,
      content: true,
      explanation: true,
      helperMessage: true,
      messages: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { title: true, content: true }
      }
    }
  },
  favoriteItems: {
    where: { deletedAt: null },
    select: { userId: true }
  },
  _count: {
    select: {
      steps: { where: { deletedAt: null } },
      usages: true,
      favoriteItems: { where: { deletedAt: null } }
    }
  }
} satisfies Prisma.ProcedureSelect;

const runnableProcedureInclude = {
  category: {
    select: { id: true, name: true, slug: true, icon: true, color: true }
  },
  steps: {
    where: { deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      options: {
        where: { deletedAt: null },
        orderBy: { order: 'asc' }
      },
      messages: {
        where: { deletedAt: null, status: 'ACTIVE' },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
      }
    }
  }
} satisfies Prisma.ProcedureInclude;

type ProcedureResult = Prisma.ProcedureGetPayload<{ select: typeof procedureSelect }>;

function asStringArray(value: string) {
  return parseJson<unknown[]>(value, []).filter((item): item is string => typeof item === 'string');
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function includesTerm(value: string | null | undefined, term: string) {
  return Boolean(value && normalize(value).includes(term));
}

function scoreProcedure(procedure: ProcedureResult, term: string) {
  if (!term) return procedure.featured ? 5 : 1;

  let score = 0;
  if (includesTerm(procedure.title, term)) score += 80;
  if (includesTerm(procedure.summary, term)) score += 45;
  if (includesTerm(procedure.category.name, term)) score += 35;

  for (const keyword of asStringArray(procedure.keywords)) {
    if (includesTerm(keyword, term)) score += 55;
  }

  for (const symptom of asStringArray(procedure.symptoms)) {
    if (includesTerm(symptom, term)) score += 50;
  }

  for (const step of procedure.steps) {
    if (includesTerm(step.title, term)) score += 25;
    if (includesTerm(step.content, term)) score += 18;
    if (includesTerm(step.explanation, term)) score += 12;
    if (includesTerm(step.helperMessage, term)) score += 12;

    for (const message of step.messages) {
      if (includesTerm(message.title, term)) score += 18;
      if (includesTerm(message.content, term)) score += 14;
    }
  }

  if (procedure.featured) score += 4;
  score += Math.min(procedure._count.usages, 20);
  return score;
}

function sanitizeProcedure(procedure: ProcedureResult, userId: string, score = 0) {
  return {
    id: procedure.id,
    title: procedure.title,
    slug: procedure.slug,
    summary: procedure.summary,
    keywords: asStringArray(procedure.keywords),
    symptoms: asStringArray(procedure.symptoms),
    difficulty: procedure.difficulty,
    estimatedMinutes: procedure.estimatedMinutes,
    featured: procedure.featured,
    updatedAt: procedure.updatedAt,
    category: procedure.category,
    stepCount: procedure._count.steps,
    usageCount: procedure._count.usages,
    favoriteCount: procedure._count.favoriteItems,
    isFavorite: procedure.favoriteItems.some((favorite) => favorite.userId === userId),
    score
  };
}

const publishedWhere = {
  status: 'PUBLISHED',
  deletedAt: null,
  category: {
    deletedAt: null,
    status: 'ACTIVE'
  }
} satisfies Prisma.ProcedureWhereInput;

export async function getAttendantDashboard(userId: string) {
  const [categories, featured, favorites, recentUsages, mostUsed] = await Promise.all([
    prisma.category.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        color: true,
        _count: {
          select: {
            procedures: {
              where: { status: 'PUBLISHED', deletedAt: null }
            }
          }
        }
      }
    }),
    prisma.procedure.findMany({
      where: { ...publishedWhere, featured: true },
      select: procedureSelect,
      orderBy: [{ updatedAt: 'desc' }],
      take: 6
    }),
    prisma.favoriteProcedure.findMany({
      where: {
        userId,
        deletedAt: null,
        procedure: publishedWhere
      },
      include: { procedure: { select: procedureSelect } },
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    prisma.procedureUsage.findMany({
      where: {
        attendantId: userId,
        procedure: publishedWhere
      },
      include: { procedure: { select: procedureSelect } },
      orderBy: { startedAt: 'desc' },
      distinct: ['procedureId'],
      take: 6
    }),
    prisma.procedure.findMany({
      where: publishedWhere,
      select: procedureSelect,
      orderBy: [{ usages: { _count: 'desc' } }, { updatedAt: 'desc' }],
      take: 6
    })
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      color: category.color,
      procedureCount: category._count.procedures
    })),
    featured: featured.map((procedure) => sanitizeProcedure(procedure, userId)),
    favorites: favorites.map((item) => sanitizeProcedure(item.procedure, userId)),
    recent: recentUsages.map((usage) => sanitizeProcedure(usage.procedure, userId)),
    mostUsed: mostUsed.map((procedure) => sanitizeProcedure(procedure, userId))
  };
}

export async function searchPublishedProcedures(userId: string, query: string, categoryId?: string) {
  const normalizedQuery = normalize(query);

  const procedures = await prisma.procedure.findMany({
    where: {
      ...publishedWhere,
      categoryId: categoryId || undefined
    },
    select: procedureSelect,
    orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
    take: 200
  });

  const results = procedures
    .map((procedure) => ({ procedure, score: scoreProcedure(procedure, normalizedQuery) }))
    .filter((item) => !normalizedQuery || item.score > 0)
    .sort((first, second) => second.score - first.score || first.procedure.title.localeCompare(second.procedure.title))
    .slice(0, 30)
    .map((item) => sanitizeProcedure(item.procedure, userId, item.score));

  if (normalizedQuery) {
    await prisma.searchLog.create({
      data: {
        userId,
        query,
        normalizedQuery,
        resultsCount: results.length
      }
    });
  }

  return {
    query,
    normalizedQuery,
    resultsCount: results.length,
    results
  };
}

export async function toggleFavoriteProcedure(userId: string, procedureId: string) {
  const settings = await getSettings();
  if (!settings.allowFavorites) {
    throw new Error('FAVORITES_DISABLED');
  }

  const procedure = await prisma.procedure.findFirst({
    where: { id: procedureId, ...publishedWhere },
    select: { id: true }
  });

  if (!procedure) {
    throw new Error('PROCEDURE_NOT_FOUND');
  }

  const favorite = await prisma.favoriteProcedure.findUnique({
    where: { userId_procedureId: { userId, procedureId } }
  });

  if (!favorite) {
    await prisma.favoriteProcedure.create({ data: { userId, procedureId } });
    return { procedureId, isFavorite: true };
  }

  const deletedAt = favorite.deletedAt ? null : new Date();
  await prisma.favoriteProcedure.update({
    where: { userId_procedureId: { userId, procedureId } },
    data: { deletedAt }
  });

  return { procedureId, isFavorite: !deletedAt };
}

export async function listFavoriteProcedures(userId: string) {
  const favorites = await prisma.favoriteProcedure.findMany({
    where: {
      userId,
      deletedAt: null,
      procedure: publishedWhere
    },
    include: { procedure: { select: procedureSelect } },
    orderBy: { createdAt: 'desc' }
  });

  return favorites.map((item) => sanitizeProcedure(item.procedure, userId));
}

export async function listRecentProcedures(userId: string) {
  const usages = await prisma.procedureUsage.findMany({
    where: {
      attendantId: userId,
      procedure: publishedWhere
    },
    include: { procedure: { select: procedureSelect } },
    orderBy: { startedAt: 'desc' },
    take: 50
  });

  const seen = new Set<string>();
  return usages
    .filter((usage) => {
      if (seen.has(usage.procedureId)) return false;
      seen.add(usage.procedureId);
      return true;
    })
    .slice(0, 20)
    .map((usage) => sanitizeProcedure(usage.procedure, userId));
}

export async function getRunnableProcedure(userId: string, procedureId: string) {
  const procedure = await prisma.procedure.findFirst({
    where: { id: procedureId, ...publishedWhere },
    include: {
      ...runnableProcedureInclude,
      favoriteItems: {
        where: { userId, deletedAt: null },
        select: { id: true }
      }
    }
  });

  if (!procedure) {
    throw new Error('PROCEDURE_NOT_FOUND');
  }

  return {
    id: procedure.id,
    title: procedure.title,
    slug: procedure.slug,
    summary: procedure.summary,
    description: procedure.description,
    difficulty: procedure.difficulty,
    estimatedMinutes: procedure.estimatedMinutes,
    initialStepId: procedure.initialStepId,
    category: procedure.category,
    isFavorite: procedure.favoriteItems.length > 0,
    steps: procedure.steps.map((step) => ({
      id: step.id,
      title: step.title,
      instruction: step.content,
      explanation: step.explanation,
      helperMessage: step.helperMessage,
      highlighted: step.highlighted,
      type: step.type,
      position: step.position,
      nextStepId: step.nextStepId,
      isFinal: step.isFinal,
      options: step.options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        order: option.order,
        nextStepId: option.nextStepId
      })),
      messages: step.messages.map((message) => ({
        id: message.id,
        title: message.title,
        content: message.content,
        order: message.order,
        status: message.status,
        copyCount: message.copyCount
      }))
    }))
  };
}

export async function startProcedureUsage(userId: string, procedureId: string) {
  const procedure = await getRunnableProcedure(userId, procedureId);
  const initialStepId = procedure.initialStepId ?? procedure.steps[0]?.id ?? null;

  if (!initialStepId) {
    throw new Error('PROCEDURE_WITHOUT_STEPS');
  }

  const usage = await prisma.procedureUsage.create({
    data: {
      procedureId,
      attendantId: userId,
      currentStepId: initialStepId,
      status: 'IN_PROGRESS'
    }
  });

  await recordUsageStep(userId, usage.id, initialStepId);

  return getProcedureUsage(userId, usage.id);
}

export async function getProcedureUsage(userId: string, usageId: string) {
  const usage = await prisma.procedureUsage.findFirst({
    where: { id: usageId, attendantId: userId },
    include: {
      procedure: {
        include: runnableProcedureInclude
      },
      steps: {
        include: {
          step: { select: { id: true, title: true, position: true, type: true } },
          selectedOption: { select: { id: true, label: true } }
        },
        orderBy: { order: 'asc' }
      }
    }
  });

  if (!usage || usage.procedure.status !== 'PUBLISHED' || usage.procedure.deletedAt) {
    throw new Error('USAGE_NOT_FOUND');
  }

  return {
    id: usage.id,
    procedureId: usage.procedureId,
    attendantId: usage.attendantId,
    status: usage.status,
    currentStepId: usage.currentStepId,
    startedAt: usage.startedAt,
    completedAt: usage.completedAt,
    resolvedAt: usage.resolvedAt,
    resolutionNote: usage.resolutionNote,
    path: usage.steps.map((step) => ({
      id: step.id,
      stepId: step.stepId,
      stepTitle: step.step.title,
      stepType: step.step.type,
      selectedOptionId: step.selectedOptionId,
      selectedOptionLabel: step.selectedOption?.label ?? null,
      order: step.order,
      notes: step.notes,
      enteredAt: step.enteredAt,
      leftAt: step.leftAt
    }))
  };
}

export async function recordUsageStep(userId: string, usageId: string, stepId: string, selectedOptionId?: string | null) {
  const usage = await prisma.procedureUsage.findFirst({
    where: { id: usageId, attendantId: userId },
    select: { id: true, procedureId: true, status: true, currentStepId: true }
  });

  if (!usage || usage.status !== 'IN_PROGRESS') {
    throw new Error('USAGE_NOT_FOUND');
  }

  const step = await prisma.procedureStep.findFirst({
    where: { id: stepId, procedureId: usage.procedureId, deletedAt: null },
    select: { id: true }
  });

  if (!step) {
    throw new Error('STEP_NOT_FOUND');
  }

  if (selectedOptionId) {
    const option = await prisma.stepOption.findFirst({
      where: {
        id: selectedOptionId,
        stepId: usage.currentStepId ?? '',
        nextStepId: stepId,
        deletedAt: null
      },
      select: { id: true }
    });

    if (!option) {
      throw new Error('OPTION_NOT_FOUND');
    }
  }

  const previous = await prisma.procedureUsageStep.findFirst({
    where: { usageId, leftAt: null },
    orderBy: { order: 'desc' }
  });
  const latest = await prisma.procedureUsageStep.findFirst({
    where: { usageId },
    orderBy: { order: 'desc' }
  });

  await prisma.$transaction([
    ...(previous
      ? [
          prisma.procedureUsageStep.update({
            where: { id: previous.id },
            data: { leftAt: new Date(), selectedOptionId: selectedOptionId ?? previous.selectedOptionId }
          })
        ]
      : []),
    prisma.procedureUsageStep.create({
      data: {
        usageId,
        stepId,
        selectedOptionId: null,
        order: (latest?.order ?? 0) + 1
      }
    }),
    prisma.procedureUsage.update({
      where: { id: usageId },
      data: { currentStepId: stepId }
    })
  ]);

  return getProcedureUsage(userId, usageId);
}

export async function goBackUsageStep(userId: string, usageId: string) {
  const usage = await prisma.procedureUsage.findFirst({
    where: { id: usageId, attendantId: userId, status: 'IN_PROGRESS' },
    include: { steps: { orderBy: { order: 'desc' }, take: 2 } }
  });

  if (!usage) throw new Error('USAGE_NOT_FOUND');
  if (usage.steps.length < 2) return getProcedureUsage(userId, usageId);

  const [current, previous] = usage.steps;
  await prisma.$transaction([
    prisma.procedureUsageStep.delete({ where: { id: current.id } }),
    prisma.procedureUsageStep.update({ where: { id: previous.id }, data: { leftAt: null } }),
    prisma.procedureUsage.update({ where: { id: usageId }, data: { currentStepId: previous.stepId } })
  ]);

  return getProcedureUsage(userId, usageId);
}

export async function restartProcedureUsage(userId: string, usageId: string) {
  const usage = await prisma.procedureUsage.findFirst({
    where: { id: usageId, attendantId: userId },
    include: { procedure: { select: { initialStepId: true } } }
  });

  if (!usage) throw new Error('USAGE_NOT_FOUND');

  const firstStep = await prisma.procedureStep.findFirst({
    where: { procedureId: usage.procedureId, deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true }
  });
  const initialStepId = usage.procedure.initialStepId ?? firstStep?.id;
  if (!initialStepId) throw new Error('PROCEDURE_WITHOUT_STEPS');

  await prisma.$transaction([
    prisma.procedureUsageStep.deleteMany({ where: { usageId } }),
    prisma.procedureUsage.update({
      where: { id: usageId },
      data: { status: 'IN_PROGRESS', currentStepId: initialStepId, completedAt: null, resolvedAt: null, resolutionNote: null }
    })
  ]);

  await recordUsageStep(userId, usageId, initialStepId);
  return getProcedureUsage(userId, usageId);
}

export async function finishProcedureUsage(
  userId: string,
  usageId: string,
  status: UsageStatus,
  resolutionNote?: string | null,
  rating?: number | null,
  feedbackComment?: string | null
) {
  if (!['RESOLVED', 'NOT_RESOLVED', 'ESCALATED'].includes(status)) {
    throw new Error('INVALID_STATUS');
  }

  const settings = await getSettings();
  const cleanNote = resolutionNote?.trim() || null;

  if (status === 'NOT_RESOLVED' && settings.requireNoteOnNotResolved && !cleanNote) {
    throw new Error('RESOLUTION_NOTE_REQUIRED');
  }

  if (status === 'ESCALATED' && settings.requireNoteOnEscalation && !cleanNote) {
    throw new Error('RESOLUTION_NOTE_REQUIRED');
  }

  const usage = await prisma.procedureUsage.findFirst({
    where: { id: usageId, attendantId: userId },
    select: { id: true, procedureId: true }
  });

  if (!usage) throw new Error('USAGE_NOT_FOUND');

  await prisma.$transaction([
    prisma.procedureUsage.update({
      where: { id: usageId },
      data: {
        status,
        completedAt: new Date(),
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
        resolutionNote: cleanNote
      }
    }),
    ...(settings.allowFeedback
      ? [
          prisma.procedureFeedback.upsert({
            where: { usageId },
            update: {
              wasResolved: status === 'RESOLVED',
              rating: rating ?? null,
              comment: feedbackComment?.trim() || null
            },
            create: {
              usageId,
              procedureId: usage.procedureId,
              userId,
              wasResolved: status === 'RESOLVED',
              rating: rating ?? null,
              comment: feedbackComment?.trim() || null
            }
          })
        ]
      : [])
  ]);

  return getProcedureUsage(userId, usageId);
}

export async function abandonProcedureUsage(userId: string, usageId: string, resolutionNote?: string | null) {
  const usage = await prisma.procedureUsage.findFirst({
    where: { id: usageId, attendantId: userId },
    select: { id: true }
  });

  if (!usage) throw new Error('USAGE_NOT_FOUND');

  await prisma.procedureUsage.update({
    where: { id: usageId },
    data: {
      status: 'ABANDONED',
      completedAt: new Date(),
      resolutionNote: resolutionNote?.trim() || null
    }
  });

  return getProcedureUsage(userId, usageId);
}

export async function registerCopiedMessage(userId: string, usageId: string, messageId: string) {
  const usage = await prisma.procedureUsage.findFirst({
    where: { id: usageId, attendantId: userId },
    select: { id: true, procedureId: true }
  });

  if (!usage) throw new Error('USAGE_NOT_FOUND');

  const message = await prisma.copyableMessage.findFirst({
    where: { id: messageId, procedureId: usage.procedureId, deletedAt: null },
    select: { id: true, procedureId: true, stepId: true }
  });

  if (!message) throw new Error('MESSAGE_NOT_FOUND');

  await prisma.$transaction([
    prisma.copyableMessage.update({
      where: { id: messageId },
      data: { copyCount: { increment: 1 } }
    }),
    prisma.copiedMessageLog.create({
      data: {
        messageId,
        usageId,
        userId,
        procedureId: message.procedureId,
        stepId: message.stepId
      }
    })
  ]);

  return { messageId, procedureId: message.procedureId, stepId: message.stepId, copied: true };
}

export async function getMostCopiedMessages() {
  const messages = await prisma.copyableMessage.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      procedure: publishedWhere,
      copyCount: { gt: 0 }
    },
    include: {
      procedure: { select: { id: true, title: true } },
      step: { select: { id: true, title: true } }
    },
    orderBy: [{ copyCount: 'desc' }, { updatedAt: 'desc' }],
    take: 10
  });

  return messages.map((message) => ({
    id: message.id,
    title: message.title,
    copyCount: message.copyCount,
    procedure: message.procedure,
    step: message.step
  }));
}
