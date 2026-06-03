from pathlib import Path
from unittest.mock import patch

import pytest
from django.core.management import call_command

from tables.models import Organization, StorageFile


pytestmark = pytest.mark.django_db


@pytest.fixture
def org(db):
    return Organization.objects.create(name="cmd-test-org")


@pytest.fixture
def second_org(db):
    return Organization.objects.create(name="cmd-second-org")


def _seed_file(root: str, org_id: int, rel_path: str, content: bytes = b"data"):
    full_path = Path(root) / f"org_{org_id}" / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(content)


@pytest.fixture
def local_backend_root(tmp_path):
    return str(tmp_path)


@pytest.fixture
def patched_backend(local_backend_root):
    from tables.services.storage_service.local_backend import LocalStorageBackend

    backend = LocalStorageBackend(root=local_backend_root, organization_prefix="")

    class FakeManager:
        _backend = backend

    with patch(
        "tables.services.storage_service.get_storage_manager",
        return_value=FakeManager(),
    ):
        yield backend, local_backend_root


class TestBackfillCommand:
    def test_populates_rows_from_disk(self, org, patched_backend):
        backend, root = patched_backend
        _seed_file(root, org.id, "file.txt", content=b"hello")
        call_command("backfill_storage_files")
        assert StorageFile.objects.filter(org=org, path="file.txt").exists()

    def test_dry_run_writes_nothing(self, org, patched_backend):
        backend, root = patched_backend
        _seed_file(root, org.id, "dry.txt")
        call_command("backfill_storage_files", dry_run=True)
        assert not StorageFile.objects.filter(org=org).exists()

    def test_org_id_flag_scopes_to_single_org(self, org, second_org, patched_backend):
        backend, root = patched_backend
        _seed_file(root, org.id, "org1.txt")
        _seed_file(root, second_org.id, "org2.txt")
        call_command("backfill_storage_files", org_id=org.id)
        assert StorageFile.objects.filter(org=org, path="org1.txt").exists()
        assert not StorageFile.objects.filter(org=second_org).exists()
