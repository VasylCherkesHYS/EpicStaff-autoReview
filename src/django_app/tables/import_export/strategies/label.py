from tables.import_export.strategies.base import EntityImportExportStrategy
from tables.import_export.id_mapper import IDMapper
from tables.models import Graph
from tables.models.label_models import Label


class LabelStrategy(EntityImportExportStrategy):
    entity_type = None

    def get_instance(self, entity_id: int):
        return Label.objects.filter(id=entity_id).first()

    def extract_dependencies_from_instance(self, instance):
        return {}

    def export_entity(self, instance: Graph) -> list:
        return [label.full_path for label in instance.labels.all()]

    def create_entity(
        self, data: Graph, id_mapper: IDMapper, label_paths: list, **kwargs
    ) -> None:
        labels = [self._resolve_path(path) for path in label_paths]
        labels = [label for label in labels if label is not None]
        if labels:
            data.labels.add(*labels)

    def _resolve_path(self, path: str):
        parts = path.split("/")
        parent = None
        label = None
        for part in parts:
            label, _ = Label.objects.get_or_create(name=part, parent=parent)
            parent = label
        return label
