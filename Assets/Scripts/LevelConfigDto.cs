using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// JSON DTOs matching platform/src/lib/level-config.ts (Unity JsonUtility-friendly arrays).
/// </summary>
[Serializable]
public class LevelConfigDto
{
    public string levelName;
    public string layoutMode = "GRID";
    public NumberLineConfigDto numberLine;
    public int maxAttempts = 3;
    public Vec2Dto robotStartPosition;
    public Vec2Dto robotStartFacing;
    public Vec2Dto goalCell;
    public GridObjectDto[] gridObjects;
    public bool showCellBlinkHighlights = true;
    public bool blinkStartCells = true;
    public bool blinkEndCells = true;
    public bool allowRobotDrag = true;
    public bool allowGridObjectDrag;
    public LevelCornerHintDto cornerHint;
    public ActionBlockIntroConfigDto actionBlockIntro;
    public string[] guidedActions;
    public BlankDataDto[] blanks;
    public bool useFlagPlacement;
    public bool playerPicksEndCellWithFlag;
    public bool requireFlagBeforeRun;
    public Vec2Dto flagInitialPosition;
    public bool visitObjectSequence;
    public bool visible = true;
    public bool showCommandHistory;
    public float commandHistoryScale = 1f;
    public bool showStudentResetButton = true;
    /** When false, RUN validates the program without animating Robo. */
    public bool runRobotOnSubmit = true;
    /// <summary>Palette buttons students may use: forward, backward, turn left, turn right. Empty = all four (grid) or number-line defaults.</summary>
    public string[] enabledActionButtons;
}

[Serializable]
public class Vec2Dto
{
    public int x;
    public int y;

    public Vector2Int ToVector2Int() => new Vector2Int(x, y);
}

[Serializable]
public class GridObjectDto
{
    public Vec2Dto position;
    public string objectType;
    public bool isStartObject;
    public bool isEndObject;
    public int visitOrder;
    public bool blocksRobot;
    public bool allowDrag;
    public Vec2Dto guidedEndPosition;
    public string placement;
    public string imageUrl;
}

[Serializable]
public class NumberLineConfigDto
{
    public int tickCount = 9;
    public int lineRow = 2;
    public bool showTickLabels = true;
    public bool showArrows = true;
    public bool forwardBackwardOnly = true;
    public string lineColor;
    public string tickColor;
    public string labelColor;
    public float axisThicknessRatio;
    public float tickHeightRatio;
    public float tickWidthRatio;
    public float labelSizeRatio;
    public float playfieldScale;
    public float objectScale;
    public float robotScale;
    public float placementOffsetRatio;
    public float tickSpacing;
}

[Serializable]
public class LevelCornerHintDto
{
    public bool enabled = true;
    public string title;
    public string body;
    public string imageUrl;
    public string audioUrl;
    public bool playAudioAutomatically = true;
}

[Serializable]
public class ActionBlockIntroConfigDto
{
    public bool enabled;
    public string introId;
    public bool showOnlyOnce = true;
    public bool allowSkip = true;
    public string completeMessage;
    public IntroStepDto[] steps;
}

[Serializable]
public class IntroStepPlayfieldDto
{
    public bool useCustomPlayfield;
    public Vec2Dto robotStartPosition;
    public Vec2Dto robotStartFacing;
    public GridObjectDto[] gridObjects;
}

[Serializable]
public class IntroStepTutorialDto
{
    public bool showDragAnimation = true;
    public int dragRepeatCount = 2;
    public bool showRunTapAnimation = true;
    public int runTapRepeatCount = 2;
}

[Serializable]
public class IntroStepDto
{
    public string action;
    public string dragInstruction;
    public string runInstruction;
    public string runningInstruction;
    public LevelCornerHintDto stepHint;
    public IntroStepPlayfieldDto playfield;
    public IntroStepTutorialDto tutorial;
}

[Serializable]
public class BlankDataDto
{
    public string correctAnswer;
    public string[] enabledArrows;
}

public static class LevelConfigMapper
{
    public static LevelData ToLevelData(LevelConfigDto dto, string levelType)
    {
        if (dto == null) return null;

        var ld = new LevelData
        {
            levelType = levelType,
            levelName = dto.levelName ?? "Item",
            layoutMode = string.IsNullOrEmpty(dto.layoutMode) ? "GRID" : dto.layoutMode,
            maxAttempts = dto.maxAttempts > 0 ? dto.maxAttempts : 3,
            robotStartPosition = dto.robotStartPosition != null
                ? dto.robotStartPosition.ToVector2Int()
                : new Vector2Int(1, 0),
            robotStartFacing = dto.robotStartFacing != null
                ? dto.robotStartFacing.ToVector2Int()
                : Vector2Int.up,
            showCellBlinkHighlights = dto.showCellBlinkHighlights,
            blinkStartCells = dto.blinkStartCells,
            blinkEndCells = dto.blinkEndCells,
            allowRobotDrag = dto.allowRobotDrag,
            allowGridObjectDrag = dto.allowGridObjectDrag,
            useFlagPlacement = dto.useFlagPlacement,
            playerPicksEndCellWithFlag = dto.playerPicksEndCellWithFlag,
            requireFlagBeforeRun = dto.requireFlagBeforeRun,
            visitObjectSequence = dto.visitObjectSequence,
            visible = dto.visible,
            showCommandHistory = dto.showCommandHistory,
            commandHistoryScale = dto.commandHistoryScale > 0 ? dto.commandHistoryScale : 0.45f,
            showStudentResetButton = dto.showStudentResetButton,
            runRobotOnSubmit = dto.runRobotOnSubmit,
        };

        if (dto.numberLine != null)
        {
            ld.numberLine = new NumberLineConfig
            {
                tickCount = dto.numberLine.tickCount > 0 ? dto.numberLine.tickCount : 9,
                lineRow = dto.numberLine.lineRow,
                showTickLabels = dto.numberLine.showTickLabels,
                showArrows = dto.numberLine.showArrows,
                forwardBackwardOnly = dto.numberLine.forwardBackwardOnly,
                lineColor = string.IsNullOrWhiteSpace(dto.numberLine.lineColor) ? "#2d2d35" : dto.numberLine.lineColor,
                tickColor = string.IsNullOrWhiteSpace(dto.numberLine.tickColor) ? "#1a1a22" : dto.numberLine.tickColor,
                labelColor = string.IsNullOrWhiteSpace(dto.numberLine.labelColor) ? "#333340" : dto.numberLine.labelColor,
                axisThicknessRatio = dto.numberLine.axisThicknessRatio > 0 ? dto.numberLine.axisThicknessRatio : 0.045f,
                tickHeightRatio = dto.numberLine.tickHeightRatio > 0 ? dto.numberLine.tickHeightRatio : 0.28f,
                tickWidthRatio = dto.numberLine.tickWidthRatio > 0 ? dto.numberLine.tickWidthRatio : 0.05f,
                labelSizeRatio = dto.numberLine.labelSizeRatio > 0 ? dto.numberLine.labelSizeRatio : 0.22f,
                playfieldScale = dto.numberLine.playfieldScale > 0 ? dto.numberLine.playfieldScale : 1f,
                objectScale = dto.numberLine.objectScale > 0 ? dto.numberLine.objectScale : 1f,
                robotScale = dto.numberLine.robotScale > 0 ? dto.numberLine.robotScale : 1f,
                placementOffsetRatio = dto.numberLine.placementOffsetRatio > 0 ? dto.numberLine.placementOffsetRatio : 0.32f,
                tickSpacing = dto.numberLine.tickSpacing,
            };
            if (string.IsNullOrEmpty(dto.layoutMode) ||
                dto.layoutMode.Equals("GRID", StringComparison.OrdinalIgnoreCase))
                ld.layoutMode = "NUMBER_LINE";
        }

        if (dto.flagInitialPosition != null)
            ld.flagInitialPosition = dto.flagInitialPosition.ToVector2Int();

        if (dto.goalCell != null)
            ld.goalCell = dto.goalCell.ToVector2Int();
        else
            ld.goalCell = new Vector2Int(-1, -1);

        if (dto.gridObjects != null && dto.gridObjects.Length > 0)
        {
            ld.gridObjects = new List<GridObjectData>();
            foreach (var g in dto.gridObjects)
            {
                if (g == null || g.position == null) continue;
                var go = new GridObjectData
                {
                    position = g.position.ToVector2Int(),
                    objectType = g.objectType,
                    isStartObject = g.isStartObject,
                    isEndObject = g.isEndObject,
                    visitOrder = g.visitOrder,
                    blocksRobot = g.blocksRobot,
                    allowDrag = g.allowDrag,
                };
                if (g.visitOrder == 1) { go.isStartObject = true; go.isEndObject = false; }
                if (g.visitOrder == 2) { go.isStartObject = false; go.isEndObject = true; }
                if (go.blocksRobot || (g.objectType != null &&
                    (g.objectType.Equals("block", System.StringComparison.OrdinalIgnoreCase) ||
                     g.objectType.Equals("wood", System.StringComparison.OrdinalIgnoreCase) ||
                     g.objectType.Equals("tree", System.StringComparison.OrdinalIgnoreCase))))
                    go.blocksRobot = true;
                if (g.guidedEndPosition != null)
                    go.guidedEndPosition = g.guidedEndPosition.ToVector2Int();
                go.placement = g.placement;
                go.imageUrl = g.imageUrl;
                ld.gridObjects.Add(go);
            }
        }

        if (dto.guidedActions != null && dto.guidedActions.Length > 0)
            ld.guidedActions = new List<string>(dto.guidedActions);

        if (dto.blanks != null && dto.blanks.Length > 0)
        {
            ld.blanks = new List<BlankData>();
            foreach (var b in dto.blanks)
            {
                if (b == null) continue;
                ld.blanks.Add(new BlankData
                {
                    correctAnswer = b.correctAnswer,
                    enabledArrows = b.enabledArrows != null
                        ? new List<string>(b.enabledArrows)
                        : new List<string>(),
                });
            }
        }

        if (dto.enabledActionButtons != null && dto.enabledActionButtons.Length > 0)
            ld.enabledActionButtons = new List<string>(dto.enabledActionButtons);

        if (dto.cornerHint != null)
        {
            ld.cornerHint = MapCornerHint(dto.cornerHint);
        }

        if (dto.actionBlockIntro != null && dto.actionBlockIntro.enabled)
        {
            ld.actionBlockIntro = new ActionBlockIntroConfig
            {
                enabled = true,
                introId = dto.actionBlockIntro.introId,
                showOnlyOnce = dto.actionBlockIntro.showOnlyOnce,
                allowSkip = dto.actionBlockIntro.allowSkip,
                completeMessage = dto.actionBlockIntro.completeMessage,
                steps = new List<ActionBlockIntroStepData>(),
            };
            if (dto.actionBlockIntro.steps != null)
            {
                foreach (var s in dto.actionBlockIntro.steps)
                {
                    if (s == null) continue;
                    var step = new ActionBlockIntroStepData
                    {
                        action = s.action,
                        dragInstruction = s.dragInstruction,
                        runInstruction = s.runInstruction,
                        runningInstruction = s.runningInstruction,
                    };
                    if (s.stepHint != null)
                        step.stepHint = MapCornerHint(s.stepHint);
                    if (s.playfield != null)
                    {
                        step.playfield = new IntroStepPlayfieldData
                        {
                            useCustomPlayfield = s.playfield.useCustomPlayfield,
                            robotStartPosition = s.playfield.robotStartPosition != null
                                ? s.playfield.robotStartPosition.ToVector2Int()
                                : new Vector2Int(1, 0),
                            robotStartFacing = s.playfield.robotStartFacing != null
                                ? s.playfield.robotStartFacing.ToVector2Int()
                                : Vector2Int.up,
                            gridObjects = MapGridObjects(s.playfield.gridObjects),
                        };
                    }
                    if (s.tutorial != null)
                    {
                        step.tutorial = new IntroStepTutorialData
                        {
                            showDragAnimation = s.tutorial.showDragAnimation,
                            dragRepeatCount = Mathf.Clamp(s.tutorial.dragRepeatCount, 1, 4),
                            showRunTapAnimation = s.tutorial.showRunTapAnimation,
                            runTapRepeatCount = Mathf.Clamp(s.tutorial.runTapRepeatCount, 1, 4),
                        };
                    }
                    else
                    {
                        step.tutorial = new IntroStepTutorialData();
                    }
                    ld.actionBlockIntro.steps.Add(step);
                }
            }
        }

        ApplyLevelTypeDefaults(ld, levelType);
        return ld;
    }

    private static List<GridObjectData> MapGridObjects(GridObjectDto[] gridObjects)
    {
        var list = new List<GridObjectData>();
        if (gridObjects == null) return list;
        foreach (var g in gridObjects)
        {
            if (g == null || g.position == null) continue;
            var go = new GridObjectData
            {
                position = g.position.ToVector2Int(),
                objectType = g.objectType,
                isStartObject = g.isStartObject,
                isEndObject = g.isEndObject,
                visitOrder = g.visitOrder,
                blocksRobot = g.blocksRobot,
                allowDrag = g.allowDrag,
            };
            if (g.visitOrder == 1) { go.isStartObject = true; go.isEndObject = false; }
            if (g.visitOrder == 2) { go.isStartObject = false; go.isEndObject = true; }
            if (go.blocksRobot || (g.objectType != null &&
                (g.objectType.Equals("block", StringComparison.OrdinalIgnoreCase) ||
                 g.objectType.Equals("wood", StringComparison.OrdinalIgnoreCase) ||
                 g.objectType.Equals("tree", StringComparison.OrdinalIgnoreCase))))
                go.blocksRobot = true;
            if (g.guidedEndPosition != null)
                go.guidedEndPosition = g.guidedEndPosition.ToVector2Int();
            go.placement = g.placement;
            go.imageUrl = g.imageUrl;
            list.Add(go);
        }
        return list;
    }

    private static bool IsIntroType(string levelType)
    {
        return !string.IsNullOrEmpty(levelType) &&
               levelType.Equals("INTRO", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Fills intro steps and corner hint when the dashboard config is incomplete.</summary>
    private static void EnsureIntroLevelDefaults(LevelData ld)
    {
        if (ld == null || !IsIntroType(ld.levelType)) return;

        var defaults = ActionBlockIntroDefaults.Level0FourMoves();
        bool needsIntro = ld.actionBlockIntro == null || !ld.actionBlockIntro.enabled
            || ld.actionBlockIntro.steps == null || ld.actionBlockIntro.steps.Count == 0;

        if (needsIntro)
        {
            string introId = ld.actionBlockIntro?.introId;
            ld.actionBlockIntro = defaults;
            if (!string.IsNullOrEmpty(introId))
                ld.actionBlockIntro.introId = introId;
        }
        else
        {
            foreach (var step in ld.actionBlockIntro.steps)
            {
                if (step == null) continue;
                if (step.tutorial == null)
                    step.tutorial = new IntroStepTutorialData();
                if (step.stepHint == null)
                    step.stepHint = new LevelCornerHint { enabled = true };
                if (string.IsNullOrEmpty(step.dragInstruction))
                {
                    var match = FindDefaultStep(defaults, step.action);
                    if (match != null)
                    {
                        if (string.IsNullOrEmpty(step.dragInstruction))
                            step.dragInstruction = match.dragInstruction;
                        if (step.stepHint != null && string.IsNullOrEmpty(step.stepHint.body) && match.stepHint != null)
                            step.stepHint = match.stepHint;
                    }
                }
            }
        }

        // Only fill missing welcome text — respect dashboard cornerHint.enabled (including false).
        if (ld.cornerHint == null)
        {
            ld.cornerHint = new LevelCornerHint
            {
                enabled = true,
                title = "Welcome!",
                body = "Let's learn how to use the action blocks."
            };
        }
    }

    private static ActionBlockIntroStepData FindDefaultStep(ActionBlockIntroConfig defaults, string action)
    {
        if (defaults?.steps == null || string.IsNullOrEmpty(action)) return null;
        string a = action.Trim().ToLowerInvariant();
        foreach (var s in defaults.steps)
        {
            if (s != null && string.Equals(s.action?.Trim(), a, StringComparison.OrdinalIgnoreCase))
                return s;
        }
        return null;
    }

    private static LevelCornerHint MapCornerHint(LevelCornerHintDto dto)
    {
        if (dto == null) return null;
        return new LevelCornerHint
        {
            enabled = dto.enabled,
            title = dto.title,
            body = dto.body,
            imageUrl = dto.imageUrl,
            audioUrl = dto.audioUrl,
            playAudioAutomatically = dto.playAudioAutomatically,
        };
    }

    private static void ApplyLevelTypeDefaults(LevelData ld, string levelType)
    {
        if (string.IsNullOrEmpty(levelType)) return;
        string t = levelType.ToUpperInvariant();
        if (t == "INTRO")
        {
            ld.useFlagPlacement = false;
            ld.playerPicksEndCellWithFlag = false;
            ld.requireFlagBeforeRun = false;
            EnsureIntroLevelDefaults(ld);
        }
        else if (t != "INTRO")
            ld.actionBlockIntro = null;

        if (t == "DRAG_ACTIONS")
        {
            ld.useFlagPlacement = false;
            ld.playerPicksEndCellWithFlag = false;
            ld.requireFlagBeforeRun = false;
        }
        else if (t == "FLAG_PLACEMENT")
        {
            ld.useFlagPlacement = true;
            if (ld.guidedActions == null || ld.guidedActions.Count == 0)
                ld.guidedActions = new List<string> { "forward", "forward", "forward" };
        }
        else if (t == "CHOOSE_BUTTONS")
        {
            ld.useFlagPlacement = false;
            ld.playerPicksEndCellWithFlag = false;
            ld.requireFlagBeforeRun = false;
            if (ld.guidedActions == null || ld.guidedActions.Count == 0)
                ld.guidedActions = new List<string> { "forward", "blank", "forward" };
            if (ld.blanks == null || ld.blanks.Count == 0)
            {
                ld.blanks = new List<BlankData>
                {
                    new BlankData
                    {
                        correctAnswer = "turn left",
                        enabledArrows = new List<string> { "turn left", "turn right" }
                    }
                };
            }
        }
        else if (t == "DRAG_EDIT_PROGRAM")
        {
            ld.useFlagPlacement = false;
            ld.playerPicksEndCellWithFlag = false;
            ld.requireFlagBeforeRun = false;
            ld.blanks = null;
            if (ld.guidedActions == null || ld.guidedActions.Count == 0)
                ld.guidedActions = new List<string> { "forward", "turn left", "forward" };
        }
    }
}
