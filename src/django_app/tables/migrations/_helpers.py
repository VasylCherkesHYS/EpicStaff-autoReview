from loguru import logger

from tables.constants.organization_constants import DEFAULT_ORGANIZATION_NAME


def resolve_default_org(apps):
    """Resolve-or-create the default Organization at migration time.

    Resolution is by case-insensitive name only — this runs inside the
    migration chain before the `is_default` column exists (added later in
    0188), so the flag cannot be referenced here. The runtime helper
    (SuperadminBootstrap) is flag-first; this is migration-time bootstrap.
    Idempotent: returns the existing row if already present.
    """
    organization_model = apps.get_model("tables", "Organization")
    org = organization_model.objects.filter(
        name__iexact=DEFAULT_ORGANIZATION_NAME
    ).first()
    if org is not None:
        return org
    return organization_model.objects.create(name=DEFAULT_ORGANIZATION_NAME)


def assign_default_org(apps, model_label, org, *, batch_size=1000):
    """Backfill org_id to `org` for every row of `model_label`
    (e.g. "tables.Graph") whose org_id IS NULL.

    Idempotent (only NULL rows are touched) and chunked (batch_size rows per
    UPDATE) to avoid lock contention on large installs.
    """
    target_model = apps.get_model(*model_label.split("."))
    while True:
        ids = list(
            target_model.objects.filter(org_id__isnull=True).values_list(
                "pk", flat=True
            )[:batch_size]
        )
        if not ids:
            break
        target_model.objects.filter(pk__in=ids).update(org_id=org.id)
    logger.info(f"Backfilled org_id={org.id} on {model_label} (NULL rows)")
