from loguru import logger
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from tables.services.webhook_trigger_service import WebhookTriggerService
from tables.models.webhook_models import LocalhostWebhookConfig, NgrokWebhookConfig


def _re_register_webhooks(model_name: str, id_: int) -> None:
    logger.info(f"Triggered webhook re-registration for {model_name} ID: {id_}")
    try:
        registered = WebhookTriggerService().register_webhooks()
        if registered:
            logger.info("Successfully registered webhooks")
        else:
            logger.error("Register signal was sent but not delivered")
    except Exception:
        logger.exception(f"Error registering webhooks for {model_name} ID: {id_}")


@receiver(post_save, sender=NgrokWebhookConfig)
@receiver(post_save, sender=LocalhostWebhookConfig)
def webhook_config_post_save_handler(sender, instance, **_):
    _re_register_webhooks(sender.__name__, instance.pk)


@receiver(post_delete, sender=NgrokWebhookConfig)
@receiver(post_delete, sender=LocalhostWebhookConfig)
def webhook_config_post_delete_handler(sender, instance, **_):
    _re_register_webhooks(sender.__name__, instance.pk)
