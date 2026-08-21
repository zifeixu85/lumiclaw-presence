import type {ReactNode} from 'react';

export function StatusBadge({tone = 'neutral', children}: {tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'info'; children: ReactNode}) {
  const styles = {neutral: 'bg-[var(--lc-surface-muted)] text-[var(--lc-ink-muted)]', positive: 'bg-[var(--lc-positive-soft)] text-[var(--lc-positive)]', warning: 'bg-[var(--lc-warning-soft)] text-[var(--lc-warning)]', danger: 'bg-[var(--lc-danger-soft)] text-[var(--lc-danger)]', info: 'bg-[var(--lc-info-soft)] text-[var(--lc-info)]'};
  return <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 font-[var(--lc-font-mono)] text-[10px] font-bold tracking-[0.04em] ${styles[tone]}`}>{children}</span>;
}
