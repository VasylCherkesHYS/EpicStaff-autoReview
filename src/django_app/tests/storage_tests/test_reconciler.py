import pytest

from tables.models import Organization, StorageFile
from tables.services.storage_service.reconciler import StorageReconciler


pytestmark = pytest.mark.django_db


@pytest.fixture
def org(db):
    return Organization.objects.create(name="reconciler-org")


@pytest.fixture
def local_manager_backend(tmp_path):
    """LocalStorageBackend with empty prefix — mirrors how get_storage_manager() sets it up."""
    from tables.services.storage_service.local_backend import LocalStorageBackend

    return LocalStorageBackend(root=str(tmp_path), organization_prefix="")


def _seed_file(backend_root, org_id, rel_path, content=b"data"):
    """Write a real file under org_<id>/<rel_path> in the backend root directory."""
    from pathlib import Path

    full_path = Path(backend_root) / f"org_{org_id}" / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(content)


class TestReconcileTree:
    def test_creates_file_rows_with_size_and_parent_path(
        self, org, local_manager_backend, tmp_path
    ):
        _seed_file(str(tmp_path), org.id, "a/b/file.txt", content=b"hello")
        StorageReconciler(local_manager_backend).reconcile_tree(org.id, "")

        row = StorageFile.objects.get(org=org, path="a/b/file.txt")
        assert row.item_type == "file"
        assert row.size == 5
        assert row.parent_path == "a/b/"
        assert row.name == "file.txt"

    def test_creates_ancestor_folder_rows(self, org, local_manager_backend, tmp_path):
        _seed_file(str(tmp_path), org.id, "a/b/file.txt")
        StorageReconciler(local_manager_backend).reconcile_tree(org.id, "")

        assert StorageFile.objects.filter(
            org=org, path="a/", item_type="folder"
        ).exists()
        assert StorageFile.objects.filter(
            org=org, path="a/b/", item_type="folder"
        ).exists()

    def test_deletes_stale_rows(self, org, local_manager_backend, tmp_path):
        StorageFile.objects.create(
            org=org, path="ghost.txt", name="ghost.txt", item_type="file"
        )
        _seed_file(str(tmp_path), org.id, "real.txt")
        StorageReconciler(local_manager_backend).reconcile_tree(org.id, "")

        assert not StorageFile.objects.filter(org=org, path="ghost.txt").exists()
        assert StorageFile.objects.filter(org=org, path="real.txt").exists()

    def test_preserves_is_system_and_created_at_across_rerun(
        self, org, local_manager_backend, tmp_path
    ):
        _seed_file(str(tmp_path), org.id, "out.txt", content=b"x")
        StorageReconciler(local_manager_backend).reconcile_tree(org.id, "")

        row = StorageFile.objects.get(org=org, path="out.txt")
        original_created_at = row.created_at
        row.is_system = True
        row.save(update_fields=["is_system"])

        StorageReconciler(local_manager_backend).reconcile_tree(org.id, "")

        row.refresh_from_db()
        assert row.is_system is True
        assert row.created_at == original_created_at

    def test_root_prefix_empty_string(self, org, local_manager_backend, tmp_path):
        _seed_file(str(tmp_path), org.id, "root_file.txt")
        StorageReconciler(local_manager_backend).reconcile_tree(org.id, "")

        assert StorageFile.objects.filter(org=org, path="root_file.txt").exists()

    def test_folder_rows_have_correct_parent_path(
        self, org, local_manager_backend, tmp_path
    ):
        _seed_file(str(tmp_path), org.id, "x/y/z/deep.txt")
        StorageReconciler(local_manager_backend).reconcile_tree(org.id, "")

        folder = StorageFile.objects.get(org=org, path="x/y/")
        assert folder.parent_path == "x/"
        assert folder.item_type == "folder"
