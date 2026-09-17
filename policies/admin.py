"""Free CRUD UI at /admin/ -- useful for eyeballing data without a frontend."""

from django.contrib import admin

from .models import EmployeeInfo, PolicyCategory, PolicyOption, Rule, RuleCondition


@admin.register(EmployeeInfo)
class EmployeeInfoAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "location", "joining_date")
    search_fields = ("name", "country")


@admin.register(PolicyCategory)
class PolicyCategoryAdmin(admin.ModelAdmin):
    list_display = ("display_name", "type")


@admin.register(PolicyOption)
class PolicyOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "category")
    list_filter = ("category",)


class RuleConditionInline(admin.TabularInline):
    model = RuleCondition
    extra = 1


@admin.register(Rule)
class RuleAdmin(admin.ModelAdmin):
    list_display = ("id", "outcome", "scope", "valid_from", "valid_to")
    list_filter = ("scope",)
    inlines = [RuleConditionInline]
