"""
Base settings for Bridge.dev

This file contains all the core settings that are shared across all environments.
Environment-specific overrides are in dev.py and prod.py.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Security settings
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required")

DEBUG = os.environ.get("DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = (
    os.environ.get("ALLOWED_HOSTS", "").split(",")
    if os.environ.get("ALLOWED_HOSTS")
    else []
)

# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party apps
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_celery_beat",
    # Local apps
    "apps.accounts",
    "apps.core",
    "apps.common",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # CORS headers
    "apps.common.middleware.CorrelationIDMiddleware",  # Correlation ID tracking
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.middleware.WorkspaceMiddleware",  # Workspace scoping middleware
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

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

WSGI_APPLICATION = "config.wsgi.application"

# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "bridge_dev"),
        "USER": os.environ.get("DB_USER", "postgres"),
        "PASSWORD": os.environ.get("DB_PASSWORD", ""),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "OPTIONS": {
            "connect_timeout": 10,
        },
    }
}

# Password validation
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
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Media files
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Custom User model
AUTH_USER_MODEL = "accounts.User"

# REST Framework configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
}

# JWT Settings
from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(days=7),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# Supabase configuration (for future use)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Celery configuration
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.environ.get(
    "CELERY_RESULT_BACKEND", "redis://localhost:6379/0"
)
REDIS_URL = os.environ.get(
    "REDIS_URL", CELERY_BROKER_URL
)  # Fallback to broker URL if not set
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_ENABLE_UTC = True

# Celery task retry configuration
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_DEFAULT_MAX_RETRIES = 3
CELERY_TASK_DEFAULT_RETRY_DELAY = 60  # seconds

# Celery Beat configuration for periodic tasks
CELERY_BEAT_SCHEDULE = {
    "check-cron-triggers": {
        "task": "apps.core.tasks.check_and_trigger_cron_workflows",
        "schedule": 60.0,  # Run every minute
    },
    "cleanup-stale-presence": {
        "task": "apps.core.tasks.cleanup_stale_presence",
        "schedule": 300.0,  # Run every 5 minutes
    },
}

# Workflow orchestration configuration
WORKFLOW_MAX_CONCURRENT_RUNS_DEFAULT = int(
    os.environ.get("WORKFLOW_MAX_CONCURRENT_RUNS_DEFAULT", "10")
)
WORKFLOW_RATE_LIMIT_RUNS_PER_MINUTE_DEFAULT = int(
    os.environ.get("WORKFLOW_RATE_LIMIT_RUNS_PER_MINUTE_DEFAULT", "60")
)
WORKFLOW_QUEUE_MAX_WAIT_SECONDS = int(
    os.environ.get("WORKFLOW_QUEUE_MAX_WAIT_SECONDS", "300")
)

# Credential encryption configuration
CREDENTIAL_ENCRYPTION_KEY = os.environ.get("CREDENTIAL_ENCRYPTION_KEY", "")
if not CREDENTIAL_ENCRYPTION_KEY:
    import warnings

    warnings.warn(
        "CREDENTIAL_ENCRYPTION_KEY not set. Credential encryption will fail. "
        'Generate a key using: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
    )

# Connector configuration
CONNECTOR_REGISTRY_PATH = os.environ.get("CONNECTOR_REGISTRY_PATH", "")

# Logging and tracing configuration
LOG_RETENTION_DAYS = int(os.environ.get("LOG_RETENTION_DAYS", "30"))
TRACE_AGGREGATION_ENABLED = (
    os.environ.get("TRACE_AGGREGATION_ENABLED", "True").lower() == "true"
)

# LLM Guardrails configuration
LLM_SECRET_REDACTION_ENABLED = (
    os.environ.get("LLM_SECRET_REDACTION_ENABLED", "True").lower() == "true"
)
LLM_FIELD_ALLOWLIST_ENABLED = (
    os.environ.get("LLM_FIELD_ALLOWLIST_ENABLED", "True").lower() == "true"
)
LLM_ALLOWED_FIELDS = [
    "id",
    "name",
    "title",
    "description",
    "type",
    "action_id",
    "connector_id",
    "prompt",
    "messages",
    "model",
    "temperature",
    "max_tokens",
    "system_prompt",
    "content",
    "role",
    "text",
    "status",
    "created_at",
    "updated_at",
    "version_number",
    "workflow_id",
    "node_id",
    "edge_id",
    "position",
    "data",
    "source",
    "target",
    "sourceHandle",
    "targetHandle",
]
