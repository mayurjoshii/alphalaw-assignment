/**
 * Sample rows for base_db_schema.sql
 * Scenario covered: LEAVE (US / IN / Global + tenure-based bonus leave)
 *                    PAY_SCHEDULE (US -> biweekly, IN -> monthly)
 */

import type { EmployeeInfo, LeaveMeta, PayScheduleMeta, PolicyCategory, PolicyOptions, Rule, RuleCondition } from './schema';

export const employeeInfo: EmployeeInfo[] = [
  {
    id: 'emp-001',
    name: 'John Doe',
    gender: 'Male',
    location: 'New York',
    country: 'US',
    joining_date: '2021-03-15', // > 2 years tenure -> bonus leave applies
  },
  {
    id: 'emp-002',
    name: 'Priya Singh',
    gender: 'Female',
    location: 'Bangalore',
    country: 'IN',
    joining_date: '2023-01-10', // > 2 years tenure -> bonus leave applies
  },
  {
    id: 'emp-003',
    name: 'Wei Chen',
    gender: 'Male',
    location: 'Singapore',
    country: 'SG', // neither US nor IN -> falls back to Global leave only
    joining_date: '2025-06-01', // < 2 years tenure -> no bonus leave
  },
  {
    id: 'emp-004',
    name: 'Maria Garcia',
    gender: 'Female',
    location: 'Austin',
    country: 'US',
    joining_date: '2025-01-01', // < 2 years tenure -> no bonus leave
  },
];

export const policyCategory: PolicyCategory[] = [
  { id: 'pc-leave', display_name: 'Leave Policy', type: 'LEAVE' },
  { id: 'pc-pay-schedule', display_name: 'Pay Schedule Policy', type: 'PAY_SCHEDULE' },
];

export const policyOptions: PolicyOptions[] = [
  // --- LEAVE options (category_id -> pc-leave) ---
  {
    id: 'po-leave-us',
    category_id: 'pc-leave',
    meta: JSON.stringify({ label: 'US Leave', days: 10 } satisfies LeaveMeta),
  },
  {
    id: 'po-leave-in',
    category_id: 'pc-leave',
    meta: JSON.stringify({ label: 'IN Leave', days: 12 } satisfies LeaveMeta),
  },
  {
    id: 'po-leave-global',
    category_id: 'pc-leave',
    meta: JSON.stringify({ label: 'Global Leave', days: 15 } satisfies LeaveMeta),
  },
  {
    id: 'po-leave-bonus',
    category_id: 'pc-leave',
    meta: JSON.stringify({ label: 'Bonus Leave (tenure > 2 years)', days: 5 } satisfies LeaveMeta),
  },

  // --- PAY_SCHEDULE options (category_id -> pc-pay-schedule) ---
  {
    id: 'po-pay-biweekly',
    category_id: 'pc-pay-schedule',
    meta: JSON.stringify({ label: 'Biweekly Pay', frequency: 'BIWEEKLY' } satisfies PayScheduleMeta),
  },
  {
    id: 'po-pay-monthly',
    category_id: 'pc-pay-schedule',
    meta: JSON.stringify({ label: 'Monthly Pay', frequency: 'MONTHLY' } satisfies PayScheduleMeta),
  },
];

export const rules: Rule[] = [
  // LEAVE
  { id: 'rule-leave-global', outcome_id: 'po-leave-global', scope: 'GLOBAL', valid_from: '2026-08-01T00:00:00Z', valid_to: null },
  { id: 'rule-leave-us', outcome_id: 'po-leave-us', scope: 'CONDITIONAL', valid_from: '2026-08-01T00:00:00Z', valid_to: null },
  { id: 'rule-leave-in', outcome_id: 'po-leave-in', scope: 'CONDITIONAL', valid_from: '2026-08-01T00:00:00Z', valid_to: null },
  { id: 'rule-leave-bonus', outcome_id: 'po-leave-bonus', scope: 'CONDITIONAL', valid_from: '2026-08-01T00:00:00Z', valid_to: null },

  // PAY_SCHEDULE
  { id: 'rule-pay-biweekly', outcome_id: 'po-pay-biweekly', scope: 'CONDITIONAL', valid_from: '2026-08-01T00:00:00Z', valid_to: null },
  { id: 'rule-pay-monthly', outcome_id: 'po-pay-monthly', scope: 'CONDITIONAL', valid_from: '2026-08-01T00:00:00Z', valid_to: null },
];

// Only CONDITIONAL-scope rules get rows here. `rule-leave-global` is
// scope: 'GLOBAL' and intentionally has none — it always applies and needs
// nothing to evaluate.
export const rulesCondition: RuleCondition[] = [
  {
    id: 'rc-001',
    rules_id: 'rule-leave-us',
    employee_attribute: 'country',
    operator: 'equals',
    value: 'US',
    combinator: null,
  },
  {
    id: 'rc-002',
    rules_id: 'rule-leave-in',
    employee_attribute: 'country',
    operator: 'equals',
    value: 'IN',
    combinator: null,
  },
  {
    id: 'rc-003',
    rules_id: 'rule-leave-bonus',
    employee_attribute: 'tenure_years', // derived from joining_date at runtime
    operator: 'greater_than',
    value: '2',
    combinator: null,
  },
  {
    id: 'rc-004',
    rules_id: 'rule-pay-biweekly',
    employee_attribute: 'country',
    operator: 'equals',
    value: 'US',
    combinator: null,
  },
  {
    id: 'rc-005',
    rules_id: 'rule-pay-monthly',
    employee_attribute: 'country',
    operator: 'equals',
    value: 'IN',
    combinator: null,
  },
];
