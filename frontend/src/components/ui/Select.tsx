import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: Array<{ label: string; value: string }>;
};

export function Select({ className, label, error, id, options, ...props }: SelectProps) {
  const selectId = id ?? props.name;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <label className="block" htmlFor={selectId}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={cn(
          'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 sm:py-2 sm:text-sm',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-100',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span id={errorId} className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}
