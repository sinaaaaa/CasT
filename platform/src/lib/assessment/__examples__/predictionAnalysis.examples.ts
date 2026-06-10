/**
 * Runnable examples for flag / prediction diagnosis.
 * Run: npx tsx src/lib/assessment/__examples__/predictionAnalysis.examples.ts
 */

import { analyzePrediction } from "../predictionAnalysis";
import type { RobotCommand } from "../assessmentTypes";

const start = { x: 2, y: 2 };
const up = { x: 0, y: 1 };

function run(name: string, commands: RobotCommand[], flag: { x: number; y: number }) {
  const r = analyzePrediction({
    startPosition: start,
    startDirection: up,
    givenCommands: commands,
    studentFlagPosition: flag,
    gridSize: { cols: 6, rows: 6 },
  });
  console.log(`\n=== ${name} ===`);
  console.log({
    isCorrect: r.isCorrect,
    score: r.score,
    level: r.level,
    mistake: r.detectedMistakeType,
    matchQuality: r.matchQuality,
    explanation: r.teacherExplanation,
  });
}

// 1. Correct flag — one forward from (2,2) → (2,3)
run("correct", ["forward"], { x: 2, y: 3 });

// 2. One-step error
run("one-step error", ["forward"], { x: 2, y: 2 });

// 3. Left/right swapped — correct (1,3); swapped path ends (3,3)
run("left/right swapped", ["forward", "turn left", "forward"], { x: 3, y: 3 });

// 4. Turn-as-move — turn right moves sideways to (3,3) without rotating
run("turn-as-move", ["forward", "turn right"], { x: 3, y: 3 });

// 5. Ignored turns — correct (1,3); ignored ends (2,4)
run("ignored turns", ["forward", "turn left", "forward"], { x: 2, y: 4 });

// 6. Wrong start direction — facing right: two forwards → (4,2)
run("wrong start direction", ["forward", "forward"], { x: 4, y: 2 });

// 7. Forward/backward confusion — correct ends (2,3); swapped ends (2,2)
run("forward/backward confusion", ["forward", "backward", "forward"], { x: 2, y: 2 });

// 8. Unclear
run("unclear", ["forward", "turn left", "forward"], { x: 0, y: 0 });
