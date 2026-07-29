import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AuditAction } from '../types/domain.js';
import { parseJson, stringifyJson } from '../utils/json.js';

type AuditInput = {
  actorId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  procedureId?: string;
  description?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export type AuditFilters = {
  q?: string;
  actorId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  procedureId?: string;
  startDate?: Date;
  endDate?: Date;
};

const sensitiveKeyPattern = /(password|senha|token|hash|secret|authorization|cookie)/i;

function maskEmail(value: string) {
  const [name, domain] = value.split('@');
  if (!domain) return value;
  return `${name.slice(0, 2)}***@${domain}`;
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (sensitiveKeyPattern.test(key)) {
    return '[REDACTED]';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    if (key.toLowerCase().includes('email')) return maskEmail(value);
    if (key.toLowerCase().includes('phone') || key.toLowerCase().includes('telefone')) return maskPhone(value);
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(childKey, childValue)
      ])
    );
  }

  return value;
}

export function sanitizeAuditData(value: unknown) {
  return sanitizeValue('', value);
}

function buildMetadata(input: AuditInput) {
  const metadata = {
    ...(input.metadata ?? {}),
    description: input.description,
    before: input.before === undefined ? undefined : sanitizeAuditData(input.before),
    after: input.after === undefined ? undefined : sanitizeAuditData(input.after)
  };

  const cleanMetadata = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined));
  return Object.keys(cleanMetadata).length > 0 ? stringifyJson(cleanMetadata) : undefined;
}

function hydrateAuditLogMetadata<T extends { metadata: string | null }>(log: T) {
  return {
    ...log,
    metadata: parseJson<Record<string, unknown> | null>(log.metadata, null)
  };
}

export async function audit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      procedureId: input.procedureId,
      metadata: buildMetadata(input),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });
}

export async function listAuditLogs(filters: AuditFilters, page: number, pageSize: number) {
  const where: Prisma.AuditLogWhereInput = {
    actorId: filters.actorId,
    action: filters.action,
    entityType: filters.entityType,
    entityId: filters.entityId,
    procedureId: filters.procedureId,
    createdAt:
      filters.startDate || filters.endDate
        ? {
            gte: filters.startDate,
            lte: filters.endDate
          }
        : undefined
  };

  if (filters.q) {
    where.OR = [
      { entityType: { contains: filters.q } },
      { entityId: { contains: filters.q } },
      { actor: { name: { contains: filters.q } } },
      { actor: { email: { contains: filters.q } } }
    ];
  }

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        procedure: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    data: logs.map((log) => ({
      ...hydrateAuditLogMetadata(log),
      actor: log.actor ? { ...log.actor, email: maskEmail(log.actor.email) } : null
    })),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

export async function getAuditLogById(id: string) {
  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      procedure: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  if (!log) {
    throw new Error('AUDIT_LOG_NOT_FOUND');
  }

  return {
    ...hydrateAuditLogMetadata(log),
    actor: log.actor ? { ...log.actor, email: maskEmail(log.actor.email) } : null
  };
}
