/**
 * Collapsible section. Used in the Policy Studio so a category with several
 * options and rule builders can be folded away instead of scrolling forever.
 */

import { AnimatePresence, motion } from 'motion/react';
import { useState, type ReactNode } from 'react';

export function Accordion({
  summary,
  meta,
  defaultOpen = false,
  children,
}: {
  summary: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-rule bg-paper-high/70 overflow-hidden rounded-[3px] border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="focus-ring hover:bg-paper-high flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="text-ink-faint text-[10px]"
          aria-hidden
        >
          ▶
        </motion.span>
        <span className="min-w-0 flex-1">{summary}</span>
        {meta}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 40, opacity: { duration: 0.15 } }}
          >
            <div className="border-rule-soft border-t px-4 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
