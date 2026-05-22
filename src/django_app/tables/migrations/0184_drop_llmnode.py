from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tables", "0183_surface_surfacestoragefile_surface_storage_files_and_more"),
    ]

    operations = [
        migrations.DeleteModel(
            name="LLMNode",
        ),
    ]
