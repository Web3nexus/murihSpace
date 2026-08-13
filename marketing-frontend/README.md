# MurihSpace Marketing Frontend

The public-facing marketing website for MurihSpace, served at `murihspace.com`.

Part of the `marketing-frontend/` ↔ `marketing-backend/` pair. This frontend
renders the marketing pages and the **public Help Center**, fetching content
from the `marketing-backend/` Laravel service through its cached public
read-only API (`/api/public/...`).

## Pages

- Homepage, Features, Pricing, Creators, Blog
- **Public Help Center** (planned: `murihspace.com/help/...`)

## Stack

- React Router 8 (SSR)
- React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui
- lucide-react, motion

## Getting started

```bash
npm install
npm run dev
```

Copy `.env.example` → `.env` and set the API URLs for your environment.

## Deployment

- `murihspace.com`
- Staging: `staging.murihspace.com`

## Related

- **Frontend API**: `web/backend/` (Laravel) — main platform data
- **Help / CMS content**: `web/marketing-backend/` (Laravel) — public help + marketing CMS