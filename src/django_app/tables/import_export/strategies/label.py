from tables.import_export.strategies.base import EntityImportExportStrategy
from tables.import_export.serializers.label import LabelImportSerializer
from tables.import_export.id_mapper import IDMapper
from tables.import_export.enums import EntityType
from tables.models import Graph
from tables.models.label_models import Label


class LabelStrategy(EntityImportExportStrategy):
    entity_type = EntityType.LABEL
    serializer_class = LabelImportSerializer

    def get_instance(self, entity_id: int):
        return Label.objects.filter(id=entity_id).first()

    def extract_dependencies_from_instance(self, instance: Label):
        return {}

    def export_entity(self, instance: Label) -> dict:
        return LabelImportSerializer(instance).data

    def export_graph_labels(self, graph: Graph) -> list:
        return list(graph.labels.values_list("id", flat=True))

    def find_existing(self, data: dict, id_mapper: IDMapper):
        old_parent_id = data.get("parent")
        parent_id = (
            id_mapper.get_or_none(EntityType.LABEL, old_parent_id)
            if old_parent_id
            else None
        )
        return Label.objects.filter(name=data["name"], parent_id=parent_id).first()

    def create_entity(self, data: dict, id_mapper: IDMapper, **kwargs) -> Label:
        old_parent_id = data.get("parent")
        parent_id = (
            id_mapper.get_or_none(EntityType.LABEL, old_parent_id)
            if old_parent_id
            else None
        )
        label, _ = Label.objects.get_or_create(name=data["name"], parent_id=parent_id)
        return label

    def attach_labels_to_graph(
        self, graph: Graph, id_mapper: IDMapper, label_ids: list
    ) -> None:
        new_label_ids = [
            id_mapper.get(EntityType.LABEL, old_id) for old_id in label_ids
        ]
        if new_label_ids:
            graph.labels.add(*Label.objects.filter(id__in=new_label_ids))
