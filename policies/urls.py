"""
DefaultRouter turns each ViewSet into a full set of URLs -- the equivalent of
wiring up an express.Router() and mounting it.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AttributeValueViewSet,
    AttributeViewSet,
    EmployeeAttributeViewSet,
    EmployeeInfoViewSet,
    PolicyCategoryViewSet,
    PolicyOptionViewSet,
    RuleConditionViewSet,
    RuleViewSet,
)

router = DefaultRouter()
router.register("employees", EmployeeInfoViewSet, basename="employee")
router.register("policy-categories", PolicyCategoryViewSet, basename="policy-category")
router.register("policy-options", PolicyOptionViewSet, basename="policy-option")
router.register("rules", RuleViewSet, basename="rule")
router.register("rule-conditions", RuleConditionViewSet, basename="rule-condition")
router.register("attributes", AttributeViewSet, basename="attribute")
router.register("attribute-values", AttributeValueViewSet, basename="attribute-value")
router.register(
    "employee-attributes", EmployeeAttributeViewSet, basename="employee-attribute"
)

urlpatterns = [path("", include(router.urls))]
