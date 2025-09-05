from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("tables", "0103_create_venv_and_migrate_data"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="pythoncode",
            name="libraries",
        ),
    ]
