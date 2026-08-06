# Move local database to Neon (production) — step by step

Use this when **cas-t.vercel.app** does not show the same students, levels, or attempts as your local machine.

---

## Part 1 — Prepare (one time)

### 1. Start local database

Open PowerShell:

```powershell
cd D:\ITLS\SPARC\coding-block-SPARC\platform
docker compose up -d
```

Wait until Docker shows container **`sparc-assessment-db`** running.

### 2. Make local changes you want online

- Use the local site: `npm run dev` → http://localhost:3000  
- Create levels, students, assignments, etc.  
- Those changes are stored in **local Docker Postgres**, not Neon yet.

### 3. Get two URLs from Neon

Open [console.neon.tech](https://console.neon.tech) → your project → **Connect**:

| Use for | Which button | Hostname looks like |
|---------|--------------|---------------------|
| **Import script** | **Direct** connection | `ep-xxxx.region.aws.neon.tech` |
| **Vercel `DATABASE_URL`** | **Pooled** connection | `ep-xxxx-pooler.region.aws.neon.tech` |

Copy the **Direct** string. It must end with:

```text
?sslmode=require
```

(not `sslmode=requir`)

---

## Part 2 — Copy local → Neon

In PowerShell:

```powershell
cd D:\ITLS\SPARC\coding-block-SPARC\platform

# Paste YOUR Neon DIRECT connection string (replace USER and PASS)
$env:NEON_DATABASE_URL = "postgresql://USER:PASS@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"

powershell -ExecutionPolicy Bypass -File .\scripts\migrate-local-to-neon.ps1 -ReplaceExisting
```

**`-ReplaceExisting`** deletes old data on Neon and replaces it with your local copy.  
You should see `SUCCESS — local database copied to Neon.`

A backup file is saved in `platform/backups/sparc-to-neon-*.sql`.

### If import fails with "type already exists"

You forgot `-ReplaceExisting`. Run the same command again **with** that flag.

---

## Part 3 — Point Vercel at Neon (critical)

Importing to Neon is **not enough**. Vercel must use the **pooled** Neon URL.

1. Open **Vercel** → project **CasT** → **Settings** → **Environment Variables**
2. Set **`DATABASE_URL`** to the **Pooled** connection string from Neon (with `-pooler` in the host)
3. Confirm these exist:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://...@ep-xxxx-pooler....neon.tech/neondb?sslmode=require` |
| `NEXTAUTH_URL` | `https://cas-t.vercel.app` |
| `NEXTAUTH_SECRET` | (long random string) |
| `GAME_API_KEY` | (your production key) |
| `GAME_CORS_ORIGIN` | `https://cas-t.vercel.app` |

4. **Deployments** → latest deployment → **⋯** → **Redeploy**  
   (turn off “Use existing build cache” if offered)

---

## Part 4 — Verify

1. Open **https://cas-t.vercel.app/api/health/db**  
   - Should return `"ok": true`

2. Log in as **teacher** on production  
   - Check students, levels, and attempts match local

3. Student play: **https://cas-t.vercel.app/play**

---

## Repeat later (after more local work)

Whenever you change data locally and want production updated:

```powershell
cd D:\ITLS\SPARC\coding-block-SPARC\platform
$env:NEON_DATABASE_URL = "postgresql://...DIRECT...?sslmode=require"
powershell -ExecutionPolicy Bypass -File .\scripts\migrate-local-to-neon.ps1 -ReplaceExisting
```

Then **Redeploy** on Vercel (usually not required if only data changed and `DATABASE_URL` already points to Neon).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pg_dump failed` | `docker compose up -d` in `platform/` |
| `type "AttemptStatus" already exists` | Add `-ReplaceExisting` to the script |
| Health OK but wrong data | Vercel `DATABASE_URL` is not the **pooled** Neon URL — fix and redeploy |
| Localhost works, production empty | You imported to Neon but Vercel still uses old `DATABASE_URL` |
| **Failed to save assignments** online (local OK) | Neon is missing newer columns. Against the **Neon** `DATABASE_URL` run: `npm run db:assignment-soft` then `npm run db:assignment-order` (or paste those SQL files in Neon SQL Editor). Redeploy not required. |
| Password with special characters | URL-encode `@`, `#`, `%` in the password part of the connection string |

**Security:** Never commit Neon passwords to git. Rotate the Neon password if it was shared in chat.
