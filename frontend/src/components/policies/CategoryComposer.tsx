/**
 * Add a policy category. A category is only useful with options and a rule
 * per option, so all three are composed in one drawer and written in
 * dependency order by `useCreateCategory`.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Drawer, DrawerHeader } from '@/components/ui/Drawer';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { RuleBuilder } from './RuleBuilder';
import { useCreateCategory, type OptionDraft } from '@/lib/queries';
import { ApiError } from '@/lib/api';
import { POLICY_CATEGORY_NAMES, type Attribute, type PolicyCategoryName } from '@/types/domain';

const blankOption = (): OptionDraft => ({
  label: '',
  meta: {},
  scope: 'CONDITIONAL',
  conditions: [],
});

export function CategoryComposer({
  open,
  attributes,
  takenTypes,
  onClose,
}: {
  open: boolean;
  attributes: Attribute[];
  /** `PolicyCategory.type` is unique -- don't offer one that already exists. */
  takenTypes: PolicyCategoryName[];
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateCategory();

  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState<PolicyCategoryName | ''>('');
  /** Quantitative categories stack their options; the rest select one. */
  const [quantity, setQuantity] = useState(true);
  const [options, setOptions] = useState<OptionDraft[]>([blankOption()]);
  const [amounts, setAmounts] = useState<string[]>(['']);
  const [error, setError] = useState('');

  const reset = () => {
    setDisplayName('');
    setType('');
    setQuantity(true);
    setOptions([blankOption()]);
    setAmounts(['']);
    setError('');
    create.reset();
  };

  const patchOption = (index: number, patch: Partial<OptionDraft>) =>
    setOptions((current) => current.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  const addOption = () => {
    setOptions((current) => [...current, blankOption()]);
    setAmounts((current) => [...current, '']);
  };

  const removeOption = (index: number) => {
    setOptions((current) => current.filter((_, i) => i !== index));
    setAmounts((current) => current.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!displayName.trim() || !type) {
      setError('Name and type are both required.');
      return;
    }
    const incomplete = options.some(
      (option) =>
        !option.label.trim() ||
        (option.scope === 'CONDITIONAL' && option.conditions.length === 0)
    );
    if (incomplete) {
      setError('Every option needs a label, and matching-only rules need a condition.');
      return;
    }
    setError('');

    try {
      await create.mutateAsync({
        display_name: displayName.trim(),
        type,
        options: options.map((option, index) => ({
          ...option,
          // A numeric `days` in meta is what makes the category stack rather
          // than select one -- see `strategyFor` in resolve.ts.
          meta: quantity && amounts[index] ? { days: Number(amounts[index]) } : {},
          conditions: option.conditions.filter((c) => c.employee_attribute && c.value),
        })),
      });
      toast(`${displayName.trim()} created.`);
      reset();
      onClose();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : 'Could not create category.';
      setError(message);
      toast(message, 'error');
    }
  };

  const availableTypes = POLICY_CATEGORY_NAMES.filter((name) => !takenTypes.includes(name));

  return (
    <Drawer
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <DrawerHeader
        eyebrow="New policy category"
        title={displayName || <span className="text-ink-faint">Untitled category</span>}
        onClose={() => {
          reset();
          onClose();
        }}
        actions={
          <Button
            onClick={submit}
            state={create.isPending ? 'pending' : create.isSuccess ? 'done' : 'idle'}
          >
            Create category
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-7">
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <Input
                value={displayName}
                placeholder="e.g. Maternity Leave"
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
            <Field label="Category type" hint="one row per type">
              <Select
                value={type}
                placeholder="Choose a type"
                options={availableTypes.map((name) => ({
                  value: name,
                  label: name.replace(/_/g, ' ').toLowerCase(),
                }))}
                onChange={(event) => setType(event.target.value as PolicyCategoryName)}
              />
            </Field>
          </section>

          <section className="border-rule bg-paper-high/60 rounded-[3px] border px-4 py-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={quantity}
                onChange={(event) => setQuantity(event.target.checked)}
                className="accent-oxblood mt-0.5 size-3.5"
              />
              <span>
                <span className="text-[13px]">This category grants an amount</span>
                <span className="text-ink-faint mt-0.5 block font-mono text-[10px] leading-relaxed">
                  Amounts stack — a matching employee gets every applicable option summed.
                  Leave this off for either/or values like a pay schedule, where one option
                  wins.
                </span>
              </span>
            </label>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="stamp">Options &amp; their rules</h3>
              <Button tone="quiet" onClick={addOption}>
                + Option
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {options.map((option, index) => (
                <motion.div
                  key={index}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  className="border-rule bg-paper-raised flex flex-col gap-4 rounded-[3px] border p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="stamp mt-3 shrink-0">{String(index + 1).padStart(2, '0')}</span>

                    <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                      <Field label="Option label">
                        <Input
                          value={option.label}
                          placeholder="e.g. US location top-up"
                          onChange={(event) => patchOption(index, { label: event.target.value })}
                        />
                      </Field>
                      {quantity && (
                        <Field label="Amount" hint="days">
                          <Input
                            type="number"
                            value={amounts[index] ?? ''}
                            placeholder="8"
                            onChange={(event) =>
                              setAmounts((current) =>
                                current.map((a, i) => (i === index ? event.target.value : a))
                              )
                            }
                          />
                        </Field>
                      )}
                    </div>

                    {options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        aria-label="Remove option"
                        className="focus-ring text-ink-faint hover:text-oxblood mt-3 size-8 shrink-0 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="border-rule-soft border-t pt-3 pl-9">
                    <RuleBuilder
                      scope={option.scope}
                      conditions={option.conditions}
                      attributes={attributes}
                      onScopeChange={(scope) => patchOption(index, { scope })}
                      onChange={(conditions) => patchOption(index, { conditions })}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </section>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-oxblood border-oxblood/20 bg-oxblood-wash rounded-[3px] border px-3 py-2 font-mono text-[11px]"
            >
              {error}
            </motion.p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
