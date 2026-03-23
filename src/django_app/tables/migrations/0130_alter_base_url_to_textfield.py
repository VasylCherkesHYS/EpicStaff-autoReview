from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tables", "0129_merge_20251211_1413"),
    ]

    operations = [
        migrations.AlterField(
            model_name="llmmodel",
            name="base_url",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="defaultllmconfig",
            name="base_url",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="llmconfig",
            name="base_url",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="embeddingmodel",
            name="base_url",
            field=models.TextField(blank=True, null=True, default=None),
        ),
    ]
