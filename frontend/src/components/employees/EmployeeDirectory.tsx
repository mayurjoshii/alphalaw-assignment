/**
 * The directory: every employee, their attributes, and the headline resolved
 * value so the list itself is useful before anyone opens a panel.
 */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Badge, Button, Input } from '@/components/ui/primitives';
import { EmployeePanel } from './EmployeePanel';
import { resolveEmployeePolicies, calculateTenureYears } from '@/lib/resolve';
import {
  useActiveRules,
  useAttributes,
  useEmployees,
  usePolicyCategories,
  usePolicyOptions,
} from '@/lib/queries';
import type { Employee } from '@/types/domain';

export function EmployeeDirectory() {
  const employees = useEmployees();
  const attributes = useAttributes();
  const categories = usePolicyCategories();
  const options = usePolicyOptions();
  const rules = useActiveRules();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  /**
   * One stable object for the four reference datasets. Memoised because it is
   * both a dependency of the row resolution below and a prop bundle for the
   * panel -- a fresh `?? []` each render would re-resolve every row.
   */
  const reference = useMemo(
    () => ({
      attributes: attributes.data ?? [],
      categories: categories.data ?? [],
      options: options.data ?? [],
      rules: rules.data ?? [],
    }),
    [attributes.data, categories.data, options.data, rules.data]
  );

  /** Attributes worth showing as directory columns -- the enumerated ones. */
  const columns = useMemo(
    () => reference.attributes.filter((a) => a.enumerated).slice(0, 3),
    [reference.attributes]
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (employees.data ?? [])
      .filter((employee) =>
        term
          ? employee.name.toLowerCase().includes(term) ||
            Object.values(employee.attributes).some((value) =>
              value.toLowerCase().includes(term)
            )
          : true
      )
      .map((employee) => ({
        employee,
        resolved: resolveEmployeePolicies({
          facts: {
            name: employee.name,
            joining_date: employee.joining_date,
            attributes: employee.attributes,
          },
          ...reference,
        }),
      }));
  }, [employees.data, search, reference]);

  const open = (employee: Employee | null) => {
    setSelected(employee);
    setPanelOpen(true);
  };

  const loading = employees.isLoading || attributes.isLoading;

  return (
    <div className="animate-rise flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[32px] leading-none font-semibold tracking-[-0.03em]">
            Directory
          </h2>
          <p className="text-ink-soft mt-1.5 text-[13px]">
            {employees.data?.length ?? 0} on record · entitlements resolve live from the
            active rule set
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={search}
            placeholder="Search name or attribute…"
            onChange={(event) => setSearch(event.target.value)}
            className="w-56"
          />
          <Button onClick={() => open(null)}>+ New employee</Button>
        </div>
      </div>

      {/* Scrolls sideways rather than clipping once the attribute columns
          outgrow the viewport. */}
      <div className="sheet overflow-x-auto">
        {loading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <p className="text-ink-faint px-6 py-14 text-center font-mono text-[12px]">
            {search ? 'No match.' : 'No employees yet — add the first one.'}
          </p>
        ) : (
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="border-rule bg-paper-high/70 border-b">
                <th className="stamp px-5 py-3 text-left font-medium">Employee</th>
                {columns.map((column) => (
                  <th key={column.key} className="stamp px-3 py-3 text-left font-medium">
                    {column.label}
                  </th>
                ))}
                <th className="stamp px-3 py-3 text-left font-medium">Tenure</th>
                <th className="stamp px-5 py-3 text-right font-medium">Entitlements</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ employee, resolved }, index) => {
                const headline = resolved.find((row) => row.total !== null);
                const tenure = employee.joining_date
                  ? calculateTenureYears(employee.joining_date)
                  : null;

                return (
                  <motion.tr
                    key={employee.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: Math.min(index * 0.025, 0.3),
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    onClick={() => open(employee)}
                    className="border-rule-soft hover:bg-paper-high group cursor-pointer border-b transition-colors last:border-0"
                  >
                    <td className="px-5 py-3">
                      <span className="group-hover:text-oxblood text-[14px] transition-colors">
                        {employee.name}
                      </span>
                    </td>

                    {columns.map((column) => {
                      const raw = employee.attributes[column.key];
                      const label =
                        column.values.find((v) => v.value === raw)?.label ?? raw;
                      return (
                        <td key={column.key} className="px-3 py-3">
                          {label ? (
                            <Badge>{label}</Badge>
                          ) : (
                            <span className="text-ink-faint font-mono text-[11px]">—</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="text-ink-soft px-3 py-3 font-mono text-[11px]">
                      {tenure === null ? '—' : `${tenure.toFixed(1)} yr`}
                    </td>

                    <td className="px-5 py-3 text-right">
                      {headline ? (
                        <span className="text-verdigris font-mono text-[13px] font-medium">
                          {headline.display}
                        </span>
                      ) : (
                        <span className="text-ink-faint font-mono text-[11px]">
                          unresolved
                        </span>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <EmployeePanel
        open={panelOpen}
        employee={selected}
        onClose={() => setPanelOpen(false)}
        {...reference}
      />
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="border-rule-soft flex items-center gap-4 border-b px-5 py-4 last:border-0"
        >
          <motion.div
            animate={{ opacity: [0.35, 0.7, 0.35] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: index * 0.12 }}
            className="bg-rule h-3 w-40 rounded-full"
          />
          <motion.div
            animate={{ opacity: [0.25, 0.5, 0.25] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: index * 0.12 + 0.2 }}
            className="bg-rule ml-auto h-3 w-16 rounded-full"
          />
        </div>
      ))}
    </div>
  );
}
