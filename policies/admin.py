"""Free CRUD UI at /admin/ -- useful for eyeballing data without a frontend."""

from django.contrib import admin

from .models import (
    Attribute,
    AttributeValue,
    EmployeeAttribute,
    EmployeeInfo,
    PolicyCategory,
    PolicyOption,
    Rule,
    RuleCondition,
)


class EmployeeAttributeInline(admin.TabularInline):
    """The employee_attributes form, edited inline on the employee."""

    model = EmployeeAttribute
    extra = 1


@admin.register(EmployeeInfo)
class EmployeeInfoAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "location", "joining_date")
    search_fields = ("name", "country")
    inlines = [EmployeeAttributeInline]


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


class AttributeValueInline(admin.TabularInline):
    model = AttributeValue
    extra = 1


@admin.register(Attribute)
class AttributeAdmin(admin.ModelAdmin):
    list_display = ("key", "label", "data_type", "source", "enumerated")
    list_filter = ("data_type", "source", "enumerated")
    inlines = [AttributeValueInline]


@admin.register(EmployeeAttribute)
class EmployeeAttributeAdmin(admin.ModelAdmin):
    list_display = ("employee", "attribute", "value")
    list_filter = ("attribute",)
    search_fields = ("employee__name", "value")
