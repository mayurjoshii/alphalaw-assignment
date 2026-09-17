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
)


class EmployeeInfoViewSet(viewsets.ModelViewSet):
    """
    GET  /api/employees/               list employees with their attributes
    GET  /api/employees/?location=USA  filter by any attribute key
    POST /api/employees/               create an employee
    """

    queryset = EmployeeInfo.objects.prefetch_related("attributes").all()
    serializer_class = EmployeeInfoSerializer

    def get_queryset(self):
        """Any query param naming an attribute filters on that attribute's value."""
        qs = super().get_queryset()
        keys = set(Attribute.objects.values_list("key", flat=True))
        for key, value in self.request.query_params.items():
            if key in keys:
                # One .filter() per key so several keys AND together rather
                # than collapsing onto a single attribute row.
                qs = qs.filter(attributes__attribute_id=key, attributes__value=value)
        return qs


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


class RuleViewSet(viewsets.ModelViewSet):
    """
    GET  /api/rules/           list rules with their conditions, ?active=true
    POST /api/rules/           create a rule (conditions can be nested inline)
    GET  /api/rules/active/    only rules in effect right now
    """

    queryset = Rule.objects.select_related("outcome").prefetch_related("conditions")
    serializer_class = RuleSerializer

    def get_queryset(self):
        qs = super().get_queryset()
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
