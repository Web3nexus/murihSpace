#!/bin/bash
# Start command for Railpack (set as RAILPACK_START_CMD on the app).
# Does what nixpacks.toml's start.sh did: migrations, writable storage, then
# Reverb for websockets, with FrankenPHP serving HTTP through Caddy.
set -e

cd /app

chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

if [ "$RAILPACK_SKIP_MIGRATIONS" != "true" ]; then
  php artisan migrate --force
fi

php artisan storage:link || true
php artisan optimize:clear
php artisan optimize

# Reverb listens on 8080; Caddy proxies /app/* and /apps/* to it.
php artisan reverb:start --host=0.0.0.0 --port=8080 &

exec docker-php-entrypoint --config /app/scripts/Caddyfile.railpack --adapter caddyfile
