# Bridge.dev Backend

Django backend for Bridge.dev, a no-code integration platform.

## Quick Start

1. **Set up virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp ../.env.example .env
   # Edit .env with your settings
   ```

3. **Run migrations:**
   ```bash
   python manage.py migrate
   python manage.py seed_rbac  # Seed default roles and permissions
   ```

4. **Create superuser:**
   ```bash
   python manage.py createsuperuser
   ```

5. **Run development server:**
   ```bash
   python manage.py runserver
   ```

## Project Structure

```
backend/
├── apps/
│   ├── accounts/      # Authentication, users, organizations, workspaces, RBAC
│   ├── core/          # Workflow models (Workflow, Run, RunStep, Trigger)
│   └── common/        # Shared utilities (logging, middleware)
├── config/
│   ├── settings/      # Environment-specific settings
│   │   ├── base.py    # Base settings
│   │   ├── dev.py     # Development overrides
│   │   └── prod.py    # Production overrides
│   └── urls.py        # Main URL configuration
└── manage.py          # Django management script
```

## Environment Variables

See [docs/ENV_SETUP.md](../docs/ENV_SETUP.md) for complete environment variable documentation.

Key variables:
- `SECRET_KEY`: Django secret key (required)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`: Database configuration
- `DJANGO_ENV`: Environment selector (`dev` or `prod`)
- `USE_SQLITE`: Use SQLite for local development (optional)

## API Endpoints

- **Authentication**: `/api/v1/auth/`
  - `POST /api/v1/auth/login/` - Login (get JWT tokens)
  - `POST /api/v1/auth/register/` - Register new user
  - `POST /api/v1/auth/token/refresh/` - Refresh access token
  - `POST /api/v1/auth/token/verify/` - Verify token

- **Core**: `/api/v1/core/`
  - `GET /api/v1/core/workflows/` - List workflows
  - `GET /api/v1/core/workflows/{id}/` - Get workflow
  - `GET /api/v1/core/runs/` - List runs
  - `GET /api/v1/core/triggers/` - List triggers

All endpoints require authentication via JWT Bearer token.

## Workspace Scoping

Workspaces are specified via:
- `X-Workspace-Id` header (preferred)
- `workspace_id` query parameter

Example:
```bash
curl -H "Authorization: Bearer <token>" \
     -H "X-Workspace-Id: <workspace-id>" \
     http://localhost:8000/api/v1/core/workflows/
```

## Management Commands

- `python manage.py seed_rbac` - Seed default roles and permissions
- `python manage.py createsuperuser` - Create admin user
- `python manage.py migrate` - Run database migrations

## Development

### Running Tests

```bash
python manage.py test
```

### Code Style

Follow Django and DRF best practices. See `.cursor/rules/` for project-specific guidelines.

## Logging

See [docs/LOGGING.md](../docs/LOGGING.md) for logging usage and patterns.

Logging includes:
- Correlation IDs for request tracing
- Structured JSON logs in production
- Human-readable logs in development

## Security

- JWT authentication with token rotation
- Workspace-scoped access control
- RBAC with roles and permissions
- Environment-based secret management

## Next Steps

Phase 0 is complete. Next phases will add:
- Phase 1: Orchestration core (Celery, queue management)
- Phase 2: Connectors and secrets management
- Phase 3: AI assistance features
- Phase 4: Observability and alerts
- Phase 5: Frontend experience
- Phase 6: Extensibility

