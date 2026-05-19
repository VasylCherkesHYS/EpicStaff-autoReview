"""
Spectacular Settings
https://drf-spectacular.readthedocs.io/en/latest/settings.html
"""

SPECTACULAR_SETTINGS = {
    "TITLE": "CrewAI SheetsUI API",
    "VERSION": "v1",
    "SERVE_INCLUDE_SCHEMA": False,
    "SWAGGER_UI_SETTINGS": {
        "persistAuthorization": True,
    },
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "django_app.spectacular_hooks.assign_tags_postprocessing_hook",
    ],
}
