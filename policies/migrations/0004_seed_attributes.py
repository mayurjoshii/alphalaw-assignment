"""
Seed the attribute master list and its option lists (MJ-api-endpoints.md).

Data migration, not schema: `GET /api/attributes/` is only useful once these
rows exist, so the form schema ships with the code rather than by hand.
`joining_date` is stored but not enumerated -- it is a free date input, and
tenure is derived from it at evaluation time.
"""

from django.db import migrations

# key -> (label, data_type, [option values])
ATTRIBUTES = {
    "gender": ("Gender", "text", ["MALE", "FEMALE"]),
    "location": ("Location", "text", ["USA", "INDIA"]),
    "joining_date": ("Joining Date", "date", []),
    "department": ("Department", "text", ["ENGINEERING", "SALES", "MARKETING", "HR"]),
    "employment_type": ("Employment Type", "text", ["FULLTIME", "CONTRACT"]),
    "employee_level": (
        "Employee Level",
        "text",
        ["JUNIOR", "SENIOR", "EXECUTIVE", "INTERN"],
    ),
}


def seed(apps, schema_editor):
    Attribute = apps.get_model("policies", "Attribute")
    AttributeValue = apps.get_model("policies", "AttributeValue")

    for key, (label, data_type, options) in ATTRIBUTES.items():
        attribute, _ = Attribute.objects.update_or_create(
            key=key,
            defaults={
                "label": label,
                "data_type": data_type,
                "source": "attribute_table",
                "enumerated": bool(options),
                "compute_key": "",
            },
        )
        for sort_order, value in enumerate(options):
            AttributeValue.objects.update_or_create(
                attribute=attribute,
                value=value,
                defaults={
                    "label": value.title(),
                    "active": True,
                    "sort_order": sort_order,
                },
            )


def unseed(apps, schema_editor):
    """Values go with their attribute via the FK cascade."""
    Attribute = apps.get_model("policies", "Attribute")
    Attribute.objects.filter(key__in=ATTRIBUTES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("policies", "0003_attribute_attributevalue_employeeattribute"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
