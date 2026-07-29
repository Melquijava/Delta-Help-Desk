import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export function Textarea({ className, label, error, id, ...props }: TextareaProps) {
  const textareaId = id ?? props.name;
  const errorId = error ? `${textareaId}-error` : undefined;

  return (
    <label className="block" htmlFor={textareaId}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <textarea
        id={textareaId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={cn(
          'mt-1 min-h-28 w-full resize-y rounded border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 sm:py-2 sm:text-sm',
          error && 'border-red-400 focus:border-red-500 focus:ring-red-100',
          className
        )}
        {...props}
      />
      {error && <span id={errorId} className="mt-1 block text-sm text-red-600">{error}</span>}
    </label>
  );
}
