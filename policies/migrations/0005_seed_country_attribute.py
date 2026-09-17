"""
Seed the 'country' attribute: an enumerated (dropdown) attribute restricted
to US and IN, distinct from the free-text 'location' attribute seeded in
0004 (USA/INDIA display names, not ISO codes).
"""

from django.db import migrations

KEY = "country"
LABEL = "Country"
OPTIONS = ["US", "IN"]


def seed(apps, schema_editor):
    Attribute = apps.get_model("policies", "Attribute")
    AttributeValue = apps.get_model("policies", "AttributeValue")

    attribute, _ = Attribute.objects.update_or_create(
        key=KEY,
        defaults={
            "label": LABEL,
            "data_type": "text",
            "source": "attribute_table",
            "enumerated": True,
            "compute_key": "",
        },
    )
    for sort_order, value in enumerate(OPTIONS):
        AttributeValue.objects.update_or_create(
            attribute=attribute,
            value=value,
            defaults={
                "label": value,
                "active": True,
                "sort_order": sort_order,
            },
        )


def unseed(apps, schema_editor):
    Attribute = apps.get_model("policies", "Attribute")
    Attribute.objects.filter(key=KEY).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("policies", "0004_seed_attributes"),
    ]

    operations = [migrations.RunPython(seed, unseed)]
