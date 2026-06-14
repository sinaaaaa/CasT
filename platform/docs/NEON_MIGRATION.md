# Move local database to Neon (production)

## Before you start

1. Create a project at [neon.tech](https://neon.tech).
2. Copy two connection strings from the Neon dashboard:
   - **Direct** — for one-time import (this script)
   - **Pooled** (`-pooler` in host) — for Vercel `DATABASE_URL`
3. Keep local Docker running: `cd platform && docker compose up -d`

## One-time import (Windows)

```powershell
cd platform

# Use Neon DIRECT connection string (not pooled) for import
$env:NEON_DATABASE_URL = "postgresql://USER:PASS@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"

powershell -ExecutionPolicy Bypass -File .\scripts\migrate-local-to-neon.ps1
```

Requires `psql` on PATH ([PostgreSQL client tools](https://www.postgresql.org/download/windows/)).

If Neon already has tables from an old deploy, create a **fresh branch/database** in Neon first, or drop existing tables.

## Vercel environment variables

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon **pooled** URL |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | long random string |
| `GAME_API_KEY` | same as Unity WebGL build |
| `GAME_CORS_ORIGIN` | your game origin(s), comma-separated |

After saving env vars, redeploy.

## Schema-only (no student data)

```powershell
.\scripts\migrate-local-to-neon.ps1 -SchemaOnly
```

Then run `npx prisma migrate deploy` if you use Prisma migrations instead of a full dump.

## Verify

```bash
curl https://YOUR-APP.vercel.app/api/health/db
```

Login as teacher and confirm levels/students/attempts match local.
