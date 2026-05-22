from tables.models import Graph
from tables.models.label_models import Label


class LabelStrategy:
    def export(self, instance: Graph) -> list:
        return [label.full_path for label in instance.labels.all()]

    def import_labels(self, graph: Graph, label_paths: list) -> None:
        labels = [self._resolve_path(path) for path in label_paths]
        labels = [label for label in labels if label is not None]
        if labels:
            graph.labels.add(*labels)

    def _resolve_path(self, path: str):
        parts = path.split("/")
        parent = None
        label = None
        for part in parts:
            label, _ = Label.objects.get_or_create(name=part, parent=parent)
            parent = label
        return label
