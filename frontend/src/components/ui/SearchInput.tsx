import type { InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../lib/cn';

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} aria-hidden="true" />
      <input
        aria-label={props['aria-label'] ?? props.placeholder ?? 'Pesquisar'}
        className={cn(
          'w-full rounded border border-slate-300 bg-white py-4 pl-12 pr-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100',
          className
        )}
        type="search"
        {...props}
      />
    </div>
  );
}
