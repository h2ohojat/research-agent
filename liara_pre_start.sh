#!/bin/bash
set -e
echo "Running migrations..."
python manage.py migrate --noinput
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear
echo "Pre-start hooks finished."