"""
Add the executive leave bonus, and split maternity/paternity into a
one-time leave category.

New migration rather than editing 0001/0002/0009 in place (the established
solo-dev pattern -- see 0001's joining_date edit, 0009's docstring): 0002's
CheckConstraint sits underneath 0003-0009, two of which round-trip live
employee data between EmployeeInfo columns and EmployeeAttribute rows.
Tracing the reverse chain on the actual dev DB found 0008's reverse
recreates EmployeeAttribute rows against a `country` Attribute that 0005's
reverse then tries to delete under an on_delete=PROTECT FK -- a guaranteed
mid-rollback failure. Not worth it for a constraint widening.

1. Widens PolicyCategory.type's CHECK constraint to allow LEAVE_ONETIME.
2. Executive leave bonus: +14 days, CONDITIONAL on employee_level=EXECUTIVE,
   in the existing LEAVE category. Additive like the other LEAVE rules --
   every other level simply fails the condition, so no "else" rule is
   needed (accumulate strategy, per resolve.ts:strategyFor).
3. Moves the existing "Maternity leave" / "Paternity leave" options from
   LEAVE into the new LEAVE_ONETIME category. Same rule/condition rows,
   just re-pointed -- resolveEmployeePolicies sums within a category, so
   this is what keeps their days out of the annually-accruing LEAVE total
   and resolves them as their own line instead.
"""

from datetime import datetime, timezone as dt_timezone

from django.db import migrations, models

CATEGORY_TYPES = [
    "DEPARTMENT",
    "TENURE",
    "LEAVE",
    "LEAVE_ONETIME",
    "LOCATION",
    "COMPLIANCE",
    "SHIFT",
    "BENEFIT",
    "PAY_SCHEDULE",
    "WORK_SCHEDULE",
]

ONETIME_LABELS = ["Maternity leave", "Paternity leave"]


def seed(apps, schema_editor):
    PolicyCategory = apps.get_model("policies", "PolicyCategory")
    PolicyOption = apps.get_model("policies", "PolicyOption")
    Rule = apps.get_model("policies", "Rule")
    RuleCondition = apps.get_model("policies", "RuleCondition")

    leave, _ = PolicyCategory.objects.get_or_create(
        type="LEAVE", defaults={"display_name": "Leave"}
    )
    onetime, _ = PolicyCategory.objects.get_or_create(
        type="LEAVE_ONETIME", defaults={"display_name": "Leave (One-time)"}
    )

    option, _ = PolicyOption.objects.update_or_create(
        category=leave,
        meta__label="Executive leave bonus",
        defaults={"meta": {"label": "Executive leave bonus", "days": 14}},
    )
    rule = Rule.objects.create(
        outcome=option,
        scope="CONDITIONAL",
        # Same fixed anchor as 0009's LEAVE rules -- deterministic regardless
        # of when this migration actually runs.
        valid_from=datetime(2024, 1, 1, tzinfo=dt_timezone.utc),
        valid_to=None,
    )
    RuleCondition.objects.create(
        rule=rule,
        employee_attribute="employee_level",
        operator="equals",
        value="EXECUTIVE",
    )

    PolicyOption.objects.filter(category=leave, meta__label__in=ONETIME_LABELS).update(
        category=onetime
    )


def unseed(apps, schema_editor):
    PolicyCategory = apps.get_model("policies", "PolicyCategory")
    PolicyOption = apps.get_model("policies", "PolicyOption")

    leave = PolicyCategory.objects.filter(type="LEAVE").first()
    if leave is not None:
        PolicyOption.objects.filter(
            category__type="LEAVE_ONETIME", meta__label__in=ONETIME_LABELS
        ).update(category=leave)
    # The LEAVE_ONETIME category row itself is left behind on reverse, same
    # as 0009 leaves LEAVE behind -- and the CHECK constraint below is never
    # narrowed back, so an empty leftover row is harmless either way.

    # Raw SQL rather than the ORM: mixing AlterField/constraint operations
    # with RunPython in the same migration renders a fresh historical
    # PolicyOption class per reverse step, and Rule's PROTECT-cascade
    # collector then rejects ids from a queryset built off a different one
    # of those classes ("Cannot query ...: Must be PolicyOption instance").
    # Deleting by id in plain SQL sidesteps that Django-internals mismatch.
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            DELETE FROM policies_rulecondition
            WHERE rule_id IN (
                SELECT r.id FROM policies_rule r
                JOIN policies_policyoption po ON po.id = r.outcome_id
                JOIN policies_policycategory pc ON pc.id = po.category_id
                WHERE pc.type = 'LEAVE' AND po.meta->>'label' = 'Executive leave bonus'
            )
            """
        )
        cursor.execute(
            """
            DELETE FROM policies_rule
            WHERE id IN (
                SELECT r.id FROM policies_rule r
                JOIN policies_policyoption po ON po.id = r.outcome_id
                JOIN policies_policycategory pc ON pc.id = po.category_id
                WHERE pc.type = 'LEAVE' AND po.meta->>'label' = 'Executive leave bonus'
            )
            """
        )
        cursor.execute(
            """
            DELETE FROM policies_policyoption
            WHERE id IN (
                SELECT po.id FROM policies_policyoption po
                JOIN policies_policycategory pc ON pc.id = po.category_id
                WHERE pc.type = 'LEAVE' AND po.meta->>'label' = 'Executive leave bonus'
            )
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ("policies", "0009_rule_conditions_use_location"),
    ]

    operations = [
        migrations.AlterField(
            model_name="policycategory",
            name="type",
            field=models.CharField(
                max_length=32,
                unique=True,
                choices=[
                    ("DEPARTMENT", "Department"),
                    ("TENURE", "Tenure"),
                    ("LEAVE", "Leave"),
                    ("LEAVE_ONETIME", "Leave (one-time)"),
                    ("LOCATION", "Location"),
                    ("COMPLIANCE", "Compliance"),
                    ("SHIFT", "Shift"),
                    ("BENEFIT", "Benefit"),
                    ("PAY_SCHEDULE", "Pay schedule"),
                    ("WORK_SCHEDULE", "Work schedule"),
                ],
            ),
        ),
        # Widens the CHECK constraint forward; reverse is a deliberate no-op.
        # Reversing RemoveConstraint+AddConstraint normally re-narrows it,
        # but that ALTER TABLE runs after unseed()'s DELETEs on this same
        # migration's reverse, and Postgres refuses to ALTER a table with
        # pending trigger events from an earlier statement in the same
        # transaction ("cannot ALTER TABLE ... because it has pending
        # trigger events"). Narrowing a CHECK constraint back is rarely
        # worth that risk anyway -- state_operations keeps Django's model
        # state (and `makemigrations --check`) correct either direction.
        migrations.RunSQL(
            sql=[
                'ALTER TABLE "policies_policycategory" DROP CONSTRAINT "policycategory_type_valid"',
                'ALTER TABLE "policies_policycategory" ADD CONSTRAINT "policycategory_type_valid" '
                "CHECK (\"type\" IN ('DEPARTMENT', 'TENURE', 'LEAVE', 'LEAVE_ONETIME', 'LOCATION', "
                "'COMPLIANCE', 'SHIFT', 'BENEFIT', 'PAY_SCHEDULE', 'WORK_SCHEDULE'))",
            ],
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="policycategory",
                    name="policycategory_type_valid",
                ),
                migrations.AddConstraint(
                    model_name="policycategory",
                    constraint=models.CheckConstraint(
                        condition=models.Q(("type__in", CATEGORY_TYPES)),
                        name="policycategory_type_valid",
                    ),
                ),
            ],
        ),
        migrations.RunPython(seed, unseed),
    ]
