import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

type ToastTone = 'success' | 'error' | 'info';

const tones: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-brand-100 bg-brand-50 text-brand-700'
};

export function Toast({ message, tone = 'info' }: { message: string; tone?: ToastTone }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : Info;

  return (
    <div className={cn('flex items-center gap-2 rounded border px-3 py-2 text-sm', tones[tone])} role="status">
      <Icon size={18} aria-hidden="true" />
      {message}
    </div>
  );
}
