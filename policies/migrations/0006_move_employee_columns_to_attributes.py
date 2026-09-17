"""
Move the per-employee facts off EmployeeInfo columns into employee_attributes.

`gender`, `location` (0004) and `country` (0005) are all attributes, so the
columns were a second home for the same fact. `joining_date` stays a real
column: tenure is derived from it and it is the only typed date field.

Runs before the columns are dropped in 0007; reversing restores the values.
"""

from django.db import migrations

# Column values as they were, mapped onto the seeded attribute values.
VALUE_MAPS = {
    "gender": {"MALE": "MALE", "M": "MALE", "FEMALE": "FEMALE", "F": "FEMALE"},
    "location": {"US": "USA", "USA": "USA", "IN": "INDIA", "INDIA": "INDIA"},
    "country": {"US": "US", "USA": "US", "IN": "IN", "INDIA": "IN"},
}


def to_attributes(apps, schema_editor):
    Attribute = apps.get_model("policies", "Attribute")
    EmployeeAttribute = apps.get_model("policies", "EmployeeAttribute")
    EmployeeInfo = apps.get_model("policies", "EmployeeInfo")

    attributes = {a.key: a for a in Attribute.objects.filter(key__in=VALUE_MAPS)}

    for employee in EmployeeInfo.objects.all():
        for key, value_map in VALUE_MAPS.items():
            column = (getattr(employee, key) or "").strip().upper()
            value = value_map.get(column)
            # Unmappable free-form values are dropped rather than written as
            # options the UI could never offer back.
            if not value or key not in attributes:
                continue
            EmployeeAttribute.objects.update_or_create(
                employee=employee,
                attribute=attributes[key],
                defaults={"value": value},
            )


def to_columns(apps, schema_editor):
    EmployeeAttribute = apps.get_model("policies", "EmployeeAttribute")
    EmployeeInfo = apps.get_model("policies", "EmployeeInfo")

    for employee in EmployeeInfo.objects.all():
        rows = {
            row.attribute_id: row.value
            for row in EmployeeAttribute.objects.filter(employee=employee)
        }
        employee.gender = rows.get("gender", "")
        employee.location = rows.get("location", "")
        employee.country = rows.get("country", "")
        employee.save(update_fields=["gender", "location", "country"])


class Migration(migrations.Migration):

    dependencies = [
        ("policies", "0005_seed_country_attribute"),
    ]

    operations = [migrations.RunPython(to_attributes, to_columns)]
