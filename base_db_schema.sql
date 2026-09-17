
Table employee_info {
  id string [primary key]
  name string [not null]
  gender string
  location string
  country string
  joining_date string
}

enum policy_category_name {
  DEPARTMENT
  /*
  */
  TENURE
  LEAVE
  LOCATION
  COMPLIANCE
  SHIFT
  BENEFIT
  PAY_SCHEDULE
  WORK_SCHEDULE
}


Table policy_category {
  id string [primary key]
  display_name string
  type policy_category_name

}

-- // Ex: Options not on all but few of them
-- // Pay_schedule: biweekly or monthly
Table policy_options {
  id string [primary key]
  category_id string [ref: - policy_category.id]
  meta string // or JSON
}

-- // one rule and their outcome, Fox ex:
-- // US employee: 12days, IN employees 10days
-- // Basically which policy_options to apply when these rules meet
Table rules {
  id string [primary key]
  outcome_id string [ref: - policy_options.id]
  valid_from datetime 
  
  -- Helps in keeping track of the past rules by assigning the valid_to, and entering a new one
  -- from valid_from date & valid_to null for the same 
  valid_to datetime
  -- // US employee, Get outcome of 12days -> Based on the rule conditions
}

-- // Multiple conditions can apply to one rule.
-- // In that case, the rules will have the multi-operators
Table rules_condition {
  id string [primary key]
  rules_id string [ref: >rules.id, not null]
  employee_attribute string // Can be the enum for all the input types & label
  operator string
  -- // what should the operand attribute apply the operator on
  value string
  
  -- // what should the above value be in - AND/OR
  combinator string

}





/* 

  employee_policy_assignment table
    This will have the effective from, and effective to date for the policy assignment to the employee
    Helps in going back in time and see the change for policy

 */