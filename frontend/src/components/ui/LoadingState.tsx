import { Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 rounded border border-slate-200 bg-white text-sm text-slate-600" role="status">
      <Loader2 className="animate-spin text-brand-600" size={18} aria-hidden="true" />
      {label}
    </div>
  );
}
