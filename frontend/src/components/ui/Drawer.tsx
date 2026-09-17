/**
 * Right-hand drawer -- the shell for the employee panel. Wide enough to hold
 * the edit form and the resolved-policy table side by side, which is the
 * whole point: you change a value on the left and watch the right recompute.
 */

import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { useEffect, type ReactNode } from 'react';

export function Drawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Stop the directory behind the drawer from scrolling with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  /*
    Portalled to <body> on purpose. `position: fixed` resolves against the
    nearest ancestor carrying a transform/filter/animation rather than the
    viewport, and the page sections animate in on load -- an in-place drawer
    inherits that element as its containing block and ends up sized to the
    page section, clipping its panes.
  */
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-[rgb(23_19_15/0.32)] backdrop-blur-[2px]"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 38, mass: 0.9 }}
            className="bg-paper-raised border-rule relative flex h-full w-full max-w-[min(1180px,94vw)] flex-col border-l"
          >
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function DrawerHeader({
  eyebrow,
  title,
  actions,
  onClose,
}: {
  eyebrow: string;
  title: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
}) {
  return (
    <header className="border-rule bg-paper-high/60 flex shrink-0 items-start justify-between gap-6 border-b px-7 py-5">
      <div className="min-w-0">
        <p className="stamp">{eyebrow}</p>
        <h2 className="font-display mt-1 truncate text-[26px] leading-tight font-semibold tracking-[-0.02em]">
          {title}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="focus-ring text-ink-faint hover:border-ink-faint hover:text-ink border-rule size-8 rounded-[3px] border transition-colors"
        >
          ✕
        </button>
      </div>
    </header>
  );
}
