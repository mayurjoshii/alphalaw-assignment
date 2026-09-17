"""
Collapse `country` into `location`, and switch location's option values to the
ISO-style codes US / IN.

`country` (0005) and `location` (0004) held the same fact in two spellings,
which let an employee end up with location=USA and country=IN. Location is now
the single source and the only accepted values are US and IN; the `country`
attribute and its employee rows go away.
"""

from django.db import migrations

# Everything that ever meant the same place -> the value kept from now on.
TO_CODE = {"US": "US", "USA": "US", "IN": "IN", "INDIA": "IN"}

NEW_OPTIONS = [("US", "USA"), ("IN", "India")]
OLD_OPTIONS = [("USA", "Usa"), ("INDIA", "India")]  # as seeded in 0004


def collapse(apps, schema_editor):
    Attribute = apps.get_model("policies", "Attribute")
    AttributeValue = apps.get_model("policies", "AttributeValue")
    EmployeeAttribute = apps.get_model("policies", "EmployeeAttribute")

    # 1. country wins where the two disagreed -- it already held the codes.
    country_rows = {
        row.employee_id: row.value
        for row in EmployeeAttribute.objects.filter(attribute_id="country")
    }
    for row in EmployeeAttribute.objects.filter(attribute_id="location"):
        source = country_rows.get(row.employee_id, row.value)
        row.value = TO_CODE.get(source.strip().upper(), row.value)
        row.save(update_fields=["value"])

    # 2. Employees who only had country keep it, now as their location.
    located = set(
        EmployeeAttribute.objects.filter(attribute_id="location").values_list(
            "employee_id", flat=True
        )
    )
    location = Attribute.objects.filter(key="location").first()
    if location is not None:
        for employee_id, value in country_rows.items():
            code = TO_CODE.get(value.strip().upper())
            if employee_id not in located and code:
                EmployeeAttribute.objects.create(
                    employee_id=employee_id, attribute=location, value=code
                )

    # 3. Re-point the option list at the codes.
    AttributeValue.objects.filter(attribute_id="location").delete()
    for sort_order, (value, label) in enumerate(NEW_OPTIONS):
        AttributeValue.objects.create(
            attribute_id="location",
            value=value,
            label=label,
            active=True,
            sort_order=sort_order,
        )

    # 4. Drop country. Employee rows first -- the FK to Attribute is PROTECT.
    EmployeeAttribute.objects.filter(attribute_id="country").delete()
    Attribute.objects.filter(key="country").delete()


def restore(apps, schema_editor):
    """Rebuild `country` from `location` and put the old spellings back."""
    Attribute = apps.get_model("policies", "Attribute")
    AttributeValue = apps.get_model("policies", "AttributeValue")
    EmployeeAttribute = apps.get_model("policies", "EmployeeAttribute")

    country, _ = Attribute.objects.update_or_create(
        key="country",
        defaults={
            "label": "Country",
            "data_type": "text",
            "source": "attribute_table",
            "enumerated": True,
            "compute_key": "",
        },
    )
    for sort_order, value in enumerate(["US", "IN"]):
        AttributeValue.objects.update_or_create(
            attribute=country,
            value=value,
            defaults={"label": value, "active": True, "sort_order": sort_order},
        )

    spelled_out = {"US": "USA", "IN": "INDIA"}
    for row in EmployeeAttribute.objects.filter(attribute_id="location"):
        EmployeeAttribute.objects.update_or_create(
            employee_id=row.employee_id, attribute=country, defaults={"value": row.value}
        )
        row.value = spelled_out.get(row.value, row.value)
        row.save(update_fields=["value"])

    AttributeValue.objects.filter(attribute_id="location").delete()
    for sort_order, (value, label) in enumerate(OLD_OPTIONS):
        AttributeValue.objects.create(
            attribute_id="location",
            value=value,
            label=label,
            active=True,
            sort_order=sort_order,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("policies", "0007_drop_employee_attribute_columns"),
    ]

    operations = [migrations.RunPython(collapse, restore)]
