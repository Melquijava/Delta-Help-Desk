import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type BadgeTone = 'blue' | 'green' | 'amber' | 'slate';

const tones: Record<BadgeTone, string> = {
  blue: 'bg-brand-50 text-brand-700 ring-brand-100',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200'
};

export function Badge({
  children,
  tone = 'slate',
  className
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-1 text-xs font-semibold ring-1', tones[tone], className)}>
      {children}
    </span>
  );
}
