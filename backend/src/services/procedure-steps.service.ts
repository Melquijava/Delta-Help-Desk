import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { StepType, UserStatus } from '../types/domain.js';

const stepInclude = {
  nextStep: {
    select: { id: true, title: true, position: true, type: true, isFinal: true }
  },
  options: {
    where: { deletedAt: null },
    include: {
      nextStep: {
        select: { id: true, title: true, position: true, type: true, isFinal: true }
      }
    },
    orderBy: { order: 'asc' }
  },
  messages: {
    where: { deletedAt: null },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
  }
} satisfies Prisma.ProcedureStepInclude;

export type StepInput = {
  title: string;
  instruction?: string | null;
  explanation?: string | null;
  position?: number;
  type: StepType;
  highlighted: boolean;
  helperMessage?: string | null;
  nextStepId?: string | null;
  isFinal: boolean;
};

export type OptionInput = {
  label: string;
  value?: string | null;
  description?: string | null;
  order?: number;
  nextStepId?: string | null;
};

export type MessageInput = {
  title: string;
  content: string;
  order?: number;
  status?: UserStatus;
};

export class StepModuleError extends Error {
  constructor(
    public readonly code:
      | 'PROCEDURE_NOT_FOUND'
      | 'STEP_NOT_FOUND'
      | 'OPTION_NOT_FOUND'
      | 'MESSAGE_NOT_FOUND'
      | 'INVALID_TARGET'
  ) {
    super(code);
  }
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeStep(step: Prisma.ProcedureStepGetPayload<{ include: typeof stepInclude }>) {
  return {
    id: step.id,
    procedureId: step.procedureId,
    title: step.title,
    instruction: step.content,
    explanation: step.explanation,
    helperMessage: step.helperMessage,
    highlighted: step.highlighted,
    type: step.type,
    position: step.position,
    nextStepId: step.nextStepId,
    nextStep: step.nextStep,
    isFinal: step.isFinal,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
    options: step.options,
    messages: step.messages
  };
}

async function assertProcedureExists(procedureId: string) {
  const procedure = await prisma.procedure.findFirst({
    where: { id: procedureId, deletedAt: null }
  });

  if (!procedure) {
    throw new StepModuleError('PROCEDURE_NOT_FOUND');
  }

  return procedure;
}

async function assertStepBelongsToProcedure(procedureId: string, stepId: string) {
  const step = await prisma.procedureStep.findFirst({
    where: { id: stepId, procedureId, deletedAt: null },
    include: stepInclude
  });

  if (!step) {
    throw new StepModuleError('STEP_NOT_FOUND');
  }

  return step;
}

async function assertTargetStep(procedureId: string, stepId?: string | null) {
  if (!stepId) {
    return null;
  }

  const target = await prisma.procedureStep.findFirst({
    where: { id: stepId, procedureId, deletedAt: null }
  });

  if (!target) {
    throw new StepModuleError('INVALID_TARGET');
  }

  return target;
}

async function nextPosition(procedureId: string) {
  const latest = await prisma.procedureStep.findFirst({
    where: { procedureId, deletedAt: null },
    orderBy: { position: 'desc' }
  });

  return (latest?.position ?? 0) + 1;
}

export async function listSteps(procedureId: string) {
  await assertProcedureExists(procedureId);

  const steps = await prisma.procedureStep.findMany({
    where: { procedureId, deletedAt: null },
    include: stepInclude,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
  });

  return steps.map(sanitizeStep);
}

export async function createStep(procedureId: string, input: StepInput) {
  await assertProcedureExists(procedureId);
  await assertTargetStep(procedureId, input.nextStepId);

  const step = await prisma.procedureStep.create({
    data: {
      procedureId,
      title: input.title,
      content: normalizeOptional(input.instruction),
      explanation: normalizeOptional(input.explanation),
      helperMessage: normalizeOptional(input.helperMessage),
      highlighted: input.highlighted,
      type: input.type,
      position: input.position ?? (await nextPosition(procedureId)),
      nextStepId: input.nextStepId || null,
      isFinal: input.isFinal
    },
    include: stepInclude
  });

  return sanitizeStep(step);
}

export async function updateStep(procedureId: string, stepId: string, input: StepInput) {
  await assertStepBelongsToProcedure(procedureId, stepId);
  await assertTargetStep(procedureId, input.nextStepId);

  const step = await prisma.procedureStep.update({
    where: { id: stepId },
    data: {
      title: input.title,
      content: normalizeOptional(input.instruction),
      explanation: normalizeOptional(input.explanation),
      helperMessage: normalizeOptional(input.helperMessage),
      highlighted: input.highlighted,
      type: input.type,
      position: input.position,
      nextStepId: input.nextStepId || null,
      isFinal: input.isFinal
    },
    include: stepInclude
  });

  return sanitizeStep(step);
}

export async function deleteStep(procedureId: string, stepId: string) {
  await assertStepBelongsToProcedure(procedureId, stepId);

  await prisma.$transaction([
    prisma.procedure.updateMany({
      where: { id: procedureId, initialStepId: stepId },
      data: { initialStepId: null }
    }),
    prisma.procedureStep.updateMany({
      where: { procedureId, nextStepId: stepId },
      data: { nextStepId: null }
    }),
    prisma.stepOption.updateMany({
      where: { nextStepId: stepId },
      data: { nextStepId: null }
    }),
    prisma.procedureStep.update({
      where: { id: stepId },
      data: { deletedAt: new Date() }
    })
  ]);
}

export async function duplicateStep(procedureId: string, stepId: string) {
  const source = await assertStepBelongsToProcedure(procedureId, stepId);

  const step = await prisma.procedureStep.create({
    data: {
      procedureId,
      title: `${source.title} (copia)`,
      content: source.content,
      explanation: source.explanation,
      helperMessage: source.helperMessage,
      highlighted: source.highlighted,
      type: source.type,
      position: await nextPosition(procedureId),
      isFinal: source.isFinal,
      messages: {
        create: source.messages.map((message) => ({
          procedureId,
          title: message.title,
          content: message.content,
          order: message.order,
          status: message.status
        }))
      },
      options: {
        create: source.options.map((option) => ({
          label: option.label,
          value: option.value,
          description: option.description,
          order: option.order
        }))
      }
    },
    include: stepInclude
  });

  return sanitizeStep(step);
}

export async function moveStep(procedureId: string, stepId: string, direction: 'up' | 'down') {
  const step = await assertStepBelongsToProcedure(procedureId, stepId);
  const neighbor = await prisma.procedureStep.findFirst({
    where: {
      procedureId,
      deletedAt: null,
      position: direction === 'up' ? { lt: step.position } : { gt: step.position }
    },
    orderBy: { position: direction === 'up' ? 'desc' : 'asc' }
  });

  if (!neighbor) {
    return sanitizeStep(step);
  }

  await prisma.$transaction([
    prisma.procedureStep.update({ where: { id: step.id }, data: { position: neighbor.position } }),
    prisma.procedureStep.update({ where: { id: neighbor.id }, data: { position: step.position } })
  ]);

  return assertStepBelongsToProcedure(procedureId, stepId).then(sanitizeStep);
}

export async function setInitialStep(procedureId: string, stepId: string | null) {
  await assertProcedureExists(procedureId);
  await assertTargetStep(procedureId, stepId);

  return prisma.procedure.update({
    where: { id: procedureId },
    data: { initialStepId: stepId },
    select: { id: true, initialStepId: true }
  });
}

export async function createOption(procedureId: string, stepId: string, input: OptionInput) {
  await assertStepBelongsToProcedure(procedureId, stepId);
  await assertTargetStep(procedureId, input.nextStepId);

  return prisma.stepOption.create({
    data: {
      stepId,
      label: input.label,
      value: normalizeOptional(input.value) ?? input.label.toLowerCase().replace(/\s+/g, '-'),
      description: normalizeOptional(input.description),
      order: input.order ?? 0,
      nextStepId: input.nextStepId || null
    }
  });
}

export async function updateOption(procedureId: string, stepId: string, optionId: string, input: OptionInput) {
  await assertStepBelongsToProcedure(procedureId, stepId);
  await assertTargetStep(procedureId, input.nextStepId);

  try {
    return await prisma.stepOption.update({
      where: { id: optionId, stepId },
      data: {
        label: input.label,
        value: normalizeOptional(input.value) ?? input.label.toLowerCase().replace(/\s+/g, '-'),
        description: normalizeOptional(input.description),
        order: input.order,
        nextStepId: input.nextStepId || null
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new StepModuleError('OPTION_NOT_FOUND');
    }
    throw error;
  }
}

export async function deleteOption(procedureId: string, stepId: string, optionId: string) {
  await assertStepBelongsToProcedure(procedureId, stepId);
  await prisma.stepOption.update({
    where: { id: optionId, stepId },
    data: { deletedAt: new Date() }
  });
}

export async function createMessage(procedureId: string, stepId: string, input: MessageInput) {
  await assertStepBelongsToProcedure(procedureId, stepId);
  const latest = await prisma.copyableMessage.findFirst({
    where: { stepId, deletedAt: null },
    orderBy: { order: 'desc' }
  });

  return prisma.copyableMessage.create({
    data: {
      procedureId,
      stepId,
      title: input.title,
      content: input.content,
      order: input.order ?? (latest?.order ?? 0) + 1,
      status: input.status ?? 'ACTIVE'
    }
  });
}

export async function updateMessage(procedureId: string, stepId: string, messageId: string, input: MessageInput) {
  await assertStepBelongsToProcedure(procedureId, stepId);

  try {
    return await prisma.copyableMessage.update({
      where: { id: messageId, stepId },
      data: {
        title: input.title,
        content: input.content,
        order: input.order,
        status: input.status
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new StepModuleError('MESSAGE_NOT_FOUND');
    }
    throw error;
  }
}

export async function deleteMessage(procedureId: string, stepId: string, messageId: string) {
  await assertStepBelongsToProcedure(procedureId, stepId);
  await prisma.copyableMessage.update({
    where: { id: messageId, stepId },
    data: { deletedAt: new Date() }
  });
}

export async function duplicateMessage(procedureId: string, stepId: string, messageId: string) {
  await assertStepBelongsToProcedure(procedureId, stepId);
  const source = await prisma.copyableMessage.findFirst({
    where: { id: messageId, stepId, deletedAt: null }
  });

  if (!source) {
    throw new StepModuleError('MESSAGE_NOT_FOUND');
  }

  const latest = await prisma.copyableMessage.findFirst({
    where: { stepId, deletedAt: null },
    orderBy: { order: 'desc' }
  });

  return prisma.copyableMessage.create({
    data: {
      procedureId,
      stepId,
      title: `${source.title} (copia)`,
      content: source.content,
      order: (latest?.order ?? 0) + 1,
      status: source.status
    }
  });
}

function isFinalStep(step: { isFinal: boolean; type: string }) {
  return step.isFinal || step.type === 'FINAL_SOLUTION' || step.type === 'TECHNICAL_ESCALATION';
}

export type FlowValidationStep = {
  id: string;
  title: string;
  type: string;
  isFinal: boolean;
  nextStepId: string | null;
  options: Array<{ nextStepId: string | null }>;
};

export type FlowValidationIssue = {
  type: string;
  message: string;
  stepId?: string;
};

export function validateStepGraph(steps: FlowValidationStep[], configuredInitialStepId: string | null) {
  const issues: Array<{ type: string; message: string; stepId?: string }> = [];

  if (steps.length === 0) {
    issues.push({ type: 'NO_STEPS', message: 'O procedimento nao possui etapas.' });
  }

  const initialStepId = configuredInitialStepId;

  if (!initialStepId) {
    issues.push({ type: 'NO_INITIAL_STEP', message: 'Defina uma etapa inicial.' });
  }

  if (!steps.some(isFinalStep)) {
    issues.push({ type: 'NO_FINAL_STEP', message: 'Crie pelo menos uma etapa final.' });
  }

  const byId = new Map(steps.map((step) => [step.id, step]));

  for (const step of steps) {
    const targets = [
      ...(step.nextStepId ? [step.nextStepId] : []),
      ...step.options.map((option) => option.nextStepId).filter(Boolean)
    ];

    for (const option of step.options) {
      if (!isFinalStep(step) && !option.nextStepId) {
        issues.push({
          type: 'OPTION_WITHOUT_DESTINATION',
          stepId: step.id,
          message: `A etapa "${step.title}" possui alternativa sem proxima etapa.`
        });
      }
    }

    if (!isFinalStep(step) && targets.length === 0) {
      issues.push({
        type: 'STEP_WITHOUT_DESTINATION',
        stepId: step.id,
        message: `A etapa "${step.title}" nao possui destino nem conclusao.`
      });
    }

    for (const target of targets) {
      if (target && !byId.has(target)) {
        issues.push({
          type: 'BROKEN_TARGET',
          stepId: step.id,
          message: `A etapa "${step.title}" aponta para uma etapa indisponivel.`
        });
      }
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const reachesConclusion = new Map<string, boolean>();

  function walk(stepId: string): boolean {
    const step = byId.get(stepId);
    if (!step) return false;
    if (isFinalStep(step)) return true;
    if (visiting.has(stepId)) {
      issues.push({ type: 'LOOP_DETECTED', stepId, message: `Loop detectado a partir de "${step.title}".` });
      return false;
    }
    if (visited.has(stepId)) return reachesConclusion.get(stepId) ?? false;

    visiting.add(stepId);
    const targets = [
      ...(step.nextStepId ? [step.nextStepId] : []),
      ...step.options.map((option) => option.nextStepId).filter(Boolean)
    ] as string[];
    const ok = targets.length > 0 && targets.every(walk);
    visiting.delete(stepId);
    visited.add(stepId);
    reachesConclusion.set(stepId, ok);

    if (!ok) {
      issues.push({
        type: 'PATH_WITHOUT_CONCLUSION',
        stepId,
        message: `Existe caminho sem conclusao passando por "${step.title}".`
      });
    }

    return ok;
  }

  if (initialStepId) {
    if (byId.has(initialStepId)) {
      walk(initialStepId);
    } else {
      issues.push({
        type: 'BROKEN_INITIAL_STEP',
        message: 'A etapa inicial configurada nao esta disponivel.'
      });
    }
  }

  const reachable = new Set<string>();
  function mark(stepId: string) {
    if (reachable.has(stepId)) return;
    const step = byId.get(stepId);
    if (!step) return;
    reachable.add(stepId);
    if (step.nextStepId) mark(step.nextStepId);
    for (const option of step.options) {
      if (option.nextStepId) mark(option.nextStepId);
    }
  }
  if (initialStepId) mark(initialStepId);

  for (const step of steps) {
    if (!reachable.has(step.id)) {
      issues.push({
        type: 'UNREACHABLE_STEP',
        stepId: step.id,
        message: `A etapa "${step.title}" nao e alcancada pela etapa inicial.`
      });
    }
  }

  return {
    isValid: issues.length === 0,
    initialStepId,
    issues
  };
}

export async function validateProcedureFlow(procedureId: string) {
  const procedure = await assertProcedureExists(procedureId);
  const steps = await listSteps(procedureId);
  const validation = validateStepGraph(steps, procedure.initialStepId ?? null);

  return {
    ...validation,
    steps
  };
}
