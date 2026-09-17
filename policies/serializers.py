"""
Serializers = validation + JSON shape. Roughly Zod schema + response mapper
in one object: they validate incoming POST bodies and render outgoing rows.
"""

from django.db import transaction
from rest_framework import serializers

from .models import (
    Attribute,
    AttributeSource,
    AttributeValue,
    EmployeeAttribute,
    EmployeeInfo,
    PolicyCategory,
    PolicyOption,
    Rule,
    RuleCondition,
    RuleScope,
)


class EmployeeInfoSerializer(serializers.ModelSerializer):
    """
    Identity plus a flat `{attribute_key: value}` map, so one GET gives the UI
    everything it needs to fill the form. Writes go to
    /api/employee-attributes/, which validates each value against its attribute.
    """

    attributes = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeInfo
        fields = [
            "id",
            "name",
            "attributes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_attributes(self, obj):
        return {row.attribute_id: row.value for row in obj.attributes.all()}


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


class AttributeValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttributeValue
        fields = ["id", "attribute", "value", "label", "active", "sort_order"]
        read_only_fields = ["id"]


class NestedAttributeValueSerializer(AttributeValueSerializer):
    """Same shape, minus `attribute` -- it is the parent in this context."""

    class Meta(AttributeValueSerializer.Meta):
        fields = [f for f in AttributeValueSerializer.Meta.fields if f != "attribute"]


class AttributeSerializer(serializers.ModelSerializer):
    """
    The form schema for one input: what to label it, which widget to render
    (`data_type`), and -- when `enumerated` -- the options to offer.
    """

    values = serializers.SerializerMethodField()

    class Meta:
        model = Attribute
        fields = [
            "key",
            "label",
            "data_type",
            "source",
            "enumerated",
            "compute_key",
            "values",
        ]

    def get_values(self, obj):
        active = [v for v in obj.values.all() if v.active]
        return NestedAttributeValueSerializer(active, many=True).data

    def validate(self, attrs):
        source = attrs.get("source", getattr(self.instance, "source", None))
        compute_key = attrs.get("compute_key", getattr(self.instance, "compute_key", ""))
        if source == AttributeSource.COMPUTED and not compute_key:
            raise serializers.ValidationError(
                {"compute_key": "A computed attribute needs a compute_key."}
            )
        if source == AttributeSource.ATTRIBUTE_TABLE and compute_key:
            raise serializers.ValidationError(
                {"compute_key": "Only computed attributes carry a compute_key."}
            )
        return attrs


class EmployeeAttributeSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="attribute.label", read_only=True)

    class Meta:
        model = EmployeeAttribute
        fields = [
            "id",
            "employee",
            "attribute",
            "label",
            "value",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        """Reject values a stored attribute cannot hold -- the form's guard rail."""
        attribute = attrs.get("attribute", getattr(self.instance, "attribute", None))
        value = attrs.get("value", getattr(self.instance, "value", None))
        if attribute is None or value is None:
            return attrs
        if attribute.source == AttributeSource.COMPUTED:
            raise serializers.ValidationError(
                {"attribute": f"'{attribute.key}' is computed at runtime, not stored."}
            )
        if attribute.enumerated:
            allowed = list(
                attribute.values.filter(active=True).values_list("value", flat=True)
            )
            if value not in allowed:
                raise serializers.ValidationError(
                    {"value": f"Not an allowed value for '{attribute.key}': {allowed}"}
                )
        return attrs
