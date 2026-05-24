from django.db.models.signals import post_delete


def _delete_owned_inline_surface(sender, instance, **kwargs):
    inline_surface_id = getattr(instance, "inline_surface_id", None)
    if inline_surface_id:
        from tables.models import InlineSurface

        InlineSurface.objects.filter(pk=inline_surface_id).delete()


def register_inline_surface_cascade():
    from tables.models.base_models import InlineSurfaceMixin

    for subclass in InlineSurfaceMixin.__subclasses__():
        if subclass._meta.abstract:
            continue
        post_delete.connect(
            _delete_owned_inline_surface,
            sender=subclass,
            dispatch_uid=f"delete_owned_inline_surface_{subclass._meta.label}",
        )


register_inline_surface_cascade()
