from rest_framework import serializers

from tables.services.rbac.org_context_service import OrgContextService


def resolve_active_org_id(request) -> int:
    """Active org id for the request, resolved from the X-Organization-Id header
    and cached on the request under `_rbac_active_org_id` (the same key
    OrgScopedViewSetMixin uses), so it resolves at most once per request."""
    org_id = getattr(request, "_rbac_active_org_id", None)
    if org_id is None:
        org_id = OrgContextService().resolve(request=request)
        request._rbac_active_org_id = org_id
    return org_id


class OrgScopedPrimaryKeyRelatedField(serializers.PrimaryKeyRelatedField):
    """A ``PrimaryKeyRelatedField`` narrowed to the caller's active organization.

    Use for **write** fields that reference an org-scoped model (FK or M2M) so a
    pk belonging to another org is rejected exactly like a non-existent pk
    ("Invalid pk … object does not exist") — existence in another org is never
    revealed, consistent with the 404-on-cross-org policy.

    ``org_lookup`` is the ORM path from the related model to the org id:
    - default ``"org_id"`` for models that own an ``org`` FK directly (e.g. Agent);
    - e.g. ``"crew__org_id"`` for a model scoped via a parent.

    Requires the serializer context to carry ``request`` (the active org is read
    from the ``X-Organization-Id`` header via ``OrgContextService``). With no
    request in context (e.g. schema generation) the base queryset is used.
    """

    org_lookup = "org_id"

    def __init__(self, *args, org_lookup=None, **kwargs):
        if org_lookup is not None:
            self.org_lookup = org_lookup
        super().__init__(*args, **kwargs)

    def get_queryset(self):
        queryset = super().get_queryset()
        request = self.context.get("request")
        if request is None:
            return queryset
        return queryset.filter(**{self.org_lookup: resolve_active_org_id(request)})
