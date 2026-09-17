"""
Point rule conditions at the `location` attribute.

`country` was dropped in 0008, so conditions written as
`country equals IN` referenced an attribute that no longer exists. Location now
carries the same codes (US / IN), so the values survive untouched.
"""

from django.db import migrations

SPELLED_OUT = {"USA": "US", "INDIA": "IN"}


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


class Migration(migrations.Migration):

    dependencies = [
        ("policies", "0008_location_is_the_only_country_source"),
    ]

    operations = [migrations.RunPython(to_location, to_country)]
