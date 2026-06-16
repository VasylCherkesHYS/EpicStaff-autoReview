import json
from dataclasses import dataclass

from rest_framework.exceptions import ValidationError as DRFValidationError

from tables.models.graph_models import (
    ClassificationConditionGroup,
    ClassificationDecisionTableNode,
    ClassificationDecisionTablePrompt,
)
from tables.serializers.model_serializers.node_serializers.flow_control_serializers import (
    ClassificationDecisionTableNodeSerializer,
)
from tables.import_export.enums import EntityType
from tables.import_export.registry import entity_registry
from tables.import_export.services.partial_export_service import (
    GraphPartialExportService,
    NodeRef,
)
from tables.import_export.tabular.classification_decision_table import (
    export_condition_groups_csv,
)
from tables.utils.helpers import generate_file_name


@dataclass
class NodeExportResult:
    """Payload for the view to turn into an HTTP response."""

    content: str | None = None
    content_type: str | None = None
    filename: str | None = None
    errors: list | None = None


class ClassificationDecisionTableNodeService:
    def __init__(self):
        self._partial_export_service = GraphPartialExportService(entity_registry)

    def create_or_update(
        self,
        data: dict,
        instance: ClassificationDecisionTableNode | None = None,
        partial: bool = False,
    ) -> tuple[ClassificationDecisionTableNode, list | None]:
        data = data.copy()
        condition_groups_data = data.pop("condition_groups", None)
        prompt_configs_data = data.pop("prompt_configs", None)

        serializer = ClassificationDecisionTableNodeSerializer(
            instance, data=data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        node = serializer.save()

        if partial and condition_groups_data is None and prompt_configs_data is None:
            return node, None

        if prompt_configs_data is not None:
            self._sync_prompt_configs(node, prompt_configs_data)

        if condition_groups_data is not None:
            self._sync_condition_groups(node, condition_groups_data, instance)

        return node, condition_groups_data

    def export(self, pk, export_format: str = "json") -> NodeExportResult:
        export_format = (export_format or "json").lower()
        if export_format not in ("json", "csv"):
            raise DRFValidationError(
                {"export_format": "Unsupported format. Use 'json' or 'csv'."}
            )

        if export_format == "csv":
            node = ClassificationDecisionTableNode.objects.select_related(
                "default_llm_config__model"
            ).get(pk=pk)
            buf = export_condition_groups_csv(node)
            return NodeExportResult(
                content=buf.getvalue(),
                content_type="text/csv",
                filename=f"CDT_{node.node_name}.csv",
            )

        # JSON: reuse the partial-export pipeline so the file is identical in
        # structure to a partial export (and re-importable via partial-import).
        node = ClassificationDecisionTableNode.objects.get(pk=pk)
        result = self._partial_export_service.export(
            [
                NodeRef(
                    entity_type=EntityType.CLASSIFICATION_DECISION_TABLE_NODE,
                    node_id=node.id,
                )
            ]
        )
        if result.has_errors:
            return NodeExportResult(errors=result.errors)

        return NodeExportResult(
            content=json.dumps(result.data, indent=4),
            content_type="application/json",
            filename=generate_file_name(f"{node.node_name}", prefix="CDT"),
        )

    def _sync_prompt_configs(self, node, prompt_configs_data: list) -> None:
        incoming_keys = {pd["prompt_key"] for pd in prompt_configs_data}
        ClassificationDecisionTablePrompt.objects.filter(cdt_node=node).exclude(
            prompt_key__in=incoming_keys
        ).delete()
        for prompt_data in prompt_configs_data:
            defaults = {
                k: v
                for k, v in prompt_data.items()
                if k not in ("prompt_key", "id", "cdt_node")
            }
            ClassificationDecisionTablePrompt.objects.update_or_create(
                cdt_node=node,
                prompt_key=prompt_data["prompt_key"],
                defaults=defaults,
            )

    def _sync_condition_groups(
        self,
        node,
        condition_groups_data: list,
        instance: ClassificationDecisionTableNode | None,
    ) -> None:
        prompt_by_id = {
            p.id: p
            for p in ClassificationDecisionTablePrompt.objects.filter(cdt_node=node)
        }
        incoming_route_codes = {
            gd["route_code"] for gd in condition_groups_data if gd.get("route_code")
        }
        incoming_names = {
            gd["group_name"]
            for gd in condition_groups_data
            if not gd.get("route_code") and gd.get("group_name")
        }
        if instance:
            node.condition_groups.exclude(route_code__isnull=True).exclude(
                route_code__in=incoming_route_codes
            ).delete()
            node.condition_groups.filter(route_code__isnull=True).exclude(
                group_name__in=incoming_names
            ).delete()

        existing_by_rc = {}
        existing_by_name = {}
        if instance:
            for g in node.condition_groups.all():
                if g.route_code:
                    existing_by_rc[g.route_code] = g
                else:
                    existing_by_name[g.group_name] = g

        excluded = {"id", "classification_decision_table_node"}
        to_bulk_update = []
        to_bulk_create = []

        for group_data in condition_groups_data:
            gd = {k: v for k, v in group_data.items() if k not in excluded}

            old_prompt_id = gd.pop("prompt", None)
            if old_prompt_id is not None:
                gd["prompt"] = prompt_by_id.get(old_prompt_id)

            rc = gd.get("route_code")
            existing = (
                existing_by_rc.get(rc)
                if rc
                else existing_by_name.get(gd.get("group_name"))
            )
            if existing is not None:
                for attr, val in gd.items():
                    setattr(existing, attr, val)
                to_bulk_update.append(existing)
            else:
                to_bulk_create.append(
                    ClassificationConditionGroup(
                        classification_decision_table_node=node, **gd
                    )
                )

        if to_bulk_update:
            ClassificationConditionGroup.objects.bulk_update(
                to_bulk_update,
                [
                    "group_name",
                    "order",
                    "expression",
                    "prompt",
                    "manipulation",
                    "continue_flag",
                    "next_node_id",
                    "dock_visible",
                    "field_expressions",
                    "field_manipulations",
                    "section",
                ],
            )
        if to_bulk_create:
            ClassificationConditionGroup.objects.bulk_create(to_bulk_create)
