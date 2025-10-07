# -*- coding: utf-8 -*-
from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('tables', '0107_rename_chunk_text_documentembedding_chunk'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            UPDATE tables_documentembedding
            SET chunk_id = NULL
            WHERE chunk_id IS NOT NULL;
            """,
            reverse_sql="""
            -- откат: ничего не делаем
            """
        ),

        migrations.RunSQL(
            sql="""
            ALTER TABLE tables_documentembedding
            DROP CONSTRAINT IF EXISTS tables_documentembedding_chunk_id_8f317cfc_fk_tables_chunk_id;
            """,
            reverse_sql="""
            ALTER TABLE tables_documentembedding
            ADD CONSTRAINT tables_documentembedding_chunk_id_8f317cfc_fk_tables_chunk_id
            FOREIGN KEY (chunk_id) REFERENCES tables_chunk(id) DEFERRABLE INITIALLY DEFERRED;
            """
        ),

        migrations.RunSQL(
            sql="""
            ALTER TABLE tables_documentembedding
            ADD CONSTRAINT tables_documentembedding_chunk_id_8f317cfc_fk_tables_chunk_id
            FOREIGN KEY (chunk_id)
            REFERENCES tables_chunk(id)
            ON DELETE SET NULL
            DEFERRABLE INITIALLY DEFERRED;
            """,
            reverse_sql="""
            ALTER TABLE tables_documentembedding
            DROP CONSTRAINT IF EXISTS tables_documentembedding_chunk_id_8f317cfc_fk_tables_chunk_id;
            """
        ),
    ]
