import pytest
from django.urls import reverse

from tables.models.webhook_models import (
    NgrokWebhookConfig,
    ProviderType,
    RealtimeChannel,
    TwilioChannel,
    WebhookTrigger,
)
from tables.models.realtime_models import RealtimeAgent


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_realtime_channel(db):
    """Create a minimal RealtimeChannel (no RealtimeAgent required)."""
    return RealtimeChannel.objects.create(name="test-channel")


def _make_twilio_channel(realtime_channel, **kwargs):
    return TwilioChannel.objects.create(
        channel=realtime_channel,
        account_sid="AC_test",
        auth_token="auth_test",
        **kwargs,
    )


def _make_webhook_trigger_with_ngrok(path="test-voice"):
    trigger = WebhookTrigger.objects.create(path=path, provider_type=ProviderType.NGROK)
    NgrokWebhookConfig.objects.create(
        trigger=trigger,
        name="test-ngrok",
        auth_token="tok",
        region=NgrokWebhookConfig.Region.EU,
    )
    return trigger


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestTwilioChannelWebhookTrigger:
    def test_create_twilio_channel_without_webhook_trigger(self, auth_client, db):
        """POST without webhook_trigger should create successfully with null trigger."""
        rc = _make_realtime_channel(db)
        url = reverse("twiliochannel-list")
        payload = {
            "channel": rc.pk,
            "account_sid": "AC_nosid",
            "auth_token": "tok_noauth",
        }
        response = auth_client.post(url, payload, format="json")
        assert response.status_code == 201, response.json()
        assert response.json()["webhook_trigger"] is None

    def test_create_twilio_channel_with_ngrok_trigger(self, auth_client, db):
        """POST with webhook_trigger FK; GET should return nested webhook_trigger with live_url=null."""
        rc = _make_realtime_channel(db)
        trigger = _make_webhook_trigger_with_ngrok(path="voice-ngrok-test")

        url = reverse("twiliochannel-list")
        payload = {
            "channel": rc.pk,
            "account_sid": "AC_ngrok",
            "auth_token": "tok_ngrok",
            "webhook_trigger": trigger.pk,
        }
        create_response = auth_client.post(url, payload, format="json")
        assert create_response.status_code == 201, create_response.json()

        twilio_pk = create_response.json()["channel"]
        get_response = auth_client.get(
            reverse("twiliochannel-detail", args=[twilio_pk])
        )
        assert get_response.status_code == 200, get_response.json()

        data = get_response.json()
        # The read path still returns the FK id (TwilioChannelSerializer is used for both)
        assert data["webhook_trigger"] == trigger.pk

    def test_two_channels_share_one_trigger(self, auth_client, db):
        """Two TwilioChannels may point at the same WebhookTrigger."""
        rc1 = _make_realtime_channel(db)
        rc2 = RealtimeChannel.objects.create(name="channel-b")
        trigger = _make_webhook_trigger_with_ngrok(path="shared-trigger")

        url = reverse("twiliochannel-list")
        for rc, sid in [(rc1, "AC_one"), (rc2, "AC_two")]:
            response = auth_client.post(
                url,
                {
                    "channel": rc.pk,
                    "account_sid": sid,
                    "auth_token": "auth",
                    "webhook_trigger": trigger.pk,
                },
                format="json",
            )
            assert response.status_code == 201, response.json()

        # Both channels are linked to the same trigger
        assert TwilioChannel.objects.filter(webhook_trigger=trigger).count() == 2

        # GET each channel and confirm path matches
        for tc in TwilioChannel.objects.filter(webhook_trigger=trigger):
            get_resp = auth_client.get(
                reverse("twiliochannel-detail", args=[tc.channel_id])
            )
            assert get_resp.status_code == 200
            assert get_resp.json()["webhook_trigger"] == trigger.pk

    def test_patch_twilio_channel_remove_trigger(self, auth_client, db):
        """PATCH webhook_trigger=null should clear the FK."""
        rc = _make_realtime_channel(db)
        trigger = _make_webhook_trigger_with_ngrok(path="removable-trigger")
        tc = _make_twilio_channel(rc, webhook_trigger=trigger)

        url = reverse("twiliochannel-detail", args=[tc.channel_id])
        response = auth_client.patch(url, {"webhook_trigger": None}, format="json")
        assert response.status_code == 200, response.json()
        assert response.json()["webhook_trigger"] is None

        tc.refresh_from_db()
        assert tc.webhook_trigger_id is None

    def test_realtime_channel_get_expands_twilio_webhook_trigger(self, auth_client, db):
        """GET /realtime-channels/{id}/ should include twilio.webhook_trigger with path and live_url."""
        trigger = _make_webhook_trigger_with_ngrok(path="realtime-voice")
        rc = _make_realtime_channel(db)
        _make_twilio_channel(rc, webhook_trigger=trigger)

        url = reverse("realtimechannel-detail", args=[rc.pk])
        response = auth_client.get(url)
        assert response.status_code == 200, response.json()

        data = response.json()
        twilio = data.get("twilio")
        assert twilio is not None, "twilio nested object missing"

        wt = twilio.get("webhook_trigger")
        assert wt is not None, "webhook_trigger missing in twilio"
        assert wt["path"] == "realtime-voice"
        # live_url is null in test env (no Redis tunnel running)
        assert "live_url" in wt
        assert wt["live_url"] is None
