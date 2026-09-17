/**
 * Condition rows for one rule: `<attribute> <operator> <value>`, chained by
 * AND/OR. The attribute list and its allowed values come from
 * `GET /api/attributes/`, so a condition can only be written against a fact
 * the engine can actually resolve.
 */

import { AnimatePresence, motion } from 'motion/react';
import { Button, Select, Input, RadioGroup } from '@/components/ui/primitives';
import { CONDITION_OPERATORS, testableAttributes, type Attribute } from '@/types/domain';
import type { ConditionDraft } from '@/lib/queries';

export function RuleBuilder({
  scope,
  conditions,
  attributes: storedAttributes,
  onScopeChange,
  onChange,
}: {
  scope: 'GLOBAL' | 'CONDITIONAL';
  conditions: ConditionDraft[];
  attributes: Attribute[];
  onScopeChange: (scope: 'GLOBAL' | 'CONDITIONAL') => void;
  onChange: (conditions: ConditionDraft[]) => void;
}) {
  // Derived facts like tenure_years have no Attribute row but are the whole
  // point of a tenure rule, so they join the list here.
  const attributes = testableAttributes(storedAttributes);

  const update = (index: number, patch: Partial<ConditionDraft>) =>
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const add = () =>
    onChange([
      ...conditions,
      {
        employee_attribute: attributes[0]?.key ?? '',
        operator: 'equals',
        value: '',
        combinator: 'AND',
      },
    ]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="stamp shrink-0">Applies to</span>
        <RadioGroup
          name={`scope-${conditions.length}-${scope}`}
          value={scope}
          onChange={(value) => onScopeChange(value as 'GLOBAL' | 'CONDITIONAL')}
          options={[
            { value: 'GLOBAL', label: 'Everyone' },
            { value: 'CONDITIONAL', label: 'Matching only' },
          ]}
        />
      </div>

      <AnimatePresence initial={false}>
        {scope === 'CONDITIONAL' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 pt-1">
              {conditions.map((condition, index) => (
                <ConditionRow
                  key={index}
                  condition={condition}
                  attributes={attributes}
                  // The combinator joins this row to the next, so the last
                  // row never shows one.
                  showCombinator={index < conditions.length - 1}
                  onChange={(patch) => update(index, patch)}
                  onRemove={() => onChange(conditions.filter((_, i) => i !== index))}
                />
              ))}

              <div className="flex items-center gap-2">
                <Button tone="quiet" onClick={add}>
                  + Condition
                </Button>
                {conditions.length === 0 && (
                  <span className="text-oxblood font-mono text-[10px]">
                    a matching-only rule needs at least one
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConditionRow({
  condition,
  attributes,
  showCombinator,
  onChange,
  onRemove,
}: {
  condition: ConditionDraft;
  attributes: Attribute[];
  showCombinator: boolean;
  onChange: (patch: Partial<ConditionDraft>) => void;
  onRemove: () => void;
}) {
  const attribute = attributes.find((a) => a.key === condition.employee_attribute);
  // Numeric facts (tenure_years) get a free number input; enumerated ones get
  // their own option list so a typo can't produce a rule that never matches.
  const numeric = attribute?.data_type === 'number';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="border-rule-soft bg-paper-high flex flex-col gap-2 rounded-[3px] border p-2.5"
    >
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] items-center gap-2">
        <Select
          value={condition.employee_attribute}
          placeholder="Attribute"
          options={attributes.map((a) => ({ value: a.key, label: a.label }))}
          onChange={(event) =>
            onChange({ employee_attribute: event.target.value, value: '' })
          }
        />
        <Select
          value={condition.operator}
          placeholder="is"
          options={CONDITION_OPERATORS}
          onChange={(event) => onChange({ operator: event.target.value })}
        />
        {attribute?.enumerated ? (
          <Select
            value={condition.value}
            placeholder="Value"
            options={attribute.values.map((v) => ({
              value: v.value,
              label: v.label || v.value,
            }))}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        ) : (
          <Input
            type={numeric ? 'number' : 'text'}
            value={condition.value}
            placeholder={numeric ? '2' : 'value'}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove condition"
          className="focus-ring text-ink-faint hover:text-oxblood size-8 shrink-0 transition-colors"
        >
          ✕
        </button>
      </div>

      {showCombinator && (
        <div className="w-28">
          <RadioGroup
            name={`comb-${condition.employee_attribute}-${condition.value}`}
            value={condition.combinator}
            onChange={(value) => onChange({ combinator: value as 'AND' | 'OR' })}
            options={[
              { value: 'AND', label: 'and' },
              { value: 'OR', label: 'or' },
            ]}
          />
        </div>
      )}
    </motion.div>
  );
}
