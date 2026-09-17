/**
 * Client-side port of the rule engine in `functions.ts`, adapted to the
 * attributes model (`EmployeeAttribute` rows rather than columns).
 *
 * It lives in the browser because the Django side has no resolution endpoint
 * yet -- the POC fetches rules/conditions/options once and evaluates locally,
 * which is also what makes the live "recompute on blur" preview possible
 * before an employee has been saved (MJ-api-endpoints.md).
 */

import { testableAttributes } from '@/types/domain';
import type {
  Attribute,
  PolicyCategory,
  PolicyOption,
  Rule,
  RuleCondition,
  RuleScope,
} from '@/types/domain';

/** The facts a rule can test: stored attributes plus derived ones. */
export interface EmployeeFacts {
  name: string;
  attributes: Record<string, string>;
}

export interface ResolvedLine {
  rule: Rule;
  option: PolicyOption;
  label: string;
  /** Numeric payload when the option is quantitative (e.g. leave days). */
  amount: number | null;
  scope: RuleScope;
  /** Human-readable trace of why this line applied -- shown in the tooltip. */
  because: string;
}

export type ResolutionStrategy = 'accumulate' | 'select-one';

export interface ResolvedCategory {
  category: PolicyCategory;
  strategy: ResolutionStrategy;
  lines: ResolvedLine[];
  /** Summed amount for accumulate categories, null for select-one. */
  total: number | null;
  /** The single value to print in the table's value column. */
  display: string;
}

// ---------------------------------------------------------------- attributes

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function calculateTenureYears(joiningDate: string, asOf: Date = new Date()): number {
  return (asOf.getTime() - new Date(joiningDate).getTime()) / MS_PER_YEAR;
}

/**
 * Resolve one attribute key against an employee. `tenure_years` is computed
 * from the `joining_date` attribute; everything else is a stored attribute row.
 */
function factValue(facts: EmployeeFacts, key: string): string | number | null {
  if (key === 'tenure_years') {
    const joiningDate = facts.attributes.joining_date;
    return joiningDate ? calculateTenureYears(joiningDate) : null;
  }
  return facts.attributes[key] ?? null;
}

// ---------------------------------------------------------------- conditions

function evaluateCondition(condition: RuleCondition, facts: EmployeeFacts): boolean {
  const actual = factValue(facts, condition.employee_attribute);
  if (actual === null || actual === '') return false;

  switch (condition.operator) {
    case 'equals':
      return String(actual) === condition.value;
    case 'not_equals':
      return String(actual) !== condition.value;
    case 'greater_than':
      return Number(actual) > Number(condition.value);
    case 'less_than':
      return Number(actual) < Number(condition.value);
    case 'greater_than_or_equal':
      return Number(actual) >= Number(condition.value);
    case 'less_than_or_equal':
      return Number(actual) <= Number(condition.value);
    default:
      return false;
  }
}

/**
 * Fold conditions left to right. Per the schema, a condition's `combinator`
 * describes how it joins to the *next* one, so the last one's is ignored.
 */
function evaluateConditions(conditions: RuleCondition[], facts: EmployeeFacts): boolean {
  if (!conditions.length) return false;
  return conditions.reduce((accumulated, condition, index) => {
    const result = evaluateCondition(condition, facts);
    if (index === 0) return result;
    return conditions[index - 1].combinator === 'OR'
      ? accumulated || result
      : accumulated && result;
  }, false);
}

export function ruleApplies(rule: Rule, facts: EmployeeFacts): boolean {
  if (rule.scope === 'GLOBAL') return true;
  return evaluateConditions(rule.conditions, facts);
}

/** A rule is in force when now falls inside [valid_from, valid_to). */
export function ruleIsActive(rule: Rule, asOf: Date = new Date()): boolean {
  if (new Date(rule.valid_from) > asOf) return false;
  return rule.valid_to === null || new Date(rule.valid_to) > asOf;
}

// -------------------------------------------------------------------- meta

/** Options whose meta carries a number are quantitative and accumulate. */
function amountOf(option: PolicyOption): number | null {
  for (const key of ['days', 'amount', 'hours', 'count']) {
    const value = option.meta[key];
    if (typeof value === 'number') return value;
  }
  return null;
}

export function optionLabel(option: PolicyOption): string {
  const label = option.meta.label;
  if (typeof label === 'string' && label) return label;

  const amount = amountOf(option);
  if (amount !== null) return `${amount} days`;

  // `meta` is a free-form JSONField, so fall back to its first string value
  // before resorting to raw JSON.
  const firstString = Object.values(option.meta).find(
    (value): value is string => typeof value === 'string'
  );
  return firstString ?? JSON.stringify(option.meta);
}

export function optionUnit(option: PolicyOption): string {
  if (typeof option.meta.days === 'number') return 'days';
  if (typeof option.meta.hours === 'number') return 'hours';
  return '';
}

// --------------------------------------------------------------- explanation

export function describeCondition(
  condition: RuleCondition,
  attributes: Attribute[] = []
): string {
  // Computed facts carry no Attribute row from the API, so fold them in to
  // get "Tenure (years)" rather than a bare key.
  const attribute = testableAttributes(attributes).find(
    (a) => a.key === condition.employee_attribute
  );
  const name = attribute?.label ?? condition.employee_attribute.replace(/_/g, ' ');
  const verb = {
    equals: 'is',
    not_equals: 'is not',
    greater_than: '>',
    less_than: '<',
    greater_than_or_equal: '≥',
    less_than_or_equal: '≤',
  }[condition.operator];
  const value =
    attribute?.values.find((v) => v.value === condition.value)?.label ?? condition.value;
  return `${name} ${verb} ${value}`;
}

function describeRule(rule: Rule, attributes: Attribute[]): string {
  if (rule.scope === 'GLOBAL') return 'Applies to everyone';
  return rule.conditions
    .map((condition, index) => {
      const clause = describeCondition(condition, attributes);
      const joiner = index === 0 ? '' : `${rule.conditions[index - 1].combinator} `;
      return `${joiner}${clause}`;
    })
    .join(' ');
}

// ---------------------------------------------------------------- resolution

/**
 * Which strategy a category uses is read off its data, not hardcoded:
 *
 *  - quantitative options (leave days) ACCUMULATE -- a US employee gets the
 *    global allowance *plus* their location top-up *plus* any tenure bonus,
 *    per MJ-api-endpoints.md.
 *  - everything else is SELECT-ONE, where a matching CONDITIONAL rule beats
 *    the GLOBAL fallback (functions.ts:resolveScopedRules) -- an employee
 *    cannot be paid both biweekly and monthly.
 */
export function strategyFor(options: PolicyOption[]): ResolutionStrategy {
  const quantitative = options.some((option) => amountOf(option) !== null);
  return quantitative ? 'accumulate' : 'select-one';
}

function toLine(rule: Rule, option: PolicyOption, attributes: Attribute[]): ResolvedLine {
  return {
    rule,
    option,
    label: optionLabel(option),
    amount: amountOf(option),
    scope: rule.scope,
    because: describeRule(rule, attributes),
  };
}

export interface ResolveInput {
  facts: EmployeeFacts;
  categories: PolicyCategory[];
  options: PolicyOption[];
  rules: Rule[];
  attributes: Attribute[];
  asOf?: Date;
}

/**
 * The whole policy picture for one employee, one row per category -- this is
 * what the side table in the employee panel renders.
 */
export function resolveEmployeePolicies({
  facts,
  categories,
  options,
  rules,
  attributes,
  asOf = new Date(),
}: ResolveInput): ResolvedCategory[] {
  const optionsById = new Map(options.map((option) => [option.id, option]));

  return categories.map((category) => {
    const categoryOptions = options.filter((option) => option.category === category.id);
    const categoryOptionIds = new Set(categoryOptions.map((option) => option.id));

    const candidates = rules.filter(
      (rule) => categoryOptionIds.has(rule.outcome) && ruleIsActive(rule, asOf)
    );
    const matched = candidates.filter((rule) => ruleApplies(rule, facts));
    const strategy = strategyFor(categoryOptions);

    const selected =
      strategy === 'accumulate'
        ? matched
        : // CONDITIONAL wins outright; GLOBAL is only the fallback.
          (() => {
            const conditional = matched.filter((rule) => rule.scope === 'CONDITIONAL');
            return conditional.length
              ? conditional.slice(0, 1)
              : matched.filter((rule) => rule.scope === 'GLOBAL').slice(0, 1);
          })();

    const lines = selected
      .map((rule) => {
        const option = optionsById.get(rule.outcome);
        return option ? toLine(rule, option, attributes) : null;
      })
      .filter((line): line is ResolvedLine => line !== null);

    const total =
      strategy === 'accumulate' && lines.length
        ? lines.reduce((sum, line) => sum + (line.amount ?? 0), 0)
        : null;

    const unit = lines.length ? optionUnit(lines[0].option) : '';

    return {
      category,
      strategy,
      lines,
      total,
      display: !lines.length
        ? '—'
        : total !== null
          ? `${total}${unit ? ` ${unit}` : ''}`
          : lines[0].label,
    };
  });
}
