from rest_framework import serializers

from tables.models.webhook_models import (
    NgrokWebhookConfig,
    RealtimeChannel,
    TwilioChannel,
)
from tables.models.realtime_models import (
    ConversationRecording,
    ElevenLabsRealtimeConfig,
    GeminiRealtimeConfig,
    OpenAIRealtimeConfig,
    RealtimeAgent,
    RealtimeAgentChat,
    RealtimeSessionItem,
)


class RealtimeAgentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RealtimeAgent
        exclude = ["agent"]


class RealtimeSessionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RealtimeSessionItem
        fields = "__all__"


class RealtimeAgentChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = RealtimeAgentChat
        fields = "__all__"


class OpenAIRealtimeConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = OpenAIRealtimeConfig
        fields = "__all__"


class ElevenLabsRealtimeConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ElevenLabsRealtimeConfig
        fields = "__all__"


class GeminiRealtimeConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeminiRealtimeConfig
        fields = "__all__"


class TwilioChannelSerializer(serializers.ModelSerializer):
    class Meta:
        model = TwilioChannel
        fields = "__all__"


class _NgrokConfigMinimalSerializer(serializers.ModelSerializer):
    live_url = serializers.SerializerMethodField()

    class Meta:
        model = NgrokWebhookConfig
        fields = ["id", "domain", "live_url"]

    def get_live_url(self, instance: NgrokWebhookConfig):
        from tables.services.webhook_trigger_service import WebhookTriggerService

        try:
            return WebhookTriggerService().get_tunnel_url(ngrok_webhook_config=instance)
        except Exception:
            return None


class _TwilioChannelReadSerializer(serializers.ModelSerializer):
    """Read-only variant that expands ngrok_config so downstream consumers get the domain."""

    ngrok_config = _NgrokConfigMinimalSerializer(read_only=True)

    class Meta:
        model = TwilioChannel
        fields = "__all__"


class RealtimeChannelSerializer(serializers.ModelSerializer):
    twilio = _TwilioChannelReadSerializer(read_only=True)

    class Meta:
        model = RealtimeChannel
        fields = "__all__"


class ConversationRecordingSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from tables.models.realtime_models import (
            RealtimeAgentChat as _RealtimeAgentChat,
        )

        self.fields["rt_agent_chat"] = serializers.PrimaryKeyRelatedField(
            queryset=_RealtimeAgentChat.objects.all(),
            required=False,
            allow_null=True,
        )

    class Meta:
        model = ConversationRecording
        fields = "__all__"
        read_only_fields = ["file_size", "audio_format", "created_at"]


class RealtimeAgentReadSerializer(serializers.ModelSerializer):
    openai_config = OpenAIRealtimeConfigSerializer(read_only=True)
    elevenlabs_config = ElevenLabsRealtimeConfigSerializer(read_only=True)
    gemini_config = GeminiRealtimeConfigSerializer(read_only=True)

    class Meta:
        model = RealtimeAgent
        exclude = ["agent"]


class RealtimeAgentWriteSerializer(serializers.ModelSerializer):
    voice = serializers.CharField(allow_blank=True, default="alloy")

    class Meta:
        model = RealtimeAgent
        exclude = ["agent"]

    def validate(self, attrs):
        openai_config = attrs.get(
            "openai_config", getattr(self.instance, "openai_config", None)
        )
        elevenlabs_config = attrs.get(
            "elevenlabs_config", getattr(self.instance, "elevenlabs_config", None)
        )
        gemini_config = attrs.get(
            "gemini_config", getattr(self.instance, "gemini_config", None)
        )

        set_count = sum(
            [
                openai_config is not None,
                elevenlabs_config is not None,
                gemini_config is not None,
            ]
        )

        if set_count > 1:
            raise serializers.ValidationError(
                "A RealtimeAgent may have at most one provider config set "
                "(openai_config, elevenlabs_config, or gemini_config)."
            )

        return attrs
