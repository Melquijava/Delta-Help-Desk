export type UserStatus = 'ACTIVE' | 'INACTIVE';

export type ProcedureStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type ProcedureDifficulty = 'EASY' | 'MEDIUM' | 'ADVANCED';

export type StepType =
  | 'INFORMATION'
  | 'QUESTION'
  | 'ACTION'
  | 'COPYABLE_MESSAGE'
  | 'ALERT'
  | 'CHECK'
  | 'FINAL_SOLUTION'
  | 'TECHNICAL_ESCALATION';

export type UsageStatus = 'IN_PROGRESS' | 'RESOLVED' | 'NOT_RESOLVED' | 'ESCALATED' | 'ABANDONED';

export type AuditAction =
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
