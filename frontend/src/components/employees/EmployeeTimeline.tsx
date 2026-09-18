/**
 * One employee's attribute history -- every value they've ever held for
 * every attribute, newest first, each annotated with the rules that test
 * that attribute key. This is the audit trail for "why did this person's
 * policy change": read down the rail to see what changed and when.
 *
 * It surfaces *candidate* rules, not a resolved outcome at each point in
 * time -- point-in-time rule resolution (matching every condition together,
 * GLOBAL fallback, tenure bonuses) isn't ported to Django yet, see
 * decisions.md. `resolveEmployeePolicies` in lib/resolve.ts only resolves
 * the employee's *current* attributes.
 */

import { motion } from 'motion/react';
import { Drawer, DrawerHeader } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/primitives';
import { optionLabel } from '@/lib/resolve';
import { useEmployeeTimeline } from '@/lib/queries';

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, DATE_FORMAT);
}

export function EmployeeTimeline({
  open,
  employeeId,
  onClose,
}: {
  open: boolean;
  employeeId: string | null;
  onClose: () => void;
}) {
  const timeline = useEmployeeTimeline(open ? employeeId : null);
  const data = timeline.data;

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerHeader
        eyebrow="Attribute history"
        title={data ? data.employee.name : <span className="text-ink-faint">…</span>}
        onClose={onClose}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        {timeline.isLoading ? (
          <p className="text-ink-faint px-1 py-10 text-center font-mono text-[12px]">
            Loading history…
          </p>
        ) : !data || data.attributeTimeline.length === 0 ? (
          <p className="text-ink-faint px-1 py-10 text-center font-mono text-[12px]">
            No attribute has ever been recorded for this employee.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-5 pl-5">
            <div className="bg-rule absolute top-1.5 bottom-1.5 left-[3px] w-px" aria-hidden />

            {data.attributeTimeline.map((event, index) => (
              <motion.li
                key={event.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.4), duration: 0.35 }}
                className="relative"
              >
                <span
                  aria-hidden
                  className={`absolute top-1.5 -left-5 size-[7px] -translate-x-1/2 rounded-full ${
                    event.status === 'active' ? 'bg-verdigris' : 'bg-ink-faint'
                  }`}
                />

                <div className="border-rule-soft bg-paper-high rounded-[3px] border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13px]">{event.attribute.label}</span>
                      <code className="text-oxblood font-mono text-[11px] font-medium">
                        {event.value}
                      </code>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-ink-faint font-mono text-[10.5px]">
                        {formatDate(event.valid_from)}
                        {event.valid_to ? ` — ${formatDate(event.valid_to)}` : ' — present'}
                      </span>
                      <Badge tone={event.status === 'active' ? 'verdigris' : 'neutral'}>
                        {event.status}
                      </Badge>
                    </span>
                  </div>

                  {event.rules_referencing_attribute.length > 0 && (
                    <div className="mt-2.5 flex flex-col gap-1">
                      <span className="stamp">Rules testing this attribute</span>
                      <ul className="flex flex-col gap-1">
                        {event.rules_referencing_attribute.map((rule) => (
                          <li
                            key={rule.id}
                            className="flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]"
                          >
                            <Badge tone={rule.status === 'active' ? 'verdigris' : 'neutral'}>
                              {rule.status}
                            </Badge>
                            <Badge>{rule.category_type.replace(/_/g, ' ')}</Badge>
                            <span className="text-ink-soft">{optionLabel(rule.outcome)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
}
