# Generated for EST-1429: adaptive community_level for local/drift search.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tables', '0182_graph_search_params_and_llmconfig_context_window'),
    ]

    operations = [
        migrations.AddField(
            model_name='graphraglocalsearchconfig',
            name='community_level',
            field=models.IntegerField(
                default=2,
                help_text='Max Leiden community-hierarchy level to include in context.',
            ),
        ),
        migrations.AddField(
            model_name='graphragdriftsearchconfig',
            name='community_level',
            field=models.IntegerField(
                default=2,
                help_text='Max Leiden community-hierarchy level to include in context.',
            ),
        ),
    ]
