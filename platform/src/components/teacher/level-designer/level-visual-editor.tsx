"use client";

import { LevelType } from "@prisma/client";
import type { LevelGameplayConfig } from "@/lib/level-config";
import { LEVEL_TYPE_HELP, LEVEL_TYPE_LABELS } from "@/lib/level-config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid3x3, Flag, ListTree, Settings2, MessageSquare } from "lucide-react";
import { GridDesigner } from "./grid-designer";
import { NumberLineDesigner } from "./number-line-designer";
import { LayoutModePicker } from "./layout-mode-picker";
import { isNumberLineLayout } from "@/lib/level-config";
import { RobotSettingsEditor } from "./robot-settings-editor";
import { CornerHintEditor } from "./corner-hint-editor";
import { GuidedProgramEditor } from "./guided-program-editor";
import { CommandBagsEditor } from "./command-bags-editor";
import { FlagSettingsEditor } from "./flag-settings-editor";
import { CopyLevelLayout } from "./copy-level-layout";
import { GeometryPathEditor } from "./geometry-path-editor";
import { GeometryPathToolsEditor } from "./geometry-path-tools-editor";
import { Briefcase } from "lucide-react";

const PLAYABLE_TYPES = [
  LevelType.DRAG_ACTIONS,
  LevelType.DRAG_EDIT_PROGRAM,
  LevelType.FLAG_PLACEMENT,
  LevelType.CHOOSE_BUTTONS,
  LevelType.GEOMETRY_PATH,
] as const;

type Props = {
  levelType: LevelType;
  config: LevelGameplayConfig;
  onChange: (config: LevelGameplayConfig) => void;
  levelName: string;
  currentLevelId?: string;
};

export function LevelVisualEditor({ levelType, config, onChange, levelName, currentLevelId }: Props) {
  function handleChange(c: LevelGameplayConfig) {
    onChange({ ...c, levelName: levelName || c.levelName });
  }

  if (levelType === LevelType.INTRO) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This is an introduction item. Edit it from{" "}
        <strong>Introduction (Item 0)</strong> in the sidebar.
      </p>
    );
  }

  return (
    <Tabs defaultValue="grid" className="w-full">
      <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 bg-slate-100/80 p-1">
        <TabsTrigger value="grid" className="gap-2 data-[state=active]:bg-white">
          <Grid3x3 className="h-4 w-4" />
          <span className="hidden sm:inline">Board</span>
        </TabsTrigger>
        <TabsTrigger value="rules" className="gap-2 data-[state=active]:bg-white">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Rules</span>
        </TabsTrigger>
        <TabsTrigger value="tip" className="gap-2 data-[state=active]:bg-white">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Student tip</span>
        </TabsTrigger>
        {(levelType === LevelType.FLAG_PLACEMENT ||
          levelType === LevelType.CHOOSE_BUTTONS ||
          levelType === LevelType.DRAG_EDIT_PROGRAM) && (
          <TabsTrigger value="program" className="gap-2 data-[state=active]:bg-white">
            <ListTree className="h-4 w-4" />
            <span className="hidden sm:inline">Program</span>
          </TabsTrigger>
        )}
        {levelType === LevelType.DRAG_ACTIONS && (
          <TabsTrigger value="bags" className="gap-2 data-[state=active]:bg-white">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Bags</span>
          </TabsTrigger>
        )}
        {levelType === LevelType.GEOMETRY_PATH && (
          <TabsTrigger value="bags" className="gap-2 data-[state=active]:bg-white">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Bags</span>
          </TabsTrigger>
        )}
        {levelType === LevelType.FLAG_PLACEMENT && (
          <TabsTrigger value="flag" className="gap-2 data-[state=active]:bg-white">
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">Flag</span>
          </TabsTrigger>
        )}
      </TabsList>

      <p className="mb-4 text-sm text-slate-500">
        {LEVEL_TYPE_LABELS[levelType]} — {LEVEL_TYPE_HELP[levelType]}
      </p>

      <TabsContent value="grid" className="mt-0 space-y-4">
        {currentLevelId && (
          <CopyLevelLayout
            currentLevelId={currentLevelId}
            currentConfig={config}
            onApply={handleChange}
          />
        )}
        {levelType !== LevelType.GEOMETRY_PATH && (
          <LayoutModePicker config={config} onChange={handleChange} />
        )}
        {levelType === LevelType.GEOMETRY_PATH ? (
          <>
            <GeometryPathEditor config={config} onChange={handleChange} />
            <details className="rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
                Advanced board objects
              </summary>
              <div className="border-t border-slate-100 p-4">
                <GridDesigner config={config} onChange={handleChange} />
              </div>
            </details>
          </>
        ) : isNumberLineLayout(config) ? (
          <NumberLineDesigner config={config} onChange={handleChange} />
        ) : (
          <GridDesigner config={config} onChange={handleChange} />
        )}
      </TabsContent>
      <TabsContent value="rules" className="mt-0">
        <RobotSettingsEditor config={config} onChange={handleChange} />
      </TabsContent>
      <TabsContent value="tip" className="mt-0">
        <CornerHintEditor config={config} onChange={handleChange} />
      </TabsContent>
      {levelType === LevelType.FLAG_PLACEMENT && (
        <>
          <TabsContent value="flag" className="mt-0">
            <FlagSettingsEditor config={config} onChange={handleChange} />
          </TabsContent>
          <TabsContent value="program" className="mt-0">
            <GuidedProgramEditor config={config} onChange={handleChange} showBlanks={false} />
          </TabsContent>
        </>
      )}
      {levelType === LevelType.CHOOSE_BUTTONS && (
        <TabsContent value="program" className="mt-0">
          <GuidedProgramEditor config={config} onChange={handleChange} showBlanks />
        </TabsContent>
      )}
      {levelType === LevelType.DRAG_EDIT_PROGRAM && (
        <TabsContent value="program" className="mt-0">
          <GuidedProgramEditor config={config} onChange={handleChange} showBlanks={false} />
        </TabsContent>
      )}
      {levelType === LevelType.DRAG_ACTIONS && (
        <TabsContent value="bags" className="mt-0">
          <CommandBagsEditor config={config} onChange={handleChange} />
        </TabsContent>
      )}
      {levelType === LevelType.GEOMETRY_PATH && (
        <TabsContent value="bags" className="mt-0 space-y-4">
          <GeometryPathToolsEditor config={config} onChange={handleChange} />
          {(config.geometryPath?.tools?.actionChunks || config.geometryPath?.tools?.commandBags) && (
            <CommandBagsEditor config={config} onChange={handleChange} />
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}

export { PLAYABLE_TYPES };
