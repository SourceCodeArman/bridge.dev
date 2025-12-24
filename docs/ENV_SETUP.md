# Environment Setup Guide

This document describes the required environment variables for Bridge.dev.

## Quick Start

1. Copy the `.env.example` file to `.env` in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values (see sections below)

3. The application will automatically load variables from `.env` using `python-dotenv`

## Required Environment Variables

### Django Core Settings

- `SECRET_KEY` (required): Django secret key for cryptographic signing
  - Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
  - **Never commit this to version control**

- `DEBUG` (optional, default: `False`): Enable debug mode
  - Set to `True` for development, `False` for production

- `DJANGO_ENV` (optional, default: `dev`): Environment selector
  - Options: `dev` or `prod`
  - Determines which settings file to load (`dev.py` or `prod.py`)

- `ALLOWED_HOSTS` (optional, default: empty): Comma-separated list of allowed hosts
  - Example: `localhost,127.0.0.1,yourdomain.com`

### Database Configuration

Bridge.dev uses PostgreSQL (compatible with Supabase):

- `DB_NAME` (optional, default: `bridge_dev`): Database name
- `DB_USER` (optional, default: `postgres`): Database user
- `DB_PASSWORD` (required): Database password
- `DB_HOST` (optional, default: `localhost`): Database host
- `DB_PORT` (optional, default: `5432`): Database port

**For local development with SQLite:**
- `USE_SQLITE=True` (optional): Use SQLite instead of PostgreSQL
  - Only recommended for local development/testing

### Supabase Configuration (Optional)

For future Supabase integration:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Supabase anon/public key
- `SUPABASE_SERVICE_KEY`: Supabase service role key (keep secret!)

### Production Security Settings

For production deployments:

- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
  - Example: `https://yourdomain.com,https://app.yourdomain.com`

- `SECURE_SSL_REDIRECT` (optional, default: `True`): Force HTTPS redirects
- `SECURE_HSTS_SECONDS` (optional, default: `31536000`): HSTS header duration

## Environment-Specific Settings

### Development (`DJANGO_ENV=dev`)

- Uses `config/settings/dev.py`
- Enables debug mode, console email backend
- Allows localhost CORS origins
- Uses verbose console logging

### Production (`DJANGO_ENV=prod`)

- Uses `config/settings/prod.py`
- Disables debug mode
- Enforces HTTPS and security headers
- Uses structured JSON logging
- Requires explicit CORS configuration

## Example .env File

```bash
# Django Settings
SECRET_KEY=django-insecure-change-this-in-production
DEBUG=True
DJANGO_ENV=dev
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DB_NAME=bridge_dev
DB_USER=postgres
DB_PASSWORD=mypassword
DB_HOST=localhost
DB_PORT=5432

# Supabase (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

## Self-Hosting Setup

For self-hosted deployments:

1. Set up PostgreSQL database (or use Supabase)
2. Configure all required environment variables
3. Set `DJANGO_ENV=prod` for production
4. Ensure `SECRET_KEY` is a strong random value
5. Configure `ALLOWED_HOSTS` with your domain
6. Set up SSL/TLS certificates
7. Configure `CORS_ALLOWED_ORIGINS` for your frontend domain

## Security Notes

- **Never commit `.env` files to version control**
- Use strong, randomly generated `SECRET_KEY` values
- Keep `SUPABASE_SERVICE_KEY` and database passwords secure
- In production, use environment variables or secret management services
- Rotate secrets regularly

