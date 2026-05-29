import pytest
from django.urls import reverse

from tables.models.graph_models import Graph
from tables.models.webhook_models import (
    LocalhostWebhookConfig,
    NgrokWebhookConfig,
    ProviderType,
    WebhookTrigger,
)


@pytest.mark.django_db
class TestWebhookTriggerAndNodeAPI:
    def test_create_webhook_trigger(self, auth_client):
        """
        Basic smoke test for /api/webhook-triggers/ create endpoint.
        Creates a trigger with no provider (provider_type=None).
        """
        url = reverse("webhooktrigger-list")
        payload = {
            "path": "myWebhook123",
            "provider_type": None,
        }

        response = auth_client.post(url, payload, format="json")

        assert response.status_code == 201
        assert WebhookTrigger.objects.count() == 1
        trigger = WebhookTrigger.objects.first()
        assert trigger.path == "myWebhook123"
        assert trigger.provider_type is None

    def test_create_webhook_trigger_node_with_nested_trigger(
        self, auth_client, graph: Graph
    ):
        """
        Ensure /api/webhook-trigger-nodes/ accepts nested webhook_trigger payload
        with no provider and links node to the corresponding WebhookTrigger.
        """
        url = reverse("webhooktriggernode-list")

        payload = {
            "node_name": "My Webhook Trigger",
            "graph": graph.id,
            "python_code": {
                "libraries": ["requests"],
                "code": "def handler(event, context):\n    return event",
                "entrypoint": "handler",
                "global_kwargs": {},
            },
            "webhook_trigger": {
                "path": "myWebhookNested",
                "provider_type": None,
            },
            "metadata": {},
        }

        response = auth_client.post(url, payload, format="json")

        assert response.status_code == 201
        data = response.json()
        assert data["node_name"] == "My Webhook Trigger"
        assert data["webhook_trigger"]["path"] == "myWebhookNested"

        # WebhookTrigger should be created with no provider type
        trigger = WebhookTrigger.objects.get(path="myWebhookNested")
        assert trigger.provider_type is None

    def test_create_webhook_trigger_node_with_ngrok_trigger(
        self, auth_client, graph: Graph
    ):
        """
        Ensure /api/webhook-trigger-nodes/ accepts a nested ngrok webhook_trigger
        and creates both the WebhookTrigger and the linked NgrokWebhookConfig.
        """
        url = reverse("webhooktriggernode-list")

        payload = {
            "node_name": "My Ngrok Webhook Trigger",
            "graph": graph.id,
            "python_code": {
                "libraries": [],
                "code": "def handler(event, context):\n    return event",
                "entrypoint": "handler",
                "global_kwargs": {},
            },
            "webhook_trigger": {
                "path": "myNgrokWebhook",
                "provider_type": "ngrok",
                "ngrok_config": {
                    "name": "test-ngrok",
                    "auth_token": "test-token-abc",
                    "domain": None,
                },
            },
            "metadata": {},
        }

        response = auth_client.post(url, payload, format="json")

        assert response.status_code == 201
        data = response.json()
        assert data["node_name"] == "My Ngrok Webhook Trigger"
        assert data["webhook_trigger"]["path"] == "myNgrokWebhook"

        trigger = WebhookTrigger.objects.get(path="myNgrokWebhook")
        assert trigger.provider_type == ProviderType.NGROK
        assert NgrokWebhookConfig.objects.filter(trigger=trigger).exists()

    def test_create_webhook_trigger_node_with_localhost_trigger(
        self, auth_client, graph: Graph
    ):
        """
        Ensure /api/webhook-trigger-nodes/ accepts a nested localhost webhook_trigger
        and creates both the WebhookTrigger and the linked LocalhostWebhookConfig.
        """
        url = reverse("webhooktriggernode-list")

        payload = {
            "node_name": "My Localhost Webhook Trigger",
            "graph": graph.id,
            "python_code": {
                "libraries": [],
                "code": "def handler(event, context):\n    return event",
                "entrypoint": "handler",
                "global_kwargs": {},
            },
            "webhook_trigger": {
                "path": "myLocalhostWebhook",
                "provider_type": "localhost",
                "localhost_config": {
                    "name": "test-localhost",
                    "domain": "localhost:8080",
                },
            },
            "metadata": {},
        }

        response = auth_client.post(url, payload, format="json")

        assert response.status_code == 201
        data = response.json()
        assert data["node_name"] == "My Localhost Webhook Trigger"
        assert data["webhook_trigger"]["path"] == "myLocalhostWebhook"

        trigger = WebhookTrigger.objects.get(path="myLocalhostWebhook")
        assert trigger.provider_type == ProviderType.LOCALHOST
        assert LocalhostWebhookConfig.objects.filter(trigger=trigger).exists()
