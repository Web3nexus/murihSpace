# Backup and Restore

## Database Backup

```bash
# Create backup
pg_dump -U murihspace -h localhost murihspace > backups/murihspace_$(date +%Y%m%d_%H%M%S).sql

# With compression
pg_dump -U murihspace -h localhost murihspace | gzip > backups/murihspace_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore
psql -U murihspace -h localhost murihspace < backups/murihspace_20260723_120000.sql
gunzip -c backups/murihspace_20260723_120000.sql.gz | psql -U murihspace -h localhost murihspace
```

## File Storage Backup

```bash
# Local product files (private storage)
tar -czf backups/storage_$(date +%Y%m%d_%H%M%S).tar.gz storage/app/digital_products

# S3-compatible storage (if used)
aws s3 sync s3://murihspace-private/ backups/s3-private/ --profile murihspace
```

## Redis Backup

```bash
# Save snapshot
redis-cli SAVE

# The RDB file is at /var/lib/redis/dump.rdb by default
cp /var/lib/redis/dump.rdb backups/redis_$(date +%Y%m%d_%H%M%S).rdb
```

## Automation

Add to crontab:
```
0 3 * * * /usr/local/bin/pg_dump -U murihspace murihspace | gzip > /backups/db/daily_$(date +\%Y\%m\%d).sql.gz
0 4 * * * find /backups/db -name "*.sql.gz" -mtime +30 -delete

```

## Restore Test Procedure

1. Restore database to staging: `pg_restore -U murihspace -d murihspace_staging --clean backups/latest.dump`
2. Run `php artisan migrate --force`
3. Run `php artisan test`
4. Verify key data points via API: `GET /api/v1/ready`
