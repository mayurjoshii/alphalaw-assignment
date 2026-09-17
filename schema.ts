/**
 * Types for base_db_schema.sql
 * Scenario covered: LEAVE (US / IN / Global + tenure-based bonus leave)
 *                    PAY_SCHEDULE (US -> biweekly, IN -> monthly)
 */

// ===================================================================
// Enums / unions (mirrors `policy_category_name` in the schema)
// ===================================================================

export type PolicyCategoryName =
  | 'DEPARTMENT'
  | 'TENURE'
  | 'LEAVE'
  | 'LOCATION'
  | 'COMPLIANCE'
  | 'SHIFT'
  | 'BENEFIT'
  | 'PAY_SCHEDULE'
  | 'WORK_SCHEDULE';

// `rules_condition.operator` is a free-form string in the schema; narrowed
// here to the set actually needed to express "country equals X" and
// "tenure_years greater_than X".
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal';

export type Combinator = 'AND' | 'OR';

// A rule is either always active (GLOBAL) or only active when its
// rules_condition rows match the employee (CONDITIONAL). Only CONDITIONAL
// rules should ever have rows in rules_condition.
export type RuleScope = 'GLOBAL' | 'CONDITIONAL';

// ===================================================================
// Table interfaces (field names/types match base_db_schema.sql)
// ===================================================================

export interface EmployeeInfo {
  id: string;
  name: string;
  gender: string | null;
  location: string | null;
  country: string | null;
  // Not a column on employee_info in the schema, but the TENURE-based bonus
  // leave rule needs a real date to derive tenure_years from at runtime.
  joining_date: string; // ISO date, e.g. "2021-03-15"
}

export interface PolicyCategory {
  id: string;
  display_name: string;
  type: PolicyCategoryName;
}

export interface PolicyOptions {
  id: string;
  category_id: string; // FK -> PolicyCategory.id
  meta: string; // JSON-stringified payload, shape depends on category
}

export interface Rule {
  id: string;
  outcome_id: string; // FK -> PolicyOptions.id
  scope: RuleScope; // 'GLOBAL' = always applies, 'CONDITIONAL' = needs rules_condition rows
  valid_from: string; // ISO datetime
  valid_to: string | null; // ISO datetime, null = open-ended
}

export interface RuleCondition {
  id: string;
  rules_id: string; // FK -> Rule.id
  employee_attribute: string; // e.g. 'country', 'tenure_years'
  operator: ConditionOperator;
  value: string;
  // How this condition combines with the *next* one on the same rule.
  // null when it's the only condition for that rule.
  combinator: Combinator | null;
}

// Typed shapes for `policy_options.meta` once JSON.parse'd, one per category.
export interface LeaveMeta {
  label: string;
  days: number;
}

export interface PayScheduleMeta {
  label: string;
  frequency: 'BIWEEKLY' | 'MONTHLY';
}
