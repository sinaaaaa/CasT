# Stealth CT Assessment Architecture (ECD)

This document describes the Evidence-Centered Design (ECD) assessment layer added to the SPARC platform **without replacing** existing `LevelAttempt`, `AssessmentResult`, or student data.

## Flow

```
TASK (level + CT construct weights)
  → gameplay evidence (commands, simulation, route comparison)
  → construct inference (weighted scores 0–100)
  → teacher interpretation (plain language)
  → recommendation (next practice)
```

## Modules (`platform/src/lib/assessment/`)

| File | Role |
|------|------|
| `assessmentTypes.ts` | ECD types: evidence, scores, teacher summary |
| `assessmentConfig.ts` | Mastery bands, task-type emphasis, task config builder |
| `routeAnalysis.ts` | `simulateProgram`, `findOptimalRoute` (BFS), `compareRoutes` |
| `assessmentEngine.ts` | `extractEvidence`, `calculateConstructScores`, `runStealthAssessment` |
| `assessmentNarratives.ts` | `generateTeacherNarrative` |
| `teacherInterpretation.ts` | `generateRecommendations`, `buildInterpretations` |
| `persist.ts` | `analyzeStealthAssessment` — writes DB + syncs construct rows |

## Database (additive)

New table: **`StealthAssessmentResult`** (one row per attempt, versioned `assessmentVersion = "v1"`).

- Does **not** modify `LevelAttempt` rows except via existing construct performance sync.
- Legacy **`AssessmentResult`** (Unity dimension ints) unchanged.
- Old attempts remain valid; run backfill to create stealth rows.

## Integration

1. **`POST /api/game/level-end`** — already calls `analyzeAttemptConstructs`, which now prefers the stealth engine.
2. **`POST /api/ct/analyze-attempt`** — same path for teacher re-analysis.
3. **Teacher UI** — `StealthAssessmentPanel` on attempt detail when `stealthAssessment` exists.

## Level config (optional)

```json
{
  "assessment": {
    "taskType": "multi-stage-navigation",
    "compareWithOptimalRoute": true,
    "requiredGoalOrder": true
  }
}
```

If omitted, task type is inferred from `visitObjectSequence`, obstacles, layout mode, etc.

## Mastery bands

| Score | Band |
|-------|------|
| 0–39 | Emerging |
| 40–64 | Developing |
| 65–84 | Proficient |
| 85–100 | Advanced |

## Backfill

```bash
cd platform
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/add_stealth_assessment_result.sql
npx tsx scripts/backfill-stealth-assessment.ts
```

Creates `StealthAssessmentResult` for ended attempts that lack one; does not alter original attempt payloads.

## Example output

See `platform/src/lib/assessment/__examples__/sample-output.json`.
