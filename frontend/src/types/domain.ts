/**
 * Mirrors the DRF serializers in `policies/serializers.py`. Kept as plain
 * types rather than generated from the API so the shapes are readable next to
 * the components that consume them.
 */

export type PolicyCategoryName =
  | 'DEPARTMENT'
  | 'TENURE'
  | 'LEAVE'
  | 'LEAVE_ONETIME'
  | 'LOCATION'
  | 'COMPLIANCE'
  | 'SHIFT'
  | 'BENEFIT'
  | 'PAY_SCHEDULE'
  | 'WORK_SCHEDULE';

export const POLICY_CATEGORY_NAMES: PolicyCategoryName[] = [
  'DEPARTMENT',
  'TENURE',
  'LEAVE',
  'LEAVE_ONETIME',
  'LOCATION',
  'COMPLIANCE',
  'SHIFT',
  'BENEFIT',
  'PAY_SCHEDULE',
  'WORK_SCHEDULE',
];

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal';

export const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'greater_than', label: 'is more than' },
  { value: 'less_than', label: 'is less than' },
  { value: 'greater_than_or_equal', label: 'is at least' },
  { value: 'less_than_or_equal', label: 'is at most' },
];

export type Combinator = 'AND' | 'OR';
export type RuleScope = 'GLOBAL' | 'CONDITIONAL';
export type AttributeDataType = 'text' | 'number' | 'date' | 'bool';
export type AttributeSource = 'attribute_table' | 'computed';

export interface AttributeValue {
  id: string;
  value: string;
  label: string;
  active: boolean;
  sort_order: number;
}

/** The form schema for one input: label, widget (`data_type`), and options. */
export interface Attribute {
  key: string;
  label: string;
  data_type: AttributeDataType;
  source: AttributeSource;
  enumerated: boolean;
  compute_key: string;
  values: AttributeValue[];
}

export interface Employee {
  id: string;
  name: string;
  /** Flat `{attribute_key: value}` map, built by EmployeeInfoSerializer -- includes `joining_date`. */
  attributes: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface PolicyCategory {
  id: string;
  display_name: string;
  type: PolicyCategoryName;
  created_at: string;
  updated_at: string;
}

/** `meta` is free-form JSON whose shape depends on the category. */
export interface PolicyOption {
  id: string;
  category: string;
  category_type: PolicyCategoryName;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RuleCondition {
  id: string;
  employee_attribute: string;
  operator: ConditionOperator;
  value: string;
  combinator: Combinator;
}

export interface Rule {
  id: string;
  outcome: string;
  scope: RuleScope;
  valid_from: string;
  valid_to: string | null;
  conditions: RuleCondition[];
  created_at: string;
  updated_at: string;
}

/**
 * Derived facts. They have no `Attribute` row server-side (nothing stores
 * them) but rules are written against them, so the condition builder needs
 * them in its attribute list. `resolve.ts` knows how to compute each one.
 */
export const COMPUTED_ATTRIBUTES: Attribute[] = [
  {
    key: 'tenure_years',
    label: 'Tenure (years)',
    data_type: 'number',
    source: 'computed',
    enumerated: false,
    compute_key: 'tenure_years',
    values: [],
  },
];

/** The full set a rule can test: stored attributes plus derived ones. */
export function testableAttributes(stored: Attribute[]): Attribute[] {
  const keys = new Set(stored.map((attribute) => attribute.key));
  return [...stored, ...COMPUTED_ATTRIBUTES.filter((a) => !keys.has(a.key))];
}

// ---------------------------------------------------------------- timeline

/** `Rule` plus what `RuleTimelineSerializer` derives server-side. */
export interface RuleTimelineEntry extends Rule {
  status: 'active' | 'superseded';
  category_type: PolicyCategoryName;
}

/** Response shape of `GET /api/policy-options/:id/timeline/`. */
export interface PolicyOptionTimeline {
  policyOption: PolicyOption;
  rules: RuleTimelineEntry[];
}

/** One row of `GET /api/employees/:id/timeline/`. */
export interface EmployeeAttributeTimelineEvent {
  id: string;
  attribute: Attribute;
  value: string;
  valid_from: string;
  valid_to: string | null;
  status: 'active' | 'superseded';
  rules_referencing_attribute: RuleTimelineEntry[];
}

/** Response shape of `GET /api/employees/:id/timeline/`. */
export interface EmployeeTimeline {
  employee: Employee;
  attributeTimeline: EmployeeAttributeTimelineEvent[];
}
