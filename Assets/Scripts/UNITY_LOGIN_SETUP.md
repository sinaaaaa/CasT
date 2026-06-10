# Unity login with Student ID → Platform

## Part 1 — Start the platform (once per session)

```bash
cd platform
docker compose up -d
npm run db:push
npm run db:seed
npm run dev
```

Check: open http://localhost:3000/api/health/db — should show `"ok": true`.

---

## Part 2 — Main Menu scene setup (5 minutes)

### Step 1: Open `MainMenu` scene

### Step 2: Remove old Flask object (optional)

- **FlaskCommunication** in the scene is OK — it now forwards to the platform (port 3000). Prefer **PlatformBootstrap** on the same object.

### Step 3: Add platform bootstrap

1. Select your **LoginManager** object (or create empty **PlatformServices**).
2. **Add Component** → `PlatformBootstrap`
3. Set Inspector:
   - **Platform Url** = `http://localhost:3000`
   - **Game Api Key** = `sparc-game-dev-key-change-in-production`  
     (must match `GAME_API_KEY` in `platform/.env`)

`PlatformBootstrap` also adds `GameAssessmentClient` for level tracking.

### Step 4: Wire LoginManager UI

On **LoginManager** component:

| Field | Assign |
|--------|--------|
| Student Id Input | Your ID `InputField` |
| Login Button | Your Login button |
| Status Text | Message label (optional) |
| Platform Url | `http://localhost:3000` |

### Step 5: Login button

Either:

- LoginManager already hooks the button in `Start()`, **or**
- Button OnClick → `LoginManager.OnLoginButtonClicked`

### Step 6: Play mode test

1. Press **Play**
2. Enter student ID: `1001` (or `1001` for new student — auto-created)
3. Click **Login**
4. Console should show: `[PlatformBootstrap] Ready` then `Login successful!`
5. Scene loads (LoadingScene → Level1)

Seeded test IDs: `1001`–`1004` (maps to `STU-1001` …) or use any new number.

---

## What happens on Login

```
Player enters "1001" → Login button
    → POST http://localhost:3000/api/game/student-signin
    → Header: X-Game-Api-Key
    → Body: { "studentId": "1001" }
    → PlayerPrefs "UserId" = "STU-1001"
    → Load game scene
```

Teachers see this student in http://localhost:3000/teacher/students after they play levels.

---

## WebGL build

- **Platform Url** must be your deployed server URL (not localhost) unless you test locally.
- Host game and API with CORS enabled (already configured on `/api/game/*`).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Cannot reach platform" | Run `npm run dev` in `platform/` |
| Database error | `docker compose up -d` then `npm run db:push` && `npm run db:seed` |
| Invalid API key | Match `Game Api Key` in Unity with `GAME_API_KEY` in `.env` |
| StudentDataManager not found | Add **PlatformBootstrap** to the scene (auto-creates it) — fixed in latest scripts |
