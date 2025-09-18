set -e
echo "Running migrations..."
python manage.py migrate --noinput
echo "Pre-start hooks finished."