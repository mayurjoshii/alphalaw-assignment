/**
 * The rule set, grouped by category: which options exist, which rule grants
 * each one, and under what conditions. Read-mostly -- it is the reference an
 * HR user checks before deciding what an employee should get.
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Accordion } from '@/components/ui/Accordion';
import { Badge, Button } from '@/components/ui/primitives';
import { CategoryComposer } from './CategoryComposer';
import { describeCondition, optionLabel, strategyFor } from '@/lib/resolve';
import {
  useActiveRules,
  useAttributes,
  usePolicyCategories,
  usePolicyOptions,
} from '@/lib/queries';

export function PolicyStudio() {
  const categories = usePolicyCategories();
  const options = usePolicyOptions();
  const rules = useActiveRules();
  const attributes = useAttributes();

  const [composerOpen, setComposerOpen] = useState(false);

  const allCategories = categories.data ?? [];
  const allOptions = options.data ?? [];
  const allRules = rules.data ?? [];
  const allAttributes = attributes.data ?? [];

  return (
    <div className="animate-rise flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[32px] leading-none font-semibold tracking-[-0.03em]">
            Policy studio
          </h2>
          <p className="text-ink-soft mt-1.5 text-[13px]">
            {allCategories.length} categories · {allRules.length} active rules
          </p>
        </div>
        <Button onClick={() => setComposerOpen(true)}>+ New category</Button>
      </div>

      {categories.isLoading ? (
        <div className="sheet text-ink-faint px-6 py-14 text-center font-mono text-[12px]">
          Loading rule set…
        </div>
      ) : allCategories.length === 0 ? (
        <div className="sheet text-ink-faint px-6 py-14 text-center font-mono text-[12px]">
          No categories yet — create the first one.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {allCategories.map((category, index) => {
            const categoryOptions = allOptions.filter((o) => o.category === category.id);
            const strategy = strategyFor(categoryOptions);

            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(index * 0.04, 0.3),
                  duration: 0.45,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Accordion
                  defaultOpen={index === 0}
                  summary={
                    <span className="flex items-baseline gap-2.5">
                      <span className="text-[15px]">{category.display_name}</span>
                      <span className="text-ink-faint font-mono text-[10px] tracking-[0.1em] uppercase">
                        {category.type.replace(/_/g, ' ').toLowerCase()}
                      </span>
                    </span>
                  }
                  meta={
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge tone={strategy === 'accumulate' ? 'verdigris' : 'neutral'}>
                        {strategy === 'accumulate' ? 'stacks' : 'one applies'}
                      </Badge>
                      <Badge>{categoryOptions.length} opt</Badge>
                    </span>
                  }
                >
                  {categoryOptions.length === 0 ? (
                    <p className="text-ink-faint font-mono text-[11px]">
                      No options defined for this category.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {categoryOptions.map((option) => {
                        const rule = allRules.find((r) => r.outcome === option.id);
                        return (
                          <li
                            key={option.id}
                            className="border-rule-soft bg-paper-raised grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-4 rounded-[3px] border px-3 py-2.5"
                          >
                            <span className="text-[13px]">{optionLabel(option)}</span>

                            <span className="flex flex-wrap items-center gap-1.5">
                              {!rule ? (
                                <Badge tone="oxblood">no active rule</Badge>
                              ) : rule.scope === 'GLOBAL' ? (
                                <Badge tone="verdigris">everyone</Badge>
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
                                    <code className="border-rule bg-paper-high text-ink-soft rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px]">
                                      {describeCondition(condition, allAttributes)}
                                    </code>
                                  </span>
                                ))
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Accordion>
              </motion.div>
            );
          })}
        </div>
      )}

      <CategoryComposer
        open={composerOpen}
        attributes={allAttributes}
        takenTypes={allCategories.map((category) => category.type)}
        onClose={() => setComposerOpen(false)}
      />
    </div>
  );
}
