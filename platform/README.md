# SPARC Computational Thinking Assessment Platform

Next.js assessment dashboard for the Unity WebGL robot programming game. Collects detailed level-attempt evidence (commands, button events, robot touches) for teachers and shows progress to students.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS** + shadcn-style UI components
- **PostgreSQL** + **Prisma**
- **NextAuth** (credentials / JWT session)
- **Recharts** for teacher analytics

## Quick start (local)

### 1. Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL) or a local PostgreSQL instance

### 2. Install dependencies

```bash
cd platform
npm install
```

### 3. Environment

```bash
cp .env.example .env
```

Edit `.env` if needed. Default database URL matches `docker-compose.yml`.

### 4. Start PostgreSQL

```bash
docker compose up -d
```

### 5. Database setup

```bash
npm run db:push
npm run db:seed
```

For migration-based workflows:

```bash
npm run db:migrate
npm run db:seed
```

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Check database connectivity: [http://localhost:3000/api/health/db](http://localhost:3000/api/health/db)

## Troubleshooting: `Can't reach database server at localhost:5432`

Login will fail until PostgreSQL is running **and** seeded. A `401` on login usually means the DB is down, not wrong credentials.

### Option A — Docker Desktop (recommended)

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Start Docker Desktop and wait until it is running
3. In `platform/`:

```bash
docker compose up -d
npm run db:push
npm run db:seed
```

### Option B — PostgreSQL installed on Windows

1. Install PostgreSQL 16 from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Create database and user (pgAdmin or `psql`):

```sql
CREATE USER sparc WITH PASSWORD 'sparc_dev_password';
CREATE DATABASE sparc_assessment OWNER sparc;
```

3. Ensure `.env` matches:

```
DATABASE_URL="postgresql://sparc:sparc_dev_password@localhost:5432/sparc_assessment?schema=public"
```

4. Run:

```bash
npm run db:push
npm run db:seed
```

### Verify

```bash
# Should return {"ok":true,...}
curl http://localhost:3000/api/health/db
```

## Demo accounts (after seed)

| Role    | Email                   | Password     |
|---------|-------------------------|--------------|
| Admin   | admin@sparc.edu         | password123  |
| Teacher | teacher@sparc.edu       | password123  |
| Student | alex@student.sparc.edu  | password123  |
| Student | sam@student.sparc.edu   | password123  |

Unity external student IDs: `STU-1001` … `STU-1004`

### Admin (`/admin/*`)

- **User management** — create teachers/admins with email + password, create students, reset passwords, deactivate or archive accounts
- Only users with role `ADMIN` can access (teachers cannot)

## Panels

### Student (`/student/*`)

- Dashboard, progress, levels, per-level detail, attempt history

### Teacher (`/teacher/*`)

- Dashboard with analytics cards and charts
- Students list + detailed profile (command timeline, attempts)
- Classes, levels, attempt evidence page
- Reports and analytics views

## Unity WebGL API

All game endpoints require header:

```
X-Game-Api-Key: <GAME_API_KEY from .env>
```

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/game/level-start` | Start attempt, returns `attemptId` |
| POST | `/api/game/level-end` | Finalize attempt + scores |
| POST | `/api/game/save-command-event` | Log command change |
| POST | `/api/game/save-action-button-event` | Log button click/disable/close |
| POST | `/api/game/save-robot-touch-event` | Log robot drag/touch |
| POST | `/api/game/save-progress` | Mid-level progress snapshot |

Example C# client: `Assets/Scripts/GameAssessmentClient.cs`

### Main menu sign-in / sign-up (Unity)

1. Add **`PlatformCommunication`** and **`GameAssessmentClient`** to a DontDestroyOnLoad object in your main menu scene (or let them auto-create on first use).
2. Set on `PlatformCommunication` (Inspector):
   - **Platform Url** = `http://localhost:3000`
   - **Game Api Key** = same as `GAME_API_KEY` in `platform/.env`
3. `LoginManager` calls `PlatformCommunication.CheckOrCreateStudent(studentId)` when the player taps Login.
4. Endpoint: `POST /api/game/student-signin` with body `{ "studentId": "1001" }` — creates the student if new (same idea as old Flask).

After login, `PlayerPrefs` key `UserId` stores the external id (e.g. `STU-1001`). Use that for all assessment calls.

Set on `GameAssessmentClient`:

- `apiBaseUrl` = `http://localhost:3000`
- `gameApiKey` = same as `GAME_API_KEY` in `.env`

**Web dashboard login** (teachers/students in browser) still uses email + password at `/login` — separate from the in-game student ID flow.

## Project structure

```
platform/
├── prisma/schema.prisma    # Data models
├── prisma/seed.ts          # Demo data
├── src/app/api/game/       # Unity ingestion APIs
├── src/app/api/teacher/    # Teacher REST APIs
├── src/app/student/        # Student UI
├── src/app/teacher/        # Teacher UI
└── docker-compose.yml      # PostgreSQL
```

## Production notes

- Set strong `NEXTAUTH_SECRET` and `GAME_API_KEY` (never commit real values)
- Set `NEXTAUTH_URL` to your public HTTPS URL (e.g. `https://your-app.vercel.app`)
- Set `GAME_CORS_ORIGIN` to your Unity WebGL origin(s), comma-separated (not `*` in production if avoidable)
- Use Neon **pooled** `DATABASE_URL` for PostgreSQL
- Use `prisma migrate deploy` or `db push` in CI/CD after schema changes
- Create production admin via `/admin/users` and **change all demo passwords**
- Deactivate unused accounts before sharing the public URL
- Put the app behind HTTPS; security headers are applied automatically

Protected routes:

| Area | Who can access |
|------|----------------|
| `/admin/*` | Admin only |
| `/teacher/*` | Teacher + Admin |
| `/student/*` | Student only |
| `/api/game/*` | Valid `X-Game-Api-Key` header |
| `/api/teacher/*`, `/api/admin/*` | Signed-in with correct role |
