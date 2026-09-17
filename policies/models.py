"""
Django models translating base_db_schema.sql.

Django owns the schema here (code-first): these classes are the source of
truth and `makemigrations` generates the DDL from them.
"""

import uuid

from django.db import models
from django.db.models import Q


class PolicyCategoryName(models.TextChoices):
    """Mirrors the `policy_category_name` enum in base_db_schema.sql."""

    DEPARTMENT = "DEPARTMENT", "Department"
    TENURE = "TENURE", "Tenure"
    LEAVE = "LEAVE", "Leave"
    LOCATION = "LOCATION", "Location"
    COMPLIANCE = "COMPLIANCE", "Compliance"
    SHIFT = "SHIFT", "Shift"
    BENEFIT = "BENEFIT", "Benefit"
    PAY_SCHEDULE = "PAY_SCHEDULE", "Pay schedule"
    WORK_SCHEDULE = "WORK_SCHEDULE", "Work schedule"


class ConditionOperator(models.TextChoices):
    EQUALS = "equals", "Equals"
    NOT_EQUALS = "not_equals", "Not equals"
    GREATER_THAN = "greater_than", "Greater than"
    LESS_THAN = "less_than", "Less than"
    GREATER_THAN_OR_EQUAL = "greater_than_or_equal", "Greater than or equal"
    LESS_THAN_OR_EQUAL = "less_than_or_equal", "Less than or equal"


class Combinator(models.TextChoices):
    AND = "AND", "And"
    OR = "OR", "Or"


class RuleScope(models.TextChoices):
    """A rule either always applies, or only when its conditions match."""

    GLOBAL = "GLOBAL", "Global"
    CONDITIONAL = "CONDITIONAL", "Conditional"


class UUIDModel(models.Model):
    """Opaque string PKs, as the schema assumes -- not Django's auto-int."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class EmployeeInfo(UUIDModel):
    name = models.CharField(max_length=255)
    gender = models.CharField(max_length=64, blank=True)
    location = models.CharField(max_length=128, blank=True)
    country = models.CharField(max_length=2, blank=True, help_text="ISO code, e.g. US / IN")
    joining_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "employee info"
        ordering = ["name"]

    def __str__(self):
        return self.name


class PolicyCategory(UUIDModel):
    display_name = models.CharField(max_length=255)
    type = models.CharField(max_length=32, choices=PolicyCategoryName.choices, unique=True)

    class Meta:
        verbose_name_plural = "policy categories"
        ordering = ["type"]
        constraints = [
            models.CheckConstraint(
                condition=Q(type__in=PolicyCategoryName.values),
                name="policycategory_type_valid",
            )
        ]

    def __str__(self):
        return self.display_name


class PolicyOption(UUIDModel):
    """One selectable outcome within a category, e.g. PAY_SCHEDULE -> biweekly."""

    category = models.ForeignKey(
        PolicyCategory, on_delete=models.CASCADE, related_name="options"
    )
    meta = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.category.type}: {self.meta}"


class Rule(UUIDModel):
    """
    One rule and the option it grants. `valid_from` / `valid_to` keep history:
    supersede a rule by setting its valid_to and inserting a new row.
    """

    outcome = models.ForeignKey(
        PolicyOption, on_delete=models.PROTECT, related_name="rules"
    )
    scope = models.CharField(
        max_length=16, choices=RuleScope.choices, default=RuleScope.CONDITIONAL
    )
    valid_from = models.DateTimeField()
    valid_to = models.DateTimeField(
        null=True, blank=True, help_text="Null means currently active."
    )

    class Meta:
        ordering = ["-valid_from"]
        constraints = [
            models.CheckConstraint(
                condition=Q(scope__in=RuleScope.values),
                name="rule_scope_valid",
            ),
            # valid_to, when set, must come after valid_from -- the DB-level
            # twin of the serializer's cross-field check.
            models.CheckConstraint(
                condition=Q(valid_to__isnull=True) | Q(valid_to__gt=models.F("valid_from")),
                name="rule_valid_period_ordered",
            ),
        ]

    def __str__(self):
        return f"Rule {self.id} -> {self.outcome_id}"


class RuleCondition(UUIDModel):
    """
    One condition on a rule. Multiple conditions are chained with `combinator`,
    e.g. country equals US AND tenure_years greater_than 2.
    """

    rule = models.ForeignKey(Rule, on_delete=models.CASCADE, related_name="conditions")
    employee_attribute = models.CharField(max_length=128)
    operator = models.CharField(max_length=32, choices=ConditionOperator.choices)
    value = models.CharField(max_length=255)
    combinator = models.CharField(
        max_length=3, choices=Combinator.choices, default=Combinator.AND
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(operator__in=ConditionOperator.values),
                name="rulecondition_operator_valid",
            ),
            models.CheckConstraint(
                condition=Q(combinator__in=Combinator.values),
                name="rulecondition_combinator_valid",
            ),
        ]

    def __str__(self):
        return f"{self.employee_attribute} {self.operator} {self.value}"
