# Generated migration for effective-dating EmployeeAttribute rows.
# Solo-dev pattern: new migration rather than editing 0003/0004/etc in place.

from django.db import migrations, models
from django.db.models import Q
from django.utils import timezone


def backfill_valid_from(apps, schema_editor):
    """Set valid_from = created_at for all existing rows (all are currently open)."""
    EmployeeAttribute = apps.get_model("policies", "EmployeeAttribute")
    for row in EmployeeAttribute.objects.all():
        row.valid_from = row.created_at
        row.save(update_fields=["valid_from"])


def reverse_backfill(apps, schema_editor):
    """Reverse: set valid_from = None (will be handled by default on next forward run)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("policies", "0010_leave_onetime_category"),
    ]

    operations = [
        migrations.AddField(
            model_name="employeeattribute",
            name="valid_from",
            field=models.DateTimeField(default=timezone.now),
        ),
        migrations.AddField(
            model_name="employeeattribute",
            name="valid_to",
            field=models.DateTimeField(
                blank=True, null=True, help_text="Null means currently active."
            ),
        ),
        migrations.RunPython(backfill_valid_from, reverse_backfill),
        migrations.RemoveConstraint(
            model_name="employeeattribute",
            name="employeeattribute_unique_per_employee",
        ),
        migrations.AddConstraint(
            model_name="employeeattribute",
            constraint=models.UniqueConstraint(
                condition=Q(valid_to__isnull=True),
                fields=["employee", "attribute"],
                name="employeeattribute_unique_open_per_employee",
            ),
        ),
        migrations.AddConstraint(
            model_name="employeeattribute",
            constraint=models.CheckConstraint(
                condition=Q(valid_to__isnull=True)
                | Q(valid_to__gt=models.F("valid_from")),
                name="employeeattribute_valid_period_ordered",
            ),
        ),
        migrations.AlterModelOptions(
            name="employeeattribute",
            options={"ordering": ["employee_id", "attribute_id", "-valid_from"]},
        ),
    ]
