'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {useEffect, useRef, type ReactNode} from 'react';

export function Drawer({open, onOpenChange, title, description, children, footer}: {open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode; footer?: ReactNode}) {
  const restoreFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) return;
    const remember = () => { if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) restoreFocus.current = document.activeElement; };
    const rememberPointer = (event: PointerEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const trigger = event.target.closest<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
      if (trigger !== null) restoreFocus.current = trigger;
    };
    remember(); document.addEventListener('focusin', remember); document.addEventListener('pointerdown', rememberPointer, true);
    return () => { document.removeEventListener('focusin', remember); document.removeEventListener('pointerdown', rememberPointer, true); };
  }, [open]);
  const changeOpen = (next: boolean) => { const target = restoreFocus.current; onOpenChange(next); if (!next) setTimeout(() => target?.focus(), 0); };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={changeOpen} modal>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/35" />
        <DialogPrimitive.Content onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus.current?.focus(); }} className="lc-scrollbar fixed inset-y-0 right-0 z-50 flex w-[min(720px,76vw)] flex-col overflow-y-auto border-l border-[var(--lc-line)] bg-[var(--lc-surface)] shadow-[var(--lc-shadow-float)] focus:outline-none">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-6 border-b border-[var(--lc-line)] bg-[var(--lc-surface)] px-7 py-5">
            <div><DialogPrimitive.Title className="font-[var(--lc-font-serif)] text-2xl font-semibold tracking-[-0.02em]">{title}</DialogPrimitive.Title><DialogPrimitive.Description className="mt-1 max-w-xl text-[13px] text-[var(--lc-ink-muted)]">{description}</DialogPrimitive.Description></div>
            <DialogPrimitive.Close className="grid size-9 shrink-0 place-items-center rounded-md border border-[var(--lc-line)] bg-white text-[var(--lc-ink-muted)] hover:text-[var(--lc-ink)]" aria-label="Close"><X aria-hidden size={17} /></DialogPrimitive.Close>
          </div>
          <div className="flex-1 px-7 py-6">{children}</div>
          {footer === undefined ? null : <div className="sticky bottom-0 border-t border-[var(--lc-line)] bg-[var(--lc-surface)] px-7 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
