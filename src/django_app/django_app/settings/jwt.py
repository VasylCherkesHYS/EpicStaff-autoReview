"""
Simple JWT Settings
https://django-rest-framework-simplejwt.readthedocs.io/en/latest/settings.html
"""

from datetime import timedelta

from django.conf import settings

from django_app.settings import env


SIMPLE_JWT = {
    "SIGNING_KEY": env.str("JWT_SECRET", settings.SECRET_KEY),
    "ALGORITHM": "HS256",
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", 15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", 7)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}
