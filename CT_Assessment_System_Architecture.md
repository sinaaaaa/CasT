# CT Assessment System — Technical Architecture

This document explains how the SPARC Computational Thinking (CT) assessment system works end to end: from student gameplay through simulation, mistake detection, scoring, and teacher-facing reports.

**Implementation location:** The assessment engine lives in the Next.js platform at `platform/src/lib/assessment/`. Unity runs the game and sends attempt telemetry; the platform performs deterministic simulation, diagnosis, and scoring.

---

## 1. System Overview

### 1.1 The assessment pipeline

The system is **task-aware**. It does not apply one formula to every level. Instead, it detects the task type, runs the appropriate analyzer, and produces teacher-friendly explanations grounded in what actually happened to the robot.

```
Student gameplay (Unity)
        │
        ▼
   Gameplay logs
   (commands, flag, blanks, events, mistakes)
        │
        ▼
   POST /api/game/level-end
        │
        ▼
   Task-type detector
   (LevelType + level config + layout)
        │
        ▼
   Simulation engine
   (simulateProgram — robot state over time)
        │
        ▼
   Task-specific mistake detector
   (prediction / choice / path / debug / number line)
        │
        ▼
   Score calculator
   (task-specific rubric → 0–100)
        │
        ▼
   Teacher explanation generator
   (behaviors → interpretations → recommendations)
        │
        ▼
   Dashboard report
   (teacher UI + persisted StealthAssessmentResult)
```

### 1.2 Evidence-Centered Design (ECD)

The engine follows ECD principles:

| Layer | What it captures |
|-------|------------------|
| **Task** | Level type, goals, obstacles, starter program, teacher solution |
| **Evidence** | Commands, simulation path, flag position, blank answers, edit diff |
| **Inference** | Mistake type, route quality, repair status, score |
| **Teacher output** | Plain-language summary, next-step recommendation, visuals |

### 1.3 Unity ↔ platform split

| Component | Role |
|-----------|------|
| **Unity** (`GameAssessmentClient`, `CharacterMove`) | Runs levels, records `finalCommand`, `mistakes`, flag cells, blank answers, command events |
| **Platform** (`runStealthAssessment`) | Simulates routes, classifies mistakes, scores, writes teacher narrative |
| **Teacher UI** (`AttemptAssessmentView`) | Shows task-specific panels; path/debugging detail is often **recomputed live** for freshness |

### 1.4 Why task-aware assessment matters

A prediction task (place a flag) requires different evidence than a debugging task (repair a broken program). Comparing every attempt to the shortest BFS route would produce misleading teacher messages on flag levels. The engine branches early and only uses route comparison where it helps explain student thinking.

---

## 2. Task Types

Levels are classified using Prisma `LevelType`, level configuration JSON, and layout mode. Each maps to a dedicated analyzer.

### 2.1 Task type summary

| Student experience | Level type / signal | Analyzer module |
|--------------------|---------------------|-----------------|
| **Prediction / Flag** | `FLAG_PLACEMENT` or flag-placement config | `predictionAnalysis.ts` |
| **Choose Action** | `CHOOSE_BUTTONS` or guided blanks | `choiceActionAnalysis.ts` |
| **Drag Action Blocks / Path Building** | `DRAG_ACTIONS` | `pathBuildingAnalysis.ts` |
| **Edit Starter Program / Debugging** | `DRAG_EDIT_PROGRAM` | `editStarterDebuggingAnalysis.ts` |
| **Number Line** | `layoutMode: "NUMBER_LINE"` | `numberLineAnalysis.ts` |

### 2.2 Prediction / Flag

**What the student does:** Watches a fixed command sequence and places a flag where they think the robot will stop.

**What is assessed:**
- Student flag cell vs. simulated correct endpoint
- Optional misconception models (left/right swap, turn-as-move, ignored turn, wrong start direction, forward/backward confusion)

**What is NOT used:** Shortest-route BFS, route efficiency, or command-sequence editing.

**Success rule:** Flag cell exactly matches the correctly simulated final position.

### 2.3 Choose Action

**What the student does:** Fills one or more guided blanks in a program (e.g., pick Forward vs. Turn Left for step 3).

**What is assessed:**
- Each blank answer vs. `levelConfig.blanks[].correctAnswer`
- Optional simulation to detect obstacle collisions in the resulting program

**Success rule:** All blanks filled and every choice matches the correct answer.

### 2.4 Drag Action Blocks / Path Building

**What the student does:** Builds a full command route from scratch.

**What is assessed:**
1. Simulate the student program
2. Check goal success (must **stop** on goal — see Section 6)
3. Compare to a smart-selected reference route
4. Find the **first important mistake**
5. Classify route quality and score

**Success rule:** `programStopsOnGoalStrict` — robot ends on the goal cell with correct final facing when required.

### 2.5 Edit Starter Program / Debugging

**What the student does:** Repairs a broken starter program on the yellow command strip.

**What is assessed:**
- Diff between **original program**, **student repair**, and **working fix options**
- Whether the bug is actually fixed (strict stop-on-goal)
- Repair status: over-fix, under-fix, wrong turn, wrong order, no repair, etc.
- Repair quality label for the dashboard

**Success rule:** Student program stops on the goal after repair; passing through the goal without stopping does **not** count as fixed.

### 2.6 Number Line

**What the student does:** Counts robot steps along a horizontal number line (ticks), often with visit targets.

**What is assessed:**
- Step counting accuracy
- Direction correspondence (arrow vs. movement)
- Visit order on ticks
- Movement sequencing and orientation

**What is NOT used:** Grid route comparison or BFS shortest path.

---

## 3. Simulation Engine

**Module:** `platform/src/lib/assessment/routeAnalysis.ts` — `simulateProgram`

The simulation engine is the shared foundation for grid-based tasks. It replays commands deterministically so assessment does not depend on Unity physics quirks.

### 3.1 Robot state

| State variable | Description |
|----------------|-------------|
| **Position** | Grid cell `{x, y}`. On number line, `x` is the tick index. |
| **Facing** | Unit direction vector (up, right, down, left). Turns rotate in place using Unity-matched rules. |
| **Goal progress** | Tracks which goals were visited and in what order (multi-goal levels). |

### 3.2 Commands

| Command | Effect |
|---------|--------|
| **Forward** | Move one cell in the facing direction |
| **Backward** | Move one cell opposite to facing |
| **Turn Left** | Rotate 90° counter-clockwise in place |
| **Turn Right** | Rotate 90° clockwise in place |

Commands are resolved from `finalCommand`, command events, guided actions, and level config via `resolveAttemptProgram`.

### 3.3 Obstacles and boundaries

- Obstacle cells come from `gridObjects` where `blocksRobot` is true or `objectType === "block"`.
- If forward/backward movement is blocked, the robot does not move.
- A blocked move increments `wrongTurns` and records `obstacleCollision` on that step.

### 3.4 Step history

Every command produces a `SimulationStep` recording:

- Position before and after
- Facing before and after
- Whether the step collided with an obstacle or boundary
- Goal touch events at that step

### 3.5 Simulation output (conceptual)

The engine produces a rich result used by all downstream analyzers:

```
SimulationResult
├── commands[]              // parsed command list
├── path[]                  // cell positions visited
├── pathStates[]            // position + facing per step
├── steps[]                 // full step-by-step history
├── finalPosition           // where the robot ended
├── finalDirection          // which way it faces
├── collisions[]            // boundary collision cells
├── reachedGoals[]          // goal IDs touched
├── goalCompletion          // 0–1 progress
├── correctGoalOrder        // multi-goal sequence OK?
├── passed                  // legacy pass flag
├── obstacleCollisionCount
├── firstObstacleMistakeStep
└── attemptedObstacleCells[]
```

### 3.6 Goal relationship (semantic layer)

`analyzeGoalRelationship` derives teacher-meaningful outcomes:

| Field | Meaning |
|-------|---------|
| `goalTouched` | Robot visited the goal cell at any point |
| `stoppedOnGoal` | Robot's **final** position is on the goal |
| `passedThroughGoal` | Touched goal but stopped elsewhere |
| `distanceFromGoal` | Manhattan distance from final position to goal |
| `passedGoalDistance` | How far past the goal the robot stopped |
| `finalDirectionCorrect` | Required facing matches (when level requires it) |

### 3.7 Optimal route finder

`findOptimalRoute` uses BFS over `(position, facing, goalProgress)` to discover shortest valid command sequences (up to 12 stored). This powers comparison targets but is **not** always the comparison chosen — see Section 5.

---

## 4. Mistake Detection

Mistake detection is **exact and task-specific**. The system prioritizes the **first explainable mistake** and describes what happened to the robot, not only that answers differ.

### 4.1 Prediction / Flag mistakes

| Mistake type | Teacher meaning |
|--------------|-----------------|
| **Correct** | Flag matches simulated endpoint |
| **One-step counting error** | Flag is one cell away from correct |
| **Left/right turn confusion** | Flag matches a model where L/R are swapped |
| **Turn as movement error** | Flag matches treating a turn like sideways movement |
| **Ignored turn error** | Flag matches a path where a turn did not change facing |
| **Wrong start direction** | Flag matches starting from wrong facing |
| **Forward/backward confusion** | Flag matches F/B reversed |
| **Opposite movement error** | Flag suggests reversed movement direction |
| **Invalid flag position** | Flag outside the grid |
| **Unclear** | No strong misconception pattern |

**Detection method:** Run the command list under misconception models; match student flag to each model's endpoint. Use Manhattan distance and match quality (`strong` / `close` / `possible` / `weak`).

### 4.2 Path building mistakes

| Mistake type | Teacher meaning |
|--------------|-----------------|
| **Wrong rotation** | Wrong turn (left vs. right) at a step |
| **Forward instead of turn** | Student moved when they should have turned |
| **Turn instead of forward** | Student turned when they should have moved |
| **Extra forward** | Unnecessary forward movement |
| **Missing forward** | Needed forward movement omitted |
| **Wrong command order** | Right commands, wrong sequence |
| **Goal order error** | Visited goals out of required order |
| **Skipped subgoal** | Missed an intermediate goal |
| **Obstacle collision** | Tried to move through blocked cell |
| **Boundary collision** | Tried to move off the grid |
| **Opposite direction** | Movement opposite to intended |
| **Unclear route** | Cannot classify cleanly |

**Detection flow:**

```
simulate(studentProgram)
    → chooseComparisonTarget()
    → resolveFirstMistakeStep()
    → interpretSemanticIssue()   // robot outcome first
    → detectMistake()            // PathMistakeType
```

### 4.3 Debugging mistakes

| Category | Examples |
|----------|----------|
| **Repair status** | `correctFix`, `partialFix`, `overFix`, `underFix`, `noRepair`, `wrongTurnFix`, `wrongOrderFix`, `wrongDirectionFix`, `successfulButInefficient` |
| **Detected mistake** | `overAddedForward`, `underAddedForward`, `oppositeTurn`, `wrongCommandAdded`, `correctCommandWrongPosition`, `extraUnrelatedCommand`, `fullRewriteCorrect`, `collisionRepairError` |

**Key rules:**
- Compare student repair to original starter and to working fix options
- `bugFixed` requires `programStopsOnGoalStrict` — not merely touching the goal
- Program diff alignment (LCS) highlights added, removed, and changed commands

### 4.4 Number line mistakes

| Issue | Teacher meaning |
|-------|-----------------|
| **Off by one** | Step count is one short or long |
| **Wrong direction** | Movement does not move toward the goal tick |
| **Too many / too few steps** | Total moves vs. optimal visit path |
| **Direction confusion** | Arrow or facing does not match movement |
| **Visit order error** | Visit targets reached in wrong sequence |

### 4.5 Semantic interpretation (cross-cutting)

When simulation reveals a clear robot outcome, `semanticInterpretation.ts` produces teacher copy before falling back to raw command diffs:

| Semantic issue | Example message |
|----------------|-----------------|
| `obstacle_collision` | "Robot tried to move through an obstacle at Step 3." |
| `passed_goal` | "Robot passed the goal and stopped 1 cell beyond." |
| `extra_command` | "Student added 1 extra Forward." |
| `wrong_turn` | "Wrong turn at Step 2." |
| `stopped_before_goal` | "Robot stopped before reaching the goal." |
| `missing_command` | "Student did not add the forward needed to reach the goal." |

---

## 5. Smart Comparison Selection

The system **does not always compare the student route to the shortest path**. Shortest is one candidate; the goal is the comparison that yields the **clearest teacher explanation**.

### 5.1 Comparison candidates

| Target type | When used |
|-------------|-----------|
| **Teacher solution** | Level has an authored reference program |
| **Shortest valid route** | BFS optimal path to goal |
| **Closest valid route** | Valid route most similar in length/shape to student |
| **Alternate valid route** | Another valid path that explains a single mistake better |

**Module:** `comparison-target.ts` — `chooseComparisonTarget`

### 5.2 Selection scoring factors

The selector scores each candidate on:

- **Single-mistake explainability** — Can one step difference explain the divergence?
- **Shared prefix length** — How many leading commands match?
- **Program similarity** (LCS-based)
- **Length similarity**
- **Teacher solution preference** when it explains equally well
- **Obstacle / multi-goal bonuses** when relevant

### 5.3 Example

```
Student:   F  L  F  F  F
Shortest:  F  R  F  F  F
                    ↑
              Step 2 — wrong turn

Diagnosis: "Wrong turn at Step 2."
Comparison target: shortest valid route (or teacher solution if authored)
```

If the shortest route diverges at step 4 but the teacher solution diverges at step 2 with the same mistake pattern as the student, the teacher solution may be selected for clearer diagnosis.

### 5.4 When comparison is disabled

Route comparison is **skipped** for:

- Flag / prediction levels
- Choose-action levels
- Path-building levels (uses dedicated path analyzer instead of generic `compareRoutes`)
- Debugging levels (uses program diff + working fix options)

Generic grid navigation levels may still use `compareRoutes` for efficiency metrics.

---

## 6. Goal Success Rule

> **The robot only succeeds if it STOPS on the goal.**

This rule is enforced by `programStopsOnGoalStrict` and applied consistently to path building and debugging.

### 6.1 Outcome matrix

| Robot outcome | Counts as success? | Typical classification |
|---------------|---------------------|------------------------|
| Stops on goal, correct facing | ✅ Yes | Correct / Valid route / Bug fixed |
| Passes through goal, stops elsewhere | ❌ No | `passed_goal` / over-fix |
| Stops before goal | ❌ No | `stopped_before_goal` / under-fix |
| Hits obstacle | ❌ No | `obstacle_collision` |
| Wrong final direction (when required) | ❌ No | `wrong_direction` |

### 6.2 Debugging: do not mark as fixed if…

- Robot **passed** the goal but did not stop on it
- Robot stopped **before** the goal
- Robot hit an **obstacle**
- Robot reached goal but **wrong final facing** when the level requires a specific direction

### 6.3 Path building: route quality interaction

Even a route that "almost works" is downgraded when `stoppedOnGoal` is false. Semantic interpretation surfaces "passed goal" or "stopped early" before generic "incorrect route" labels.

---

## 7. Scoring

Scores are **0–100** and mapped to mastery bands:

| Score range | Mastery band |
|-------------|--------------|
| 0–39 | Emerging |
| 40–64 | Developing |
| 65–84 | Proficient |
| 85–100 | Advanced |

### 7.1 Prediction / Flag

| Outcome | Score (approx.) |
|---------|-----------------|
| Exact flag match | **100** |
| One cell away | **75** |
| Strong misconception match | **~58** |
| Close misconception + distance 1 | **~48** |
| Possible misconception match | **~42** |
| Unclear / far from correct | **10–30** (distance-based) |
| Invalid flag position | **15** |

### 7.2 Choose Action

| Outcome | Score |
|---------|-------|
| All blanks correct | **100** |
| Filled but wrong | **35** |
| Incomplete (not all blanks) | **15** |

Obstacle collision may override the explanation but uses the same score tiers unless extended logic applies.

### 7.3 Path Building

Base score from `scoreForQuality` (adjusted by goal progress 0–1):

| Route quality | Score range |
|---------------|-------------|
| Exact Route | **95–100** |
| Valid Route | **88–95** |
| Valid but Extra Commands | **72–82** |
| Close Route | **55–70** |
| Partial Route | **38–55** |
| Goal Order Error | **35–55** |
| Obstacle Collision | **25–40** |
| Incorrect Route | **12–30** |

### 7.4 Debugging

Base score from `scoreForRepair`:

| Repair status | Score range (approx.) |
|---------------|----------------------|
| `correctFix` | **92–100** |
| `successfulButInefficient` | **78–88** |
| `partialFix` | **45–70** |
| `overFix` | **55–70** |
| `underFix` | **50–62** |
| `wrongTurnFix` | **35–53** |
| `wrongOrderFix` | **40–58** |
| `wrongDirectionFix` | **~42** |
| `noRepair` | **8–18** |
| Other incorrect fixes | **15–35** |

The dashboard also shows a **Repair Quality Level** (Section 8) derived from repair status + program match to preferred fix.

### 7.5 Number Line

Number line levels produce **component metrics** (each 0–100):

- Start position recognition
- Direction accuracy
- Step counting accuracy
- Arrow-to-movement correspondence
- Movement sequencing
- Orientation understanding

These feed the teacher narrative rather than a single route-efficiency score.

---

## 8. Repair Quality Levels

For debugging tasks, the UI maps technical `RepairStatus` values to teacher-friendly **Repair Quality Levels**.

| Level | Teacher-friendly meaning |
|-------|--------------------------|
| **Exact Repair** | Student's program matches the preferred minimal fix exactly. Bug fixed. |
| **Efficient Repair** | Bug fixed with a valid program that is as short or shorter than the preferred fix. |
| **Alternate Valid Repair** | Bug fixed, but student used a different valid approach (e.g., extra commands). |
| **Close Repair** | Student was on the right track — e.g., over-fix (passed goal) or near-correct edit. |
| **Partial Repair** | Some correct edits, but robot does not fully succeed. |
| **Incorrect Repair** | Student changed the program but the bug is not fixed, or changes made things worse. |
| **No Repair** | Student left the starter program unchanged. |

### 8.1 How levels are resolved

```
if studentProgram == starterProgram → No Repair
if bugFixed && studentProgram == preferredFix → Exact Repair
if bugFixed && studentProgram.length <= preferredFix.length → Efficient Repair
if bugFixed → Alternate Valid Repair
if partialFix status → Partial Repair
if overFix / underFix / wrongTurnFix with decent score → Close Repair
else → Incorrect Repair
```

Each level has dashboard styling (color, icon tone) defined in `REPAIR_QUALITY_META`.

---

## 9. Dashboard Output

The teacher dashboard (`AttemptAssessmentView` and task-specific panels) is designed for **clarity, not technical overload**.

### 9.1 What teachers should see (primary)

| Field | Example |
|-------|---------|
| **Task type** | "Path Building" / "Debugging" / "Prediction" |
| **Result label** | "Close Route" / "Exact Repair" / "One step off" |
| **First important mistake** | "Wrong turn at Step 2" |
| **Exact issue** | Semantic primary issue line |
| **Robot outcome** | "Robot passed the goal and stopped 1 cell beyond." |
| **What this means** | Interpretation in plain language |
| **Recommended next step** | Actionable practice suggestion |
| **Visual program comparison** | Color-coded command chips (match / wrong / extra / missing) |
| **Route visualization** | Grid path overlay when applicable |

### 9.2 What stays collapsed (advanced)

- Comparison target type (`shortestValidRoute` vs `teacherSolution`)
- Diagnosis clarity score
- Full misconception model table
- Raw construct metric weights
- Internal `RepairStatus` enum values

### 9.3 ECD narrative structure

`generateTeacherNarrative` produces a `TeacherAssessmentSummary`:

```
Behaviors      →  observable facts ("Student placed flag at row 3, column 5")
Interpretations →  what it means ("May show left/right turn confusion")
Recommendations →  next practice ("Assign a one-turn prediction level")
```

### 9.4 Task-specific panels

| Task | Panel component |
|------|-----------------|
| Flag / Prediction | `PredictionAnalysisPanel` |
| Choose Action | `ChoiceActionAnalysisPanel` |
| Path Building | `PathBuildingAnalysisPanel` |
| Debugging | `DebuggingAnalysisPanel` + `RepairQualityCard` |
| Number Line | `NumberLineAssessmentPanel` |
| Generic grid | `TeacherAssessmentReport` + `RouteAnalysisPanel` |

### 9.5 Persisted data

On level end, `analyzeStealthAssessment` writes a `StealthAssessmentResult` row:

- `overallScore`, `overallMastery`, `confidence`
- `evidence` (metrics, behaviors, simulation snippet)
- `routeAnalysis` (when applicable)
- `teacherSummary`, `recommendations`

Path-building and debugging **full diagnoses** are often recomputed live on the teacher page for the richest detail.

---

## 10. Examples

### Example 1 — Prediction: wrong turn

**Setup:** Commands `F, R, F`. Student places flag where the robot would land if the turn were **Left** instead of **Right**.

**Detection:**
- Misconception model `leftRightSwapped` endpoint matches flag
- `detectedMistakeType`: `leftRightTurnConfusion`
- `matchQuality`: `strong`

**Dashboard output:**
- Result: Misconception match (~58 score) or close tier depending on distance
- Issue: "Student's flag matches where the robot would land if left and right turns were swapped."
- Next step: "Assign another prediction task with one turn and discuss left vs right from the robot's view."

---

### Example 2 — Debugging: extra forward

**Setup:**
- Expected fix: `F  R  F`
- Student: `F  R  F  F`

**Detection:**
- `bugFixed`: false (robot passes goal, stops 1 cell beyond)
- `repairStatus`: `overFix`
- Semantic issue: `passed_goal`
- Repair quality: **Close Repair**

**Dashboard output:**
| Field | Value |
|-------|-------|
| Issue | Student added 1 extra Forward |
| Robot outcome | Robot passed goal by 1 cell |
| Score | ~55–70 (overFix range) |
| Label | Close Repair |
| Next step | Practice counting steps so the robot stops on the goal, not past it |

---

### Example 3 — Path building: wrong turn at step 2

**Setup:**
```
Student:   F  L  F  F  F
Correct:   F  R  F  F  F
```

**Detection:**
- Comparison target: shortest valid route (or teacher solution)
- `firstMistakeStep`: 2
- `PathMistakeType`: `wrongRotation`
- Semantic: `wrong_turn`

**Dashboard output:**
- Issue: **Wrong turn at Step 2**
- Route quality: Close Route or Partial Route (depending on final position)
- Visual: Step 2 chip highlighted as "Wrong turn"

---

### Example 4 — Obstacle collision

**Setup:** Student program includes forward into a blocked cell.

**Detection:**
- `obstacleCollision` at step N
- `PathMistakeType`: `obstacleCollision`
- Semantic: `obstacle_collision`

**Dashboard output:**
- Issue: **Robot tried to move through blocked space**
- Detail: "Student tried to move through the obstacle at Step N."
- Route quality: Obstacle Collision (score ~25–40)
- Next step: Practice planning around blocked cells

---

## 11. Why This Is Smart Assessment

Traditional grading often stops at **correct / incorrect**. The SPARC CT assessment system goes further by explaining **student thinking from gameplay evidence**.

### 11.1 What makes it "smart"

| Capability | Benefit |
|------------|---------|
| **Deterministic simulation** | Same commands always produce the same diagnosis |
| **Task-specific logic** | Prediction is not graded like path building |
| **Mistake classification** | Names the error pattern, not just "wrong" |
| **Semantic robot outcome** | "Passed goal" vs "stopped before goal" vs "hit obstacle" |
| **Smart comparison selection** | Chooses the reference route that best explains one clear mistake |
| **Teacher-friendly language** | ECD behaviors → interpretations → recommendations |

### 11.2 What teachers gain

- See **where** the student went wrong (step number, command chip)
- Understand **why** it went wrong (misconception model or semantic issue)
- Know **what to assign next** (targeted recommendation)
- Review **visual evidence** (program diff, route map) without reading code

### 11.3 What developers should know

| Topic | Location |
|-------|----------|
| Main pipeline | `assessmentEngine.ts` → `runStealthAssessment` |
| Simulation | `routeAnalysis.ts` |
| Comparison selection | `comparison-target.ts` |
| Path building | `pathBuildingAnalysis.ts` |
| Debugging | `editStarterDebuggingAnalysis.ts` |
| Prediction | `predictionAnalysis.ts` |
| Teacher copy | `assessmentNarratives.ts`, `teacherInterpretation.ts`, `semanticInterpretation.ts` |
| UI | `platform/src/components/assessment/` |
| API trigger | `POST /api/game/level-end` |
| Unity telemetry | `Assets/Scripts/GameAssessmentClient.cs` |

### 11.4 Architecture diagram (full stack)

```
┌─────────────────────────────────────────────────────────────┐
│                        UNITY GAME                           │
│  Robot movement · UI · Flag · Blanks · Command strip        │
└──────────────────────────┬──────────────────────────────────┘
                           │ level-end payload
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   NEXT.JS PLATFORM API                      │
│  /api/game/level-end → analyzeStealthAssessment             │
└──────────────────────────┬──────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   Task detector    simulateProgram    Evidence extractors
          │                │                │
          └────────────────┼────────────────┘
                           ▼
              Task-specific analyzers
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     Mistake type      Score 0–100    Teacher narrative
                           │
                           ▼
              StealthAssessmentResult (DB)
                           │
                           ▼
              Teacher dashboard (live + persisted)
└─────────────────────────────────────────────────────────────┘
```

---

## Appendix A — Key type reference (developers)

### Prediction mistake types
`correct`, `oneStepCountingError`, `leftRightTurnConfusion`, `turnAsMoveError`, `ignoredTurnError`, `wrongStartDirection`, `forwardBackwardConfusion`, `oppositeMovementError`, `invalidFlagPosition`, `unclear`

### Path mistake types
`wrongRotation`, `turnInsteadOfForward`, `forwardInsteadOfTurn`, `extraForward`, `missingForward`, `wrongCommandOrder`, `goalOrderError`, `skippedSubgoal`, `obstacleCollision`, `boundaryCollision`, `oppositeDirection`, `unclearRoute`, `none`

### Route quality levels
`Exact Route`, `Valid Route`, `Valid but Extra Commands`, `Close Route`, `Partial Route`, `Incorrect Route`, `Goal Order Error`, `Obstacle Collision`

### Repair statuses
`correctFix`, `partialFix`, `incorrectFix`, `overFix`, `underFix`, `wrongTurnFix`, `wrongCommandFix`, `wrongOrderFix`, `wrongDirectionFix`, `noRepair`, `successfulButInefficient`

### Semantic issue types
`obstacle_collision`, `passed_goal`, `extra_command`, `wrong_turn`, `wrong_command`, `wrong_direction`, `missing_command`, `stopped_before_goal`, `inefficient_route`, `correct`, `unknown`

---

## Appendix B — Related documentation

- `platform/docs/STEALTH_ASSESSMENT.md` — ECD module overview and backfill instructions
- `platform/src/lib/assessment/__examples__/sample-output.json` — example JSON shape (note: construct scoring in samples may reflect an older engine version)

---

*Document version: aligned with stealth assessment engine `assessmentVersion: "v1"` and platform modules as of project snapshot.*
