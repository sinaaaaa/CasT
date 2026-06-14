"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Map } from "lucide-react";
import {
  AssessmentGridMap,
  GridMapLegend,
  RouteMapAnchorBar,
} from "@/components/assessment/assessment-grid-map";
import type { PathBuildingAnalysisResult } from "@/lib/assessment/pathBuildingAnalysis";
import { buildFirstMistakeMessages } from "@/lib/assessment/program-diff-visual";

export function PathMapSection({
  result,
  activeStep,
  defaultOpen = true,
}: {
  result: PathBuildingAnalysisResult;
  activeStep: number | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const hasPaths =
    result.studentPath.length > 1 ||
    result.closestValidPath.length > 1 ||
    result.shortestPath.length > 1;

  if (!hasPaths) return null;

  const referencePath =
    result.selectedReferencePath.length > 1
      ? result.selectedReferencePath
      : result.closestValidPath.length > 1
        ? result.closestValidPath
        : result.shortestPath;
  const firstMistakeStep = result.firstMistakeStep;
  const mistakeMessages = buildFirstMistakeMessages(firstMistakeStep);
  const attemptedObstacle =
    result.attemptedObstacleCells[0] ?? null;

  const mapProps = {
    routeStartPosition: result.routeStartPosition,
    routeGoalPosition: result.routeGoalPosition,
    goalLabel: result.goalLabel,
    studentEndPosition: result.studentEndPosition,
    objectMarkers: result.objectMarkers,
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/70">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50/80"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <Map className="h-4 w-4 text-sky-700" />
          Path visualization
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4">
          {mistakeMessages && (
            <p className="text-xs font-medium text-amber-800">{mistakeMessages.pathMapSubtitle}</p>
          )}
          <RouteMapAnchorBar
            routeStartPosition={result.routeStartPosition}
            routeGoalPosition={result.routeGoalPosition}
            goalLabel={result.goalLabel}
            studentEndPosition={result.studentEndPosition}
          />
          <GridMapLegend compact />
          <div className="grid gap-4 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <AssessmentGridMap
                title="Student path"
                subtitle="Route the student built"
                path={result.studentPath}
                pathStates={result.studentPathStates}
                collisions={result.attemptedObstacleCells}
                pathClass="bg-sky-500"
                borderClass="border-sky-200/80 bg-sky-50/30"
                highlightStep={activeStep}
                fadeAfterStep={firstMistakeStep}
                attemptedObstacleCell={attemptedObstacle}
                pulseGoal
                dimmed={activeStep != null}
                {...mapProps}
              />
            </motion.div>
            {referencePath.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
              >
                <AssessmentGridMap
                  title="A correct way"
                  subtitle="How the robot can reach the goal"
                  path={referencePath}
                  collisions={[]}
                  pathClass="bg-emerald-500"
                  borderClass="border-emerald-200/80 bg-emerald-50/30"
                  highlightStep={activeStep}
                  pulseGoal
                  dimmed={activeStep != null}
                  {...mapProps}
                  studentEndPosition={referencePath[referencePath.length - 1]}
                />
              </motion.div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
