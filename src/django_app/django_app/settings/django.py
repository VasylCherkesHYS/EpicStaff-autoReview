"""
Django Settings
https://docs.djangoproject.com/en/5.0/topics/settings/
"""

import sys

from django_app.settings import env, BASE_DIR

DEBUG = env.bool("DEBUG", False)
SECRET_KEY = env.str("SECRET_KEY")
ALLOWED_HOSTS = [
    "*",  # host.strip() for host in os.getenv("ALLOWED_HOSTS", "0.0.0.0, 127.0.0.1").split(",")
]
ROOT_URLCONF = "django_app.urls"


LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "loguru": {
            "class": "logging.StreamHandler",
            "stream": sys.stdout,
        },
    },
    "root": {
        "handlers": ["loguru"],
        "level": "DEBUG",
    },
}


INSTALLED_APPS = [
    "health_check",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "tables",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "django_filters",
    "corsheaders",
    "django_redis",
]


MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "corsheaders.middleware.CorsMiddleware",
]


TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env.str("POSTGRES_DB", "crew"),
        "USER": env.str("DB_USER", "postgres"),
        "PASSWORD": env.str("POSTGRES_PASSWORD", "admin"),
        "HOST": env.str("DB_HOST_NAME", "localhost"),
        "PORT": env.int("DB_PORT", 5432),
    }
}


REDIS_HOST = env.str("REDIS_HOST", "localhost")
REDIS_PORT = env.int("REDIS_PORT", 6379)
REDIS_PASSWORD = env.str("REDIS_PASSWORD")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": f"redis://{REDIS_HOST}:{REDIS_PORT}/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SERIALIZER": "django_redis.serializers.json.JSONSerializer",
            "PASSWORD": REDIS_PASSWORD,
        },
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
    {
        "NAME": "tables.services.rbac.utils.printable_ascii_password_validator.PrintableAsciiPasswordValidator",
    },
]


AUTH_USER_MODEL = "tables.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


MEDIA_URL = "/media/"
MEDIA_ROOT = env.path("DJANGO_MEDIA_ROOT", BASE_DIR / "media")


# Email / password-recovery delivery.
#
# Two independent knobs:
#   * `EMAIL_HOST`         — "is SMTP delivery configured at all?" If set,
#                            Django uses the SMTP backend; if blank, it
#                            falls back to the console backend so the
#                            reset link is still observable in stdout.
#   * `EMAIL_HOST_USER` +  — "should Django authenticate?" Both blank =
#     `EMAIL_HOST_PASSWORD`  unauthenticated relay (mailpit, local Postfix,
#                            some corporate MTAs). Both set = plain SMTP
#                            AUTH against the configured host.
#
# Setting a user/password against a server that does NOT implement SMTP
# AUTH (mailpit is the common one) will raise `SMTPNotSupportedError` —
# leave them blank for those servers.
#
# Business-layer code that needs to branch on "should we advertise email
# delivery to the end user?" must ask `SmtpConfigService.is_configured()`
# rather than inspecting `EMAIL_BACKEND`.
EMAIL_HOST = env.str("EMAIL_HOST", "")
EMAIL_PORT = env.int("EMAIL_PORT", 587)
EMAIL_HOST_USER = env.str("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env.str("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", False)
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

DEFAULT_FROM_EMAIL = env.str("DEFAULT_FROM_EMAIL", "no-reply@epicstaff.local")
