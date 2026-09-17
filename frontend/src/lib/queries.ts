/**
 * React Query hooks, one per API resource. Every mutation invalidates the
 * keys its write can affect, so the resolved-policy table re-derives itself
 * without any manual refresh wiring.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  Attribute,
  Employee,
  PolicyCategory,
  PolicyCategoryName,
  PolicyOption,
  Rule,
  RuleScope,
} from '@/types/domain';

export const keys = {
  attributes: ['attributes'] as const,
  employees: ['employees'] as const,
  categories: ['policy-categories'] as const,
  options: ['policy-options'] as const,
  rules: ['rules'] as const,
};

// ------------------------------------------------------------------- reads

/** The form schema: every attribute with its allowed values inlined. */
export function useAttributes() {
  return useQuery({
    queryKey: keys.attributes,
    queryFn: () => api.list<Attribute>('/attributes/'),
    // Attributes are edited far less often than employees; don't refetch them
    // on every panel open.
    staleTime: 5 * 60_000,
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: keys.employees,
    queryFn: () => api.list<Employee>('/employees/'),
  });
}

export function usePolicyCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.list<PolicyCategory>('/policy-categories/'),
  });
}

export function usePolicyOptions() {
  return useQuery({
    queryKey: keys.options,
    queryFn: () => api.list<PolicyOption>('/policy-options/'),
  });
}

/** Only rules in force today -- superseded rows never reach the UI. */
export function useActiveRules() {
  return useQuery({
    queryKey: [...keys.rules, 'active'],
    queryFn: () => api.list<Rule>('/rules/active/'),
  });
}

// --------------------------------------------------------------- employees

export interface EmployeeDraft {
  name: string;
  attributes: Record<string, string>;
}

/**
 * Creating an employee is two round trips by design: `/employees/` owns
 * identity (just `name` -- joining_date lives in employee_attributes like
 * every other fact), `/employee-attributes/` owns everything else and
 * validates each value against its attribute's option list.
 */
export function useSaveEmployee() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, draft }: { id?: string; draft: EmployeeDraft }) => {
      const identity = { name: draft.name };

      const employee = id
        ? await api.patch<Employee>(`/employees/${id}/`, identity)
        : await api.post<Employee>('/employees/', identity);

      await syncAttributes(employee, draft.attributes);
      return employee;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.employees });
    },
  });
}

/**
 * Reconcile the attribute rows to match the draft: PATCH what changed, POST
 * what is new, DELETE what was cleared. Sequential rather than parallel so a
 * validation error points at one field.
 */
async function syncAttributes(employee: Employee, next: Record<string, string>) {
  const existing = employee.attributes ?? {};
  const rows = await api.list<{ id: string; attribute: string; value: string }>(
    `/employee-attributes/${api.query({ employee: employee.id })}`
  );
  const rowByKey = new Map(rows.map((row) => [row.attribute, row]));

  for (const [key, value] of Object.entries(next)) {
    const row = rowByKey.get(key);
    if (!value) {
      if (row) await api.delete(`/employee-attributes/${row.id}/`);
      continue;
    }
    if (!row) {
      await api.post('/employee-attributes/', {
        employee: employee.id,
        attribute: key,
        value,
      });
    } else if (row.value !== value) {
      await api.patch(`/employee-attributes/${row.id}/`, { value });
    }
  }

  // Keys dropped from the draft entirely.
  for (const key of Object.keys(existing)) {
    if (!(key in next)) {
      const row = rowByKey.get(key);
      if (row) await api.delete(`/employee-attributes/${row.id}/`);
    }
  }
}

export function useDeleteEmployee() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}/`),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.employees }),
  });
}

// ---------------------------------------------------------------- policies

export interface ConditionDraft {
  employee_attribute: string;
  operator: string;
  value: string;
  combinator: 'AND' | 'OR';
}

export interface OptionDraft {
  label: string;
  /** Free-form payload beyond the label, e.g. `{days: 12}`. */
  meta: Record<string, unknown>;
  scope: RuleScope;
  conditions: ConditionDraft[];
}

export interface CategoryDraft {
  display_name: string;
  type: PolicyCategoryName;
  options: OptionDraft[];
}

/**
 * One category, its options, and a rule per option, written in dependency
 * order. `RuleSerializer` accepts conditions nested inline, so each option
 * costs two requests rather than 2 + n.
 */
export function useCreateCategory() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (draft: CategoryDraft) => {
      const category = await api.post<PolicyCategory>('/policy-categories/', {
        display_name: draft.display_name,
        type: draft.type,
      });

      const validFrom = new Date().toISOString();

      for (const option of draft.options) {
        const created = await api.post<PolicyOption>('/policy-options/', {
          category: category.id,
          meta: { label: option.label, ...option.meta },
        });

        await api.post<Rule>('/rules/', {
          outcome: created.id,
          scope: option.scope,
          valid_from: validFrom,
          valid_to: null,
          // A GLOBAL rule must carry zero conditions (serializer enforces it).
          conditions: option.scope === 'GLOBAL' ? [] : option.conditions,
        });
      }

      return category;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.categories });
      client.invalidateQueries({ queryKey: keys.options });
      client.invalidateQueries({ queryKey: keys.rules });
    },
  });
}

/**
 * Re-point an employee at a different option in a category by writing the
 * attribute value the winning rule tests for. The engine does the rest --
 * assignments stay derived rather than becoming a second source of truth.
 */
export function useOverrideByAttribute() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      attribute,
      value,
    }: {
      employeeId: string;
      attribute: string;
      value: string;
    }) => {
      const rows = await api.list<{ id: string; attribute: string }>(
        `/employee-attributes/${api.query({ employee: employeeId })}`
      );
      const row = rows.find((r) => r.attribute === attribute);
      return row
        ? api.patch(`/employee-attributes/${row.id}/`, { value })
        : api.post('/employee-attributes/', { employee: employeeId, attribute, value });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: keys.employees }),
  });
}
