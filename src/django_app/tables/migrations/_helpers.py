from loguru import logger
from tables.constants.organization_constants import DEFAULT_ORGANIZATION_NAME


def assign_default_org(apps, model_label, *, batch_size=1000):
    """Backfill org_id to the DEFAULT_ORGANIZATION_NAME org for every row of
    `model_label` (e.g. "tables.Graph") whose org_id IS NULL.

    Idempotent (only NULL rows are touched) and chunked (batch_size rows per
    UPDATE) to avoid lock contention on large installs. Safe on fresh installs:
    if the default org does not exist yet, there is nothing to backfill.
    """
    organization_model = apps.get_model("tables", "Organization")
    target_model = apps.get_model(*model_label.split("."))

    default_org = organization_model.objects.filter(
        name=DEFAULT_ORGANIZATION_NAME
    ).first()
    if default_org is None:
        logger.warning(f"Can not get default organization: {DEFAULT_ORGANIZATION_NAME}")
        return

    while True:
        ids = list(
            target_model.objects.filter(org_id__isnull=True).values_list(
                "pk", flat=True
            )[:batch_size]
        )
        if not ids:
            break
        target_model.objects.filter(pk__in=ids).update(org_id=default_org.id)
