/**
 * The employee panel: edit form on the left, live resolved-policy table on
 * the right. Both create and edit run through here, so a brand-new employee
 * shows their entitlements before they are ever saved.
 */

import { useEffect, useMemo, useState } from 'react';
import { Drawer, DrawerHeader } from '@/components/ui/Drawer';
import { Badge, Button } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { EmployeeForm, type EmployeeDraftState } from './EmployeeForm';
import { ResolvedPolicyTable } from './ResolvedPolicyTable';
import { resolveEmployeePolicies } from '@/lib/resolve';
import { useSaveEmployee } from '@/lib/queries';
import { ApiError } from '@/lib/api';
import type { Attribute, Employee, PolicyCategory, PolicyOption, Rule } from '@/types/domain';

const EMPTY: EmployeeDraftState = { name: '', attributes: {} };

function toDraft(employee: Employee | null): EmployeeDraftState {
  if (!employee) return EMPTY;
  return {
    name: employee.name,
    attributes: { ...employee.attributes },
  };
}

export function EmployeePanel({
  open,
  employee,
  attributes,
  categories,
  options,
  rules,
  onClose,
}: {
  open: boolean;
  /** null = create mode. */
  employee: Employee | null;
  attributes: Attribute[];
  categories: PolicyCategory[];
  options: PolicyOption[];
  rules: Rule[];
  onClose: () => void;
}) {
  const toast = useToast();
  const save = useSaveEmployee();

  const [draft, setDraft] = useState<EmployeeDraftState>(EMPTY);
  /**
   * `committed` is what the engine evaluates. Keeping it separate from
   * `draft` is what implements the on-blur/on-click evaluation decided in
   * MJ-api-endpoints.md -- the table doesn't flicker on every keystroke.
   */
  const [committed, setCommitted] = useState<EmployeeDraftState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const next = toDraft(employee);
    setDraft(next);
    setCommitted(next);
    setErrors({});
    save.reset();
    // Re-seeding is keyed on which record the panel opened for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee?.id]);

  const resolved = useMemo(
    () =>
      resolveEmployeePolicies({
        facts: {
          name: committed.name,
          attributes: committed.attributes,
        },
        categories,
        options,
        rules,
        attributes,
      }),
    [committed, categories, options, rules, attributes]
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(employee));
  const stale = JSON.stringify(draft) !== JSON.stringify(committed);

  const handleSave = async () => {
    if (!draft.name.trim()) {
      setErrors({ name: 'A name is required.' });
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync({
        id: employee?.id,
        draft: {
          name: draft.name.trim(),
          attributes: draft.attributes,
        },
      });
      toast(employee ? 'Employee updated.' : 'Employee added.');
      onClose();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Save failed.';
      // DRF reports `field: message`; point the form at that field.
      const [field] = message.split(':');
      setErrors(field && field in draft.attributes ? { [field]: message } : { name: message });
      toast(message, 'error');
    }
  };

  return (
    <Drawer open={open} onClose={onClose}>
      <DrawerHeader
        eyebrow={employee ? 'Employee record' : 'New employee'}
        title={draft.name || <span className="text-ink-faint">Unnamed</span>}
        onClose={onClose}
        actions={
          <>
            {dirty && <Badge tone="brass">unsaved</Badge>}
            <Button
              onClick={handleSave}
              state={save.isPending ? 'pending' : save.isSuccess ? 'done' : 'idle'}
              disabled={!dirty && Boolean(employee)}
            >
              {employee ? 'Save changes' : 'Add employee'}
            </Button>
          </>
        }
      />

      {/*
        Narrow: one column that scrolls as a whole. Wide: two independently
        scrolling panes. The explicit `grid-rows-[minmax(0,1fr)]` is what makes
        that work -- an auto-sized row grows past the drawer instead of
        letting the panes scroll, which silently clips the bottom of the form.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
        <section className="px-7 py-6 lg:min-h-0 lg:overflow-y-auto">
          <EmployeeForm
            draft={draft}
            attributes={attributes}
            errors={errors}
            onChange={setDraft}
            onCommit={setCommitted}
          />
        </section>

        <aside className="border-rule bg-paper/70 border-t px-6 py-6 lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <ResolvedPolicyTable
            resolved={resolved}
            joiningDate={committed.attributes.joining_date || null}
            stale={stale}
          />
        </aside>
      </div>
    </Drawer>
  );
}
