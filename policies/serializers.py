"""
Serializers = validation + JSON shape. Roughly Zod schema + response mapper
in one object: they validate incoming POST bodies and render outgoing rows.
"""

from django.db import transaction
from rest_framework import serializers

from .models import (
    EmployeeInfo,
    PolicyCategory,
    PolicyOption,
    Rule,
    RuleCondition,
    RuleScope,
)


class EmployeeInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeInfo
        fields = [
            "id",
            "name",
            "gender",
            "location",
            "country",
            "joining_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class PolicyCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PolicyCategory
        fields = ["id", "display_name", "type", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class PolicyOptionSerializer(serializers.ModelSerializer):
    # Handy read-only extra so clients don't need a second request.
    category_type = serializers.CharField(source="category.type", read_only=True)

    class Meta:
        model = PolicyOption
        fields = ["id", "category", "category_type", "meta", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class RuleConditionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RuleCondition
        fields = [
            "id",
            "rule",
            "employee_attribute",
            "operator",
            "value",
            "combinator",
        ]
        read_only_fields = ["id"]


class NestedRuleConditionSerializer(RuleConditionSerializer):
    """Same shape, minus `rule` -- the parent supplies it on create."""

    class Meta(RuleConditionSerializer.Meta):
        fields = [f for f in RuleConditionSerializer.Meta.fields if f != "rule"]


class RuleSerializer(serializers.ModelSerializer):
    conditions = NestedRuleConditionSerializer(many=True, required=False)

    class Meta:
        model = Rule
        fields = [
            "id",
            "outcome",
            "scope",
            "valid_from",
            "valid_to",
            "conditions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        """Cross-field checks -- the bits a plain field validator can't express."""
        valid_from = attrs.get("valid_from", getattr(self.instance, "valid_from", None))
        valid_to = attrs.get("valid_to", getattr(self.instance, "valid_to", None))
        if valid_from and valid_to and valid_to <= valid_from:
            raise serializers.ValidationError(
                {"valid_to": "valid_to must be after valid_from."}
            )

        scope = attrs.get("scope", getattr(self.instance, "scope", None))
        conditions = attrs.get("conditions")
        if scope == RuleScope.GLOBAL and conditions:
            raise serializers.ValidationError(
                {"conditions": "A GLOBAL rule must not carry conditions."}
            )
        if scope == RuleScope.CONDITIONAL and conditions == []:
            raise serializers.ValidationError(
                {"conditions": "A CONDITIONAL rule needs at least one condition."}
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        """Write the rule and its conditions in one POST."""
        conditions = validated_data.pop("conditions", [])
        rule = Rule.objects.create(**validated_data)
        for condition in conditions:
            RuleCondition.objects.create(rule=rule, **condition)
        return rule
