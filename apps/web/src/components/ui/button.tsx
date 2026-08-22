import {forwardRef, type ButtonHTMLAttributes} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {variant?: ButtonVariant; size?: 'sm' | 'md'};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({className = '', variant = 'secondary', size = 'md', type = 'button', ...props}, ref) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'border-[var(--lc-accent)] bg-[var(--lc-accent)] text-[var(--lc-sidebar)] hover:bg-[#f86b49]',
    secondary: 'border-[var(--lc-line)] bg-[var(--lc-surface)] text-[var(--lc-ink)] hover:border-[#aaa69c] hover:bg-white',
    ghost: 'border-transparent bg-transparent text-[var(--lc-ink-muted)] hover:bg-[var(--lc-surface-muted)] hover:text-[var(--lc-ink)]',
    danger: 'border-[var(--lc-danger)] bg-[var(--lc-danger-soft)] text-[var(--lc-danger)] hover:bg-[#efd4d0]'
  };
  return <button ref={ref} type={type} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-[var(--lc-radius-sm)] border px-3.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${size === 'sm' ? 'min-h-8 px-2.5 text-xs' : 'text-[13px]'} ${variants[variant]} ${className}`} {...props} />;
});
