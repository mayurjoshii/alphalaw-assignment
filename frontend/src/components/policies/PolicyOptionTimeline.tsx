/**
 * Full rule history for one option -- every rule ever written against it,
 * active and superseded, newest first. Opened from the Policy studio so an
 * HR user can see how one line of policy has evolved, not just what applies
 * today.
 */

import { motion } from 'motion/react';
import { Drawer, DrawerHeader } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/primitives';
import { describeCondition, optionLabel } from '@/lib/resolve';
import { usePolicyOptionTimeline } from '@/lib/queries';
import type { Attribute } from '@/types/domain';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, DATE_FORMAT);
}

export function PolicyOptionTimeline({
  open,
  optionId,
  attributes,
  onClose,
}: {
  open: boolean;
  optionId: string | null;
  attributes: Attribute[];
  onClose: () => void;
}) {
  const timeline = usePolicyOptionTimeline(open ? optionId : null);
  const data = timeline.data;

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerHeader
        eyebrow="Option history"
        title={data ? optionLabel(data.policyOption) : <span className="text-ink-faint">…</span>}
        onClose={onClose}
        actions={data && <Badge>{data.policyOption.category_type.replace(/_/g, ' ')}</Badge>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        {timeline.isLoading ? (
          <p className="text-ink-faint px-1 py-10 text-center font-mono text-[12px]">
            Loading history…
          </p>
        ) : !data || data.rules.length === 0 ? (
          <p className="text-ink-faint px-1 py-10 text-center font-mono text-[12px]">
            No rule has ever been written against this option.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-5 pl-5">
            {/* The rail every entry hangs its dot on. */}
            <div className="bg-rule absolute top-1.5 bottom-1.5 left-[3px] w-px" aria-hidden />

            {data.rules.map((rule, index) => (
              <motion.li
                key={rule.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.35 }}
                className="relative"
              >
                <span
                  aria-hidden
                  className={`absolute top-1.5 -left-5 size-[7px] -translate-x-1/2 rounded-full ${
                    rule.status === 'active' ? 'bg-verdigris' : 'bg-ink-faint'
                  }`}
                />

                <div className="border-rule-soft bg-paper-high rounded-[3px] border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-medium tracking-[0.02em]">
                      {formatDate(rule.valid_from)}
                      {rule.valid_to ? ` — ${formatDate(rule.valid_to)}` : ' — present'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Badge tone={rule.status === 'active' ? 'verdigris' : 'neutral'}>
                        {rule.status}
                      </Badge>
                      <Badge tone={rule.scope === 'GLOBAL' ? 'neutral' : 'brass'}>
                        {rule.scope === 'GLOBAL' ? 'everyone' : 'conditional'}
                      </Badge>
                    </span>
                  </div>

                  <p className="text-ink mt-1.5 font-mono text-[12px] font-medium">
                    {optionLabel(rule.outcome)}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {rule.scope === 'GLOBAL' ? (
                      <span className="text-ink-faint font-mono text-[10.5px]">
                        Applies to everyone, no conditions.
                      </span>
                    ) : rule.conditions.length === 0 ? (
                      <Badge tone="oxblood">no conditions</Badge>
                    ) : (
                      rule.conditions.map((condition, conditionIndex) => (
                        <span key={condition.id} className="flex items-center gap-1.5">
                          {conditionIndex > 0 && (
                            <span className="text-ink-faint font-mono text-[9px]">
                              {rule.conditions[conditionIndex - 1].combinator}
                            </span>
                          )}
                          <code className="border-rule bg-paper text-ink-soft rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px]">
                            {describeCondition(condition, attributes)}
                          </code>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
}
