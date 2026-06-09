from django.db import migrations

from tables.migrations._helpers import assign_default_org


def forwards(apps, schema_editor):
    for label in ("tables.Graph", "tables.Agent", "tables.Crew"):
        assign_default_org(apps, label)


class Migration(migrations.Migration):

    dependencies = [
        ("tables", "0184_rbac_inherit_org_scoped_in_graph_agent_crew"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
