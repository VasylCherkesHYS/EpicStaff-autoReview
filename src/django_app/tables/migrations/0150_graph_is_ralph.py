# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tables', '0149_codeagentnode_session_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='graph',
            name='is_ralph',
            field=models.BooleanField(default=False, help_text="If 'True' -> this is a Ralph flow created from the Ralph template."),
        ),
    ]
