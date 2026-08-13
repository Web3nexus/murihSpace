# MurihSpace Marketing Backend

The dedicated Laravel 13 backend for the MurihSpace Support / CRM platform
(previously planned as `support/`). Paired with `web/marketing-frontend/`.

This service becomes the operational backend for:

- Help Center CMS (articles, categories, revisions, feedback)
- Support tickets and customer conversations
- CRM and customer profiles
- Support teams, agents, SLAs and automation
- Marketing CMS and public help content
- Support analytics and reporting

It mirrors the conventions of the main `web/backend/` Laravel application
(PostgreSQL, Redis, queues, policies, API resources, service classes) but uses
its own **separate** database so core MurihSpace business data never moves here.

## Requirements

- PHP 8.4+
- PostgreSQL 14+
- Redis (for queues / cache in production)
- Composer 2

## Getting started

```bash
# 1. Boot a database (must match .env)
createdb murihspace_support

# 2. Install dependencies and environment
composer install
cp .env.example .env
php artisan key:generate

# 3. Migrations + seed the Help Center from the main platform
php artisan migrate
php artisan support:migrate-help-center
```

The import command is **idempotent** — it can be run repeatedly and will update
existing rows instead of duplicating them. It is safe to re-run after the
public help API is live.

## Public read-only Help API

Exposed under `/api/public` and intended for the `web/marketing-frontend/`
application. Only `published` records are returned.

```
GET  /api/public/help/search?q=gift            # full-text search (title, keywords, body, category, tags)
GET  /api/public/help/categories               # active categories + article counts
GET  /api/public/help/articles?category=gifting  # paginated published articles
GET  /api/public/help/articles/{slug}          # single article (increments view count)
POST /api/public/help/articles/{slug}/feedback # record was-this-helpful feedback
```

Responses include `Cache-Control: public`, a configurable `max-age` TTL and
`X-Cache-TTL` header via the `cache.public` middleware. Search queries and
helpful/not-helpful feedback are stored for analytics.

## Staff / SecureCRM

Staff accounts live in a separate `staff_users` table (role `support_agent`,
`support_manager`, `support_admin`, etc.) authenticated with Sanctum bearer
tokens — never mixed with customer accounts. Route groups are protected by the
`staff` and `staff.permission` middleware aliases. The staff dashboard entry
point is `/securecrm`.

## Tests

```bash
php artisan test
```

The test suite runs on SQLite in-memory and exercises the import command
(idempotency, data fidelity) and the public API (caching, filtering, 404s,
feedback, search analytics).