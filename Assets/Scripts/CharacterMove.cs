using UnityEngine;
using UnityEngine.Serialization;
using UnityEngine.UI;
using System.Collections.Generic;
using CharacterActions;
using System.Collections;
using UnityEngine.SceneManagement;
using TMPro;
using System.Linq;
using UnityEngine.Networking;
using UnityEngine.EventSystems; // For GraphicRaycaster
using System; // For Dictionary and Exception

// Define these classes at a level where they can be easily used for JSON serialization
[System.Serializable]
public class PlayerActionLogEntry
{
    public string action;
    public float timestamp;
}

[System.Serializable]
public class CTAssessmentRequest
{
    public string student_id;
    public string level; // This will now be more dynamic, e.g., "Level 1", "Level 2"
    public List<PlayerActionLogEntry> log;
    public string robot_position; // Format: "x,y"
    public string apple_position; // Format: "x,y"
    public List<string> unity_chatgpt_feedback_log; // New field
    public int grid_rows; // Added for dynamic grid assessment
    public int grid_cols; // Added for dynamic grid assessment

    // Level 1 Specific Data
    public int level1_starting_position_index; // 0 for (0,2), 1 for (0,5), 2 for (0,7)
    public int actions_before_run;
    public List<float> forward_press_intervals;

    // For Level Summary Assessment
    public bool is_level_summary; 
    public float level_duration_seconds;

    // NEW: Facing direction for optimal path calculation
    public int[] initial_facing;

    // --- NEW FIELDS FOR ADVANCED ASSESSMENT ---
    public int attempt_number;
    public float time_taken;
    public int hints_used;
    public int block_efficiency;
    public int min_blocks;
    public int used_blocks;
    public List<List<PlayerActionLogEntry>> previous_attempts;

    public string robot_start_position; // Format: "x,y"
    public int[] robot_start_facing;    // Format: [x, y]

    public int number_of_attempts;
    public float time_on_task;
    public int persistence_score;
    public int creativity_score;
    public List<string> error_types;
    public List<string> collaboration_events;

    // --- GUIDED/FILL-IN-THE-BLANK FIELDS ---
    public List<string> guidedActions = null; // Optional guided actions for fill-in-the-blank
    public string correctBlankAnswer = null; // e.g., "turn left" or "turn right"
    public List<string> blankEnabledArrows = null; // Which arrows to enable at blank
    public List<BlankData> correctBlankAnswers = null;
    public List<string> userBlankAnswers = null;
    
    // --- NEW DETAILED TRACKING FIELDS ---
    public List<string> user_blank_answers; // Student's actual answers to blanks
    public List<BlankData> correct_blank_answers; // Correct answers for blanks
    public List<string> guided_actions; // The guided action sequence
    public string robot_final_position; // Format: "x,y"
    public List<Vector2Int> apple_positions; // Apple positions in level
    public bool level_completed; // Whether the level was completed
    public int wrong_answers_count; // Number of wrong answers given
    public float time_to_first_action; // Time from level start to first action
    public List<float> time_between_actions; // Intervals between actions

    /// <summary>Json from <see cref="LevelTelemetryU"/> (queue evolution, robot touch, hidden palette).</summary>
    public string level_telemetry_json;
}

[System.Serializable]
public class BlankData
{
    public string correctAnswer;
    public List<string> enabledArrows;
}

/// <summary>Queued command snapshots for per-level assessment (serializable for JsonUtility).</summary>
[System.Serializable]
public class RunSnapshotTelemetry
{
    public string label;
    public string[] commands;
}

[System.Serializable]
public class LevelTelemetryU
{
    public string[] initial_commands;
    public RunSnapshotTelemetry[] run_snapshots;
    public string[] final_commands;
    public string[] palette_buttons_hidden;
    public float robot_interaction_seconds;
    public bool robot_was_touched;
    public float level_elapsed_seconds;
    public string[] level_allowed_action_buttons;
}

[System.Serializable]
public class ObstacleData
{
    public Vector2Int position;
    public string type; // "tree" or "wood"
    public string correctBlankAnswer = null; // e.g., "turn left" or "turn right"
    public List<string> blankEnabledArrows = null; // Which arrows to enable at blank
    public List<BlankData> blanks = null;
}

[System.Serializable]
public class GridObjectData
{
    public Vector2Int position;
    public string objectType; // ... "crayon", "crayon-box", "crayons", "black-crayon", ...
    public bool isStartObject = false;
    public bool isEndObject = false;
    /// <summary>When visit sequence is on: 1 = first visit, 2 = second visit.</summary>
    public int visitOrder = 0;
    /// <summary>Robot cannot enter this cell — bumps back on forward/backward into it.</summary>
    public bool blocksRobot = false;
    public bool allowDrag = false; // If true, this specific object can be dragged
    public Vector2Int guidedEndPosition = Vector2Int.zero; // Target position for guided levels (optional)
    /// <summary>NUMBER_LINE: above | below | onLine — used for vertical offset in Unity.</summary>
    public string placement;
    /// <summary>Optional platform image URL for this prop on the number line.</summary>
    public string imageUrl;
}

[System.Serializable]
public class NumberLineConfig
{
    public int tickCount = 9;
    public int lineRow = 2;
    public bool showTickLabels = true;
    public bool showArrows = true;
    public bool forwardBackwardOnly = true;
    public string lineColor = "#2d2d35";
    public string tickColor = "#1a1a22";
    public string labelColor = "#333340";
    public float axisThicknessRatio = 0.045f;
    public float tickHeightRatio = 0.28f;
    public float tickWidthRatio = 0.05f;
    public float labelSizeRatio = 0.22f;
    /// <summary>Distance between ticks in world units when &gt; 0 (overrides CharacterMove.numberLineGridSize).</summary>
    public float tickSpacing;
    /// <summary>Spacing multiplier for tick positions and axis (1 = default).</summary>
    public float playfieldScale = 1f;
    /// <summary>Extra scale for props on the number line (1 = default auto-fit).</summary>
    public float objectScale = 1f;
    /// <summary>Extra scale for the robot on the number line (1 = default auto-fit).</summary>
    public float robotScale = 1f;
    /// <summary>How far above/below props sit from the axis, as a fraction of cell spacing.</summary>
    public float placementOffsetRatio = 0.32f;
}

[System.Serializable]
public class LevelData
{
    /// <summary>Platform/dashboard key (e.g. level_1). Used for telemetry when loaded from API.</summary>
    public string levelKey;
    /// <summary>Dashboard order index (0 = intro, 1 = level 1, 2 = level 2, …).</summary>
    public int orderIndex;
    /// <summary>INTRO | DRAG_ACTIONS | FLAG_PLACEMENT | CHOOSE_BUTTONS | DRAG_EDIT_PROGRAM — from teacher dashboard.</summary>
    public string levelType;
    public string levelName;
    /// <summary>GRID (default) or NUMBER_LINE — horizontal tick axis instead of full 6×6 board.</summary>
    public string layoutMode = "GRID";
    public NumberLineConfig numberLine;
    public List<ObstacleData> obstacles = new List<ObstacleData>(); // NEW
    public List<GridObjectData> gridObjects = new List<GridObjectData>(); // NEW: Grid objects for start/end
    public int maxAttempts = 3; // NEW: Maximum attempts for this level
    public bool isRandom = false;
    public int numRandomApples = 0; // Only used if isRandom is true
    public Vector2Int robotStartPosition = new Vector2Int(0,0); // Default start position
    public Vector2Int robotStartFacing = Vector2Int.up; // Default facing up

    /// <summary>Playfield size after <see cref="CharacterMove.ApplyLevelGridDimensions"/> (default 6×6 grid).</summary>
    public int gridCols = 6;
    public int gridRows = 6;

    [Tooltip("Fixed goal cell with no prop required. Use (-1,-1) when unset. Set from teacher dashboard goalCell.")]
    public Vector2Int goalCell = new Vector2Int(-1, -1);
    public List<string> guidedActions = null; // Optional guided actions for fill-in-the-blank
    public string correctBlankAnswer = null; // e.g., "turn left" or "turn right"
    public List<string> blankEnabledArrows = null; // Which arrows to enable at blank
    /// <summary>Action palette visible to students (forward, backward, turn left, turn right). Null/empty = layout defaults.</summary>
    public List<string> enabledActionButtons = null;
    public List<BlankData> blanks = null; // Add the missing blanks property
    public bool allowGridObjectDrag = false; // If true, grid objects can be dragged

    /// <summary>DRAG_ACTIONS: visit object 1 then object 2 in one program; both blink and hide on visit.</summary>
    public bool visitObjectSequence = false;

    [Tooltip("If true, this level uses a placeable FLAG as the end target. No end-object prefab is spawned " +
             "from gridObjects[] for isEndObject entries.")]
    public bool useFlagPlacement = false;

    [Tooltip("If true WITH useFlagPlacement, the player picks the goal by tapping any EMPTY cell. " +
             "That cell becomes isEndObject for the run (e.g. Level 2: 3× forward, then reach the flag). " +
             "If false, the goal is fixed by gridObjects with isEndObject / guidedEndPosition.")]
    public bool playerPicksEndCellWithFlag = false;

    [Tooltip("Optional starting cell for the flag in flag-placement mode. " +
             "Use (-1,-1) to leave the flag unplaced until the player taps a cell.")]
    public Vector2Int flagInitialPosition = new Vector2Int(-1, -1);

    [Tooltip("If true (and useFlagPlacement), RUN is blocked until the player has placed the flag.")]
    public bool requireFlagBeforeRun = false;

    [Header("Cell blink highlights (per level)")]
    [Tooltip("Master switch: show blinking tiles on this level's start/end cells.")]
    public bool showCellBlinkHighlights = true;
    [Tooltip("Blink on gridObjects marked isStartObject (blue by default).")]
    public bool blinkStartCells = true;
    [Tooltip("Blink on gridObjects marked isEndObject (green by default). Shown under the prop so bin/apple stay visible.")]
    public bool blinkEndCells = true;

    [Tooltip("When global allowRobotDrag is on, lets players drag the robot on this level before RUN.")]
    public bool allowRobotDrag = true;

    [Tooltip("When false, level is omitted from Unity play (dashboard can still publish it).")]
    public bool visible = true;

    [Tooltip("Show compact command-history strip after RUN.")]
    public bool showCommandHistory = false;

    [Tooltip("Scale of command-history UI (0.2–1). Default 0.45 = small strip.")]
    public float commandHistoryScale = 1f;

    [Tooltip("Show the in-game Reset button for students on this level.")]
    public bool showStudentResetButton = true;

    [Tooltip("When true, RUN animates Robo through the program. When false, RUN checks the answer without moving Robo.")]
    public bool runRobotOnSubmit = true;

    [Header("Top-right hint panel")]
    [Tooltip("Shown during normal play (hidden while action-block intro runs — intro steps use their own hints).")]
    public LevelCornerHint cornerHint = new LevelCornerHint();

    [Header("Action block introduction (optional)")]
    [Tooltip("Teach palette blocks one at a time before regular level play. Configure steps like level data.")]
    public ActionBlockIntroConfig actionBlockIntro;
}

/// <summary>Top-right text/image hint — used for levels and intro steps.</summary>
[System.Serializable]
public class LevelCornerHint
{
    public bool enabled = true;
    public string title;
    [TextArea(2, 5)]
    public string body;
    public Sprite image;
    /// <summary>Platform-hosted image path (e.g. /uploads/hints/abc.png).</summary>
    public string imageUrl;
    /// <summary>Platform-hosted audio (e.g. /uploads/hint-audio/abc.mp3).</summary>
    public string audioUrl;
    /// <summary>Play tip audio when the panel opens (default true when audioUrl is set).</summary>
    public bool playAudioAutomatically = true;

    [Header("Panel UI (Unity)")]
    [Tooltip("When on, uses the layout block below instead of only the scene default on LevelCornerHintPanel.")]
    public bool useCustomLayout;
    public CornerHintPanelLayout layout = new CornerHintPanelLayout();
}

/// <summary>Per-level action-block tutorial (managed in InitializeLevelData like other level fields).</summary>
[System.Serializable]
public class ActionBlockIntroConfig
{
    public bool enabled;
    [Tooltip("PlayerPrefs key — intro is skipped after completion when showOnlyOnce is true.")]
    public string introId = "level1_blocks";
    public bool showOnlyOnce = true;
    [Tooltip("When true, students can tap Skip to exit the introduction early.")]
    public bool allowSkip = true;
    [TextArea(2, 4)]
    public string completeMessage = "You learned all four moves! Now solve the item.";
    public List<ActionBlockIntroStepData> steps = new List<ActionBlockIntroStepData>();
}

[System.Serializable]
public class IntroStepPlayfieldData
{
    [Tooltip("When true, robot position / grid props below are used for this step only.")]
    public bool useCustomPlayfield;
    public Vector2Int robotStartPosition = new Vector2Int(1, 0);
    public Vector2Int robotStartFacing = Vector2Int.up;
    public List<GridObjectData> gridObjects = new List<GridObjectData>();
}

[System.Serializable]
public class IntroStepTutorialData
{
    public bool showDragAnimation = true;
    [Range(1, 4)] public int dragRepeatCount = 2;
    public bool showRunTapAnimation = true;
    [Range(1, 4)] public int runTapRepeatCount = 2;
}

[System.Serializable]
public class ActionBlockIntroStepData
{
    [Tooltip("forward | backward | turn left | turn right")]
    public string action = "forward";
    public LevelCornerHint stepHint = new LevelCornerHint();
    [TextArea(2, 3)]
    public string dragInstruction;
    public string runInstruction = "Now tap Run!";
    public string runningInstruction = "Watch Robo go!";
    public IntroStepPlayfieldData playfield = new IntroStepPlayfieldData();
    public IntroStepTutorialData tutorial = new IntroStepTutorialData();
}


public class CharacterMove : MonoBehaviour
{
    public Button rotateLeftButton;
    public Button rotateRightButton;
    public Button moveForwardButton;
    public Button moveDownButton;
    public Button runButton;

    [Header("Student UI")]
    [Tooltip("Optional. Clears the yellow-strip program and returns the robot to the level start (does not count as a failed attempt).")]
    public Button studentResetButton;

    [Header("Drag & Drop Input")]
    [Tooltip("When true, the four action buttons (forward, backward, turn left, turn right) only respond to drag-and-drop onto an ActionQueueDropZone. Clicking them will NOT enqueue an action.")]
    public bool useDragAndDropForActions = true;

    [Header("Number line layout")]
    [Tooltip("Optional. Auto-created when a level uses layoutMode NUMBER_LINE.")]
    public NumberLineVisual numberLineVisual;

    [Header("UI — top-right hints")]
    [Tooltip("Optional. Auto-created if empty. Default panel style (background, listen button, sizes) is edited here. Per-level overrides: Level Data → Corner Hint → Use Custom Layout.")]
    public LevelCornerHintPanel cornerHintPanel;

    [Header("Action block intro (runtime)")]
    [Tooltip("Optional. Auto-created on this GameObject if empty. Driven by LevelData.actionBlockIntro.")]
    public ActionBlockIntroManager actionBlockIntro;
    public bool IsActionBlockIntroActive => actionBlockIntro != null && actionBlockIntro.IsActive;

    [Header("Drag-drop tutorial (runtime)")]
    [Tooltip("Optional. Auto-created when drag-and-drop is enabled. Plays only on the INTRODUCTION level (level_0 / INTRO).")]
    public DragDropTutorialController dragDropTutorial;
    [Tooltip("Optional. Drag the full panel that should accept dropped action blocks (e.g. the yellow strip at the bottom). If left empty, the drop zone defaults to the actionQueueTransform.")]
    public RectTransform dropZonePanel;
    [Tooltip("If true, blocks the user adds to the action queue (via drag or click) get a small close button so the user can delete that block before pressing Run.")]
    public bool addCloseButtonsToQueuedBlocks = true;
    [Tooltip("If true, blocks the user adds to the action queue can be picked up and dragged to reorder them within the queue (Scratch-like).")]
    public bool allowReorderQueuedBlocks = true;
    [Tooltip("Optional sprite used for the close button. When set, the sprite IS the close button (no extra X glyph is drawn) and the button is tinted white instead of red.")]
    public Sprite closeButtonSprite;
    [Tooltip("Background tint when no closeButtonSprite is assigned.")]
    public Color closeButtonColor = new Color(0.85f, 0.18f, 0.18f, 1f);
    [Tooltip("Color of the programmatic 'X' glyph (only used when no closeButtonSprite is assigned).")]
    public Color closeButtonGlyphColor = new Color(1f, 1f, 1f, 1f);
    [Tooltip("Size of the close button (square), in canvas pixels. Increase if the button looks too small on your block prefab.")]
    public float closeButtonSize = 36f;
    [Tooltip("Offset of the close button from the block's top-right corner, in canvas pixels. Positive values push the button OUTSIDE the block (corner overhang); use negative values to inset it inside the block.")]
    public Vector2 closeButtonOffset = new Vector2(6f, 6f);
    [Tooltip("If true, the close button overhangs the block's top-right corner using closeButtonOffset. Disable to fully tuck the button inside the block.")]
    public bool closeButtonOverhang = true;

    [Header("Touch & Scratch-style UX")]
    [Tooltip("EventSystem.pixelDragThreshold is raised to at least this value on Start so a finger tap doesn't accidentally start a reorder drag. Default is touch-friendly. Set to 0 to leave the project default untouched.")]
    public int touchFriendlyDragThreshold = 14;
    [Tooltip("If true, dragging a queued block OUTSIDE the drop zone (the yellow strip) and releasing deletes the block — Scratch-style 'drag off the script area to throw away'. When false, the block snaps back to its original position.")]
    public bool dragOutQueuedToDelete = true;
    [Tooltip("If true, the action block currently being executed by the robot is tinted with executingBlockHighlightColor while it runs. Helps kids see exactly which block is firing.")]
    public bool highlightExecutingBlock = true;
    [Tooltip("Tint applied to the currently-executing block's Image while its action is running.")]
    public Color executingBlockHighlightColor = new Color(1f, 0.92f, 0.4f, 1f);
    [Tooltip("If true, a block that lands in the queue (insert OR reorder drop) plays a tiny scale-pop animation to acknowledge the drop.")]
    public bool enableDropBounce = true;
    [Tooltip("Peak extra scale during the drop bounce. 0.15 = 115% at peak.")]
    [Range(0f, 0.5f)] public float dropBounceAmount = 0.15f;
    [Tooltip("Duration of the drop-bounce animation in seconds.")]
    [Range(0f, 0.5f)] public float dropBounceDuration = 0.18f;

    public GameObject actionImagePrefab;
    public Transform actionQueueTransform;
    public Sprite forwardSprite;
    public Sprite backwardSprite;
    public Sprite rotateLeftSprite;
    public Sprite rotateRightSprite;

    // ── Grid Setup ──────────────────────────────────────────────────────────────
    // The grid is a matrix where (0,0) = bottom-left cell.
    // Positive X  → moves right  (columns increase).
    // Positive Z  → moves up/forward (rows increase).
    //
    // EASIEST SETUP (recommended):
    //   1. Set Grid Rows and Grid Cols to match your visual grid (e.g. 6 and 6).
    //   2. Drag the grid background object (Quad / Plane / Sprite) into Grid Background.
    //   3. Right-click this component → "Auto-Calculate Grid From Background".
    //      gridSize and the grid origin are computed automatically.
    //   4. Enable Draw Grid Gizmos and confirm green dots sit on tile centers.
    //
    // VIRTUAL MATRIX SETUP — the matrix is purely logical: cells (0,0)..(gridCols-1, gridRows-1).
    //   • Place an empty GameObject in the scene at the CENTER of cell (0,0) and drag it
    //     into Grid Origin Transform. That single anchor + Grid Cell Size = world layout.
    //   • Expanding gridCols / gridRows in the Inspector adds NEW cells outward; existing
    //     cells keep the same world position and the same world size (gridSize).
    //   • Drop images (sprite prefabs) into specific cells manually via virtualMatrixEntries.
    // ────────────────────────────────────────────────────────────────────────────
    [Header("Grid Setup")]
    [Tooltip("Empty GameObject placed at the CENTER of cell (0,0). Drag it in the Scene view to move the whole grid. " +
             "Right-click CharacterMove → Create Grid Origin Anchor, or add GridOriginAnchor to an empty object.")]
    public Transform gridOriginTransform;
    [Tooltip("Extra nudge for the whole grid (world units). Use when the anchor is correct but tiles are slightly off.")]
    public Vector3 gridWorldOffset = Vector3.zero;

    [Tooltip("When on, moving Grid Origin Transform in the editor updates the grid immediately (Play mode + Scene view gizmos).")]
    public bool syncGridOriginEveryFrame = true;
    [Tooltip("World-space distance between two adjacent cell centers on the 6×6 grid. Does not affect NUMBER_LINE when Number Line Grid Size is set.")]
    [Min(0.001f)] public float gridSize = 100f;

    [Header("Number Line Layout (NUMBER_LINE levels only)")]
    [Tooltip("Tick spacing for the number line (world units). 0 = use Grid Size above. Does NOT change the 6×6 grid.")]
    [Min(0f)] public float numberLineGridSize = 0f;
    [Tooltip("World-space nudge for the number line only — does NOT move the 6×6 grid. Use X to shift left/right, Z for forward/back.")]
    public Vector3 numberLineWorldOffset = Vector3.zero;
    [Tooltip("When on, shifts ticks so the middle of the line aligns with the 6×6 board center. Turn off and use Number Line World Offset only if you prefer manual placement.")]
    public bool numberLineAutoCenterHorizontally = true;
    [Tooltip("Draw order for the number line (mesh render queue). Must be higher than Background World Quad (default 1000).")]
    [Range(1000, 4000)] public int numberLineRenderQueue = 2100;
    [Tooltip("Optional sorting layer for number-line sprites (if using 2D overlay). Leave Default unless you use custom layers.")]
    public string numberLineSortingLayerName = "Default";
    [Tooltip("Sorting order when number line uses SpriteRenderer path.")]
    public int numberLineSortingOrder = 20;
    [Tooltip("Axis color when level JSON has no lineColor (also editable in dashboard).")]
    public Color numberLineAxisColor = new Color(0.18f, 0.18f, 0.21f, 1f);
    [Tooltip("Tick mark color when level JSON has no tickColor.")]
    public Color numberLineTickColor = new Color(0.12f, 0.12f, 0.14f, 1f);

    public float moveDuration = 0.5f;
    public float rotationAngle = 90f; // Must be 90 degrees for proper turns

    [Header("Grid Debug")]
    [Tooltip("Draws a dot at each cell center (green) and a wireframe around each cell (yellow) in the Scene view. Use while setting up the grid to verify alignment.")]
    public bool drawGridGizmos = false;
    [Tooltip("Color of the gizmo dot drawn at each cell center.")]
    public Color gridGizmoCellCenterColor = new Color(0.2f, 0.95f, 0.2f, 0.9f);
    [Tooltip("Color of the gizmo wireframe drawn around each cell.")]
    public Color gridGizmoCellOutlineColor = new Color(0.95f, 0.85f, 0.1f, 0.6f);

    [Header("Object Sizing (auto-scale to cell)")]
    [Tooltip("When on, every spawned obstacle/grid object/robot is auto-scaled so it fits cleanly inside one cell after spawn.")]
    public bool autoFitObjectsToCell = true;
    [Tooltip("Fraction of the cell that an object should fill on its largest XZ side. 1.0 = exactly cell-sized, 0.85 = small gutter, 1.2 = overflow.")]
    [Range(0.1f, 2f)] public float cellFillRatio = 0.85f;
    [Tooltip("Multiplier applied ONLY to the robot's auto-scale. 1.0 matches grid objects; raise it to make the robot read bigger in the camera.")]
    [Range(0.1f, 3f)] public float robotCellFillMultiplier = 1.1f;
    [Tooltip("Auto-scale the robot too when SetupLevel runs.")]
    public bool autoFitRobotToCell = true;

    [Header("Optional Grid Image (aligned to gizmos)")]
    [Tooltip("Sprite drawn under the matrix. Use ONE sprite to stretch across the whole matrix (single grid texture) or per-cell sprite if 'Tile Per Cell' is on.")]
    public Sprite gridImageSprite;
    [Tooltip("If on, spawns one sprite per cell using gridImageSprite. If off, spawns one stretched sprite covering the whole matrix.")]
    public bool tilePerCell = false;
    [Tooltip("Y offset for the spawned grid image so it sits flat under the objects (small negative number = just below).")]
    public float gridImageYOffset = -0.01f;
    [Tooltip("Sorting order for the spawned grid image SpriteRenderer (lower draws behind).")]
    public int gridImageSortingOrder = -10;
    [Tooltip("Tint color applied to the spawned grid image.")]
    public Color gridImageTint = Color.white;

    [Tooltip("Fine-tune the image size relative to the gizmo grid. 1.0 = exact match (uses sprite rect / pixelsPerUnit). Raise this if your sprite has transparent padding around the tile and the image looks smaller than the gizmos; lower if it overflows. 0.95-1.15 is the usual range.")]
    [Range(0.5f, 1.5f)] public float gridImageScaleMultiplier = 1f;

    [Header("3D camera (Chess Corner view)")]
    [Tooltip("Use a mesh floor (visible from corner cameras). ON recommended for Chess Corner view.")]
    public bool useMeshGridFloorFor3D = true;

    [Tooltip("Optional material for the mesh floor. If empty, one is created from Grid Image Sprite.")]
    public Material gridFloorMeshMaterial;

    [Tooltip("Tilt props toward the camera in 3D corner view (Y rotation).")]
    [Range(0f, 360f)]
    public float presentation3DObjectYaw = 45f;

    [Header("Cell blink highlights")]
    [Tooltip("Shows blinking squares on start/end cells per level config (including flag-placement levels).")]
    public bool showGoalCellBlink = true;
    public Color startCellBlinkColor = new Color(0.35f, 0.75f, 1f, 0.75f);
    public Color endCellBlinkColor = new Color(0.2f, 0.95f, 0.35f, 0.85f);
    [Range(0.1f, 8f)] public float cellBlinkSpeed = 2.5f;
    [Tooltip("Draw order for blink tiles — above floor grid, below props (see endObjectSortingOrderBoost).")]
    public int cellBlinkSortingOrder = 3;
    [Range(0.5f, 1.1f)] public float cellBlinkSizeRatio = 0.96f;
    public float cellBlinkYOffset = 0.04f;
    [Tooltip("Sprite draw order boost for spawned end objects (e.g. bin) so they appear above the floor and blink overlay.")]
    public int endObjectSortingOrderBoost = 10;

    [Header("Guided blank levels (e.g. Level 3)")]
    [Tooltip("After the player fills every blank, start running the queue automatically. If off, they press RUN.")]
    public bool autoRunAfterGuidedBlankFilled = true;

    [Header("Robot drag (before RUN)")]
    [Tooltip("If on, the robot can be dragged on the grid. Pressing RUN always resets to the level's robotStartPosition / robotStartFacing.")]
    public bool allowRobotDrag = false;
    [Tooltip("While dragging, snap the robot's facing toward the pointer (pull direction).")]
    public bool orientRobotTowardDrag = true;
    [Tooltip("Toy-style: press the left or right side of the robot (not center) to turn 90°; center starts a move drag.")]
    public bool tangibleSideTapRotate = true;
    [Tooltip("Center band for move-drag: |lateral| ≤ this fraction of half a cell keeps drag; outside = turn left/right.")]
    [Range(0.15f, 0.45f)]
    public float tangibleCenterDragBandFraction = 0.32f;
    [Tooltip("Smooth visible spin when turning the robot (side tap / scroll / Q-E) before RUN.")]
    public bool animateManualRobotRotation = true;
    [Tooltip("Duration of one 90° toy-style turn.")]
    [Range(0.08f, 1.2f)]
    public float manualRobotRotationDuration = 0.42f;
    [Tooltip("On left/right sides: drag to spin the robot (continuous rotation); release snaps to N/E/S/W. Small movement = one 90° step.")]
    public bool tangibleOrbitDragRotate = true;
    [Tooltip("Yaw per pixel of horizontal screen movement during orbit drag.")]
    [Range(0.05f, 1.2f)]
    public float orbitScreenDegreesPerPixel = 0.42f;
    [Tooltip("Also add yaw from vertical finger/mouse movement while orbit-dragging.")]
    public bool orbitUseVerticalScreenDelta = true;
    [Range(0.05f, 0.8f)]
    public float orbitVerticalToYawScale = 0.28f;
    [Tooltip("Blend in rotation from the pointer angle around the robot on the floor (hands-on feel).")]
    public bool orbitBlendFloorAngle = true;
    [Tooltip("Movement smaller than this (screen pixels) counts as a tap → single 90° turn instead of free spin.")]
    [Range(4f, 40f)]
    public float orbitTapVsDragPixelThreshold = 14f;
    [Tooltip("While dragging (desktop/WebGL): mouse wheel turns the robot 90°. Mobile: side taps or orient-to-drag.")]
    public bool rotateRobotWithScrollWhileDragging = true;

    public GameObject footprintPrefab;
    public float footprintLifetime = 5f;

    public LayerMask gridLayer;
    public Transform actionHistoryTransform;

    [Header("Command history layout")]
    [Tooltip("Width/height of each move icon in the history strip (pixels).")]
    public float commandHistoryIconSize = 56f;
    [Tooltip("Gap between history icons.")]
    public float commandHistorySpacing = 6f;
    [Tooltip("Padding inside the history container.")]
    public float commandHistoryPadding = 4f;
    [Tooltip("Vertical gap between attempt rows (attempt 1 bottom, newer attempts above).")]
    public float commandHistoryRowSpacing = 8f;
    [Tooltip("Optional extra scale on the whole history container (1 = normal). Per-level override in dashboard.")]
    [Range(0.5f, 1.5f)]
    public float defaultCommandHistoryScale = 1f;
    public Button basketButton; // Reference to the basket button
    public GameObject successPopup; // General success popup
    public TextMeshProUGUI successPopupText; // Text for the success popup message
    public Button successPopupContinueButton; // Button to proceed from success popup

    private Animator animator;
    private Queue<CharacterAction> actionQueue = new Queue<CharacterAction>();
    private Queue<CharacterAction> actionHistory = new Queue<CharacterAction>();
    private List<CharacterAction> actionHistoryList = new List<CharacterAction>();
    /// <summary>Active UI row for the current game attempt (1-based display).</summary>
    private Transform _commandHistoryActiveRow;
    private int _commandHistoryActiveAttempt = -1;
    private bool isProcessing = false;
    private Vector3 footprintOffset = new Vector3(0, 0.01f, 0);

    public float collisionBackstep = 1f; // Distance to move back on collision
    private Vector3 lastSafePosition; // To store the character's last safe position

    public Text applesNeededText; // UI Text to display level info



    // private int applesNeeded = 0; // This will be dynamic based on level



    private Coroutine currentMoveCoroutine;
    [SerializeField] private GameObject appleObject; // This might become obsolete or used differently
    public SpriteRenderer spriteRenderer;
    public float fadeDuration = 1.0f; // Duration of fade
    public int repeatCount = 10; // Number of repetitions

    // Task system might be replaced or integrated with the new level system
    // [System.Serializable]
    // public class Task
    // {
    //     public List<CharacterAction> actions;
    //     public string completionMessage;
    //     public bool isCompleted = false; // Flag to indicate task completion
    // }
    // public List<Task> tasks;
    // private int currentTaskIndex = 0;

    private Coroutine fadeCoroutine;
    public AudioClip collectSound; // The sound clip to play
    private AudioSource audioSource; // AudioSource component reference
    public AudioClip footstepsround; // The sound clip to play
    private AudioSource audioSource1; // AudioSource component reference
    private Vector3 initialBasketButtonPosition; // To store the initial position of the basket button

    [Header("ChatGPT Feedback")]
    [Tooltip("Master switch. Turn OFF to completely disable ChatGPT calls (offline / no-API runs).")]
    public bool enableChatGPT = true;
    [Tooltip("Text shown when ChatGPT is disabled but the game still wants to display a fallback hint.")]
    public string chatGPTDisabledFallback = "Keep practicing — you can do it!";
    public ChatGPTManager chatGPTManager;
    public TextMeshProUGUI chatGPTResponseText;

    [Header("Flag Placement Mode")]
    [Tooltip("Legacy inspector toggle — ignored at runtime. Set LevelData.useFlagPlacement on each level instead (e.g. Level 2).")]
    public bool flagPlacementMode = false;
    [Tooltip("Prefab spawned for the goal flag.")]
    public GameObject flagPrefab;

    [Tooltip("Camera used for screen → grid taps and for projecting UI flags onto the overlay. If unset, tries Camera.main, then finds any enabled camera.")]
    public Camera gridInteractionCamera;

    [Tooltip("If your flag prefab is UI under a Canvas, assign that Canvas here. " +
             "Leave EMPTY for world flags (mesh / SpriteRenderer) — those drag like bananas when you tap the grid.")]
    public Canvas flagOverlayCanvas;

    [Tooltip("Optional RectTransform inside the canvas used as positioning root (often the full-screen panel). Defaults to this canvas's root RectTransform.")]
    public RectTransform flagUIContainerRect;
    [Tooltip("If true, the player can tap a different cell to MOVE the flag after it's been placed.")]
    public bool allowFlagMove = true;
    [Tooltip("Optional starting cell for the flag. Use (-1,-1) to leave unplaced until the player taps.")]
    public Vector2Int flagInitialCell = new Vector2Int(-1, -1);

    [Header("Flag visibility (world prefab)")]
    [Tooltip("Lift the flag slightly above the grid floor to reduce z-fighting with tiles.")]
    public float flagVisualYOffset = 0.05f;
    [Tooltip("If true, after spawn the flag copies the first grid prop's rotation (e.g. banana). If none, uses X=90 so flat sprites face the top-down camera.")]
    public bool alignFlagRotationToGridProps = true;
    [Tooltip("Sprite sorting order added on top of the highest grid object order (so the flag draws on top).")]
    public int flagSortingOrderBoost = 8;

    [Tooltip("If ON, the flag can only be placed on the level's isEndObject cell (ignored when LevelData.playerPicksEndCellWithFlag is true).")]
    public bool flagMustUseDesignatedEndCell = false;

    [Tooltip("Cells where the flag cannot be placed (occupied by start object, obstacles, etc.). Auto-managed.")]
    [HideInInspector] public GameObject activeFlag;
    [HideInInspector] public Vector2Int flagCell = new Vector2Int(-1, -1);



    [Header("Virtual Matrix Size (always 6×6)")]
    [Tooltip("Columns — locked to 6 for all levels. Valid cols: 0..5.")]
    [Min(1)] public int gridCols = 6;
    [Tooltip("Rows — locked to 6 for all levels. Valid rows: 0..5.")]
    [Min(1)] public int gridRows = 6;

    /// <summary>
    /// One manual placement in the virtual matrix. Use the Inspector to fill these in, then
    /// click "Apply Virtual Matrix Now" on the component context menu (or enable
    /// <see cref="useVirtualMatrix"/> to override the current level on Play).
    /// </summary>
    [System.Serializable]
    public class VirtualMatrixEntry
    {
        [Tooltip("(col, row) inside the virtual matrix. Auto-clamped to [0..gridCols-1] / [0..gridRows-1].")]
        public Vector2Int cell;

        [Tooltip("Lower-case prefab key (e.g. \"banana\", \"apple\", \"tree\", \"wood\"). Must match GetGridObjectPrefab/obstacle types.")]
        public string objectType = "apple";

        [Tooltip("If true, treat this as the start marker the robot must reach first.")]
        public bool isStartObject;

        [Tooltip("If true, treat this as the goal marker.")]
        public bool isEndObject;

        [Tooltip("If true, treat this as an obstacle (tree / wood).")]
        public bool isObstacle;

        [Tooltip("If true, players can drag this object at runtime.")]
        public bool allowDrag;

        [Tooltip("Optional: place an empty marker, no prefab spawned. Useful for reserving cells.")]
        public bool emptyMarker;
    }

    [Header("Virtual Matrix Mapping (manual)")]
    [Tooltip("Enable to spawn from virtualMatrixEntries instead of LevelData when SetupLevel runs.")]
    public bool useVirtualMatrix = false;

    [Header("Platform level (debug)")]
    [Tooltip("If set, always load this dashboard level key on Play (e.g. level_2). Leave empty for normal progression.")]
    public string playLevelKeyOverride = "";

    [HideInInspector] public string currentLevelKey;

    [Tooltip("Where the robot starts when using the virtual matrix.")]
    public Vector2Int virtualRobotStart = Vector2Int.zero;

    [Tooltip("Robot facing when using the virtual matrix.")]
    public Vector2Int virtualRobotFacing = Vector2Int.up;

    [Tooltip("Manual cell -> object mapping. Each entry's cell is auto-clamped to (0,0)-(gridCols-1, gridRows-1).")]
    public List<VirtualMatrixEntry> virtualMatrixEntries = new List<VirtualMatrixEntry>();

    [Tooltip("When using the virtual matrix, enable blinking start/end cell highlights.")]
    public bool virtualMatrixBlinkHighlights = true;
    public bool virtualMatrixBlinkStartCells = true;
    public bool virtualMatrixBlinkEndCells = true;
    /// <summary>World-space center of cell (0,0) — bottom-left tile. Set automatically from gridOriginTransform in Start().</summary>
    [HideInInspector] public Vector3 robotStartWorldPos;
    private Vector2Int robotGridPosition; // Current grid position of the robot

    /// <summary>Logical grid cell the robot occupies (may differ from level start until RUN).</summary>
    public Vector2Int RobotGridPosition => robotGridPosition;
    private Vector2Int facingDirection = Vector2Int.up;
    private List<PlayerActionLogEntry> actionLog = new List<PlayerActionLogEntry>();
    private List<string> unityFeedbackLog = new List<string>();

    public TextMeshProUGUI assessmentText; // May need rethinking if assessment is per level end
    private List<string> playerActions = new List<string>();

    // New Level Management Variables
    private int currentLevel = 1;

    /// <summary>1-based play slot index (for editor tools).</summary>
    public int CurrentPlaySlot => currentLevel;
    private const int MAX_LEVELS = 19; // Updated to include new levels with grid objects
    private List<LevelData> allLevelsData;
    private string currentUserId;
    private System.Random randomGenerator = new System.Random();
    private float levelStartTime = -1f; // To track level start time

    private readonly List<RunSnapshotTelemetry> _telemetryRunSnapshots = new List<RunSnapshotTelemetry>();
    private string[] _telemetryInitialCommands = System.Array.Empty<string>();
    private string[] _telemetryFinalCommands = System.Array.Empty<string>();
    private float _robotInteractionSeconds;
    private bool _robotWasTouched;
    private bool _robotTouchSessionActive;
    private float _robotTouchSessionStartTime;
    private int _studentResetCountThisAttempt;
    private int _robotTouchStartCount;

    private List<PlayerActionLogEntry> currentAttemptActionLog = new List<PlayerActionLogEntry>();

    private bool hasAssessedLevel = false;

    private List<AssessmentResponse> level1AssessmentResults = new List<AssessmentResponse>();

    public GameObject treePrefab; // Assign in inspector
    public GameObject woodPrefab; // Assign in inspector
    [Tooltip("Wall/block prop — robot cannot pass through cells marked blocksRobot.")]
    public GameObject blockPrefab;

    // NEW: Grid object prefabs
    public GameObject bananaPrefab; // Assign in inspector
    public GameObject binPrefab; // Assign in inspector
    public GameObject newspaperPrefab; // Assign in inspector
    public GameObject recyclePrefab; // Assign in inspector
    public GameObject applePrefab; // Assign in inspector
    public GameObject boxPrefab; // Assign in inspector
    public GameObject amazonBoxPrefab; // Assign in inspector (amazon delivery box)
    public GameObject bedPrefab; // Assign in inspector
    public GameObject chairPrefab; // Assign in inspector
    public GameObject vacuumPrefab; // Assign in inspector
    
    // Additional grid object prefabs
    public GameObject bagPrefab; // Assign in inspector
    public GameObject bookPrefab; // Assign in inspector
    [FormerlySerializedAs("cesarPrefab")]
    public GameObject scissorsPrefab; // Assign in inspector (was cesarPrefab)
    public GameObject crayonsPrefab; // Crayon box (crayon-box.prefab / crayons.prefab)
    public GameObject blackCrayonPrefab; // Single crayon (crayon.prefab / black-crayon.prefab)
    public GameObject gluePrefab; // Assign in inspector
    public GameObject homePrefab; // Assign in inspector
    public GameObject mailPrefab; // Assign in inspector
    public GameObject outletPrefab; // Assign in inspector (Assets/Prefabs/GridObjects/outlet.prefab)
    public GameObject packagePrefab; // Assign in inspector
    public GameObject pencilPrefab; // Assign in inspector
    public GameObject postPrefab; // Assign in inspector
    public GameObject schoolPrefab; // Assign in inspector
    public GameObject greentreePrefab; // Assign in inspector

    // NEW: Track true starting position and facing for each attempt
    private Vector2Int attemptStartGridPos;
    private Vector2Int attemptStartFacing;

    /// <summary>Obstacles spawned for the current level (read-only — used by the camera to frame the view).</summary>
    [HideInInspector] public List<GameObject> activeObstacles = new List<GameObject>();
    /// <summary>Grid objects (apples, bananas, ...) spawned for the current level. Camera reads this to frame everything in view.</summary>
    [HideInInspector] public List<GameObject> activeGridObjects = new List<GameObject>();

    private Vector2Int _introBaselineRobotPosition;
    private Vector2Int _introBaselineRobotFacing;
    private List<GridObjectData> _introBaselineGridObjects = new List<GridObjectData>();
    private bool _introPlayfieldBaselineCached;

    /// <summary>Last loaded level used for playfield layout (NUMBER_LINE offset/size work even if GetCurrentLevelData is briefly null).</summary>
    private LevelData _playfieldLevelData;

    // NEW: Attempt tracking
    private int currentAttempt = 0; // Start at attempt 0
    private Vector2Int startObjectPosition = Vector2Int.zero;
    private Vector2Int endObjectPosition = Vector2Int.zero;
    /// <summary>Goal cell from LevelData <c>isEndObject</c> / <c>guidedEndPosition</c> while in flag-placement mode.</summary>
    private Vector2Int designatedEndObjectCell = new Vector2Int(-1, -1);
    private bool hasReachedStartObject = false;
    private bool hasReachedEndObject = false;
    /// <summary>Tracks whether the student ever reached the start object this level (for assessment).</summary>
    private bool visitedStartObjectThisLevel = false;
    /// <summary>Tracks whether the student ever reached the end object this level (for assessment).</summary>
    private bool visitedEndObjectThisLevel = false;
    private string levelStartObjectType = "";
    private string levelEndObjectType = "";
    /// <summary>Set before success popup; used when reporting assessment on continue.</summary>
    private bool pendingLevelPassed = true;
    private int movesUsedInCurrentAttempt = 0; // Track number of moves used
    private readonly List<Coroutine> _gridObjectFadeCoroutines = new List<Coroutine>();




    // --- NEW State variables for multiple blanks ---
    private int currentBlankIndexInSequence = 0;
    private List<int> blankSlotQueueIndices = new List<int>();
    private List<GameObject> blankSlotInstances = new List<GameObject>();
    private List<string> userBlankChoices = new List<string>();
    private int wrongAnswersCount = 0; // Track number of wrong answers given
    // ---------------------------------------------

    /// <summary>
    /// Converts a grid cell (col, row) to a world-space position.
    /// (0,0) = center of the bottom-left tile.
    /// col increases to the right (+X), row increases upward/forward (+Z).
    /// </summary>
    /// <summary>World position of cell (0,0) including <see cref="gridWorldOffset"/>.</summary>
    public Vector3 GetGridOriginWorld()
    {
        if (gridOriginTransform != null)
            return gridOriginTransform.position + gridWorldOffset;
        return robotStartWorldPos;
    }

    /// <summary>Refreshes <see cref="robotStartWorldPos"/> from the anchor + offset.</summary>
    public void SyncGridOriginCache()
    {
        if (gridOriginTransform != null)
            robotStartWorldPos = gridOriginTransform.position + gridWorldOffset;
        else
            robotStartWorldPos = transform.position + gridWorldOffset;
    }

    private const int LegacyGridColsForCentering = 6;

    /// <summary>Tick index at the middle of the number line (0-based).</summary>
    public static float GetNumberLineTickCenterIndex(LevelData levelData)
    {
        if (levelData?.numberLine == null || levelData.numberLine.tickCount < 1)
            return 0f;
        int ticks = Mathf.Clamp(levelData.numberLine.tickCount, 3, 20);
        return (ticks - 1) * 0.5f;
    }

    /// <summary>
    /// Extra tick-index bias so the number line sits on the legacy 6×6 center (column 2.5).
    /// Zero when <see cref="numberLineAutoCenterHorizontally"/> is off.
    /// </summary>
    public float GetNumberLineHorizontalCenterBias(LevelData levelData)
    {
        if (!numberLineAutoCenterHorizontally || levelData == null || !UsesNumberLine(levelData))
            return 0f;
        float legacyCenter = (LegacyGridColsForCentering - 1) * 0.5f;
        return legacyCenter - GetNumberLineTickCenterIndex(levelData);
    }

    /// <summary>Origin + cell math for NUMBER_LINE, including auto-center and <see cref="numberLineWorldOffset"/>.</summary>
    private Vector3 GridCellToWorldNumberLine(Vector2Int cell, LevelData levelData, Vector3 origin, float spacing)
    {
        float x = origin.x + (cell.x + GetNumberLineHorizontalCenterBias(levelData)) * spacing;
        Vector3 pos = new Vector3(x, origin.y, origin.z + cell.y * spacing);
        return pos + numberLineWorldOffset;
    }

    /// <summary>Active level for grid/number-line math (cached on load).</summary>
    public LevelData PlayfieldLevelData()
    {
        LevelData live = GetCurrentLevelData();
        return live != null ? live : _playfieldLevelData;
    }

    public bool IsPlayfieldNumberLine()
    {
        return UsesNumberLine(PlayfieldLevelData());
    }

    public Vector3 GridCellToWorld(Vector2Int cell, LevelData levelData = null)
    {
        LevelData ld = levelData ?? PlayfieldLevelData();
        Vector3 origin = GetGridOriginWorld();
        float spacing = GetCellSpacingForLayout(ld);
        if (ld != null && UsesNumberLine(ld))
            return GridCellToWorldNumberLine(cell, ld, origin, spacing);
        return new Vector3(
            origin.x + cell.x * spacing,
            origin.y,
            origin.z + cell.y * spacing);
    }

    public Vector3 GridCellToWorld(int col, int row) => GridCellToWorld(new Vector2Int(col, row));

    /// <summary>Base tick spacing for NUMBER_LINE (Inspector or level config). 0 falls back to gridSize.</summary>
    public float GetNumberLineBaseGridSize(LevelData levelData)
    {
        if (levelData?.numberLine != null && levelData.numberLine.tickSpacing > 0.001f)
            return levelData.numberLine.tickSpacing;
        if (numberLineGridSize > 0.001f)
            return numberLineGridSize;
        return gridSize;
    }

    /// <summary>Cell spacing for GRID = gridSize; NUMBER_LINE = number line grid size × playfieldScale.</summary>
    public float GetCellSpacingForLayout(LevelData levelData)
    {
        levelData ??= PlayfieldLevelData();
        if (levelData != null && UsesNumberLine(levelData))
            return GetNumberLineBaseGridSize(levelData) * GetNumberLinePlayfieldScale(levelData);
        return gridSize;
    }

    public float GetNumberLinePlayfieldScale(LevelData levelData)
    {
        if (levelData?.numberLine == null || levelData.numberLine.playfieldScale <= 0f)
            return 1f;
        return levelData.numberLine.playfieldScale;
    }

    public float GetNumberLineObjectScale(LevelData levelData)
    {
        if (levelData?.numberLine == null || levelData.numberLine.objectScale <= 0f)
            return 1f;
        return levelData.numberLine.objectScale;
    }

    public float GetNumberLineRobotScale(LevelData levelData)
    {
        if (levelData?.numberLine == null || levelData.numberLine.robotScale <= 0f)
            return 1f;
        return levelData.numberLine.robotScale;
    }

    public float GetNumberLinePlacementOffset(LevelData levelData)
    {
        float ratio = 0.32f;
        if (levelData?.numberLine != null && levelData.numberLine.placementOffsetRatio > 0f)
            ratio = levelData.numberLine.placementOffsetRatio;
        return ratio * GetCellSpacingForLayout(levelData);
    }

    /// <summary>Returns the nearest grid cell for a world XZ position.</summary>
    public Vector2Int WorldToGridCell(Vector3 world)
    {
        LevelData ld = PlayfieldLevelData();
        float spacing = GetCellSpacingForLayout(ld);
        Vector3 local = world - GetGridOriginWorld();
        if (ld != null && UsesNumberLine(ld))
            local -= numberLineWorldOffset;
        float colF = local.x / spacing;
        if (ld != null && UsesNumberLine(ld))
            colF -= GetNumberLineHorizontalCenterBias(ld);
        int col = Mathf.RoundToInt(colF);
        int row = Mathf.RoundToInt(local.z / spacing);
        return new Vector2Int(col, row);
    }

    /// <summary>When dragging the robot on a number-line level, snap to ticks on the robot row only.</summary>
    public Vector2Int WorldToGridCellForRobotDrag(Vector3 world)
    {
        LevelData ld = PlayfieldLevelData();
        if (ld == null || !UsesNumberLine(ld))
            return WorldToGridCell(world);

        int ticks = ld.numberLine != null && ld.numberLine.tickCount > 0
            ? Mathf.Clamp(ld.numberLine.tickCount, 3, 20)
            : gridCols;
        int robotRow = ld.robotStartPosition.y;
        float spacing = GetCellSpacingForLayout(ld);
        Vector3 local = world - GetGridOriginWorld() - numberLineWorldOffset;
        float colF = local.x / spacing - GetNumberLineHorizontalCenterBias(ld);
        int col = Mathf.Clamp(Mathf.RoundToInt(colF), 0, ticks - 1);
        return new Vector2Int(col, robotRow);
    }

    /// <summary>World position for robot / props using above-on-below row offsets on number-line levels.</summary>
    public Vector3 WorldPositionForGridCell(Vector2Int cell, LevelData levelData = null)
    {
        LevelData ld = levelData ?? PlayfieldLevelData();
        Vector3 p = GridCellToWorld(cell, ld);
        if (ld == null || !UsesNumberLine(ld)) return p;
        int lineRow = GetNumberLineRow(ld);
        float offset = GetNumberLinePlacementOffset(ld);
        if (cell.y < lineRow) p.z -= offset;
        else if (cell.y > lineRow) p.z += offset;
        return p;
    }

    /// <summary>World XZ for the robot on a given cell.</summary>
    public Vector3 RobotWorldPositionAtCell(Vector2Int cell) => WorldPositionForGridCell(cell);

    // -------------------------------------------------------------------
    // Robot drag (optional) — reset to level start on RUN
    // -------------------------------------------------------------------

    public Camera GetGridInteractionCamera()
    {
        if (gridInteractionCamera != null && gridInteractionCamera.enabled)
            return gridInteractionCamera;
        if (Camera.main != null && Camera.main.enabled)
            return Camera.main;
        var cam = FindObjectOfType<Camera>();
        return cam != null && cam.enabled ? cam : null;
    }

    /// <summary>True when the player may drag the robot (global + level flags, not while running).</summary>
    public bool CanDragRobot()
    {
        if (!allowRobotDrag || isProcessing || ManualRobotRotationAnimating) return false;
        LevelData ld = GetCurrentLevelData();
        return ld == null || ld.allowRobotDrag;
    }

    public bool CanPlaceRobotOnCell(Vector2Int cell) => CanRobotEnterCell(cell);

    /// <summary>True if the robot may move onto this grid cell (not out of bounds, not an obstacle/block).</summary>
    public bool CanRobotEnterCell(Vector2Int cell)
    {
        LevelData ld = GetCurrentLevelData();
        if (ld != null && UsesNumberLine(ld))
        {
            int ticks = ld.numberLine != null && ld.numberLine.tickCount > 0
                ? Mathf.Clamp(ld.numberLine.tickCount, 3, 20)
                : gridCols;
            if (cell.x < 0 || cell.x >= ticks || cell.y != ld.robotStartPosition.y)
                return false;
        }
        else if (!CellInGridBounds(cell))
        {
            return false;
        }

        if (hiddenMatrix != null && IsInsideMatrix(cell))
        {
            var occupant = hiddenMatrix[cell.x, cell.y];
            if (occupant.kind == HiddenCellKind.Obstacle) return false;
            if (occupant.kind == HiddenCellKind.GridObject && IsBlockingObjectType(occupant.objectType))
                return false;
        }
        return true;
    }

    private static bool IsBlockingObjectType(string objectType)
    {
        if (string.IsNullOrEmpty(objectType)) return false;
        string t = objectType.ToLowerInvariant();
        return t == "block" || t == "wood" || t == "tree";
    }

    /// <summary>Moves the robot to a grid cell after drag (does not change facing).</summary>
    public bool TryPlaceRobotOnCell(Vector2Int cell)
    {
        LevelData ld = GetCurrentLevelData();
        if (ld != null && UsesNumberLine(ld))
        {
            int ticks = ld.numberLine != null && ld.numberLine.tickCount > 0
                ? Mathf.Clamp(ld.numberLine.tickCount, 3, 20)
                : gridCols;
            cell = new Vector2Int(Mathf.Clamp(cell.x, 0, ticks - 1), ld.robotStartPosition.y);
        }

        if (ManualOrbitDragActive || !CanDragRobot() || !CanPlaceRobotOnCell(cell)) return false;

        Vector2Int from = robotGridPosition;
        if (from == cell)
        {
            SnapRobotToLogicalGridCell();
            return true;
        }

        robotGridPosition = cell;
        SnapRobotToLogicalGridCell();
        OnRobotMovedInMatrix(from, cell);
        Debug.Log($"[CharacterMove] Robot dragged to cell {cell}");
        return true;
    }

    /// <summary>Snaps the robot back after an invalid drag.</summary>
    public void RevertRobotToCell(Vector2Int cell)
    {
        robotGridPosition = cell;
        SnapRobotToLogicalGridCell();
    }

    /// <summary>Called from <see cref="RobotGridDrag"/> while the player drags/orbits the robot.</summary>
    public void AccumulateRobotInteractionTime(float dt)
    {
        if (dt <= 0f) return;
        _robotInteractionSeconds += dt;
        _robotWasTouched = true;
        NotifyRobotManipulationStarted();
    }

    /// <summary>Reports robot drag/tap to platform (mouse or touch). Called from <see cref="RobotGridDrag"/>.</summary>
    public void NotifyRobotManipulationStarted()
    {
        if (_robotTouchSessionActive) return;
        _robotTouchSessionActive = true;
        _robotTouchSessionStartTime = Time.time;
        _robotWasTouched = true;
        _robotTouchStartCount++;
        if (GameAssessmentClient.Instance != null)
            GameAssessmentClient.Instance.SaveRobotTouchEvent("touch_start");
    }

    /// <summary>Ends a robot touch session and sends duration to the platform.</summary>
    public void NotifyRobotManipulationEnded()
    {
        if (!_robotTouchSessionActive) return;
        _robotTouchSessionActive = false;
        float duration = Mathf.Max(0f, Time.time - _robotTouchSessionStartTime);
        if (GameAssessmentClient.Instance != null)
            GameAssessmentClient.Instance.SaveRobotTouchEvent("touch_end", duration);
    }

    private void ResetLevelTelemetry()
    {
        _telemetryRunSnapshots.Clear();
        _telemetryInitialCommands = System.Array.Empty<string>();
        _telemetryFinalCommands = System.Array.Empty<string>();
        _robotInteractionSeconds = 0f;
        _robotWasTouched = false;
        _robotTouchSessionActive = false;
        _studentResetCountThisAttempt = 0;
        _robotTouchStartCount = 0;
    }

    private void CaptureInitialProgramTelemetry()
    {
        _telemetryInitialCommands = SnapshotQueueCommandLabels();
        _telemetryRunSnapshots.Clear();
    }

    private string[] SnapshotQueueCommandLabels()
    {
        if (actionQueue == null || actionQueue.Count == 0)
            return System.Array.Empty<string>();
        return actionQueue.Select(a => a == null ? "blank" : GetActionLogString(a)).ToArray();
    }

    private void RecordTelemetryBeforeRun()
    {
        if (actionQueue.Count == 0) return;
        string[] cmds = SnapshotQueueCommandLabels();
        var snap = new RunSnapshotTelemetry
        {
            label = $"RUN {_telemetryRunSnapshots.Count + 1}",
            commands = cmds
        };
        _telemetryRunSnapshots.Add(snap);
        _telemetryFinalCommands = (string[])cmds.Clone();

        string program = string.Join(", ", cmds);
        if (!string.IsNullOrEmpty(program))
            PersistCommandHistoryEntry(program, "submitted", GetCommandHistoryDisplayAttempt());
    }

    private string[] CollectHiddenPaletteButtonNames()
    {
        var names = new List<string>(8);
        void AddIfHidden(string label, Selectable btn)
        {
            if (btn == null) return;
            if (!btn.gameObject.activeInHierarchy || !btn.interactable)
                names.Add(label);
        }
        AddIfHidden("forward", moveForwardButton);
        AddIfHidden("backward", moveDownButton);
        AddIfHidden("turn left", rotateLeftButton);
        AddIfHidden("turn right", rotateRightButton);
        return names.ToArray();
    }

    private string BuildLevelTelemetryJson(float levelElapsedSeconds)
    {
        var tel = new LevelTelemetryU
        {
            initial_commands = _telemetryInitialCommands ?? System.Array.Empty<string>(),
            run_snapshots = _telemetryRunSnapshots.ToArray(),
            final_commands = _telemetryFinalCommands ?? System.Array.Empty<string>(),
            palette_buttons_hidden = CollectHiddenPaletteButtonNames(),
            robot_interaction_seconds = _robotInteractionSeconds,
            robot_was_touched = _robotWasTouched || _robotInteractionSeconds > 0.02f,
            level_elapsed_seconds = levelElapsedSeconds,
            level_allowed_action_buttons = null
        };
        LevelData ld = GetCurrentLevelData();
        var allowed = ResolveEnabledActionButtons(ld);
        if (allowed != null && allowed.Count > 0)
            tel.level_allowed_action_buttons = allowed.ToArray();
        else if (ld != null && ld.blankEnabledArrows != null && ld.blankEnabledArrows.Count > 0)
            tel.level_allowed_action_buttons = ld.blankEnabledArrows.ToArray();
        return JsonUtility.ToJson(tel);
    }

    /// <summary>Teleports the robot to the active level's start cell and facing (called before RUN).</summary>
    public void ResetRobotToLevelStart()
    {
        LevelData ld = GetCurrentLevelData();
        if (ld == null) return;

        Vector2Int from = robotGridPosition;
        robotGridPosition = ld.robotStartPosition;
        facingDirection = ld.robotStartFacing;
        ApplyRobotFacingRotation();

        Vector3 target = GridCellToWorld(robotGridPosition);
        transform.position = target;
        SnapRobotToLogicalGridCell();
        lastSafePosition = transform.position;

        if (hiddenMatrix != null)
            OnRobotMovedInMatrix(from, robotGridPosition);

        hasReachedEndObject = false;
        hasReachedStartObject = false;
        visitedStartObjectThisLevel = false;
        RestoreAllGridObjectsForNewAttempt();

        SyncStartObjectReachedState();
        CheckGridObjectInteractions();

        Debug.Log($"[CharacterMove] Robot reset to level start {robotGridPosition}, facing {facingDirection} startOk={hasReachedStartObject}");
    }

    /// <summary>Caches level robot/grid from dashboard for intro steps that use the default playfield.</summary>
    public void SnapshotIntroPlayfieldBaseline()
    {
        LevelData ld = GetCurrentLevelData();
        if (ld == null) return;
        _introBaselineRobotPosition = ld.robotStartPosition;
        _introBaselineRobotFacing = ld.robotStartFacing;
        _introBaselineGridObjects = ld.gridObjects != null
            ? new List<GridObjectData>(ld.gridObjects)
            : new List<GridObjectData>();
        _introPlayfieldBaselineCached = true;
    }

    /// <summary>Applies per-step playfield from dashboard (robot cell, facing, props) before each intro teaching step.</summary>
    public void ApplyIntroStepPlayfield(ActionBlockIntroStepData step)
    {
        LevelData ld = GetCurrentLevelData();
        if (ld == null) return;
        if (!_introPlayfieldBaselineCached)
            SnapshotIntroPlayfieldBaseline();

        Vector2Int robotPos = _introBaselineRobotPosition;
        Vector2Int robotFace = _introBaselineRobotFacing;
        List<GridObjectData> objects = _introBaselineGridObjects;

        if (step?.playfield != null && step.playfield.useCustomPlayfield)
        {
            robotPos = step.playfield.robotStartPosition;
            robotFace = step.playfield.robotStartFacing;
            objects = step.playfield.gridObjects ?? new List<GridObjectData>();
        }

        ld.robotStartPosition = robotPos;
        ld.robotStartFacing = robotFace;
        RespawnIntroGridObjects(objects, ld);
        ClearUserActionQueue();
        ResetRobotToLevelStart();
        RefreshCellBlinkHighlights(ld);
    }

    private void RespawnIntroGridObjects(List<GridObjectData> gridObjects, LevelData levelData)
    {
        foreach (var o in activeGridObjects)
        {
            if (o != null) Destroy(o);
        }
        activeGridObjects.Clear();
        startObjectPosition = Vector2Int.zero;
        endObjectPosition = Vector2Int.zero;

        if (gridObjects == null) return;

        foreach (var gridObject in gridObjects)
        {
            if (gridObject == null) continue;
            GameObject prefab = GetGridObjectPrefab(gridObject.objectType);
            if (prefab == null) continue;

            Vector3 worldPos = GridCellToWorld(gridObject.position);
            var obj = Instantiate(prefab, worldPos, prefab.transform.rotation);
            obj.SetActive(true);
            FitObjectToCell(obj);
            NormalizeSpawnedGridObject(obj, gridObject);
            activeGridObjects.Add(obj);

            var cluster = obj.GetComponent<GridObjectCluster>() ?? obj.AddComponent<GridObjectCluster>();
            cluster.allowDrag = gridObject.allowDrag || (levelData != null && levelData.allowGridObjectDrag);
            cluster.characterMove = this;

            if (gridObject.isStartObject) startObjectPosition = gridObject.position;
            if (gridObject.isEndObject) endObjectPosition = gridObject.position;
        }
    }

    private void ApplyRobotFacingRotation()
    {
        if (facingDirection == Vector2Int.up)
            transform.rotation = Quaternion.identity;
        else if (facingDirection == Vector2Int.right)
            transform.rotation = Quaternion.Euler(0f, 90f, 0f);
        else if (facingDirection == Vector2Int.down)
            transform.rotation = Quaternion.Euler(0f, 180f, 0f);
        else if (facingDirection == Vector2Int.left)
            transform.rotation = Quaternion.Euler(0f, 270f, 0f);
    }

    /// <summary>Logical forward on the grid (before RUN / drag). Up = +row / +Z.</summary>
    public Vector2Int RobotFacing => facingDirection;

    /// <summary>True while the user is orbit-spinning the robot with finger/mouse (before RUN).</summary>
    public bool ManualOrbitDragActive { get; private set; }

    public void SetManualOrbitDragActive(bool active)
    {
        ManualOrbitDragActive = active;
        if (animator != null && active)
            animator.enabled = false;
    }

    public void RestoreAnimatorAfterOrbitIfIdle()
    {
        if (animator != null && !ManualOrbitDragActive && !ManualRobotRotationAnimating)
            animator.enabled = true;
    }

    /// <summary>After free-spinning the transform, snap logical facing to the nearest 90° for the grid.</summary>
    public void SnapRobotFacingToNearestCardinalFromTransform()
    {
        float y = transform.eulerAngles.y;
        y = (y % 360f + 360f) % 360f;
        int q = Mathf.RoundToInt(y / 90f) % 4;
        if (q < 0) q += 4;
        switch (q)
        {
            case 0: facingDirection = Vector2Int.up; break;
            case 1: facingDirection = Vector2Int.right; break;
            case 2: facingDirection = Vector2Int.down; break;
            default: facingDirection = Vector2Int.left; break;
        }
        ApplyRobotFacingRotation();
        SnapRobotToLogicalGridCell();
    }

    /// <summary>True while toy / scroll / key rotation is playing (not program RUN).</summary>
    public bool ManualRobotRotationAnimating { get; private set; }

    private Coroutine _manualRobotRotationCoroutine;

    /// <summary>Snaps facing to a cardinal direction (for drag UX). No-op if not cardinal.</summary>
    public void SetRobotFacingDirection(Vector2Int dir)
    {
        if (dir == Vector2Int.zero) return;
        int ax = Mathf.Abs(dir.x), ay = Mathf.Abs(dir.y);
        if (ax + ay != 1) return;
        facingDirection = new Vector2Int(Mathf.Clamp(dir.x, -1, 1), Mathf.Clamp(dir.y, -1, 1));
        ApplyRobotFacingRotation();
    }

    /// <summary>Instant 90° turn (used when animation is off or internally after anim completes).</summary>
    public void ApplyRobotQuarterTurnImmediate(bool clockwise)
    {
        if (clockwise)
            facingDirection = new Vector2Int(facingDirection.y, -facingDirection.x);
        else
            facingDirection = new Vector2Int(-facingDirection.y, facingDirection.x);
        ApplyRobotFacingRotation();
    }

    /// <summary>90° turn for toy UI — animates when <see cref="animateManualRobotRotation"/> is on.</summary>
    public void RotateRobotFacingQuarterTurn(bool clockwise)
    {
        if (!animateManualRobotRotation || !isActiveAndEnabled)
        {
            ApplyRobotQuarterTurnImmediate(clockwise);
            SnapRobotToLogicalGridCell();
            return;
        }

        if (ManualRobotRotationAnimating)
            return;

        if (_manualRobotRotationCoroutine != null)
            StopCoroutine(_manualRobotRotationCoroutine);
        _manualRobotRotationCoroutine = StartCoroutine(ManualRobotRotationRoutine(clockwise));
    }

    private IEnumerator ManualRobotRotationRoutine(bool clockwise)
    {
        ManualRobotRotationAnimating = true;
        float signed = clockwise ? 90f : -90f;
        Quaternion startRot = transform.rotation;
        Quaternion endRot = startRot * Quaternion.Euler(0f, signed, 0f);

        bool animatorWasEnabled = false;
        if (animator != null)
        {
            animatorWasEnabled = animator.enabled;
            animator.enabled = false;
        }

        float dur = Mathf.Max(0.05f, manualRobotRotationDuration);
        float elapsed = 0f;
        while (elapsed < dur)
        {
            elapsed += Time.deltaTime;
            float u = Mathf.SmoothStep(0f, 1f, elapsed / dur);
            transform.rotation = Quaternion.Slerp(startRot, endRot, u);
            yield return null;
        }

        transform.rotation = endRot;
        if (animator != null)
            animator.enabled = animatorWasEnabled;

        ApplyRobotQuarterTurnImmediate(clockwise);
        SnapRobotToLogicalGridCell();

        ManualRobotRotationAnimating = false;
        _manualRobotRotationCoroutine = null;
    }

    private void OnDisable()
    {
        if (_manualRobotRotationCoroutine != null)
        {
            StopCoroutine(_manualRobotRotationCoroutine);
            _manualRobotRotationCoroutine = null;
        }
        ManualRobotRotationAnimating = false;
        ManualOrbitDragActive = false;
    }

    private void SetupRobotDrag(LevelData levelData)
    {
        var drag = GetComponent<RobotGridDrag>();
        bool enable = allowRobotDrag && levelData != null && levelData.allowRobotDrag;

        if (enable)
        {
            if (drag == null) drag = gameObject.AddComponent<RobotGridDrag>();
            drag.characterMove = this;
            drag.enabled = true;
            EnsureRobotDragCollider();
        }
        else
        {
            if (drag != null) drag.enabled = false;
        }
    }

    private void EnsureRobotDragCollider()
    {
        Collider col = GetComponent<Collider>();
        if (col == null)
        {
            var box = gameObject.AddComponent<BoxCollider>();
            float s = Mathf.Max(gridSize * 0.85f, 0.5f);
            box.size = new Vector3(s, Mathf.Max(s * 0.5f, 0.5f), s);
            box.isTrigger = false;
        }

        Rigidbody rb = GetComponent<Rigidbody>();
        if (rb == null)
        {
            rb = gameObject.AddComponent<Rigidbody>();
            rb.isKinematic = true;
            rb.useGravity = false;
            rb.constraints = RigidbodyConstraints.FreezeRotation;
        }
    }

    private Vector3 ResolveRobotWorldPosition() =>
        WorldPositionForGridCell(robotGridPosition);

    /// <summary>Aligns robot XZ to the logical cell; raycasts gridLayer for floor Y.</summary>
    private void SnapRobotToLogicalGridCell()
    {
        Vector3 cell = ResolveRobotWorldPosition();
        Vector3 p = transform.position;
        p.x = cell.x;
        p.z = cell.z;
        Ray ray = new Ray(new Vector3(p.x, p.y + 0.5f, p.z), Vector3.down);
        if (Physics.Raycast(ray, out RaycastHit hit, 4f, gridLayer))
            p.y = hit.point.y;
        transform.position = p;
        lastSafePosition = p;
    }

    // -------------------------------------------------------------------
    // Hidden gridCols x gridRows matrix (logical view of the board)
    // -------------------------------------------------------------------

    /// <summary>What occupies a single matrix cell.</summary>
    public enum HiddenCellKind { Empty, Robot, StartObject, EndObject, GridObject, Obstacle }

    /// <summary>Logical state of one matrix cell.</summary>
    [System.Serializable]
    public struct HiddenCell
    {
        public HiddenCellKind kind;
        /// <summary>"banana", "apple", "tree", etc. Empty string for <see cref="HiddenCellKind.Empty"/>.</summary>
        public string objectType;
        /// <summary>Live scene instance for this cell, if any. Null for Empty / Robot.</summary>
        public GameObject instance;

        public bool IsEmpty => kind == HiddenCellKind.Empty;
        public override string ToString() => kind == HiddenCellKind.Empty ? "." : kind.ToString()[0] + ":" + objectType;
    }

    /// <summary>
    /// Hidden gridCols x gridRows matrix indexed as [col, row] with (0,0) = bottom-left tile.
    /// Rebuilt every time a level loads; kept in sync as the robot moves and objects are dragged.
    /// </summary>
    public HiddenCell[,] hiddenMatrix;

    /// <summary>True if (col, row) is inside the hidden matrix.</summary>
    public bool IsInsideMatrix(int col, int row) =>
        hiddenMatrix != null && col >= 0 && row >= 0 && col < hiddenMatrix.GetLength(0) && row < hiddenMatrix.GetLength(1);

    public bool IsInsideMatrix(Vector2Int cell) => IsInsideMatrix(cell.x, cell.y);

    /// <summary>Reads a cell. Returns an Empty cell when out of bounds.</summary>
    public HiddenCell GetMatrixCell(int col, int row) =>
        IsInsideMatrix(col, row) ? hiddenMatrix[col, row] : new HiddenCell { kind = HiddenCellKind.Empty };

    public HiddenCell GetMatrixCell(Vector2Int cell) => GetMatrixCell(cell.x, cell.y);

    /// <summary>Writes a cell. No-op if out of bounds.</summary>
    public void SetMatrixCell(int col, int row, HiddenCell value)
    {
        if (!IsInsideMatrix(col, row)) return;
        hiddenMatrix[col, row] = value;
    }

    public void SetMatrixCell(Vector2Int cell, HiddenCell value) => SetMatrixCell(cell.x, cell.y, value);

    /// <summary>Resets the matrix to gridCols x gridRows of empty cells.</summary>
    public void ClearHiddenMatrix()
    {
        hiddenMatrix = new HiddenCell[gridCols, gridRows];
    }

    /// <summary>
    /// Rebuilds the hidden matrix for the given level: robot, obstacles, grid objects.
    /// Cells outside [0..gridCols-1, 0..gridRows-1] are silently ignored (level may use neg coords).
    /// </summary>
    public void BuildHiddenMatrix(LevelData levelData)
    {
        ClearHiddenMatrix();
        if (levelData == null) return;

        // Robot
        SetMatrixCell(robotGridPosition,
            new HiddenCell { kind = HiddenCellKind.Robot, objectType = "robot", instance = gameObject });

        // Obstacles
        if (levelData.obstacles != null)
        {
            foreach (var obs in levelData.obstacles)
            {
                if (!IsInsideMatrix(obs.position)) continue;
                SetMatrixCell(obs.position,
                    new HiddenCell { kind = HiddenCellKind.Obstacle, objectType = obs.type });
            }
        }

        // Grid objects (blocking props register as obstacles in the matrix)
        if (levelData.gridObjects != null)
        {
            foreach (var go in levelData.gridObjects)
            {
                if (!IsInsideMatrix(go.position)) continue;

                if (go.blocksRobot || IsBlockingObjectType(go.objectType))
                {
                    SetMatrixCell(go.position,
                        new HiddenCell { kind = HiddenCellKind.Obstacle, objectType = go.objectType });
                    continue;
                }

                HiddenCellKind kind = HiddenCellKind.GridObject;
                if (go.isStartObject) kind = HiddenCellKind.StartObject;
                else if (go.isEndObject) kind = HiddenCellKind.EndObject;

                // Try to link the spawned instance for this grid position
                GameObject instance = null;
                Vector3 worldAtCell = GridCellToWorld(go.position);
                foreach (var obj in activeGridObjects)
                {
                    if (obj == null) continue;
                    if (Vector3.Distance(obj.transform.position, worldAtCell) < gridSize * 0.5f &&
                        obj.name.ToLower().Contains(go.objectType.ToLower()))
                    {
                        instance = obj;
                        break;
                    }
                }

                SetMatrixCell(go.position,
                    new HiddenCell { kind = kind, objectType = go.objectType, instance = instance });
            }
        }

        if (levelData.goalCell.x >= 0 && levelData.goalCell.y >= 0 && IsInsideMatrix(levelData.goalCell))
        {
            Vector2Int g = levelData.goalCell;
            HiddenCellKind existing = hiddenMatrix[g.x, g.y].kind;
            if (existing == HiddenCellKind.Empty)
            {
                SetMatrixCell(g, new HiddenCell { kind = HiddenCellKind.EndObject, objectType = "goal" });
            }
        }
    }

    /// <summary>Move the robot marker inside the matrix from <paramref name="from"/> to <paramref name="to"/>.</summary>
    public void OnRobotMovedInMatrix(Vector2Int from, Vector2Int to)
    {
        if (hiddenMatrix == null) return;
        if (IsInsideMatrix(from) && hiddenMatrix[from.x, from.y].kind == HiddenCellKind.Robot)
            hiddenMatrix[from.x, from.y] = new HiddenCell { kind = HiddenCellKind.Empty };
        if (IsInsideMatrix(to))
            hiddenMatrix[to.x, to.y] = new HiddenCell { kind = HiddenCellKind.Robot, objectType = "robot", instance = gameObject };
    }

    /// <summary>Move a grid object marker inside the matrix from <paramref name="from"/> to <paramref name="to"/>.</summary>
    public void OnGridObjectMovedInMatrix(Vector2Int from, Vector2Int to)
    {
        if (hiddenMatrix == null) return;
        if (!IsInsideMatrix(from)) return;
        HiddenCell moved = hiddenMatrix[from.x, from.y];
        if (moved.kind == HiddenCellKind.Empty || moved.kind == HiddenCellKind.Robot) return;
        hiddenMatrix[from.x, from.y] = new HiddenCell { kind = HiddenCellKind.Empty };
        if (IsInsideMatrix(to))
            hiddenMatrix[to.x, to.y] = moved;
    }

    // -------------------------------------------------------------------
    // Flag placement (used by FlagPlacement.cs)
    // -------------------------------------------------------------------

    /// <summary>True only when the active level has <see cref="LevelData.useFlagPlacement"/>.</summary>
    public bool IsFlagPlacementActive
    {
        get
        {
            LevelData ld = GetCurrentLevelData();
            return ld != null && ld.useFlagPlacement;
        }
    }

    /// <summary>True when RUN must wait for the player to place the flag (flag levels only).</summary>
    public bool IsRunBlockedByFlagRequirement()
    {
        LevelData ld = GetCurrentLevelData();
        return ld != null && ld.useFlagPlacement && ld.requireFlagBeforeRun && !IsFlagPlaced;
    }

