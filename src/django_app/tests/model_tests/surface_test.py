import pytest

from tables.models.agent_models import Surface, InlineSurface
from tables.models.mcp_models import McpTool
from tables.models.python_models import PythonCodeToolConfig, PythonCodeTool, PythonCode
from tables.models.knowledge_models.collection_models import SourceCollection
from tables.models.graph_models import StorageFile
from tables.models.rbac_models import Organization
from tables.services.surface_service import SurfaceService


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def org(db):
    return Organization.objects.create(name="test-surface-org")


@pytest.fixture
def python_tool(db):
    code = PythonCode.objects.create(code="def main(): pass")
    tool = PythonCodeTool.objects.create(
        name="surface-py-tool",
        description="test",
        args_schema={},
        python_code=code,
    )
    return tool


@pytest.fixture
def py_config_a(db, python_tool):
    return PythonCodeToolConfig.objects.create(
        name="py-config-a", tool=python_tool, configuration={}
    )


@pytest.fixture
def py_config_b(db, python_tool):
    return PythonCodeToolConfig.objects.create(
        name="py-config-b", tool=python_tool, configuration={}
    )


@pytest.fixture
def mcp_tool_a(db):
    return McpTool.objects.create(
        name="mcp-a", transport="http://localhost/sse", tool_name="tool_a"
    )


@pytest.fixture
def mcp_tool_b(db):
    return McpTool.objects.create(
        name="mcp-b", transport="http://localhost/sse", tool_name="tool_b"
    )


@pytest.fixture
def collection_a(db):
    return SourceCollection.objects.create(collection_name="coll-a")


@pytest.fixture
def collection_b(db):
    return SourceCollection.objects.create(collection_name="coll-b")


@pytest.fixture
def storage_file_a(db, org):
    return StorageFile.objects.create(org=org, name="file-a", path="a/file.txt")


@pytest.fixture
def storage_file_b(db, org):
    return StorageFile.objects.create(org=org, name="file-b", path="b/file.txt")


@pytest.fixture
def surface(db, org):
    return Surface.objects.create(
        organization=org,
        name="base-surface",
        description="",
        additional_instructions="",
    )


# ---------------------------------------------------------------------------
# Surface.resolve() — single-surface deny wins
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_resolve_allowed_tool_appears_in_result(surface, py_config_a):
    surface.allowed_python_tools.set([py_config_a])

    result = surface.resolve()

    assert py_config_a in result.python_code_tool_configs


@pytest.mark.django_db
def test_resolve_allowed_and_disabled_same_tool_excluded(surface, py_config_a):
    surface.allowed_python_tools.set([py_config_a])
    surface.disabled_python_tools.set([py_config_a])

    result = surface.resolve()

    assert py_config_a not in result.python_code_tool_configs


@pytest.mark.django_db
def test_resolve_disabled_only_not_in_result(surface, py_config_a):
    surface.disabled_python_tools.set([py_config_a])

    result = surface.resolve()

    assert py_config_a not in result.python_code_tool_configs


@pytest.mark.django_db
def test_resolve_allowed_minus_disabled_leaves_remainder(
    surface, py_config_a, py_config_b
):
    surface.allowed_python_tools.set([py_config_a, py_config_b])
    surface.disabled_python_tools.set([py_config_a])

    result = surface.resolve()

    assert py_config_a not in result.python_code_tool_configs
    assert py_config_b in result.python_code_tool_configs


@pytest.mark.django_db
def test_resolve_mcp_deny_wins(surface, mcp_tool_a, mcp_tool_b):
    surface.allowed_mcp_tools.set([mcp_tool_a, mcp_tool_b])
    surface.disabled_mcp_tools.set([mcp_tool_a])

    result = surface.resolve()

    assert mcp_tool_a not in result.mcp_tools
    assert mcp_tool_b in result.mcp_tools


@pytest.mark.django_db
def test_resolve_knowledge_deny_wins(surface, collection_a, collection_b):
    surface.allowed_knowledge_collections.set([collection_a, collection_b])
    surface.disabled_knowledge_collections.set([collection_b])

    result = surface.resolve()

    assert collection_a in result.knowledge_collections
    assert collection_b not in result.knowledge_collections


@pytest.mark.django_db
def test_resolve_storage_deny_wins(surface, storage_file_a, storage_file_b):
    surface.allowed_storage_files.set([storage_file_a, storage_file_b])
    surface.disabled_storage_files.set([storage_file_a])

    result = surface.resolve()

    assert storage_file_a not in result.storage_files
    assert storage_file_b in result.storage_files


@pytest.mark.django_db
def test_resolve_returns_additional_instructions(surface):
    surface.additional_instructions = "be concise"
    surface.save()

    result = surface.resolve()

    assert result.additional_instructions == "be concise"


# ---------------------------------------------------------------------------
# SurfaceService.combine — cross-surface deny wins
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_combine_deny_in_one_surface_removes_allow_in_other(
    org, python_tool, py_config_a
):
    surface_a = Surface.objects.create(organization=org, name="s-a")
    surface_b = Surface.objects.create(organization=org, name="s-b")

    surface_a.allowed_python_tools.set([py_config_a])
    surface_b.disabled_python_tools.set([py_config_a])

    result = SurfaceService.combine(surface_a, surface_b)

    assert py_config_a not in result.python_code_tool_configs


@pytest.mark.django_db
def test_combine_allow_in_one_surface_deny_in_same_surface_excluded(org, py_config_a):
    surface_a = Surface.objects.create(organization=org, name="s-allow-deny")
    surface_a.allowed_python_tools.set([py_config_a])
    surface_a.disabled_python_tools.set([py_config_a])

    result = SurfaceService.combine(surface_a)

    assert py_config_a not in result.python_code_tool_configs


@pytest.mark.django_db
def test_combine_allowed_in_both_surfaces_present_once(org, py_config_a):
    surface_a = Surface.objects.create(organization=org, name="s-dup-a")
    surface_b = Surface.objects.create(organization=org, name="s-dup-b")
    surface_a.allowed_python_tools.set([py_config_a])
    surface_b.allowed_python_tools.set([py_config_a])

    result = SurfaceService.combine(surface_a, surface_b)

    assert result.python_code_tool_configs.count(py_config_a) == 1


@pytest.mark.django_db
def test_combine_mcp_cross_surface_deny(org, mcp_tool_a, mcp_tool_b):
    surface_a = Surface.objects.create(organization=org, name="s-mcp-a")
    surface_b = Surface.objects.create(organization=org, name="s-mcp-b")

    surface_a.allowed_mcp_tools.set([mcp_tool_a, mcp_tool_b])
    surface_b.disabled_mcp_tools.set([mcp_tool_b])

    result = SurfaceService.combine(surface_a, surface_b)

    assert mcp_tool_a in result.mcp_tools
    assert mcp_tool_b not in result.mcp_tools


@pytest.mark.django_db
def test_combine_knowledge_cross_surface_deny(org, collection_a, collection_b):
    surface_a = Surface.objects.create(organization=org, name="s-kn-a")
    surface_b = Surface.objects.create(organization=org, name="s-kn-b")

    surface_a.allowed_knowledge_collections.set([collection_a, collection_b])
    surface_b.disabled_knowledge_collections.set([collection_a])

    result = SurfaceService.combine(surface_a, surface_b)

    assert collection_a not in result.knowledge_collections
    assert collection_b in result.knowledge_collections


@pytest.mark.django_db
def test_combine_storage_cross_surface_deny(org, storage_file_a, storage_file_b):
    surface_a = Surface.objects.create(organization=org, name="s-st-a")
    surface_b = Surface.objects.create(organization=org, name="s-st-b")

    surface_a.allowed_storage_files.set([storage_file_a, storage_file_b])
    surface_b.disabled_storage_files.set([storage_file_b])

    result = SurfaceService.combine(surface_a, surface_b)

    assert storage_file_a in result.storage_files
    assert storage_file_b not in result.storage_files


@pytest.mark.django_db
def test_combine_instructions_concatenated_in_order(org):
    surface_a = Surface.objects.create(
        organization=org, name="s-instr-a", additional_instructions="first"
    )
    surface_b = Surface.objects.create(
        organization=org, name="s-instr-b", additional_instructions="second"
    )

    result = SurfaceService.combine(surface_a, surface_b)

    assert result.additional_instructions == "first\n\nsecond"


@pytest.mark.django_db
def test_combine_inline_surface_has_no_instructions(org, py_config_a):
    surface_a = Surface.objects.create(
        organization=org, name="s-with-instr", additional_instructions="hello"
    )
    inline = InlineSurface.objects.create(organization=org)
    surface_a.allowed_python_tools.set([py_config_a])
    inline.disabled_python_tools.set([py_config_a])

    result = SurfaceService.combine(surface_a, inline)

    assert result.additional_instructions == "hello"
    assert py_config_a not in result.python_code_tool_configs


@pytest.mark.django_db
def test_combine_empty_instructions_skipped(org):
    surface_a = Surface.objects.create(
        organization=org, name="s-empty-a", additional_instructions=""
    )
    surface_b = Surface.objects.create(
        organization=org, name="s-empty-b", additional_instructions="only"
    )

    result = SurfaceService.combine(surface_a, surface_b)

    assert result.additional_instructions == "only"
