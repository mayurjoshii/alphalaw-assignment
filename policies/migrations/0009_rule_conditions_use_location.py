"""
Point rule conditions at the `location` attribute, and seed the LEAVE rules.

`country` was dropped in 0008, so conditions written as
`country equals IN` referenced an attribute that no longer exists. Location now
carries the same codes (US / IN), so the values survive untouched.

Also seeds the first LEAVE rules (solo dev, no team to desync -- edited in
place rather than adding 0010, same as 0001's joining_date edit): a GLOBAL
5-day base, a US top-up to 12, and gender-based maternity/paternity days.
LEAVE options carry `meta.days`, so the frontend's accumulate strategy sums
every matching rule -- a US employee gets 5 + 12, a US female employee
5 + 12 + 60, etc. Reversal only removes rows this migration created, leaving
the LEAVE category and any pre-existing options (e.g. the manual IN rule)
untouched.
"""

from datetime import datetime, timezone as dt_timezone

from django.db import migrations

SPELLED_OUT = {"USA": "US", "INDIA": "IN"}

# label -> (days, scope, condition) -- condition is None for GLOBAL.
LEAVE_RULES = {
    "Global base leave": (5, "GLOBAL", None),
    "USA base leave": (12, "CONDITIONAL", ("location", "equals", "US")),
    "Maternity leave": (60, "CONDITIONAL", ("gender", "equals", "FEMALE")),
    "Paternity leave": (30, "CONDITIONAL", ("gender", "equals", "MALE")),
}


def to_location(apps, schema_editor):
    RuleCondition = apps.get_model("policies", "RuleCondition")
    for condition in RuleCondition.objects.filter(
        employee_attribute__in=["country", "location"]
    ):
        condition.employee_attribute = "location"
        condition.value = SPELLED_OUT.get(
            condition.value.strip().upper(), condition.value
        )
        condition.save(update_fields=["employee_attribute", "value"])


def to_country(apps, schema_editor):
    """Location conditions came from country; send the code ones back."""
    RuleCondition = apps.get_model("policies", "RuleCondition")
    RuleCondition.objects.filter(
        employee_attribute="location", value__in=["US", "IN"]
    ).update(employee_attribute="country")


def seed_leave(apps, schema_editor):
    PolicyCategory = apps.get_model("policies", "PolicyCategory")
    PolicyOption = apps.get_model("policies", "PolicyOption")
    Rule = apps.get_model("policies", "Rule")
    RuleCondition = apps.get_model("policies", "RuleCondition")

    category, _ = PolicyCategory.objects.get_or_create(
        type="LEAVE", defaults={"display_name": "Leave"}
    )
    # Fixed, matching the existing manual IN rule's valid_from -- deterministic
    # regardless of when this migration actually runs.
    valid_from = datetime(2024, 1, 1, tzinfo=dt_timezone.utc)

    for label, (days, scope, condition) in LEAVE_RULES.items():
        option, _ = PolicyOption.objects.update_or_create(
            category=category,
            meta__label=label,
            defaults={"meta": {"label": label, "days": days}},
        )
        rule = Rule.objects.create(
            outcome=option, scope=scope, valid_from=valid_from, valid_to=None
        )
        if condition is not None:
            attribute, operator, value = condition
            RuleCondition.objects.create(
                rule=rule, employee_attribute=attribute, operator=operator, value=value
            )


def unseed_leave(apps, schema_editor):
    """Remove only the options/rules this migration created, by label."""
    PolicyOption = apps.get_model("policies", "PolicyOption")
    Rule = apps.get_model("policies", "Rule")

    options = PolicyOption.objects.filter(
        category__type="LEAVE", meta__label__in=list(LEAVE_RULES)
    )
    Rule.objects.filter(outcome__in=options).delete()  # cascades conditions
    options.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("policies", "0008_location_is_the_only_country_source"),
    ]

    operations = [
        migrations.RunPython(to_location, to_country),
        migrations.RunPython(seed_leave, unseed_leave),
    ]
