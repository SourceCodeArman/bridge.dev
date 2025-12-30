# Bridge.dev Backend

Django backend for Bridge.dev, a no-code integration platform.

## Quick Start (Docker) - Recommended

The easiest way to get started is using Docker:

1. **Configure environment:**
   ```bash
   # Edit .env with your settings (already configured for Docker)
   # The REDIS_URL should point to redis://redis:6379/0
   ```

2. **Start all services:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f backend
   ```

4. **Run migrations (if needed):**
   ```bash
   docker-compose exec backend python manage.py migrate
   docker-compose exec backend python manage.py seed_rbac
   ```

5. **Create superuser:**
   ```bash
   docker-compose exec backend python manage.py createsuperuser
   ```

6. **Stop services:**
   ```bash
   docker-compose down
   ```

### Individual Service Management

```bash
# Start only specific services
docker-compose up -d backend redis

# Restart a service
docker-compose restart backend

# View logs for specific service
docker-compose logs -f celery-worker

# Execute commands in the backend container
docker-compose exec backend python manage.py shell

# Rebuild after dependency changes
docker-compose build backend
docker-compose up -d backend
```

## Quick Start (Traditional)

If you prefer to run without Docker:

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
   # For local development, set REDIS_URL=redis://localhost:6379/0
   ```

3. **Start Redis (required for Celery):**
   ```bash
   # Install and start Redis locally
   brew install redis  # macOS
   redis-server
   ```

4. **Run migrations:**
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

## Docker Troubleshooting

### Container won't start
- Check logs: `docker-compose logs backend`
- Verify .env file exists and has correct values
- Ensure database credentials are correct
- Check if ports 8000 or 6379 are already in use: `lsof -i :8000 -i :6379`

### Database connection issues
- Verify Supabase database is accessible from your network
- Check `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` in `.env`
- Test connection: `docker-compose exec backend python manage.py dbshell`

### Redis connection issues
- Ensure Redis container is running: `docker-compose ps redis`
- Check Redis logs: `docker-compose logs redis`
- Verify `REDIS_URL=redis://redis:6379/0` in `.env`

### Hot-reload not working
- Ensure code is mounted as volume in `docker-compose.yml`
- Restart the container: `docker-compose restart backend`

### Permission errors
- The container runs as non-root user `bridgeuser` (UID 1000)
- If you get permission errors, check file ownership in mounted volumes

### Rebuilding after dependency changes
```bash
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d
```

## Next Steps


Phase 0 is complete. Next phases will add:
- Phase 1: Orchestration core (Celery, queue management)
- Phase 2: Connectors and secrets management
- Phase 3: AI assistance features
- Phase 4: Observability and alerts
- Phase 5: Frontend experience
- Phase 6: Extensibility

