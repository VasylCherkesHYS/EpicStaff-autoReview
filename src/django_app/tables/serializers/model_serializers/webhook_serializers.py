from loguru import logger
from rest_framework import serializers

from tables.models.webhook_models import (
    NgrokWebhookConfig,
    VoiceSettings,
    WebhookTrigger,
    LocalhostWebhookConfig,
)


class NgrokWebhookConfigModelSerializer(serializers.ModelSerializer):
    webhook_full_url = serializers.SerializerMethodField()

    class Meta:
        model = NgrokWebhookConfig
        fields = [
            "id",
            "name",
            "auth_token",
            "domain",
            "region",
            "webhook_full_url",
        ]

    def get_webhook_full_url(self, instance: NgrokWebhookConfig):
        from tables.services.webhook_trigger_service import WebhookTriggerService

        try:
            return WebhookTriggerService().get_tunnel_url(ngrok_webhook_config=instance)
        except Exception as e:
            logger.error(f"Failed to read tunnel URL for '{instance.name}': {e}")
        return None


class LocalhostWebhookConfigModelSerializer(serializers.ModelSerializer):
    webhook_full_url = serializers.SerializerMethodField()

    class Meta:
        model = LocalhostWebhookConfig
        fields = ["id", "name", "domain", "webhook_full_url"]

    def get_webhook_full_url(self, instance: LocalhostWebhookConfig):
        from tables.services.webhook_trigger_service import WebhookTriggerService

        try:
            return WebhookTriggerService().get_localhost_tunnel_url(
                localhost_webhook_config=instance
            )
        except Exception as e:
            logger.error(
                f"Failed to read localhost tunnel URL for '{instance.name}': {e}"
            )
        return None


class WebhookTriggerSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookTrigger
        fields = "__all__"

    def validate(self, attrs):
        instance = self.instance or WebhookTrigger()
        for k, v in attrs.items():
            setattr(instance, k, v)
        try:
            instance.clean()
            instance.validate_unique()
        except serializers.ValidationError as e:
            raise serializers.ValidationError(
                e.message_dict if hasattr(e, "message_dict") else e.messages
            )
        return attrs


class VoiceSettingsSerializer(serializers.ModelSerializer):
    voice_stream_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = VoiceSettings
        fields = [
            "twilio_account_sid",
            "twilio_auth_token",
            "voice_agent",
            "ngrok_config",
            "voice_stream_url",
        ]

    def get_voice_stream_url(self, obj):
        if not obj.ngrok_config:
            return None
        from tables.services.webhook_trigger_service import WebhookTriggerService

        try:
            base = WebhookTriggerService().get_tunnel_url(
                ngrok_webhook_config=obj.ngrok_config
            )
        except Exception:
            base = None
        if not base and obj.ngrok_config.domain:
            base = f"https://{obj.ngrok_config.domain}"
        if base:
            return (
                base.rstrip("/")
                .replace("https://", "wss://")
                .replace("http://", "wss://")
                + "/voice/stream"
            )
        return None
