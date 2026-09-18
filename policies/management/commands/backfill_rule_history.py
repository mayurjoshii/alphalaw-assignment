"""
Backfill fake history onto a handful of currently-active rules, so the
timeline endpoints/views (2026-09-18 decision) have something to render in
dev instead of every rule starting "today".

For each target below, the currently active (valid_to=None) rule matching
the category + conditions is found, its valid_from is moved to the date of
the *last* listed state, and older states are inserted before it as their
own PolicyOption + Rule (+ copied RuleCondition) rows, chained valid_to ->
next valid_from. Idempotent: skipped if that rule already has a predecessor
(a closed rule pointing at the same conditions in the same category).
"""

from datetime import datetime, timezone as dt_timezone

from django.core.management.base import BaseCommand
from django.db import transaction

from policies.models import PolicyCategory, PolicyOption, Rule, RuleCondition


def dt(y, m, d):
    return datetime(y, m, d, tzinfo=dt_timezone.utc)


# Each target: category type, the condition set identifying the live rule
# (empty list = GLOBAL), and states oldest -> current as (valid_from, meta).
# The current row's meta must match the last state's meta.
TARGETS = [
    {
        "category": "LEAVE",
        "scope": "CONDITIONAL",
        "conditions": [("location", "equals", "US")],
        "states": [
            (dt(2021, 5, 1), {"days": 8}),
            (dt(2023, 2, 15), {"days": 12}),
            (dt(2025, 4, 1), {"days": 10}),
        ],
    },
    {
        "category": "LEAVE",
        "scope": "CONDITIONAL",
        "conditions": [("location", "equals", "IN")],
        "states": [
            (dt(2022, 1, 10), {"days": 10}),
            (dt(2024, 6, 1), {"days": 8}),
            (dt(2025, 11, 1), {"days": 12}),
        ],
    },
    {
        "category": "LEAVE",
        "scope": "CONDITIONAL",
        "conditions": [("tenure_years", "greater_than", "2")],
        "states": [
            (dt(2021, 9, 1), {"days": 4, "label": "Tenure Bonus", "additive": True}),
            (dt(2023, 10, 1), {"days": 5, "label": "Tenure Bonus", "additive": True}),
            (dt(2025, 6, 1), {"days": 6, "label": "Tenure Bonus", "additive": True}),
        ],
    },
    {
        "category": "APPLICATION_ACCESS",
        "scope": "CONDITIONAL",
        "conditions": [("department", "equals", "ENGINEERING")],
        "states": [
            (dt(2022, 2, 1), {"items": ["VS Code"], "label": "Engineering tools", "multi": True}),
            (dt(2024, 1, 1), {"items": ["VS Code", "Cursor"], "label": "Engineering tools", "multi": True}),
            (dt(2026, 7, 18), {"items": ["VS Code", "Cursor", "Twingate"], "label": "Engineering tools", "multi": True}),
        ],
    },
    {
        "category": "APPLICATION_ACCESS",
        "scope": "CONDITIONAL",
        "conditions": [("department", "equals", "HR")],
        "states": [
            (dt(2022, 3, 1), {"items": ["Panel Dashboard"], "label": "HR tools", "multi": True}),
            (dt(2024, 9, 1), {"items": ["Panel Dashboard", "Tickets Dashboard"], "label": "HR tools", "multi": True}),
            (dt(2026, 2, 1), {"items": ["Panel Dashboard", "Tickets Dashboard", "Org Charts"], "label": "HR tools", "multi": True}),
        ],
    },
    {
        "category": "APPLICATION_ACCESS",
        "scope": "CONDITIONAL",
        "conditions": [("department", "equals", "MARKETING")],
        "states": [
            (dt(2021, 12, 1), {"items": ["HubSpot"], "label": "Marketing tools", "multi": True}),
            (dt(2023, 5, 1), {"items": ["HubSpot", "Salesforce"], "label": "Marketing tools", "multi": True}),
            (dt(2025, 1, 15), {"items": ["HubSpot", "Salesforce", "SEMrush"], "label": "Marketing tools", "multi": True}),
            (dt(2026, 4, 1), {"items": ["HubSpot", "Clay", "Salesforce", "SEMrush"], "label": "Marketing tools", "multi": True}),
        ],
    },
]


class Command(BaseCommand):
    help = "Backfill fake historical rule versions for the timeline views (dev data only)."

    def handle(self, *args, **options):
        with transaction.atomic():
            for target in TARGETS:
                self._backfill(target)

    def _backfill(self, target):
        category = PolicyCategory.objects.get(type=target["category"])
        conditions = target["conditions"]
        *history_states, current_state = target["states"]

        qs = Rule.objects.filter(
            outcome__category=category, scope=target["scope"], valid_to__isnull=True
        )
        for attr, op, val in conditions:
            qs = qs.filter(conditions__employee_attribute=attr, conditions__operator=op, conditions__value=val)
        current_rule = qs.distinct().get()

        predecessor_qs = Rule.objects.filter(
            outcome__category=category, scope=target["scope"], valid_to=current_rule.valid_from
        )
        for attr, op, val in conditions:
            predecessor_qs = predecessor_qs.filter(
                conditions__employee_attribute=attr, conditions__operator=op, conditions__value=val
            )
        if predecessor_qs.distinct().exists():
            self.stdout.write(f"Skipping (already backfilled): {category.type} {conditions}")
            return

        current_valid_from, current_meta = current_state
        current_rule.valid_from = current_valid_from
        current_rule.save(update_fields=["valid_from"])
        current_rule.outcome.meta = current_meta
        current_rule.outcome.save(update_fields=["meta"])

        next_valid_from = current_valid_from
        for valid_from, meta in reversed(history_states):
            option = PolicyOption.objects.create(category=category, meta=meta)
            rule = Rule.objects.create(
                outcome=option,
                scope=target["scope"],
                valid_from=valid_from,
                valid_to=next_valid_from,
            )
            for attr, op, val in conditions:
                RuleCondition.objects.create(
                    rule=rule, employee_attribute=attr, operator=op, value=val
                )
            next_valid_from = valid_from

        self.stdout.write(self.style.SUCCESS(
            f"Backfilled {len(history_states)} change(s) for {category.type} {conditions}"
        ))
