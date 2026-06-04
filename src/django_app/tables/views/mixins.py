from django.db import transaction
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from tables.services.rbac.org_context_service import OrgContextService


class CopyActionMixin:
    """Mixin that adds a ``copy`` action to a ViewSet.

    Requires two class attributes:
        copy_service_class: Copy service to instantiate.
        copy_serializer_class: Serializer for the response.
    """

    copy_service_class = None
    copy_serializer_class = None

    @action(detail=True, methods=["post"], url_path="copy")
    def copy(self, request, pk: int):
        instance = self.get_object()
        name = request.data.get("name") if isinstance(request.data, dict) else None
        # Org-scoped viewsets stamp the copy with the active org so the new row
        # satisfies the NOT NULL org constraint. Non-org-scoped viewsets (e.g.
        # tool copies) don't expose get_active_org_id and copy without an org.
        extra = {}
        if hasattr(self, "get_active_org_id"):
            extra["org_id"] = self.get_active_org_id()
        try:
            with transaction.atomic():
                new_instance = self.copy_service_class().copy(
                    instance, name=name, **extra
                )
        except Exception as e:
            return Response({"message": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            self.copy_serializer_class(new_instance).data,
            status=status.HTTP_201_CREATED,
        )


class _OrgResolverMixin:
    """Resolves and caches the active org id for the request.

    Relies on IsAuthenticated running first (request.user is authenticated).
    Pairs with HasOrgPermission, which uses the same OrgContextService.
    """

    _org_context = OrgContextService()

    def get_active_org_id(self) -> int:
        if not hasattr(self.request, "_rbac_active_org_id"):
            self.request._rbac_active_org_id = self._org_context.resolve(
                request=self.request, view_kwargs=self.kwargs
            )
        return self.request._rbac_active_org_id


class OrgScopedViewSetMixin(_OrgResolverMixin):
    """For top-level resources that own an `org` FK directly.

    Place FIRST in the ViewSet's base list so get_queryset/perform_create
    wrap the concrete ViewSet base.
    """

    def get_queryset(self):
        return super().get_queryset().filter(org_id=self.get_active_org_id())

    def perform_create(self, serializer):
        serializer.save(org_id=self.get_active_org_id(), created_by=self.request.user)


class OrgScopedChildViewSetMixin(_OrgResolverMixin):
    """For child resources scoped transitively through a parent FK.

    Set `org_filter_path` to the ORM lookup that reaches the owning org,
    e.g. "graph__org_id", "crew__org_id", "agent__org_id". Does not stamp
    org on create (children have no org column; the parent FK carries it).
    """

    org_filter_path: str = None

    def get_queryset(self):
        if not self.org_filter_path:
            raise NotImplementedError(
                f"{self.__class__.__name__} must set org_filter_path."
            )
        return (
            super()
            .get_queryset()
            .filter(**{self.org_filter_path: self.get_active_org_id()})
        )

    def perform_create(self, serializer):
        # A child may only be created under a parent that lives in the active
        # org — otherwise a caller could attach a child to another org's parent.
        self._assert_parent_in_active_org(serializer)
        serializer.save()

    def _assert_parent_in_active_org(self, serializer):
        if not self.org_filter_path:
            return
        parent_field = self.org_filter_path.split("__")[0]
        parent = serializer.validated_data.get(parent_field)
        if parent is not None and getattr(parent, "org_id", None) != (
            self.get_active_org_id()
        ):
            raise NotFound()
