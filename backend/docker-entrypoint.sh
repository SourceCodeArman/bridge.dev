#!/bin/bash
set -e

echo "Waiting for database to be ready..."
# Wait for database to be available
until python -c "import psycopg2; psycopg2.connect(host='${DB_HOST}', port='${DB_PORT}', user='${DB_USER}', password='${DB_PASSWORD}', dbname='${DB_NAME}')" 2>/dev/null; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput || true

# Seed RBAC if needed (optional)
# python manage.py seed_rbac --noinput || true

# Create superuser from environment variables (optional)
# if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
#     python manage.py createsuperuser --noinput || true
# fi

echo "Starting application..."
exec "$@"
