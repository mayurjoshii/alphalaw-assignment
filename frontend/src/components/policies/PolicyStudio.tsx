/**
 * The rule set, grouped by category: which options exist, which rule grants
 * each one, and under what conditions. Read-mostly -- it is the reference an
 * HR user checks before deciding what an employee should get.
 */

import { useState } from "react";
import { motion } from "motion/react";
import { Accordion } from "@/components/ui/Accordion";
import { Badge, Button } from "@/components/ui/primitives";
import { CategoryComposer } from "./CategoryComposer";
import { PolicyOptionTimeline } from "./PolicyOptionTimeline";
import { describeCondition, optionLabel, strategyFor } from "@/lib/resolve";
import {
  useActiveRules,
  useAllRulesWithHistory,
  useAttributes,
  usePolicyCategories,
  usePolicyOptions,
} from "@/lib/queries";
import type { Rule } from "@/types/domain";

export function PolicyStudio() {
  const categories = usePolicyCategories();
  const options = usePolicyOptions();
  const activeRules = useActiveRules();
  const rulesWithHistory = useAllRulesWithHistory();
  const attributes = useAttributes();

  const [composerOpen, setComposerOpen] = useState(false);
  const [timelineOptionId, setTimelineOptionId] = useState<string | null>(null);

  const allCategories = categories.data ?? [];
  const allOptions = options.data ?? [];
  const allActiveRules = activeRules.data ?? [];
  const allRulesWithHistory = rulesWithHistory.data ?? [];
  const allAttributes = attributes.data ?? [];

  const optionCategory = new Map(allOptions.map((o) => [o.id, o.category]));

  // A superseded rule usually points at a *different* PolicyOption (a new
  // value = a new row), so "has this option's value ever changed" can't be
  // answered by counting rules with outcome === optionId. Mirror the
  // backend's /timeline/ signature match instead: same category + scope +
  // condition set is the same rule "slot" across time. See policies/views.py.
  function conditionSignature(rule: Rule) {
    return new Set(
      rule.conditions.map((c) => `${c.employee_attribute}|${c.operator}|${c.value}`),
    );
  }

  function sameSignature(a: Set<string>, b: Set<string>) {
    if (a.size !== b.size) return false;
    for (const item of a) if (!b.has(item)) return false;
    return true;
  }

  const optionHasHistory = (optionId: string) => {
    const category = optionCategory.get(optionId);
    const ownRules = allRulesWithHistory.filter((r) => r.outcome === optionId);
    if (category == null || ownRules.length === 0) return false;

    const reference =
      ownRules.find((r) => r.valid_to == null) ??
      [...ownRules].sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0];

    if (reference.scope === "GLOBAL") {
      return (
        allRulesWithHistory.filter(
          (r) => r.scope === "GLOBAL" && optionCategory.get(r.outcome) === category,
        ).length > 1
      );
    }

    const signature = conditionSignature(reference);
    return (
      allRulesWithHistory.filter(
        (r) =>
          r.scope === "CONDITIONAL" &&
          optionCategory.get(r.outcome) === category &&
          sameSignature(conditionSignature(r), signature),
      ).length > 1
    );
  };

  return (
    <div className="animate-rise flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[32px] leading-none font-semibold tracking-[-0.03em]">
            Policy studio
          </h2>
          <p className="text-ink-soft mt-1.5 text-[13px]">
            {allCategories.length} categories · {allActiveRules.length} active
            rules
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
            const categoryOptions = allOptions.filter(
              (o) => o.category === category.id,
            );
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
                  defaultOpen={index < 3}
                  summary={
                    <span className="flex items-baseline gap-2.5">
                      <span className="text-[15px]">
                        {category.display_name}
                      </span>
                      <span className="text-ink-faint font-mono text-[10px] tracking-[0.1em] uppercase">
                        {category.type.replace(/_/g, " ").toLowerCase()}
                      </span>
                    </span>
                  }
                  meta={
                    <span className="flex shrink-0 items-center gap-2">
                      <Badge
                        tone={
                          strategy === "accumulate" ? "verdigris" : "neutral"
                        }
                      >
                        {strategy === "accumulate" ? "stacks" : "one applies"}
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
                        const rule = allActiveRules.find(
                          (r) => r.outcome === option.id,
                        );
                        console.log("Rule:rule", rule);
                        if (!rule) {
                          return null;
                        }

                        return (
                          <li
                            key={option.id}
                            className="border-rule-soft bg-paper-raised grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-start gap-4 rounded-[3px] border px-3 py-2.5"
                          >
                            <span className="text-[13px]">
                              {optionLabel(option)}
                            </span>

                            <span className="flex flex-wrap items-center gap-1.5">
                              {!rule ? (
                                <Badge tone="oxblood">no active rule</Badge>
                              ) : rule.scope === "GLOBAL" ? (
                                <Badge tone="verdigris">everyone</Badge>
                              ) : rule.conditions.length === 0 ? (
                                <Badge tone="oxblood">no conditions</Badge>
                              ) : (
                                rule.conditions.map(
                                  (condition, conditionIndex) => (
                                    <span
                                      key={condition.id}
                                      className="flex items-center gap-1.5"
                                    >
                                      {conditionIndex > 0 && (
                                        <span className="text-ink-faint font-mono text-[9px]">
                                          {
                                            rule.conditions[conditionIndex - 1]
                                              .combinator
                                          }
                                        </span>
                                      )}
                                      <code className="border-rule bg-paper-high text-ink-soft rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px]">
                                        {describeCondition(
                                          condition,
                                          allAttributes,
                                        )}
                                      </code>
                                    </span>
                                  ),
                                )
                              )}
                            </span>

                            <button
                              type="button"
                              onClick={() => setTimelineOptionId(option.id)}
                              className={`focus-ring hover:text-oxblood font-mono text-[9px] font-medium tracking-[0.1em] uppercase underline decoration-dotted underline-offset-2 ${
                                optionHasHistory(option.id)
                                  ? "text-ink"
                                  : "text-ink-faint"
                              }`}
                            >
                              History
                            </button>
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

      <PolicyOptionTimeline
        open={timelineOptionId != null}
        optionId={timelineOptionId}
        attributes={allAttributes}
        onClose={() => setTimelineOptionId(null)}
      />
    </div>
  );
}
