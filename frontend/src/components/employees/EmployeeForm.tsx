/**
 * The employee form is generated from `GET /api/attributes/` rather than
 * hardcoded: adding an attribute server-side adds an input here, and its
 * `data_type` / `enumerated` flags pick the widget.
 */

import { motion } from 'motion/react';
import { Field, Input, RadioGroup, Select } from '@/components/ui/primitives';
import type { Attribute } from '@/types/domain';

export interface EmployeeDraftState {
  name: string;
  joining_date: string;
  attributes: Record<string, string>;
}

export function EmployeeForm({
  draft,
  attributes,
  errors,
  onChange,
  onCommit,
}: {
  draft: EmployeeDraftState;
  attributes: Attribute[];
  errors: Record<string, string>;
  onChange: (next: EmployeeDraftState) => void;
  /** Re-runs policy resolution. Called on blur for typed inputs, on change
   *  for pickers -- a selection is already a finished decision. */
  onCommit: () => void;
}) {
  const setField = (patch: Partial<EmployeeDraftState>) => onChange({ ...draft, ...patch });

  const setAttribute = (key: string, value: string) =>
    onChange({ ...draft, attributes: { ...draft.attributes, [key]: value } });

  // Computed attributes (tenure_years) are derived at evaluation time and
  // must never be collected from the user.
  const editable = attributes.filter((attribute) => attribute.source === 'attribute_table');

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-4">
        <h3 className="stamp border-rule-soft border-b pb-2">Identity</h3>

        <Field label="Full name" error={errors.name}>
          <Input
            value={draft.name}
            placeholder="e.g. Priya Singh"
            onChange={(event) => setField({ name: event.target.value })}
            onBlur={onCommit}
          />
        </Field>

        <Field
          label="Joining date"
          hint="tenure is derived from this"
          error={errors.joining_date}
        >
          <Input
            type="date"
            value={draft.joining_date}
            onChange={(event) => setField({ joining_date: event.target.value })}
            onBlur={onCommit}
          />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h3 className="stamp border-rule-soft border-b pb-2">
          Attributes · what the rules test
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {editable.map((attribute, index) => (
            <motion.div
              key={attribute.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <AttributeInput
                attribute={attribute}
                value={draft.attributes[attribute.key] ?? ''}
                error={errors[attribute.key]}
                onChange={(value) => {
                  setAttribute(attribute.key, value);
                  if (attribute.enumerated) onCommit();
                }}
                onBlur={onCommit}
              />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AttributeInput({
  attribute,
  value,
  error,
  onChange,
  onBlur,
}: {
  attribute: Attribute;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const options = attribute.values.map((option) => ({
    value: option.value,
    label: option.label || option.value,
  }));

  return (
    <Field label={attribute.label} error={error}>
      {attribute.enumerated ? (
        // Two or three options fit inline; more would crowd the column.
        options.length <= 3 ? (
          <RadioGroup
            name={attribute.key}
            value={value}
            options={options}
            onChange={onChange}
          />
        ) : (
          <Select
            value={value}
            options={options}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      ) : (
        <Input
          type={attribute.data_type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )}
    </Field>
  );
}
