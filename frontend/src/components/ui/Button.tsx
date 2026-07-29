import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-200',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-brand-100',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:ring-brand-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-200'
};

export function Button({ className, variant = 'primary', icon, children, ...props }: ButtonProps) {
  const iconOnly = Boolean(icon) && !children;
  const accessibleLabel = props['aria-label'] ?? (iconOnly && typeof props.title === 'string' ? props.title : undefined);

  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10',
        'touch-manipulation select-none',
        iconOnly && 'h-12 w-12 min-w-12 px-0 py-0 [&>svg]:h-5 [&>svg]:w-5 sm:h-11 sm:w-11 sm:min-w-11',
        variants[variant],
        className
      )}
      type="button"
      aria-label={accessibleLabel}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
