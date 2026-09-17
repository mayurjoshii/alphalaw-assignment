/**
 * Runtime evaluation helpers
 * (demonstrates deriving tenure_years from joining_date at run time,
 *  and resolving which policy_options apply to a given employee)
 */

import { employeeInfo, policyCategory, policyOptions, rules, rulesCondition } from './data';
import type { EmployeeInfo, LeaveMeta, PayScheduleMeta, PolicyCategoryName, PolicyOptions, Rule, RuleCondition } from './schema';

export function calculateTenureYears(joiningDate: string, asOf: Date = new Date()): number {
  const start = new Date(joiningDate);
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return (asOf.getTime() - start.getTime()) / msPerYear;
}

function getEmployeeAttributeValue(employee: EmployeeInfo, attribute: string): string | number | null {
  if (attribute === 'tenure_years') {
    return calculateTenureYears(employee.joining_date);
  }
  return (employee as unknown as Record<string, string | null>)[attribute] ?? null;
}

function evaluateCondition(condition: RuleCondition, employee: EmployeeInfo): boolean {
  const actual = getEmployeeAttributeValue(employee, condition.employee_attribute);
  if (actual === null) return false;

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

// All conditions on a rule are AND'ed together (sample data has at most one
// condition per rule; extend here if OR-combinators are introduced).
function ruleApplies(rule: Rule, employee: EmployeeInfo): boolean {
  if (rule.scope === 'GLOBAL') return true; // always applies, nothing to check
  const conditions = rulesCondition.filter((c) => c.rules_id === rule.id);
  return conditions.length > 0 && conditions.every((c) => evaluateCondition(c, employee));
}

// Does this rule key off tenure (e.g. the bonus-leave rule)? Tenure rules are
// additive modifiers, not mutually-exclusive alternatives to a GLOBAL rule,
// so they're resolved separately from resolveScopedRules below.
function isTenureRule(rule: Rule): boolean {
  return rulesCondition.some((c) => c.rules_id === rule.id && c.employee_attribute === 'tenure_years');
}

function parseMeta<T>(option: PolicyOptions): T {
  return JSON.parse(option.meta) as T;
}

function rulesForCategory(categoryType: PolicyCategoryName): Rule[] {
  const categoryId = policyCategory.find((c) => c.type === categoryType)!.id;
  return rules.filter((r) => policyOptions.find((o) => o.id === r.outcome_id)?.category_id === categoryId);
}

// CONDITIONAL rules take precedence: if any matched, use those; a GLOBAL
// rule only kicks in as a fallback when nothing CONDITIONAL matched. This
// keeps a GLOBAL rule from being summed alongside a more specific match.
function resolveScopedRules(candidateRules: Rule[], employee: EmployeeInfo): Rule[] {
  const conditionalMatches = candidateRules.filter((r) => r.scope === 'CONDITIONAL' && ruleApplies(r, employee));
  if (conditionalMatches.length > 0) return conditionalMatches;
  return candidateRules.filter((r) => r.scope === 'GLOBAL');
}

export function getApplicableLeaveOptions(employee: EmployeeInfo): LeaveMeta[] {
  const leaveRules = rulesForCategory('LEAVE');
  const baseRules = leaveRules.filter((r) => !isTenureRule(r)); // US / IN / Global -> mutually exclusive
  const bonusRules = leaveRules.filter((r) => isTenureRule(r)); // Bonus -> additive on top of base

  const selectedBase = resolveScopedRules(baseRules, employee);
  const matchedBonus = bonusRules.filter((r) => ruleApplies(r, employee));

  return [...selectedBase, ...matchedBonus].map((rule) =>
    parseMeta<LeaveMeta>(policyOptions.find((o) => o.id === rule.outcome_id)!)
  );
}

export function getEmployeeTotalLeaveDays(employee: EmployeeInfo): number {
  return getApplicableLeaveOptions(employee).reduce((sum, meta) => sum + meta.days, 0);
}

export function getApplicablePayFrequency(employee: EmployeeInfo): PayScheduleMeta | undefined {
  const payRules = rulesForCategory('PAY_SCHEDULE');
  const [matchedRule] = resolveScopedRules(payRules, employee);
  if (!matchedRule) return undefined;
  return parseMeta<PayScheduleMeta>(policyOptions.find((o) => o.id === matchedRule.outcome_id)!);
}

// ---- example ----
// employeeInfo.forEach((e) => {
//   console.log(e.name, getApplicableLeaveOptions(e), getEmployeeTotalLeaveDays(e), getApplicablePayFrequency(e));
// });
