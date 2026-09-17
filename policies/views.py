"""
ViewSets are the Express router + controller collapsed into one class.
A ModelViewSet gives every CRUD route for free:

    GET    /api/<resource>/        list
    POST   /api/<resource>/        create
    GET    /api/<resource>/{id}/   retrieve
    PUT    /api/<resource>/{id}/   update
    PATCH  /api/<resource>/{id}/   partial update
    DELETE /api/<resource>/{id}/   destroy
"""

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

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
from .serializers import (
    AttributeSerializer,
    AttributeValueSerializer,
    EmployeeAttributeSerializer,
    EmployeeInfoSerializer,
    PolicyCategorySerializer,
    PolicyOptionSerializer,
    RuleConditionSerializer,
    RuleSerializer,
    RuleTimelineSerializer,
)


class EmployeeInfoViewSet(viewsets.ModelViewSet):
    """
    GET  /api/employees/               list employees with their attributes
    GET  /api/employees/?location=USA  filter by any attribute key
    POST /api/employees/               create an employee
    """

    # Only open rows are prefetched -- superseded history never reaches the
    # serialized current-state view.
    queryset = EmployeeInfo.objects.prefetch_related(
        Prefetch("attributes", queryset=EmployeeAttribute.open_for())
    ).all()
    serializer_class = EmployeeInfoSerializer

    def get_queryset(self):
        """Any query param naming an attribute filters on that attribute's value."""
        qs = super().get_queryset()
        keys = set(Attribute.objects.values_list("key", flat=True))
        for key, value in self.request.query_params.items():
            if key in keys:
                # One .filter() per key so several keys AND together rather
                # than collapsing onto a single attribute row. Superseded rows
                # are excluded: someone who moved must not still match their
                # old location.
                qs = qs.filter(
                    attributes__attribute_id=key,
                    attributes__value=value,
                    attributes__valid_to__isnull=True,
                )
        return qs

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        """
        GET /api/employees/{id}/timeline/

        Every attribute value this employee has ever had (newest first), each
        annotated with the rules whose conditions reference that attribute
        key -- so the dashboard can show "what might this have changed" next
        to each attribute change. Full point-in-time rule *resolution*
        (matching every condition, tenure bonuses, GLOBAL fallback) is not
        ported to Django yet -- see functions.ts:resolveScopedRules -- so this
        endpoint surfaces candidate rules rather than a resolved outcome.
        """
        employee = self.get_object()
        attribute_history = (
            employee.attributes.select_related("attribute")
            .order_by("-valid_from")
        )

        touched_keys = {row.attribute_id for row in attribute_history}
        conditions_by_key = {}
        if touched_keys:
            conditions = RuleCondition.objects.filter(
                employee_attribute__in=touched_keys
            ).select_related("rule", "rule__outcome", "rule__outcome__category")
            for condition in conditions:
                conditions_by_key.setdefault(condition.employee_attribute, []).append(
                    condition
                )

        events = []
        for row in attribute_history:
            related_conditions = conditions_by_key.get(row.attribute_id, [])
            rules_seen = {}
            for condition in related_conditions:
                rules_seen.setdefault(condition.rule_id, condition.rule)
            events.append(
                {
                    "id": row.id,
                    "attribute": AttributeSerializer(row.attribute).data,
                    "value": row.value,
                    "valid_from": row.valid_from,
                    "valid_to": row.valid_to,
                    "status": "active" if row.valid_to is None else "superseded",
                    "rules_referencing_attribute": RuleTimelineSerializer(
                        rules_seen.values(), many=True
                    ).data,
                }
            )

        return Response(
            {
                "employee": EmployeeInfoSerializer(employee).data,
                "attributeTimeline": events,
            }
        )


class PolicyCategoryViewSet(viewsets.ModelViewSet):
    queryset = PolicyCategory.objects.all()
    serializer_class = PolicyCategorySerializer


class PolicyOptionViewSet(viewsets.ModelViewSet):
    # select_related avoids the N+1 the `category_type` field would otherwise cause.
    queryset = PolicyOption.objects.select_related("category").all()
    serializer_class = PolicyOptionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        category_type = self.request.query_params.get("category_type")
        if category_type:
            qs = qs.filter(category__type=category_type.upper())
        return qs

    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        """
        GET /api/policy-options/{id}/timeline/

        Every rule ever written against this option (active and superseded),
        newest valid_from first -- the dashboard's per-option history view.
        """
        option = self.get_object()
        rules = (
            option.rules.select_related("outcome", "outcome__category")
            .prefetch_related("conditions")
            .order_by("-valid_from")
        )
        return Response(
            {
                "policyOption": PolicyOptionSerializer(option).data,
                "rules": RuleTimelineSerializer(rules, many=True).data,
            }
        )


class RuleViewSet(viewsets.ModelViewSet):
    """
    GET  /api/rules/                 rules with their conditions; superseded
                                     rules (valid_to in the past) are hidden
    GET  /api/rules/?history=true    include superseded rules, for the
                                     history tab
    POST /api/rules/                 create a rule (conditions nested inline)
    GET  /api/rules/active/          only rules in effect right now
    """

    queryset = Rule.objects.select_related("outcome").prefetch_related("conditions")
    serializer_class = RuleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Policy Studio shows current state only -- a rule whose valid_to has
        # passed belongs in the history tab, which opts back in with
        # ?history=true. Same convention as EmployeeAttributeViewSet.
        if self.action == "list" and self.request.query_params.get("history") != "true":
            qs = qs.exclude(valid_to__lte=timezone.now())
        if self.request.query_params.get("active") == "true":
            qs = self._active(qs)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(outcome__category_id=category)
        return qs

    @staticmethod
    def _active(qs):
        now = timezone.now()
        return qs.filter(valid_from__lte=now).filter(valid_to__isnull=True) | qs.filter(
            valid_from__lte=now, valid_to__gt=now
        )

    @action(detail=False, methods=["get"])
    def active(self, request):
        """A custom route, mounted by the router at /api/rules/active/."""
        serializer = self.get_serializer(self._active(self.queryset), many=True)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        """Close the rule instead of deleting -- preserves it in history."""
        instance.valid_to = timezone.now()
        instance.save(update_fields=["valid_to"])


class RuleConditionViewSet(viewsets.ModelViewSet):
    queryset = RuleCondition.objects.all()
    serializer_class = RuleConditionSerializer


class AttributeViewSet(viewsets.ModelViewSet):
    """
    GET /api/attributes/  the form schema: every attribute with its allowed
                          values inlined, so the UI renders inputs in one call.
                          ?source=attribute_table drops computed attributes.
    """

    queryset = Attribute.objects.prefetch_related("values").all()
    serializer_class = AttributeSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        source = self.request.query_params.get("source")
        if source:
            qs = qs.filter(source=source)
        return qs


class AttributeValueViewSet(viewsets.ModelViewSet):
    """GET /api/attribute-values/?attribute=location  options for one input."""

    queryset = AttributeValue.objects.all()
    serializer_class = AttributeValueSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        attribute = self.request.query_params.get("attribute")
        if attribute:
            qs = qs.filter(attribute_id=attribute)
        if self.request.query_params.get("active") == "true":
            qs = qs.filter(active=True)
        return qs


class EmployeeAttributeViewSet(viewsets.ModelViewSet):
    """
    The submitted form, one row per input:
        GET  /api/employee-attributes/?employee=<id>
        POST /api/employee-attributes/   {employee, attribute, value}
    """

    queryset = EmployeeAttribute.objects.select_related("attribute").all()
    serializer_class = EmployeeAttributeSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        employee = self.request.query_params.get("employee")
        if employee:
            qs = qs.filter(employee_id=employee)
        if self.request.query_params.get("history") != "true":
            qs = qs.filter(valid_to__isnull=True)
        return qs

    def perform_destroy(self, instance):
        """Close the attribute row instead of deleting -- preserves it in history."""
        instance.valid_to = timezone.now()
        instance.save(update_fields=["valid_to"])
