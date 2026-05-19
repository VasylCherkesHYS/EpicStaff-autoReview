"""
REST Framework Settings
https://www.django-rest-framework.org/api-guide/settings/
"""

from django_app.settings import env

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 500_000,
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend"],
    "EXCEPTION_HANDLER": "utils.exception_handler.custom_exception_handler",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "tables.services.rbac.authentication.JwtOrApiKeyAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "login": env.str("LOGIN_THROTTLE_RATE", "5/min"),
        "password_reset_request": env.str(
            "PASSWORD_RESET_REQUEST_THROTTLE_RATE", "5/hour"
        ),
    },
}
