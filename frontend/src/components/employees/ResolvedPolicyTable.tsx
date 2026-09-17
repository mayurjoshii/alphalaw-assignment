/**
 * The side table in the employee panel: one row per policy category, showing
 * the value the rule engine resolved for this employee and -- on hover -- the
 * conditions that produced it.
 */

import { AnimatePresence, motion } from 'motion/react';
import { Badge, Tooltip } from '@/components/ui/primitives';
import { CountUp } from '@/components/ui/CountUp';
import type { ResolvedCategory } from '@/lib/resolve';
import { calculateTenureYears } from '@/lib/resolve';

export function ResolvedPolicyTable({
  resolved,
  joiningDate,
  stale,
}: {
  resolved: ResolvedCategory[];
  joiningDate: string | null;
  /** True while the form holds edits that haven't been committed on blur yet. */
  stale?: boolean;
}) {
  const headline = resolved.find((row) => row.strategy === 'accumulate' && row.total !== null);
  const tenure = joiningDate ? calculateTenureYears(joiningDate) : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="stamp">Resolved entitlements</h3>
        <AnimatePresence>
          {stale && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-brass font-mono text-[9px] tracking-[0.1em] uppercase"
            >
              recomputing on blur
            </motion.span>
          )}
        </AnimatePresence>
      </header>

      {/* Headline figure: the one number an HR user is actually here for. */}
      {headline && (
        <div className="border-rule bg-paper-high relative overflow-hidden rounded-[3px] border px-5 py-4">
          <div
            aria-hidden
            className="from-verdigris/8 pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent"
          />
          <p className="stamp relative">{headline.category.display_name}</p>
          <p className="font-display relative mt-1 flex items-baseline gap-2">
            <CountUp
              value={headline.total ?? 0}
              className="text-verdigris text-[42px] leading-none font-semibold tracking-[-0.03em]"
            />
            <span className="text-ink-faint font-mono text-[11px] tracking-[0.1em] uppercase">
              days / year
            </span>
          </p>
          <p className="text-ink-faint relative mt-2 font-mono text-[10px]">
            {headline.lines.length} rule{headline.lines.length === 1 ? '' : 's'} stacked
            {tenure !== null && ` · ${tenure.toFixed(1)} yrs tenure`}
          </p>
        </div>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-rule border-b">
            <th className="stamp py-2 text-left font-medium">Category</th>
            <th className="stamp py-2 text-right font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {resolved.map((row) => (
            <tr key={row.category.id} className="border-rule-soft group border-b last:border-0">
              <td className="py-2.5 pr-3 align-top">
                <div className="text-[13px] leading-snug">{row.category.display_name}</div>
                <div className="text-ink-faint mt-0.5 font-mono text-[9px] tracking-[0.1em] uppercase">
                  {row.strategy === 'accumulate' ? 'stacks' : 'one applies'}
                </div>
              </td>
              <td className="py-2.5 text-right align-top">
                <motion.span
                  key={row.display}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className={`block font-mono text-[13px] ${
                    row.display === '—' ? 'text-ink-faint' : 'text-ink font-medium'
                  }`}
                >
                  {row.display}
                </motion.span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* The trace: every rule that fired, and why. */}
      <section className="flex flex-col gap-2">
        <h4 className="stamp">Why</h4>
        {resolved.flatMap((row) => row.lines).length === 0 ? (
          <p className="text-ink-faint font-mono text-[11px] leading-relaxed">
            No rule matched yet. Fill in location and joining date to see entitlements
            resolve.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {resolved.flatMap((row) =>
              row.lines.map((line) => (
                <motion.li
                  key={line.rule.id}
                  layout
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  className="border-rule-soft bg-paper-high flex items-center gap-2 rounded-[3px] border px-2.5 py-1.5"
                >
                  <Badge tone={line.scope === 'GLOBAL' ? 'neutral' : 'brass'}>
                    {line.scope === 'GLOBAL' ? 'all' : 'cond'}
                  </Badge>
                  <Tooltip label={line.because}>
                    <span className="text-ink-soft cursor-help font-mono text-[10.5px] underline decoration-dotted underline-offset-2">
                      {line.label}
                    </span>
                  </Tooltip>
                  {line.amount !== null && (
                    <span className="text-verdigris ml-auto font-mono text-[11px] font-medium">
                      +{line.amount}
                    </span>
                  )}
                </motion.li>
              ))
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
