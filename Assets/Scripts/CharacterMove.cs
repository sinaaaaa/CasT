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
    /// <summary>Robot cannot enter this cell â€” bumps back on forward/backward into it.</summary>
    public bool blocksRobot = false;
    public bool allowDrag = false; // If true, this specific object can be dragged
    public Vector2Int guidedEndPosition = Vector2Int.zero; // Target position for guided levels (optional)
    /// <summary>NUMBER_LINE: above | below | onLine â€” used for vertical offset in Unity.</summary>
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
    /// <summary>Dashboard order index (0 = intro, 1 = level 1, 2 = level 2, â€¦).</summary>
    public int orderIndex;
    /// <summary>INTRO | DRAG_ACTIONS | FLAG_PLACEMENT | CHOOSE_BUTTONS | DRAG_EDIT_PROGRAM â€” from teacher dashboard.</summary>
    public string levelType;
    public string levelName;
    /// <summary>GRID (default) or NUMBER_LINE â€” horizontal tick axis instead of full 6Ã—6 board.</summary>
    public string layoutMode = "GRID";
    public NumberLineConfig numberLine;
    public List<ObstacleData> obstacles = new List<ObstacleData>(); // NEW
    public List<GridObjectData> gridObjects = new List<GridObjectData>(); // NEW: Grid objects for start/end
    public int maxAttempts = 3; // NEW: Maximum attempts for this level
    public bool isRandom = false;
    public int numRandomApples = 0; // Only used if isRandom is true
    public Vector2Int robotStartPosition = new Vector2Int(0,0); // Default start position
    public Vector2Int robotStartFacing = Vector2Int.up; // Default facing up

    /// <summary>Playfield size after <see cref="CharacterMove.ApplyLevelGridDimensions"/> (default 6Ã—6 grid).</summary>
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
             "That cell becomes isEndObject for the run (e.g. Level 2: 3Ã— forward, then reach the flag). " +
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

    [Tooltip("Scale of command-history UI (0.2â€“1). Default 0.45 = small strip.")]
    public float commandHistoryScale = 1f;

    [Tooltip("Show the in-game Reset button for students on this level.")]
    public bool showStudentResetButton = true;

    [Tooltip("When true, RUN animates Robo through the program. When false, RUN checks the answer without moving Robo.")]
    public bool runRobotOnSubmit = true;

    [Tooltip("Shown in the success popup when the student completes the level. Supports {levelName}.")]
    public string attemptSuccessMessage;

    [Tooltip("Shown in the wrong-answer popup. Supports {attempt}, {maxAttempts}, {reason}.")]
    public string attemptFailureMessage;

    [Tooltip("Shown when max attempts are used. Supports {levelName}, {maxAttempts}.")]
    public string maxAttemptsMessage;

    [Header("Top-right hint panel")]
    [Tooltip("Shown during normal play (hidden while action-block intro runs â€” intro steps use their own hints).")]
    public LevelCornerHint cornerHint = new LevelCornerHint();

    [Header("Action block introduction (optional)")]
    [Tooltip("Teach palette blocks one at a time before regular level play. Configure steps like level data.")]
    public ActionBlockIntroConfig actionBlockIntro;
}

/// <summary>Top-right text/image hint â€” used for levels and intro steps.</summary>
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
    [Tooltip("PlayerPrefs key â€” intro is skipped after completion when showOnlyOnce is true.")]
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

    [Header("UI â€” top-right hints")]
    [Tooltip("Optional. Auto-created if empty. Default panel style (background, listen button, sizes) is edited here. Per-level overrides: Level Data â†’ Corner Hint â†’ Use Custom Layout.")]
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
    [Tooltip("If true, dragging a queued block OUTSIDE the drop zone (the yellow strip) and releasing deletes the block â€” Scratch-style 'drag off the script area to throw away'. When false, the block snaps back to its original position.")]
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

    // â”€â”€ Grid Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // The grid is a matrix where (0,0) = bottom-left cell.
    // Positive X  â†’ moves right  (columns increase).
    // Positive Z  â†’ moves up/forward (rows increase).
    //
    // EASIEST SETUP (recommended):
    //   1. Set Grid Rows and Grid Cols to match your visual grid (e.g. 6 and 6).
    //   2. Drag the grid background object (Quad / Plane / Sprite) into Grid Background.
    //   3. Right-click this component â†’ "Auto-Calculate Grid From Background".
    //      gridSize and the grid origin are computed automatically.
    //   4. Enable Draw Grid Gizmos and confirm green dots sit on tile centers.
    //
    // VIRTUAL MATRIX SETUP â€” the matrix is purely logical: cells (0,0)..(gridCols-1, gridRows-1).
    //   â€¢ Place an empty GameObject in the scene at the CENTER of cell (0,0) and drag it
    //     into Grid Origin Transform. That single anchor + Grid Cell Size = world layout.
    //   â€¢ Expanding gridCols / gridRows in the Inspector adds NEW cells outward; existing
    //     cells keep the same world position and the same world size (gridSize).
    //   â€¢ Drop images (sprite prefabs) into specific cells manually via virtualMatrixEntries.
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [Header("Grid Setup")]
    [Tooltip("Empty GameObject at the center of the playfield when Grid Auto Center On Origin is on. " +
             "Drag it in the Scene view to move the whole grid. " +
             "Right-click CharacterMove → Create Grid Origin Anchor, or add GridOriginAnchor to an empty object.")]
    public Transform gridOriginTransform;
    [Tooltip("Extra nudge for the whole grid (world units). Applied on top of auto-center when enabled.")]
    public Vector3 gridWorldOffset = Vector3.zero;

    [Tooltip("When on, Grid Origin Transform is the center of the playfield (not cell 0,0). " +
             "Turn off if you place GridImage_Stretched manually in the scene.")]
    public bool gridAutoCenterOnOrigin = false;

    [Tooltip("When on, moving Grid Origin Transform in the editor updates the grid immediately (Play mode + Scene view gizmos).")]
    public bool syncGridOriginEveryFrame = true;
    [Tooltip("World-space distance between two adjacent cell centers on the 6Ã—6 grid. Does not affect NUMBER_LINE when Number Line Grid Size is set.")]
    [Min(0.001f)] public float gridSize = 100f;

    [Header("Number Line Layout (NUMBER_LINE levels only)")]
    [Tooltip("Tick spacing for the number line (world units). 0 = use Grid Size above. Does NOT change the 6Ã—6 grid.")]
    [Min(0f)] public float numberLineGridSize = 0f;
    [Tooltip("World-space nudge for the number line only â€” does NOT move the 6Ã—6 grid. Use X to shift left/right, Z for forward/back.")]
    public Vector3 numberLineWorldOffset = Vector3.zero;
    [Tooltip("When on, shifts ticks so the middle of the line aligns with the 6Ã—6 board center. Turn off and use Number Line World Offset only if you prefer manual placement.")]
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

    [Tooltip("Optional: drag your scene GridImage_Stretched here. Its Position/Rotation/Scale in the Inspector are kept.")]
    public Transform gridImageStretchedOverride;

    [Tooltip("When on (default), CreateOrRefreshGridImage never moves GridImage_Stretched — only updates sprite/tint/sorting.")]
    public bool preserveManualGridImageTransform = true;

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
    [Tooltip("Draw order for blink tiles â€” above floor grid, below props (see endObjectSortingOrderBoost).")]
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
    [Tooltip("Toy-style: press the left or right side of the robot (not center) to turn 90Â°; center starts a move drag.")]
    public bool tangibleSideTapRotate = true;
    [Tooltip("Center band for move-drag: |lateral| â‰¤ this fraction of half a cell keeps drag; outside = turn left/right.")]
    [Range(0.15f, 0.45f)]
    public float tangibleCenterDragBandFraction = 0.32f;
    [Tooltip("Smooth visible spin when turning the robot (side tap / scroll / Q-E) before RUN.")]
    public bool animateManualRobotRotation = true;
    [Tooltip("Duration of one 90Â° toy-style turn.")]
    [Range(0.08f, 1.2f)]
    public float manualRobotRotationDuration = 0.42f;
    [Tooltip("On left/right sides: drag to spin the robot (continuous rotation); release snaps to N/E/S/W. Small movement = one 90Â° step.")]
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
    [Tooltip("Movement smaller than this (screen pixels) counts as a tap â†’ single 90Â° turn instead of free spin.")]
    [Range(4f, 40f)]
    public float orbitTapVsDragPixelThreshold = 14f;
    [Tooltip("While dragging (desktop/WebGL): mouse wheel turns the robot 90Â°. Mobile: side taps or orient-to-drag.")]
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
    private bool _lastMoveBlocked;

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
    public string chatGPTDisabledFallback = "Keep practicing â€” you can do it!";
    public ChatGPTManager chatGPTManager;
    public TextMeshProUGUI chatGPTResponseText;

    [Header("Flag Placement Mode")]
    [Tooltip("Legacy inspector toggle â€” ignored at runtime. Set LevelData.useFlagPlacement on each level instead (e.g. Level 2).")]
    public bool flagPlacementMode = false;
    [Tooltip("Prefab spawned for the goal flag.")]
    public GameObject flagPrefab;

    [Tooltip("Camera used for screen â†’ grid taps and for projecting UI flags onto the overlay. If unset, tries Camera.main, then finds any enabled camera.")]
    public Camera gridInteractionCamera;

    [Tooltip("If your flag prefab is UI under a Canvas, assign that Canvas here. " +
             "Leave EMPTY for world flags (mesh / SpriteRenderer) â€” those drag like bananas when you tap the grid.")]
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



    [Header("Virtual Matrix Size (always 6Ã—6)")]
    [Tooltip("Columns â€” locked to 6 for all levels. Valid cols: 0..5.")]
    [Min(1)] public int gridCols = 6;
    [Tooltip("Rows â€” locked to 6 for all levels. Valid rows: 0..5.")]
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
    /// <summary>World-space center of cell (0,0) â€” bottom-left tile. Set automatically from gridOriginTransform in Start().</summary>
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

    /// <summary>Number of levels currently loaded (platform or built-in).</summary>
    public int LoadedLevelCount => allLevelsData != null ? allLevelsData.Count : 0;

    public string GetLoadedLevelLabel(int slot)
    {
        if (allLevelsData == null || slot < 1 || slot > allLevelsData.Count) return $"Slot {slot}";
        var ld = allLevelsData[slot - 1];
        string vis = ld != null && ld.visible ? "" : " [hidden]";
        string hist = ld != null && ld.showCommandHistory ? " · history" : "";
        return $"{slot}. {ld?.levelName ?? "?"} ({ld?.levelKey}){vis}{hist}";
    }

    /// <summary>Editor / debug: reload a level slot (1-based) without changing saved player progress key.</summary>
    public void EditorReloadLevelSlot(int slot)
    {
        if (slot < 1 || allLevelsData == null || slot > allLevelsData.Count)
        {
            Debug.LogWarning($"[CharacterMove] Invalid level slot {slot} (loaded={allLevelsData?.Count ?? 0})");
            return;
        }
        currentLevel = slot;
        var ld = allLevelsData[slot - 1];
        if (ld != null && !string.IsNullOrEmpty(ld.levelKey))
            currentLevelKey = ld.levelKey;
        SetupLevel(slot);
        Debug.Log($"[CharacterMove] Editor reload slot {slot} key='{ld?.levelKey}'");
    }

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
    [Tooltip("Wall/block prop â€” robot cannot pass through cells marked blocksRobot.")]
    public GameObject blockPrefab;

    private readonly Dictionary<string, GameObject> _runtimeGridPrefabCache = new Dictionary<string, GameObject>();

    private GameObject TryLoadRuntimeGridPrefab(string objectType)
    {
        string key = objectType.ToLower();
        if (_runtimeGridPrefabCache.TryGetValue(key, out var cached) && cached != null)
            return cached;

        var fromResources = Resources.Load<GameObject>($"GridObjects/{key}");
        if (fromResources != null)
        {
            _runtimeGridPrefabCache[key] = fromResources;
            return fromResources;
        }

        // backpack and bag share bagPrefab; try alternate resource name
        if (key == "backpack" || key == "bag")
        {
            string alt = key == "backpack" ? "bag" : "backpack";
            fromResources = Resources.Load<GameObject>($"GridObjects/{alt}");
            if (fromResources != null)
            {
                _runtimeGridPrefabCache[key] = fromResources;
                return fromResources;
            }
        }

        return null;
    }

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
    [Tooltip("Used for platform object types \"bag\" and \"backpack\" (same prefab).")]
    public GameObject bagPrefab;
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

    /// <summary>Obstacles spawned for the current level (read-only â€” used by the camera to frame the view).</summary>
    [HideInInspector] public List<GameObject> activeObstacles = new List<GameObject>();
    /// <summary>Grid objects (apples, bananas, ...) spawned for the current level. Camera reads this to frame everything in view.</summary>
    [HideInInspector] public List<GameObject> activeGridObjects = new List<GameObject>();

    private Vector2Int _introBaselineRobotPosition;
    private Vector2Int _introBaselineRobotFacing;
    private List<GridObjectData> _introBaselineGridObjects = new List<GridObjectData>();
    private bool _introPlayfieldBaselineCached;
    private Coroutine _levelStartFacingRoutine;
    private int _levelStartFacingLockFrames;

    /// <summary>Last loaded level used for playfield layout (NUMBER_LINE offset/size work even if GetCurrentLevelData is briefly null).</summary>
    private LevelData _playfieldLevelData;

    // NEW: Attempt tracking
    private int currentAttempt = 0; // Start at attempt 0
    private int _activeInLevelRunNumber;
    private float _runAttemptStartTime = -1f;
    private bool _skipNextPlatformReport;
    /// <summary>True after this RUN's result was sent to the platform (avoids duplicate end on popup continue).</summary>
    private bool _currentRunReportedToPlatform;
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
    /// <summary>World position of cell (0,0) including auto-center and <see cref="gridWorldOffset"/>.</summary>
    public Vector3 GetGridOriginWorld()
    {
        if (gridOriginTransform != null)
            return gridOriginTransform.position + GetGridAutoCenterBaseOffset() + gridWorldOffset;
        return robotStartWorldPos;
    }

    /// <summary>
    /// Shifts the grid so its visual center sits on <see cref="gridOriginTransform"/> (GRID levels only).
    /// </summary>
    private Vector3 GetGridAutoCenterBaseOffset()
    {
        LevelData ld = PlayfieldLevelData();
        if (!gridAutoCenterOnOrigin || (ld != null && UsesNumberLine(ld)))
            return Vector3.zero;

        float spacing = GetCellSpacingForLayout(ld);
        return new Vector3(
            -(gridCols - 1) * 0.5f * spacing,
            0f,
            -(gridRows - 1) * 0.5f * spacing);
    }

    /// <summary>Refreshes <see cref="robotStartWorldPos"/> from the anchor + offsets.</summary>
    public void SyncGridOriginCache()
    {
        if (gridOriginTransform != null)
            robotStartWorldPos = gridOriginTransform.position + GetGridAutoCenterBaseOffset() + gridWorldOffset;
        else
            robotStartWorldPos = transform.position + GetGridAutoCenterBaseOffset() + gridWorldOffset;
    }

    /// <summary>Assigns <see cref="gridOriginTransform"/> from a scene anchor (e.g. GridOriginAnchor).</summary>
    public void AssignGridOriginTransform(Transform anchor)
    {
        gridOriginTransform = anchor;
        SyncGridOriginCache();
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

    public static bool UsesNumberLine(LevelData ld)
    {
        if (ld == null) return false;
        if (!string.IsNullOrEmpty(ld.layoutMode) &&
            ld.layoutMode.Equals("GRID", StringComparison.OrdinalIgnoreCase))
            return false;
        if (!string.IsNullOrEmpty(ld.layoutMode) &&
            ld.layoutMode.Equals("NUMBER_LINE", StringComparison.OrdinalIgnoreCase))
            return true;
        return ld.numberLine != null && ld.numberLine.tickCount >= 3;
    }

    public static int GetNumberLineRow(LevelData ld)
    {
        if (ld?.numberLine != null && ld.numberLine.lineRow >= 0)
            return ld.numberLine.lineRow;
        return 2;
    }

    /// <summary>
    /// Extra tick-index bias so the number line sits on the legacy 6Ã—6 center (column 2.5).
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

    /// <summary>Cell spacing for GRID = gridSize; NUMBER_LINE = number line grid size Ã— playfieldScale.</summary>
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
    // Robot drag (optional) â€” reset to level start on RUN
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
        if (UiDragState.IsDragging) return false;
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
            if (ld != null && cell == ld.robotStartPosition)
                ApplyLevelStartFacing(ld);
            SnapRobotToLogicalGridCell();
            return true;
        }

        robotGridPosition = cell;
        if (ld != null && cell == ld.robotStartPosition)
            ApplyLevelStartFacing(ld);
        SnapRobotToLogicalGridCell();
        OnRobotMovedInMatrix(from, cell);
        Debug.Log($"[CharacterMove] Robot dragged to cell {cell}");
        return true;
    }

    private void ApplyLevelStartFacing(LevelData ld)
    {
        if (ld == null) return;
        StopManualRobotRotationIfAny();
        facingDirection = ld.robotStartFacing;
        if (UsesNumberLine(ld))
            facingDirection = NormalizeNumberLineFacing(facingDirection, ld);
        ManualOrbitDragActive = false;
        ApplyRobotFacingRotation();
    }

    private void StopManualRobotRotationIfAny()
    {
        if (_manualRobotRotationCoroutine != null)
        {
            StopCoroutine(_manualRobotRotationCoroutine);
            _manualRobotRotationCoroutine = null;
        }
        ManualRobotRotationAnimating = false;
    }

    private void StopLevelStartFacingRoutine()
    {
        if (_levelStartFacingRoutine == null) return;
        StopCoroutine(_levelStartFacingRoutine);
        _levelStartFacingRoutine = null;
    }

    private void BeginLevelStartFacingLock(int frames = 3)
    {
        _levelStartFacingLockFrames = Mathf.Max(frames, 1);
        StopLevelStartFacingRoutine();
        _levelStartFacingRoutine = StartCoroutine(LevelStartFacingLockRoutine());
    }

    private IEnumerator LevelStartFacingLockRoutine()
    {
        int levelWhenStarted = currentLevel;
        while (_levelStartFacingLockFrames > 0)
        {
            _levelStartFacingLockFrames--;
            yield return null;
        }

        // Re-apply once after intro/camera settle unless intro is actively teaching a custom step.
        if (currentLevel != levelWhenStarted) yield break;
        if (IsActionBlockIntroActive) yield break;

        LevelData ld = GetCurrentLevelData();
        if (ld == null) yield break;
        ApplyLevelStartFacing(ld);
        SnapRobotToLogicalGridCell();
        RestoreAnimatorAfterOrbitIfIdle();
        _levelStartFacingRoutine = null;
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

    private void ApplyActionButtonVisibility(LevelData levelData)
    {
        var allowed = new HashSet<string>(
            ResolveEnabledActionButtons(levelData).Select(s => s.Trim().ToLowerInvariant()));

        void SetButton(Button btn, string key)
        {
            if (btn == null) return;
            bool visible = allowed.Contains(key);
            btn.gameObject.SetActive(visible);
            if (visible) btn.interactable = true;
        }

        SetButton(moveForwardButton, "forward");
        SetButton(moveDownButton, "backward");
        SetButton(rotateLeftButton, "turn left");
        SetButton(rotateRightButton, "turn right");
    }

    /// <summary>Number-line robots only face left or right along the axis.</summary>
    private static Vector2Int NormalizeNumberLineFacing(Vector2Int facing, LevelData levelData)
    {
        if (facing.x > 0) return Vector2Int.right;
        if (facing.x < 0) return Vector2Int.left;

        int startTick = levelData != null ? levelData.robotStartPosition.x : 0;
        int goalTick = startTick;
        if (levelData?.gridObjects != null)
        {
            foreach (var go in levelData.gridObjects)
            {
                if (go == null) continue;
                if (go.isEndObject || go.visitOrder == 2)
                {
                    goalTick = go.position.x;
                    break;
                }
            }
        }
        if (goalTick == startTick && levelData != null && levelData.goalCell.x >= 0)
            goalTick = levelData.goalCell.x;

        if (goalTick > startTick) return Vector2Int.right;
        if (goalTick < startTick) return Vector2Int.left;
        return Vector2Int.right;
    }

    private List<string> ResolveEnabledActionButtons(LevelData levelData)
    {
        if (levelData != null && levelData.enabledActionButtons != null && levelData.enabledActionButtons.Count > 0)
            return levelData.enabledActionButtons;

        if (UsesNumberLine(levelData) && (levelData.numberLine == null || levelData.numberLine.forwardBackwardOnly))
            return new List<string> { "forward", "backward" };

        return new List<string> { "forward", "backward", "turn left", "turn right" };
    }

    private int GetCommandHistoryDisplayAttempt()
    {
        return Mathf.Max(1, currentAttempt + 1);
    }

    /// <summary>Saves each move to the platform attempt; command is tagged with game attempt number.</summary>
    private void PersistCommandHistoryEntry(string command, string action, int? attemptNumber = null)
    {
        if (string.IsNullOrWhiteSpace(command)) return;
        if (GameAssessmentClient.Instance == null) return;
        if (string.IsNullOrEmpty(GameAssessmentClient.Instance.CurrentAttemptId))
        {
            Debug.LogWarning("[CharacterMove] Command history not saved — no active platform attempt (level-start).");
            return;
        }
        int attempt = attemptNumber ?? GetCommandHistoryDisplayAttempt();
        string tagged = $"[A{attempt}] {command.Trim()}";
        GameAssessmentClient.Instance.SaveCommandEvent(tagged, action);
    }

    private void EnsureCommandHistoryLayout()
    {
        if (actionHistoryTransform == null) return;

        var vlg = actionHistoryTransform.GetComponent<VerticalLayoutGroup>();
        if (vlg == null)
        {
            var oldH = actionHistoryTransform.GetComponent<HorizontalLayoutGroup>();
            if (oldH != null)
                DestroyImmediate(oldH);
            vlg = actionHistoryTransform.gameObject.AddComponent<VerticalLayoutGroup>();
        }

        int pad = Mathf.RoundToInt(commandHistoryPadding);
        vlg.padding = new RectOffset(pad, pad, pad, pad);
        vlg.spacing = commandHistoryRowSpacing;
        vlg.childAlignment = TextAnchor.UpperLeft;
        vlg.childControlWidth = true;
        vlg.childControlHeight = false;
        vlg.childForceExpandWidth = false;
        vlg.childForceExpandHeight = false;
    }

    /// <summary>One horizontal row per game attempt. Newer attempts are inserted at the top (first row).</summary>
    private Transform EnsureCommandHistoryAttemptRow(int attemptNumber)
    {
        if (actionHistoryTransform == null || attemptNumber < 1) return null;

        EnsureCommandHistoryLayout();

        string rowName = $"AttemptRow_{attemptNumber}";
        Transform existing = null;
        for (int i = 0; i < actionHistoryTransform.childCount; i++)
        {
            var child = actionHistoryTransform.GetChild(i);
            if (child.name == rowName)
            {
                existing = child;
                break;
            }
        }

        if (existing != null)
        {
            existing.SetAsFirstSibling();
            _commandHistoryActiveRow = existing;
            _commandHistoryActiveAttempt = attemptNumber;
            return existing;
        }

        var rowGo = new GameObject(rowName, typeof(RectTransform));
        rowGo.transform.SetParent(actionHistoryTransform, false);
        rowGo.transform.SetAsFirstSibling();

        var rowRt = (RectTransform)rowGo.transform;
        rowRt.localScale = Vector3.one;
        rowRt.anchorMin = new Vector2(0f, 1f);
        rowRt.anchorMax = new Vector2(0f, 1f);
        rowRt.pivot = new Vector2(0f, 1f);

        var hlg = rowGo.AddComponent<HorizontalLayoutGroup>();
        hlg.padding = new RectOffset(0, 0, 0, 0);
        hlg.spacing = commandHistorySpacing;
        hlg.childAlignment = TextAnchor.MiddleLeft;
        hlg.childControlWidth = false;
        hlg.childControlHeight = false;
        hlg.childForceExpandWidth = false;
        hlg.childForceExpandHeight = false;

        var rowLe = rowGo.AddComponent<LayoutElement>();
        rowLe.preferredHeight = commandHistoryIconSize;
        rowLe.minHeight = commandHistoryIconSize;
        rowLe.flexibleWidth = 0f;

        _commandHistoryActiveRow = rowGo.transform;
        _commandHistoryActiveAttempt = attemptNumber;
        return _commandHistoryActiveRow;
    }

    private void ApplyCommandHistoryPanel(LevelData levelData)
    {
        bool show = levelData != null && levelData.showCommandHistory;
        if (actionHistoryTransform == null) return;

        actionHistoryTransform.gameObject.SetActive(show);
        if (!show)
        {
            _commandHistoryActiveRow = null;
            _commandHistoryActiveAttempt = -1;
            for (int i = actionHistoryTransform.childCount - 1; i >= 0; i--)
                Destroy(actionHistoryTransform.GetChild(i).gameObject);
            return;
        }

        float scale = defaultCommandHistoryScale;
        if (levelData != null && levelData.commandHistoryScale > 0f)
            scale = Mathf.Clamp(levelData.commandHistoryScale, 0.5f, 1.5f);
        actionHistoryTransform.localScale = Vector3.one * scale;
        EnsureCommandHistoryLayout();
    }

    private void StyleCommandHistoryIcon(GameObject iconGo)
    {
        if (iconGo == null) return;

        float size = commandHistoryIconSize;
        var rt = iconGo.transform as RectTransform;
        if (rt != null)
        {
            rt.localScale = Vector3.one;
            rt.sizeDelta = new Vector2(size, size);
        }

        var le = iconGo.GetComponent<LayoutElement>();
        if (le == null) le = iconGo.AddComponent<LayoutElement>();
        le.ignoreLayout = false;
        le.preferredWidth = size;
        le.preferredHeight = size;
        le.minWidth = size;
        le.minHeight = size;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;
    }

    /// <summary>Teleports the robot to the active level's start cell and facing (called before RUN).</summary>
    public void ResetRobotToLevelStart()
    {
        LevelData ld = GetCurrentLevelData();
        if (ld == null) return;

        Vector2Int from = robotGridPosition;
        robotGridPosition = ld.robotStartPosition;
        ApplyLevelStartFacing(ld);

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
        transform.rotation = Quaternion.Euler(0f, FacingDirectionToYawDegrees(facingDirection), 0f);
    }

    private static float FacingDirectionToYawDegrees(Vector2Int dir)
    {
        if (dir == Vector2Int.right) return 90f;
        if (dir == Vector2Int.down) return 180f;
        if (dir == Vector2Int.left) return 270f;
        return 0f;
    }

    private static int FacingDirectionToCardinalIndex(Vector2Int dir)
    {
        if (dir == Vector2Int.right) return 1;
        if (dir == Vector2Int.down) return 2;
        if (dir == Vector2Int.left) return 3;
        return 0;
    }

    /// <summary>Logical forward on the grid (before RUN / drag). Up = +row / +Z.</summary>
    public Vector2Int RobotFacing => facingDirection;

    /// <summary>True for a few frames after level load while start facing is being applied (blocks drag-orient).</summary>
    public bool IsLevelStartFacingLocked => _levelStartFacingLockFrames > 0;

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

    /// <summary>After free-spinning the transform, snap logical facing to the nearest 90Â° for the grid.</summary>
    public void SnapRobotFacingToNearestCardinalFromTransform()
    {
        LevelData ld = GetCurrentLevelData();
        if (ld != null && UsesNumberLine(ld))
        {
            float y = transform.eulerAngles.y;
            y = (y % 360f + 360f) % 360f;
            // Collapse to left or right only (number line has no up/down facing).
            facingDirection = (y > 90f && y < 270f) ? Vector2Int.left : Vector2Int.right;
            ApplyRobotFacingRotation();
            SnapRobotToLogicalGridCell();
            return;
        }

        float yNorm = transform.eulerAngles.y;
        yNorm = (yNorm % 360f + 360f) % 360f;
        // Bias toward the current logical facing near 45° boundaries so tiny euler jitter does not flip N/E/S/W.
        float expectedYaw = FacingDirectionToYawDegrees(facingDirection);
        float delta = Mathf.DeltaAngle(expectedYaw, yNorm);
        int q;
        if (Mathf.Abs(delta) <= 45f)
            q = FacingDirectionToCardinalIndex(facingDirection);
        else
        {
            q = Mathf.FloorToInt((yNorm + 45f) / 90f) % 4;
            if (q < 0) q += 4;
        }
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
        LevelData ld = GetCurrentLevelData();
        if (ld != null && UsesNumberLine(ld))
        {
            if (dir.x > 0) facingDirection = Vector2Int.right;
            else if (dir.x < 0) facingDirection = Vector2Int.left;
            else return;
            ApplyRobotFacingRotation();
            return;
        }
        int ax = Mathf.Abs(dir.x), ay = Mathf.Abs(dir.y);
        if (ax + ay != 1) return;
        facingDirection = new Vector2Int(Mathf.Clamp(dir.x, -1, 1), Mathf.Clamp(dir.y, -1, 1));
        ApplyRobotFacingRotation();
    }

    /// <summary>Instant 90Â° turn (used when animation is off or internally after anim completes).</summary>
    public void ApplyRobotQuarterTurnImmediate(bool clockwise)
    {
        if (clockwise)
            facingDirection = new Vector2Int(facingDirection.y, -facingDirection.x);
        else
            facingDirection = new Vector2Int(-facingDirection.y, facingDirection.x);
        ApplyRobotFacingRotation();
    }

    /// <summary>90Â° turn for toy UI â€” animates when <see cref="animateManualRobotRotation"/> is on.</summary>
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

        StopManualRobotRotationIfAny();
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
        StopManualRobotRotationIfAny();
        StopLevelStartFacingRoutine();
        _levelStartFacingLockFrames = 0;
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

    /// <summary>(col, row) bounds for the logical grid.</summary>
    public bool CellInGridBounds(Vector2Int cell)
    {
        return cell.x >= 0 && cell.y >= 0 && cell.x < gridCols && cell.y < gridRows;
    }

    /// <summary>Forces a 6×6 logical grid for GRID levels; sizes playfield to tick count for NUMBER_LINE.</summary>
    private void ApplyLevelGridDimensions(LevelData levelData)
    {
        if (levelData != null && UsesNumberLine(levelData))
        {
            int ticks = levelData.numberLine != null && levelData.numberLine.tickCount > 0
                ? Mathf.Clamp(levelData.numberLine.tickCount, 3, 20)
                : 9;
            int lineRow = GetNumberLineRow(levelData);
            gridCols = ticks;
            gridRows = Mathf.Max(lineRow + 3, 4);
            SyncGridOriginCache();
            Debug.Log($"[CharacterMove] NUMBER_LINE dimensions: {gridCols} ticks, lineRow={lineRow}, gridRows={gridRows}");
            return;
        }

        const int fixedCols = 6;
        const int fixedRows = 6;

        if (gridCols != fixedCols || gridRows != fixedRows)
            Debug.Log($"[CharacterMove] Grid locked to {fixedCols}×{fixedRows} for '{levelData?.levelName ?? "level"}'.");

        gridCols = fixedCols;
        gridRows = fixedRows;

        SyncGridOriginCache();
    }

    private bool ValidateLevelCellInBounds(LevelData levelData, Vector2Int cell, string label)
    {
        if (CellInGridBounds(cell)) return true;
        Debug.LogError($"[CharacterMove] {levelData.levelName}: {label} at {cell} is outside the " +
                       $"{gridCols}Ã—{gridRows} grid. Fix level data or raise min grid size.");
        return false;
    }

    /// <summary>True if the flag has already been placed on the grid.</summary>
    public bool IsFlagPlaced => activeFlag != null && CellInGridBounds(flagCell);

    /// <summary>Goal cell for flag-placement levels. (-1,-1) until the player places the flag or level defines isEndObject.</summary>
    public Vector2Int DesignatedEndObjectCell => designatedEndObjectCell;

    public LevelData GetCurrentLevelData()
    {
        if (currentVirtualLevel != null) return currentVirtualLevel;
        if (allLevelsData != null && currentLevel >= 1 && currentLevel <= allLevelsData.Count)
            return allLevelsData[currentLevel - 1];
        return null;
    }

    /// <summary>True when the player must tap an empty cell to set the goal (flag = isEndObject).</summary>
    public bool PlayerPicksEndCellWithFlag()
    {
        LevelData ld = GetCurrentLevelData();
        return ld != null && ld.useFlagPlacement && ld.playerPicksEndCellWithFlag;
    }

    /// <summary>True when the flag may only be placed on a preset isEndObject cell from level data.</summary>
    public bool MustUseDesignatedEndCellForFlag()
    {
        if (PlayerPicksEndCellWithFlag()) return false;
        if (!flagMustUseDesignatedEndCell) return false;
        return designatedEndObjectCell.x >= 0 && designatedEndObjectCell.y >= 0;
    }

    /// <summary>Reads isEndObject / guidedEndPosition from level data into <see cref="designatedEndObjectCell"/> and <see cref="endObjectPosition"/>.</summary>
    private void ApplyLevelEndObjectTarget(LevelData levelData)
    {
        designatedEndObjectCell = new Vector2Int(-1, -1);
        if (levelData == null) return;
        if (levelData.playerPicksEndCellWithFlag)
        {
            endObjectPosition = Vector2Int.zero;
            Debug.Log("[CharacterMove] Player picks end cell with flag â€” no preset isEndObject cell.");
            return;
        }

        if (levelData.goalCell.x >= 0 && levelData.goalCell.y >= 0)
        {
            designatedEndObjectCell = levelData.goalCell;
            endObjectPosition = levelData.goalCell;
            Debug.Log($"[CharacterMove] Goal cell (no object): {levelData.goalCell}");
            return;
        }

        if (levelData.gridObjects == null) return;

        foreach (var go in levelData.gridObjects)
        {
            if (!go.isEndObject) continue;
            Vector2Int cell = (go.guidedEndPosition != Vector2Int.zero) ? go.guidedEndPosition : go.position;
            designatedEndObjectCell = cell;
            endObjectPosition = cell;
            Debug.Log($"[CharacterMove] Flag goal cell (isEndObject): {cell} (marker at {go.position})");
            return;
        }
    }

    public bool IsDesignatedEndCell(Vector2Int cell)
    {
        return designatedEndObjectCell.x >= 0 && designatedEndObjectCell.y >= 0 && cell == designatedEndObjectCell;
    }

    /// <summary>Returns true if a flag can be placed (or moved) onto the given cell.</summary>
    public bool CanPlaceFlagOnCell(Vector2Int cell)
    {
        if (!IsInsideMatrix(cell)) return false;
        if (cell == robotGridPosition) return false;
        if (cell == startObjectPosition && startObjectPosition != Vector2Int.zero) return false;

        if (MustUseDesignatedEndCellForFlag() && cell != designatedEndObjectCell)
            return false;

        if (hiddenMatrix != null)
        {
            HiddenCell hc = hiddenMatrix[cell.x, cell.y];
            if (hc.kind == HiddenCellKind.Obstacle) return false;
            if (hc.kind == HiddenCellKind.Robot) return false;
            if (hc.kind == HiddenCellKind.StartObject) return false;
            // GridObject cells are allowed — students can place the flag on a bin, chair, etc.
        }
        return true;
    }

    /// <summary>After the flag moves away, restore grid object / empty state on the old cell.</summary>
    private void RestoreCellAfterFlagRemoved(Vector2Int cell)
    {
        if (hiddenMatrix == null || !IsInsideMatrix(cell)) return;

        LevelData ld = GetCurrentLevelData();
        if (ld?.gridObjects != null)
        {
            foreach (var go in ld.gridObjects)
            {
                if (go.position.x != cell.x || go.position.y != cell.y) continue;

                HiddenCellKind kind = HiddenCellKind.GridObject;
                if (go.isStartObject) kind = HiddenCellKind.StartObject;
                else if (go.isEndObject) kind = HiddenCellKind.EndObject;

                GameObject instance = null;
                Vector3 worldAtCell = GridCellToWorld(cell);
                foreach (var obj in activeGridObjects)
                {
                    if (obj == null) continue;
                    if (Vector3.Distance(obj.transform.position, worldAtCell) < gridSize * 0.5f)
                    {
                        instance = obj;
                        break;
                    }
                }

                hiddenMatrix[cell.x, cell.y] = new HiddenCell
                {
                    kind = kind,
                    objectType = go.objectType,
                    instance = instance
                };
                return;
            }
        }

        hiddenMatrix[cell.x, cell.y] = new HiddenCell { kind = HiddenCellKind.Empty };
    }

    /// <summary>Same drag / collider setup as spawned grid pickups (banana, boxâ€¦).</summary>
    private void SetupPickupDragForInstantiatedObject(GameObject obj, bool allowPick, string logLabel)
    {
        var oldAppleCluster = obj.GetComponent("AppleCluster");
        if (oldAppleCluster != null)
            Destroy(oldAppleCluster);

        GridObjectCluster cluster = obj.GetComponent<GridObjectCluster>() ?? obj.AddComponent<GridObjectCluster>();
        cluster.allowDrag = allowPick;
        cluster.characterMove = this;

        Collider collider3D = obj.GetComponent<Collider>();
        if (collider3D == null)
        {
            BoxCollider boxCollider = obj.AddComponent<BoxCollider>();
            boxCollider.size = new Vector3(5f, 5f, 5f);
            boxCollider.isTrigger = false;
        }
        else
        {
            collider3D.isTrigger = false;
            if (collider3D is BoxCollider boxCollider3D &&
                (boxCollider3D.size.x < 0.01f || boxCollider3D.size.y < 0.01f || boxCollider3D.size.z < 0.01f ||
                 boxCollider3D.size.x > 25f || boxCollider3D.size.y > 25f || boxCollider3D.size.z > 25f ||
                 boxCollider3D.size.x < 5f || boxCollider3D.size.y < 5f || boxCollider3D.size.z < 5f))
            {
                boxCollider3D.size = new Vector3(5f, 5f, 5f);
            }
        }

        Collider2D collider2D = obj.GetComponent<Collider2D>();
        if (collider2D != null)
            Destroy(collider2D);

        Rigidbody rb = obj.GetComponent<Rigidbody>();
        if (rb == null)
        {
            rb = obj.AddComponent<Rigidbody>();
            rb.useGravity = false;
            rb.drag = 10f;
            rb.angularDrag = 10f;
            rb.constraints = RigidbodyConstraints.FreezeRotation | RigidbodyConstraints.FreezePositionY;
            rb.isKinematic = true;
        }
        else
        {
            rb.useGravity = false;
            rb.drag = 10f;
            rb.angularDrag = 10f;
            rb.constraints = RigidbodyConstraints.FreezeRotation | RigidbodyConstraints.FreezePositionY;
            rb.isKinematic = true;
        }

        Rigidbody2D rb2D = obj.GetComponent<Rigidbody2D>();
        if (rb2D != null)
            Destroy(rb2D);

        obj.layer = LayerMask.NameToLayer("Default");

        Debug.Log($"[CharacterMove] Pickup drag ready for '{logLabel}' allowDrag={allowPick}");
    }

    private static void RemoveFlagUIScreenFollowerFrom(GameObject root)
    {
        if (root == null) return;
        foreach (var f in root.GetComponentsInChildren<FlagUIScreenFollower>(true))
            Destroy(f);
    }

    /// <summary>
    /// Makes world-space flags readable from a top-down camera (rotation + draw order + alpha).
    /// </summary>
    private void ApplyFlagVisualDefaults()
    {
        if (activeFlag == null) return;
        if (flagOverlayCanvas != null && activeFlag.GetComponentInParent<Canvas>() != null) return;

        if (alignFlagRotationToGridProps)
        {
            Quaternion align = Quaternion.Euler(90f, 0f, 0f);
            if (activeGridObjects != null)
            {
                foreach (var go in activeGridObjects)
                {
                    if (go == null) continue;
                    var sr = go.GetComponentInChildren<SpriteRenderer>(true);
                    if (sr != null)
                    {
                        align = sr.transform.rotation;
                        break;
                    }
                }
            }
            activeFlag.transform.rotation = align;
        }

        int maxOrder = 0;
        if (activeGridObjects != null)
        {
            foreach (var go in activeGridObjects)
            {
                if (go == null) continue;
                foreach (var s in go.GetComponentsInChildren<SpriteRenderer>(true))
                    maxOrder = Mathf.Max(maxOrder, s.sortingOrder);
            }
        }

        foreach (var s in activeFlag.GetComponentsInChildren<SpriteRenderer>(true))
        {
            s.sortingOrder = maxOrder + flagSortingOrderBoost;
            if (s.color.a < 0.02f)
                s.color = new Color(s.color.r, s.color.g, s.color.b, 1f);
            s.enabled = true;
        }

        foreach (var mr in activeFlag.GetComponentsInChildren<MeshRenderer>(true))
        {
            mr.sortingOrder = maxOrder + flagSortingOrderBoost;
            mr.enabled = true;
        }

        // If auto-fit skipped (no Renderer bounds), give a sane scale so a tiny prefab is still visible.
        if (autoFitObjectsToCell && gridSize > 0f && !TryGetObjectWorldExtents(activeFlag, out _))
        {
            float s = gridSize * cellFillRatio;
            activeFlag.transform.localScale = Vector3.one * Mathf.Max(0.15f, s);
        }
    }

    /// <summary>
    /// Place (or move) the goal flag onto <paramref name="cell"/>. Updates the
    /// internal end-object position so existing win-checks work unchanged.
    /// Returns true on success.
    /// </summary>
    public bool TryPlaceOrMoveFlag(Vector2Int cell)
    {
        if (!IsFlagPlacementActive)
        {
            Debug.LogWarning("[CharacterMove] TryPlaceOrMoveFlag called but flag placement mode is OFF.");
            return false;
        }
        if (flagPrefab == null)
        {
            Debug.LogWarning("[CharacterMove] No flagPrefab assigned on CharacterMove. Cannot place flag.");
            return false;
        }
        if (!CanPlaceFlagOnCell(cell))
        {
            Debug.Log($"[CharacterMove] Cannot place flag on {cell} (occupied / out of bounds).");
            return false;
        }
        if (activeFlag != null && !allowFlagMove)
        {
            Debug.Log("[CharacterMove] Flag already placed and allowFlagMove is OFF.");
            return false;
        }

        Vector2Int prevCell = flagCell;
        Vector3 worldPos = GridCellToWorld(cell);

        Camera projectCam = gridInteractionCamera != null ? gridInteractionCamera : Camera.main;
        if (projectCam == null)
        {
            foreach (var c in FindObjectsOfType<Camera>())
                if (c != null && c.enabled && c.gameObject.activeInHierarchy) { projectCam = c; break; }
        }

        if (activeFlag == null)
        {
            // Instantiate from prefab defaults; avoid world position for UI (would not show on Overlay canvas).
            activeFlag = Instantiate(flagPrefab);
            activeFlag.name = "_GoalFlag";
            activeFlag.SetActive(true);

            GameObject    spawnedRoot = activeFlag;
            RectTransform uiRt        = spawnedRoot.GetComponent<RectTransform>();
            if (uiRt == null) uiRt   = spawnedRoot.GetComponentInChildren<RectTransform>(true);

            if (uiRt != null && flagOverlayCanvas != null)
            {
                RectTransform parentRect = flagUIContainerRect != null
                    ? flagUIContainerRect
                    : (RectTransform)flagOverlayCanvas.transform;

                FlagUIScreenFollower follower = uiRt.gameObject.GetComponent<FlagUIScreenFollower>()
                    ?? uiRt.gameObject.AddComponent<FlagUIScreenFollower>();
                follower.Configure(this, parentRect, projectCam, cell);

                activeFlag = uiRt.gameObject;
                // Do not Destroy the wrapper root during the same activation frame â€” Unity throws:
                // "Cannot destroy GameObject while it is being activated or deactivated."
                // Leaving an unused empty root is harmless; prefabs should ideally use RT on root only.
            }
            else
            {
                activeFlag = spawnedRoot;
                if (uiRt != null && flagOverlayCanvas == null)
                {
                    Debug.LogWarning("[CharacterMove] Flag uses UI (RectTransform) but Flag Overlay Canvas is empty â€” " +
                                     "instantiating at world coords (usually invisible). " +
                                     "For drag-like-banana pickup, assign a WORLD prefab (3D mesh / SpriteRenderer) and leave overlay empty.");
                }
                RemoveFlagUIScreenFollowerFrom(activeFlag);
                SetupPickupDragForInstantiatedObject(activeFlag, allowFlagMove, "flag");

                worldPos.y += flagVisualYOffset;
                activeFlag.transform.SetPositionAndRotation(worldPos, flagPrefab.transform.rotation);
                FitObjectToCell(activeFlag);
                ApplyFlagVisualDefaults();
            }
        }
        else
        {
            var follower = activeFlag.GetComponentInChildren<FlagUIScreenFollower>(true);
            if (follower != null)
                follower.SetGridCell(cell);
            else
            {
                worldPos.y += flagVisualYOffset;
                activeFlag.transform.position = worldPos;
            }
        }

        // Update hidden matrix: clear old cell (if any), mark new cell as EndObject.
        if (hiddenMatrix != null)
        {
            if (IsInsideMatrix(prevCell) &&
                hiddenMatrix[prevCell.x, prevCell.y].kind == HiddenCellKind.EndObject)
            {
                RestoreCellAfterFlagRemoved(prevCell);
            }
            hiddenMatrix[cell.x, cell.y] = new HiddenCell
            {
                kind = HiddenCellKind.EndObject,
                objectType = "flag",
                instance = activeFlag
            };
        }

        flagCell = cell;
        endObjectPosition = cell;
        designatedEndObjectCell = cell;
        Debug.Log($"[CharacterMove] Flag placed at cell {cell} (world {worldPos}). This cell is now isEndObject / goal.");

        if (runButton != null && !UsesGuidedBlankFlow(GetCurrentLevelData()))
            runButton.interactable = !IsRunBlockedByFlagRequirement();

        return true;
    }

    /// <summary>True when the robot is on the current end goal (flag cell or spawned end object).</summary>
    private bool RobotIsOnEndGoalCell()
    {
        if (IsFlagPlacementActive && IsFlagPlaced)
        {
            if (robotGridPosition == flagCell) return true;
            Vector3 robotWorld = transform.position;
            Vector3 goalWorld = GridCellToWorld(flagCell);
            return Vector3.Distance(robotWorld, goalWorld) < gridSize * 0.55f;
        }

        if (!hasReachedStartObject) return false;
        if (endObjectPosition == Vector2Int.zero && designatedEndObjectCell.x < 0) return false;

        Vector2Int goal = (endObjectPosition != Vector2Int.zero) ? endObjectPosition : designatedEndObjectCell;
        if (robotGridPosition == goal) return true;

        Vector3 robotWorldPos = transform.position;
        Vector3 goalWorldPos = GridCellToWorld(goal);
        return Vector3.Distance(robotWorldPos, goalWorldPos) < gridSize * 0.55f;
    }

    /// <summary>Removes the flag from the grid and restores the underlying cell in the hidden matrix.</summary>
    public void ClearFlag()
    {
        GameObject prevFlag = activeFlag;
        if (prevFlag != null)
        {
            Destroy(prevFlag);
            activeFlag = null;
        }

        if (hiddenMatrix != null && IsInsideMatrix(flagCell))
        {
            HiddenCell hc = hiddenMatrix[flagCell.x, flagCell.y];
            if (hc.kind == HiddenCellKind.EndObject &&
                (hc.objectType == "flag" || (prevFlag != null && hc.instance == prevFlag)))
            {
                RestoreCellAfterFlagRemoved(flagCell);
            }
        }

        flagCell = new Vector2Int(-1, -1);

        LevelData ld = GetCurrentLevelData();
        if (ld != null && ld.useFlagPlacement && ld.playerPicksEndCellWithFlag)
        {
            endObjectPosition = Vector2Int.zero;
            designatedEndObjectCell = new Vector2Int(-1, -1);
        }
    }

    /// <summary>
    /// Rebuilds grid / flag state for a fresh try (student Reset, Try Again, etc.).
    /// Without this, a placed flag and stale hidden-matrix cells block re-placing the goal.
    /// </summary>
    private void ResetPlayfieldForNewAttempt(LevelData levelData)
    {
        if (levelData == null) return;

        ClearFlag();

        if (levelData.useFlagPlacement)
            ApplyLevelEndObjectTarget(levelData);

        BuildHiddenMatrix(levelData);
        RefreshCellBlinkHighlights(levelData);

        if (levelData.useFlagPlacement)
        {
            Vector2Int initial = (flagInitialCell.x >= 0 && flagInitialCell.y >= 0)
                ? flagInitialCell
                : levelData.flagInitialPosition;
            if (initial.x >= 0 && initial.y >= 0 && IsInsideMatrix(initial))
                TryPlaceOrMoveFlag(initial);
        }

        movesUsedInCurrentAttempt = 0;
        attemptStartGridPos = robotGridPosition;
        attemptStartFacing = facingDirection;
        hasAssessedLevel = false;
        visitedEndObjectThisLevel = false;
    }

    /// <summary>Convert a screen-space position (mouse / touch) to a grid cell. Returns false if no valid cell hit.</summary>
    public bool TryScreenToGridCell(Vector2 screenPos, out Vector2Int cell)
    {
        cell = Vector2Int.zero;
        Camera cam = gridInteractionCamera != null ? gridInteractionCamera : Camera.main;
        if (cam == null)
        {
            Camera[] cams = FindObjectsOfType<Camera>();
            foreach (var c in cams)
            {
                if (c != null && c.enabled && c.gameObject.activeInHierarchy) { cam = c; break; }
            }
        }
        if (cam == null) return false;

        Ray ray = cam.ScreenPointToRay(screenPos);
        Vector3 world;
        const float maxDist = 5000f;

        // Prefer hitting scene geometry (grid floor / tiles) if present.
        if (Physics.Raycast(ray, out RaycastHit hit, maxDist, ~0, QueryTriggerInteraction.Ignore))
            world = hit.point;
        else
        {
            Plane gridPlane = new Plane(Vector3.up, new Vector3(0f, robotStartWorldPos.y, 0f));
            if (!gridPlane.Raycast(ray, out float dist)) return false;
            world = ray.GetPoint(dist);
        }

        cell = WorldToGridCell(world);
        return CellInGridBounds(cell);
    }

    // -------------------------------------------------------------------
    // Virtual Matrix (manual cell -> object mapping, edited in Inspector)
    // -------------------------------------------------------------------

    private void OnValidate()
    {
        // Only clamp simple value-type fields here. NEVER mutate the serialized
        // virtualMatrixEntries list from OnValidate â€” the Inspector is mid-binding
        // and that triggers "ArgumentNullException: ... _unity_self".
        // Use the context-menu "Clamp Virtual Entries Now" (or Play mode) to clamp the list.
        if (gridRows < 1) gridRows = 1;
        if (gridCols < 1) gridCols = 1;
    }

    [ContextMenu("Clamp Virtual Entries Now")]
    private void ClampVirtualEntriesContextMenu()
    {
        try { ClampVirtualEntriesToMatrix(); }
        catch (System.Exception e)
        {
            Debug.LogWarning($"[CharacterMove] Clamp skipped: {e.Message}");
        }
    }

    /// <summary>Clamps every entry's cell into the [0..gridCols-1, 0..gridRows-1] range.</summary>
    public void ClampVirtualEntriesToMatrix()
    {
        if (virtualMatrixEntries == null) return;
        int maxCol = Mathf.Max(0, gridCols - 1);
        int maxRow = Mathf.Max(0, gridRows - 1);
        for (int i = 0; i < virtualMatrixEntries.Count; i++)
        {
            var e = virtualMatrixEntries[i];
            if (e == null) continue;
            e.cell = new Vector2Int(Mathf.Clamp(e.cell.x, 0, maxCol), Mathf.Clamp(e.cell.y, 0, maxRow));
        }
        virtualRobotStart = new Vector2Int(Mathf.Clamp(virtualRobotStart.x, 0, maxCol), Mathf.Clamp(virtualRobotStart.y, 0, maxRow));
    }

    /// <summary>Builds a one-off <see cref="LevelData"/> from the manual virtual matrix entries.</summary>
    public LevelData BuildLevelFromVirtualMatrix()
    {
        ClampVirtualEntriesToMatrix();

        var ld = new LevelData
        {
            levelName = "Virtual Matrix",
            maxAttempts = 99,
            robotStartPosition = virtualRobotStart,
            robotStartFacing = (virtualRobotFacing == Vector2Int.zero) ? Vector2Int.up : virtualRobotFacing,
            obstacles = new List<ObstacleData>(),
            gridObjects = new List<GridObjectData>(),
            allowGridObjectDrag = false,
            showCellBlinkHighlights = virtualMatrixBlinkHighlights,
            blinkStartCells = virtualMatrixBlinkStartCells,
            blinkEndCells = virtualMatrixBlinkEndCells,
        };

        foreach (var e in virtualMatrixEntries)
        {
            if (e == null || e.emptyMarker) continue;

            if (e.isObstacle)
            {
                ld.obstacles.Add(new ObstacleData
                {
                    position = e.cell,
                    type = string.IsNullOrEmpty(e.objectType) ? "tree" : e.objectType,
                });
            }
            else
            {
                ld.gridObjects.Add(new GridObjectData
                {
                    position = e.cell,
                    objectType = e.objectType,
                    isStartObject = e.isStartObject,
                    isEndObject = e.isEndObject,
                    allowDrag = e.allowDrag,
                });
            }
        }
        return ld;
    }

    /// <summary>
    /// Right-click the component â†’ "Apply Virtual Matrix Now" to spawn the manual layout into the scene
    /// immediately, fit the background image, and rebuild the hidden state.
    /// </summary>
    [ContextMenu("Apply Virtual Matrix Now")]
    public void ApplyVirtualMatrixNow()
    {
        LevelData ld = BuildLevelFromVirtualMatrix();
        currentVirtualLevel = ld;
        if (Application.isPlaying)
        {
            SetupLevelFromVirtualMatrix(ld);
        }
        else
        {
            Debug.Log("[CharacterMove] Virtual matrix prepared. Press Play (with useVirtualMatrix on) or use this menu at runtime to actually spawn objects.");
        }
    }

    /// <summary>Runtime entry point used by <see cref="SetupLevel"/> when <see cref="useVirtualMatrix"/> is on.</summary>
    private void SetupLevelFromVirtualMatrix(LevelData ld)
    {
        // Clear previously spawned obstacles / grid objects
        foreach (var o in activeObstacles)   { if (o != null) Destroy(o); }
        foreach (var o in activeGridObjects) { if (o != null) Destroy(o); }
        activeObstacles.Clear();
        activeGridObjects.Clear();

        ApplyLevelGridDimensions(ld);

        // Robot
        robotGridPosition = ld.robotStartPosition;
        facingDirection   = ld.robotStartFacing;
        transform.position = GridCellToWorld(robotGridPosition);
        lastSafePosition   = transform.position;

        // Obstacles
        foreach (var obstacle in ld.obstacles)
        {
            GameObject prefab = null;
            if (obstacle.type == "tree") prefab = treePrefab;
            else if (obstacle.type == "wood") prefab = woodPrefab;
            if (prefab == null) { Debug.LogWarning($"[CharacterMove] No obstacle prefab for '{obstacle.type}'."); continue; }
            Vector3 p = GridCellToWorld(obstacle.position); p.y += 0.5f;
            var go = Instantiate(prefab, p, prefab.transform.rotation);
            go.SetActive(true);
            FitObjectToCell(go);
            activeObstacles.Add(go);
        }

        // Grid objects
        startObjectPosition = Vector2Int.zero;
        endObjectPosition   = Vector2Int.zero;
        foreach (var gridObject in ld.gridObjects)
        {
            GameObject prefab = GetGridObjectPrefab(gridObject.objectType);
            if (prefab == null) continue;

            Vector3 worldPos = GridCellToWorld(gridObject.position);
            var obj = Instantiate(prefab, worldPos, prefab.transform.rotation);
            obj.SetActive(true);
            FitObjectToCell(obj);
            activeGridObjects.Add(obj);

            var cluster = obj.GetComponent<GridObjectCluster>() ?? obj.AddComponent<GridObjectCluster>();
            cluster.allowDrag = gridObject.allowDrag;
            cluster.characterMove = this;

            if (gridObject.isStartObject) startObjectPosition = gridObject.position;
            if (gridObject.isEndObject)   endObjectPosition   = gridObject.position;

            ApplySpawnedGridObjectVisuals(obj, gridObject);
        }

        BuildHiddenMatrix(ld);
        RefreshCellBlinkHighlights(ld);
        SetupRobotDrag(ld);
        Debug.Log($"[CharacterMove] Virtual matrix applied. {gridCols}x{gridRows}, robot at {robotGridPosition}.");
    }

    /// <summary>Destroys all obstacle / grid-object instances spawned by the virtual matrix.</summary>
    [ContextMenu("Clear Spawned Virtual Matrix Objects")]
    public void ClearSpawnedVirtualMatrixObjects()
    {
        foreach (var o in activeObstacles)   { if (o != null) DestroyImmediate(o); }
        foreach (var o in activeGridObjects) { if (o != null) DestroyImmediate(o); }
        activeObstacles.Clear();
        activeGridObjects.Clear();
        ClearHiddenMatrix();
        ClearCellBlinkHighlights();
        Debug.Log("[CharacterMove] Virtual matrix scene objects cleared.");
    }

    /// <summary>Cache so SetupLevel can read what ApplyVirtualMatrixNow prepared.</summary>
    private LevelData currentVirtualLevel;


    /// <summary>Debug: prints the hidden matrix to the Console with row 0 at the bottom.</summary>
    [ContextMenu("Print Hidden Matrix")]
    public void PrintHiddenMatrix()
    {
        if (hiddenMatrix == null) { Debug.Log("[CharacterMove] Hidden matrix is null."); return; }
        int cols = hiddenMatrix.GetLength(0);
        int rows = hiddenMatrix.GetLength(1);
        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"Hidden Matrix {cols}x{rows} (row 0 = bottom):");
        for (int row = rows - 1; row >= 0; row--)
        {
            sb.Append(row.ToString("D2")).Append(" | ");
            for (int col = 0; col < cols; col++)
            {
                var c = hiddenMatrix[col, row];
                sb.Append(HiddenCellGlyph(c)).Append(' ');
            }
            sb.AppendLine();
        }
        sb.Append("     ");
        for (int col = 0; col < cols; col++) sb.Append(col.ToString("D2")[1]).Append(' ');
        Debug.Log(sb.ToString());
    }

    private static char HiddenCellGlyph(HiddenCell c)
    {
        switch (c.kind)
        {
            case HiddenCellKind.Robot:       return 'R';
            case HiddenCellKind.StartObject: return 'S';
            case HiddenCellKind.EndObject:   return 'E';
            case HiddenCellKind.Obstacle:    return '#';
            case HiddenCellKind.GridObject:  return 'O';
            default:                         return '.';
        }
    }

    // Helper method to get the desired string for actionLog
    private string GetActionLogString(CharacterAction action)
    {
        if (action is MoveAction ma)
        {
            if (ma.Direction == Vector3.forward)
                return "forward";
            else if (ma.Direction == -Vector3.forward)
                return "backward";
        }
        else if (action is RotateAction ra)
        {
            // Assuming rotationAngle is a positive value for right turn
            if (ra.Angle == rotationAngle) // User's rotateRightButton adds new RotateAction(rotationAngle)
                return "turn right";
            else if (ra.Angle == -rotationAngle) // User's rotateLeftButton adds new RotateAction(-rotationAngle)
                return "turn left";
        }
        // Fallback for any other actions or unspecified move/rotate directions
        return action.GetType().Name.ToLower();
    }

    // â”€â”€ Level Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // All positions use (col, row) where (0,0) = bottom-left tile.
    // col increases to the right, row increases upward/forward.
    // Converted from the old centre-origin system by adding (+3, +3).
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    private void InitializeLevelData()
    {
        allLevelsData = new List<LevelData>
        {
            // â”€â”€ Level 0 (introduction â€” runs once before Level 1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            new LevelData
            {
                levelKey = "level_0",
                levelType = "INTRO",
                levelName = "Introduction",
                maxAttempts = 99,
                showCellBlinkHighlights = false,
                actionBlockIntro = ActionBlockIntroDefaults.Level0FourMoves(),
                cornerHint = new LevelCornerHint
                {
                    enabled = true,
                    title = "Welcome!",
                    body = "Let's learn the action blocks first."
                },
                gridObjects = new List<GridObjectData>()
            },
            // â”€â”€ Level 1 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            
        };
    }

    private void LoadPlayerLevel()
    {
        currentUserId = PlayerPrefs.GetString("UserId", "UnknownUser");
        currentLevel = PlayerPrefs.GetInt(currentUserId + "_currentLevel", 1);
        if (currentLevel > MAX_LEVELS) currentLevel = 1; // Reset if saved level is too high
        Debug.Log($"[CharacterMove] Loaded level {currentLevel} for user {currentUserId}");
    }

    private void SavePlayerLevel()
    {
        PlayerPrefs.SetInt(currentUserId + "_currentLevel", currentLevel);
        string levelKey = GetPlatformLevelKey(currentLevel);
        if (!string.IsNullOrEmpty(levelKey))
            PlayerPrefs.SetString(currentUserId + "_currentLevelKey", levelKey);
        if (allLevelsData != null && allLevelsData.Count > 0)
        {
            string levelListKey = string.Join("|", allLevelsData.ConvertAll(ld => ld.levelKey ?? ""));
            PlayerPrefs.SetString(currentUserId + "_assignedLevelKeys", levelListKey);
        }
        PlayerPrefs.Save();
        Debug.Log($"[CharacterMove] Saved level slot {currentLevel} ({levelKey}) for user {currentUserId}");

        if (!string.IsNullOrEmpty(currentUserId) && currentUserId != "UnknownUser")
        {
            PlatformCommunication.Instance.SendGameProgress(
                currentUserId,
                GetPlatformLevelKey(currentLevel),
                0,
                BuildCommandsString(_telemetryFinalCommands));
        }
    }

    private void SetupLevel(int levelNumber)
    {
        if (levelNumber < 1 || levelNumber > allLevelsData.Count)
        {
            Debug.LogError($"[CharacterMove] Invalid level number: {levelNumber}. Resetting to level 1.");
            levelNumber = 1;
        }

        currentLevel = levelNumber;

        if (GameAssessmentClient.Instance != null)
            GameAssessmentClient.Instance.ClearCurrentAttempt();
        
        // Clean up any old AppleCluster scripts from the scene
        CleanupOldAppleClusterScripts();

        // Check if required prefabs are assigned (basic validation - individual levels may use only some of these)
        Debug.Log("[CharacterMove] Checking prefab assignments:");
        Debug.Log($"[CharacterMove] bananaPrefab: {(bananaPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] binPrefab: {(binPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] newspaperPrefab: {(newspaperPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] recyclePrefab: {(recyclePrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] applePrefab: {(applePrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] boxPrefab: {(boxPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] bedPrefab: {(bedPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] chairPrefab: {(chairPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] vacuumPrefab: {(vacuumPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] bagPrefab: {(bagPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] bookPrefab: {(bookPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] scissorsPrefab: {(scissorsPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] crayonsPrefab: {(crayonsPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] gluePrefab: {(gluePrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] homePrefab: {(homePrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] mailPrefab: {(mailPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] packagePrefab: {(packagePrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] pencilPrefab: {(pencilPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] postPrefab: {(postPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] schoolPrefab: {(schoolPrefab != null ? "OK" : "NULL")}");
        Debug.Log($"[CharacterMove] greentreePrefab: {(greentreePrefab != null ? "OK" : "NULL")}");

        LevelData levelData;
        if (useVirtualMatrix)
        {
            levelData = BuildLevelFromVirtualMatrix();
            Debug.Log("[CharacterMove] useVirtualMatrix=on. Overriding level with manual matrix mapping.");
        }
        else
        {
            levelData = allLevelsData[levelNumber - 1];
        }
        // Always keep a reference to the active level (flag placement, UI text, etc.).
        // Previously this was only set in the virtual-matrix branch, so preset levels
        // like Level 2 never enabled IsFlagPlacementActive.
        currentVirtualLevel = levelData;
        _playfieldLevelData = levelData;
        Debug.Log($"[CharacterMove] Setting up {levelData.levelName} " +
                  $"(maxAttempts={levelData.maxAttempts}, commandHistory={levelData.showCommandHistory}, animateRobot={levelData.runRobotOnSubmit})");

        ApplyLevelGridDimensions(levelData);
        ApplyCommandHistoryPanel(levelData);
        ApplyStudentResetButton(levelData);
        ValidateLevelCellInBounds(levelData, levelData.robotStartPosition, "robotStartPosition");

        // Reset attempt counter for new level
        currentAttempt = 0;
        _activeInLevelRunNumber = 0;
        _runAttemptStartTime = -1f;
        _skipNextPlatformReport = false;
        _currentRunReportedToPlatform = false;
        pendingLevelPassed = true;
        hasReachedStartObject = false;
        hasReachedEndObject = false;


        // Reset Action Log for the new level attempt
        actionLog.Clear();
        unityFeedbackLog.Clear();
        playerActions.Clear();
        hasAssessedLevel = false;

        ResetLevelTelemetry();
        _introPlayfieldBaselineCached = false;

        // Reset robot position and orientation
        robotGridPosition = levelData.robotStartPosition;
        ManualOrbitDragActive = false;
        ApplyLevelStartFacing(levelData);
        BeginLevelStartFacingLock();

        // Re-read origin each time a level loads.
        if (gridOriginTransform != null)
            SyncGridOriginCache();

        // Position the robot at the correct grid position using the calibrated start position
        Vector3 targetPosition = RobotWorldPositionAtCell(robotGridPosition);
        transform.position = targetPosition;
        lastSafePosition = transform.position;
        ApplyRobotFacingRotation();
        SnapRobotToLogicalGridCell();
        if (autoFitRobotToCell) FitRobotToCell();
        Debug.Log($"[CharacterMove] Robot positioned at grid {robotGridPosition} -> world position {targetPosition}");

        // NEW: Update camera targets to include character and grid objects
        if (multiTargetCamera != null)
        {
            multiTargetCamera.targets.Clear();
            multiTargetCamera.targets.Add(this.transform); // Character
            
            // Add grid objects as camera targets
            foreach (var obj in activeGridObjects)
            {
                if (obj != null && obj.activeInHierarchy)
                {
                    multiTargetCamera.targets.Add(obj.transform);
                }
            }
        }

        UpdateLevelDisplay(); // Update UI for level info

        bool useFlagLevel = levelData.useFlagPlacement;
        if (useFlagLevel)
            ApplyLevelEndObjectTarget(levelData);
        
        // NEW: Update instruction text for start/end object levels
        if (levelData.gridObjects.Count > 0)
        {
            string startObjectType = "";
            string endObjectType = "";
            foreach (var obj in levelData.gridObjects)
            {
                if (obj.isStartObject) startObjectType = obj.objectType;
                if (obj.isEndObject) endObjectType = obj.objectType;
            }
            
            string dragInstruction = levelData.allowGridObjectDrag ? " You can drag any object to reposition it." : "";
            string guidedInstruction = "";
            bool useFlagForMsg = levelData.useFlagPlacement;

            // Check if this level has guided positioning requirements
            foreach (var gridObject in levelData.gridObjects)
            {
                if (gridObject.guidedEndPosition != Vector2Int.zero)
                {
                    guidedInstruction = useFlagForMsg
                        ? $" Place the flag at position ({gridObject.guidedEndPosition.x}, {gridObject.guidedEndPosition.y})."
                        : $" Drag the {gridObject.objectType} to position ({gridObject.guidedEndPosition.x}, {gridObject.guidedEndPosition.y}).";
                    break;
                }
            }

            if (useFlagForMsg)
            {
                string goalHint = levelData.playerPicksEndCellWithFlag
                    ? " First tap any cell to place the flag — that is your goal."
                    : (designatedEndObjectCell.x >= 0
                        ? $" Tap the goal cell ({designatedEndObjectCell.x}, {designatedEndObjectCell.y}) to place the flag."
                        : " Tap a cell to place the flag.");
                chatGPTResponseText.text =
                    $"Welcome to {levelData.levelName}!{goalHint} Then build your path and press RUN. " +
                    $"You have {levelData.maxAttempts} attempts.{guidedInstruction}";
            }
            else
            {
                chatGPTResponseText.text = $"Welcome to {levelData.levelName}! First find the {startObjectType}, then reach the {endObjectType}. You have {levelData.maxAttempts} attempts.{dragInstruction}{guidedInstruction}";
            }
        }
        else
        {
            chatGPTResponseText.text = $"Welcome to {levelData.levelName}! Find the apples.";
        }

        successPopup.SetActive(false);

        hasAssessedLevel = false; // Reset assessment flag at the start of each level

        // Remove old obstacles
        // if (obstacleParent != null)
        // {
        //     foreach (Transform child in obstacleParent)
        //         Destroy(child.gameObject);
        // }
        // Instantiate new obstacles
        foreach (var obstacle in levelData.obstacles)
        {
            if (!ValidateLevelCellInBounds(levelData, obstacle.position, $"obstacle '{obstacle.type}'"))
                continue;

            GameObject prefab = null;
            if (obstacle.type == "tree") prefab = treePrefab;
            else if (obstacle.type == "wood") prefab = woodPrefab;
            if (prefab != null)
            {
                Vector3 cellAnchorWorld = GridCellToWorld(obstacle.position);
                float raycastOriginX = cellAnchorWorld.x;
                float raycastOriginZ = cellAnchorWorld.z;
                Vector3 rayOrigin = new Vector3(raycastOriginX, robotStartWorldPos.y + 1.0f, raycastOriginZ);
                Vector3 obstacleFinalWorldPos;
                RaycastHit hit;
                if (Physics.Raycast(rayOrigin, Vector3.down, out hit, 2.0f, gridLayer))
                {
                    obstacleFinalWorldPos = new Vector3(hit.collider.bounds.center.x, robotStartWorldPos.y, hit.collider.bounds.center.z);
                }
                else
                {
                    obstacleFinalWorldPos = new Vector3(raycastOriginX, robotStartWorldPos.y, raycastOriginZ);
                    Debug.LogWarning($"[CharacterMove] Obstacle at grid {obstacle.position} raycast failed. Placed arithmetically. Check gridLayer.");
                }
                obstacleFinalWorldPos.y += 0.5f; // (Optional: adjust as needed for your model base)
                GameObject obj = Instantiate(prefab, obstacleFinalWorldPos, prefab.transform.rotation);
                obj.SetActive(true);
                FitObjectToCell(obj);
                activeObstacles.Add(obj);
            }
        }

        // NEW: Clear and instantiate grid objects
        foreach (var obj in activeGridObjects) { if (obj != null) Destroy(obj); }
        activeGridObjects.Clear();

        // Reset any existing flag (so re-loading a level doesn't leave a stale flag).
        ClearFlag();
        bool useFlag = levelData.useFlagPlacement;

        Debug.Log($"[CharacterMove] Setting up {levelData.gridObjects.Count} grid objects for {levelData.levelName}");
        Debug.Log($"[CharacterMove] Level allowGridObjectDrag: {levelData.allowGridObjectDrag}, useFlagPlacement: {useFlag}");

        // Find start and end object positions
        startObjectPosition = Vector2Int.zero;
        if (!useFlag)
        {
            endObjectPosition = Vector2Int.zero;
            designatedEndObjectCell = new Vector2Int(-1, -1);
        }
        
        foreach (var gridObject in levelData.gridObjects)
        {
            // Skip spawning the end-object prefab when flag-placement mode is active;
            // the flag (placed via tap/click) serves as the end target instead.
            if (useFlag && gridObject.isEndObject)
            {
                Debug.Log($"[CharacterMove] Skipping end-object spawn for '{gridObject.objectType}' " +
                          "because flag placement mode is active (goal cell from isEndObject).");
                continue;
            }
            if (!ValidateLevelCellInBounds(levelData, gridObject.position, $"grid object '{gridObject.objectType}'"))
                continue;

            Debug.Log($"[CharacterMove] Processing grid object: {gridObject.objectType} at {gridObject.position}, allowDrag={gridObject.allowDrag}, isStart={gridObject.isStartObject}, isEnd={gridObject.isEndObject}");
            
            GameObject prefab = GetGridObjectPrefab(gridObject.objectType);
            if (prefab != null)
            {
                Vector3 worldPos = UsesNumberLine(levelData)
                    ? WorldPositionForGridCell(gridObject.position, levelData)
                    : GridCellToWorld(gridObject.position);
                GameObject obj = Instantiate(prefab, worldPos, prefab.transform.rotation);
                obj.SetActive(true);
                FitObjectToCell(obj);
                activeGridObjects.Add(obj);
                
                // ALWAYS set up drag system for grid objects (remove old AppleCluster if present)
                // Remove any old AppleCluster script first
                var oldAppleCluster = obj.GetComponent("AppleCluster");
                if (oldAppleCluster != null)
                {
                    Debug.Log($"[CharacterMove] Removing old AppleCluster script from {gridObject.objectType}");
                    DestroyImmediate(oldAppleCluster);
                }
                
                // Add GridObjectCluster to ALL grid objects
                GridObjectCluster cluster = obj.GetComponent<GridObjectCluster>() ?? obj.AddComponent<GridObjectCluster>();
                cluster.allowDrag = (gridObject.allowDrag || levelData.allowGridObjectDrag);
                cluster.characterMove = this;
                
                // Ensure the object has a collider for touch/mouse detection (3D collider for mouse events)
                Collider collider3D = obj.GetComponent<Collider>();
                if (collider3D == null)
                {
                    // Add a 3D collider for mouse events
                    BoxCollider boxCollider = obj.AddComponent<BoxCollider>();
                    boxCollider.size = new Vector3(5f, 5f, 5f); // Reasonable size for clicking and dragging
                    boxCollider.isTrigger = false; // Must not be a trigger for mouse events
                    Debug.Log($"[CharacterMove] Added BoxCollider (3D) to {gridObject.objectType} for drag functionality");
                }
                else
                {
                    // Ensure existing collider is properly configured and has size
                    collider3D.isTrigger = false;
                    
                    // Fix zero-sized colliders
                    if (collider3D is BoxCollider boxCollider3D)
                    {
                        if (boxCollider3D.size.x == 0 || boxCollider3D.size.y == 0 || boxCollider3D.size.z == 0)
                        {
                            boxCollider3D.size = new Vector3(5f, 5f, 5f); // Reasonable size for clicking and dragging
                            Debug.Log($"[CharacterMove] Fixed zero-sized BoxCollider (3D) for {gridObject.objectType} - new size: {boxCollider3D.size}");
                        }
                        else if (boxCollider3D.size.x > 25f || boxCollider3D.size.y > 25f || boxCollider3D.size.z > 25f)
                        {
                            boxCollider3D.size = new Vector3(5f, 5f, 5f); // Reduce overly large colliders
                            Debug.Log($"[CharacterMove] Reduced large BoxCollider (3D) for {gridObject.objectType} - new size: {boxCollider3D.size}");
                        }
                        else if (boxCollider3D.size.x < 5f || boxCollider3D.size.y < 5f || boxCollider3D.size.z < 5f)
                        {
                            boxCollider3D.size = new Vector3(5f, 5f, 5f); // Ensure minimum size
                            Debug.Log($"[CharacterMove] Increased small BoxCollider (3D) for {gridObject.objectType} - new size: {boxCollider3D.size}");
                        }
                        else
                        {
                            Debug.Log($"[CharacterMove] BoxCollider (3D) for {gridObject.objectType} already has reasonable size: {boxCollider3D.size}");
                        }
                    }
                    
                    Debug.Log($"[CharacterMove] Configured existing Collider (3D) for {gridObject.objectType}");
                }
                
                // Remove any 2D colliders that might interfere
                Collider2D collider2D = obj.GetComponent<Collider2D>();
                if (collider2D != null)
                {
                    Debug.Log($"[CharacterMove] Removing interfering Collider2D from {gridObject.objectType}");
                    DestroyImmediate(collider2D);
                }
                
                // Ensure the object has a Rigidbody (3D) for proper physics interaction
                Rigidbody rb = obj.GetComponent<Rigidbody>();
                if (rb == null)
                {
                    rb = obj.AddComponent<Rigidbody>();
                    rb.useGravity = false; // No gravity
                    rb.drag = 10f; // High drag to prevent sliding
                    rb.angularDrag = 10f; // High angular drag to prevent rotation
                    rb.constraints = RigidbodyConstraints.FreezeRotation | RigidbodyConstraints.FreezePositionY; // Freeze rotation and Y movement
                    rb.isKinematic = true; // Make kinematic to prevent physics movement
                    Debug.Log($"[CharacterMove] Added Rigidbody (3D) to {gridObject.objectType} for drag functionality");
                }
                else
                {
                    // Configure existing rigidbody to prevent unwanted movement
                    rb.useGravity = false;
                    rb.drag = 10f;
                    rb.angularDrag = 10f;
                    rb.constraints = RigidbodyConstraints.FreezeRotation | RigidbodyConstraints.FreezePositionY;
                    rb.isKinematic = true;
                    Debug.Log($"[CharacterMove] Configured existing Rigidbody (3D) for {gridObject.objectType}");
                }
                
                // Remove any 2D rigidbody that might interfere
                Rigidbody2D rb2D = obj.GetComponent<Rigidbody2D>();
                if (rb2D != null)
                {
                    Debug.Log($"[CharacterMove] Removing interfering Rigidbody2D from {gridObject.objectType}");
                    DestroyImmediate(rb2D);
                }
                
                // Ensure object is in the right layer for mouse detection
                obj.layer = LayerMask.NameToLayer("Default"); // Force all objects to Default layer
                Debug.Log($"[CharacterMove] Set {gridObject.objectType} to Default layer for mouse detection");
                
                // Additional debugging for drag setup
                Debug.Log($"[CharacterMove] DRAG SETUP: {gridObject.objectType} at position {gridObject.position}");
                Debug.Log($"[CharacterMove] DRAG SETUP: allowDrag={gridObject.allowDrag}, levelAllowDrag={levelData.allowGridObjectDrag}");
                Debug.Log($"[CharacterMove] DRAG SETUP: final allowDrag={(gridObject.allowDrag || levelData.allowGridObjectDrag)}");
                Debug.Log($"[CharacterMove] DRAG SETUP: object layer={obj.layer}, name={LayerMask.LayerToName(obj.layer)}");
                
                Debug.Log($"[CharacterMove] Set up drag system for {gridObject.objectType} - allowDrag={cluster.allowDrag}");
                
                // Store start and end positions
                if (gridObject.isStartObject)
                {
                    startObjectPosition = gridObject.position;
                    Debug.Log($"[CharacterMove] Start object '{gridObject.objectType}' placed at {gridObject.position}");
                }
                if (gridObject.isEndObject)
                {
                    endObjectPosition = gridObject.position;
                    Debug.Log($"[CharacterMove] End object '{gridObject.objectType}' placed at {gridObject.position}");
                }
                
                // Debug logging for apple specifically
                if (gridObject.objectType == "apple")
                {
                    Debug.Log($"[CharacterMove] APPLE DEBUG: Apple object '{obj.name}' instantiated at world position {obj.transform.position}");
                    Debug.Log($"[CharacterMove] APPLE DEBUG: Apple grid position: {gridObject.position}");
                    Debug.Log($"[CharacterMove] APPLE DEBUG: Apple active in hierarchy: {obj.activeInHierarchy}");
                }
                
                // Debug logging for 2D sprite objects
                SpriteRenderer spriteRenderer = obj.GetComponent<SpriteRenderer>();
                if (spriteRenderer != null)
                {
                    Debug.Log($"[CharacterMove] SPRITE DEBUG: {gridObject.objectType} '{obj.name}' has SpriteRenderer");
                    Debug.Log($"[CharacterMove] SPRITE DEBUG: Sprite: {spriteRenderer.sprite?.name ?? "null"}");
                    Debug.Log($"[CharacterMove] SPRITE DEBUG: Sorting Layer: {spriteRenderer.sortingLayerName}");
                    Debug.Log($"[CharacterMove] SPRITE DEBUG: Order in Layer: {spriteRenderer.sortingOrder}");
                    Debug.Log($"[CharacterMove] SPRITE DEBUG: Color: {spriteRenderer.color}");
                    Debug.Log($"[CharacterMove] SPRITE DEBUG: Enabled: {spriteRenderer.enabled}");
                }
                else
                {
                    Debug.LogWarning($"[CharacterMove] SPRITE DEBUG: {gridObject.objectType} '{obj.name}' has NO SpriteRenderer component!");
                }
                
                // Ensure 2D sprites are properly configured for visibility
                if (spriteRenderer != null)
                {
                    // Ensure sprite is visible
                    spriteRenderer.enabled = true;
                    spriteRenderer.color = Color.white;
                    
                    // Set proper sorting layer for 2D sprites
                    if (string.IsNullOrEmpty(spriteRenderer.sortingLayerName) || spriteRenderer.sortingLayerName == "Default")
                    {
                        spriteRenderer.sortingLayerName = "Default";
                        spriteRenderer.sortingOrder = 1; // Ensure it's above the grid
                    }
                    
                    Debug.Log($"[CharacterMove] SPRITE CONFIG: {gridObject.objectType} configured for visibility");
                }

                ApplySpawnedGridObjectVisuals(obj, gridObject);
            }
            else
            {
                Debug.LogError($"[CharacterMove] Prefab for object type '{gridObject.objectType}' is null! Check inspector assignments.");
            }
        }

        // Check if robot starts on the start object position
        if (robotGridPosition == startObjectPosition)
        {
            hasReachedStartObject = true;
            Debug.Log($"[CharacterMove] Robot starts on start object position. hasReachedStartObject set to true.");
        }

        // Build the hidden state for the gridCols x gridRows virtual matrix.
        BuildHiddenMatrix(levelData);
        Debug.Log($"[CharacterMove] Hidden matrix built for '{levelData.levelName}' ({gridCols}x{gridRows}). Robot at {robotGridPosition}.");

        ApplyPlayfieldVisualLayout(levelData);
        RefreshCellBlinkHighlights(levelData);
        SetupRobotDrag(levelData);

        // If flag-placement mode is active, the player taps the goal cell (isEndObject) to show the flag.
        if (levelData.useFlagPlacement)
        {
            Vector2Int initial = (flagInitialCell.x >= 0 && flagInitialCell.y >= 0)
                ? flagInitialCell
                : levelData.flagInitialPosition;
            if (initial.x >= 0 && initial.y >= 0 && IsInsideMatrix(initial))
            {
                TryPlaceOrMoveFlag(initial);
            }
            else if (levelData.playerPicksEndCellWithFlag)
            {
                Debug.Log("[CharacterMove] Tap any cell to place the flag (your goal).");
            }
            else if (designatedEndObjectCell.x >= 0)
            {
                Debug.Log($"[CharacterMove] Flag-placement: tap the goal cell {designatedEndObjectCell} to place the flag.");
            }
        }

        // Guided actions logic
        waitingForGuidedInput = false;
        userBlankChoices.Clear();
        blankSlotInstances.Clear();
        blankSlotQueueIndices.Clear();
        currentBlankIndexInSequence = 0;
        wrongAnswersCount = 0; // Reset wrong answers count for new level

        // Hide all blank buttons by default
        if (blankLeftButton != null) blankLeftButton.gameObject.SetActive(false);
        if (blankRightButton != null) blankRightButton.gameObject.SetActive(false);
        if (blankForwardButton != null) blankForwardButton.gameObject.SetActive(false);
        if (blankBackwardButton != null) blankBackwardButton.gameObject.SetActive(false);

        // Action palette: number-line levels use forward/backward only; grid levels use all four.
        ApplyActionButtonVisibility(levelData);
        if (runButton != null && !UsesGuidedBlankFlow(levelData))
            runButton.interactable = !IsRunBlockedByFlagRequirement();
        
        // ... existing code ...
        if (wrongAnswerPopup != null) wrongAnswerPopup.SetActive(false);
        if (wrongAnswerTryAgainButton != null)
        {
            wrongAnswerTryAgainButton.onClick.RemoveAllListeners();
            wrongAnswerTryAgainButton.onClick.AddListener(() => {
                if (wrongAnswerPopup != null) wrongAnswerPopup.SetActive(false);

                // Reset the current level without changing scene
                ResetCurrentLevel();
                RefreshStudentResetButtonState();
            });
        }

        RefreshStudentResetButtonState();
        if (levelData.guidedActions != null && levelData.guidedActions.Count > 0)
            SeedGuidedProgramQueue(levelData);
        else
            ClearActionQueueVisual();
        // Update camera targets to include character and grid objects
        if (multiTargetCamera != null)
        {
            multiTargetCamera.targets.Clear();
            multiTargetCamera.targets.Add(this.transform); // Character
            Debug.Log($"[CharacterMove] Added character as camera target");
            
            // Add grid objects as camera targets
            foreach (var obj in activeGridObjects)
            {
                if (obj != null && obj.activeInHierarchy)
                {
                    multiTargetCamera.targets.Add(obj.transform);
                    Debug.Log($"[CharacterMove] Added {obj.name} at position {obj.transform.position} as camera target");
                    
                    // Special debug for apple objects
                    if (obj.name.ToLower().Contains("apple"))
                    {
                        Debug.Log($"[CharacterMove] APPLE CAMERA DEBUG: Apple '{obj.name}' added as camera target at {obj.transform.position}");
                    }
                }
                else
                {
                    Debug.LogWarning($"[CharacterMove] Object {obj?.name} is null or not active in hierarchy - not added as camera target");
                }
            }
            
            Debug.Log($"[CharacterMove] Total camera targets: {multiTargetCamera.targets.Count}");
        
            // Force camera to update its view to include all targets
            if (multiTargetCamera.targets.Count > 0)
            {
                // Reset camera to ensure it can see all targets
                multiTargetCamera.ResetCameraToGrid();
                Debug.Log("[CharacterMove] Camera reset to include all targets");
            }
        }
        else
        {
            Debug.LogWarning("[CharacterMove] MultiTargetCamera is null! Camera targets not updated.");
        }
        
        // Debug: Check if objects are properly set up for dragging
        Debug.Log($"[CharacterMove] DRAG DEBUG: Checking drag setup for Level {currentLevel}");
        foreach (var obj in activeGridObjects)
        {
            if (obj != null)
            {
                GridObjectCluster cluster = obj.GetComponent<GridObjectCluster>();
                Collider2D collider = obj.GetComponent<Collider2D>();
                Rigidbody2D rb = obj.GetComponent<Rigidbody2D>();
                
                Debug.Log($"[CharacterMove] DRAG DEBUG: {obj.name} - hasCluster={cluster != null}, allowDrag={cluster?.allowDrag}, hasCollider={collider != null}, hasRigidbody={rb != null}");
                
                // Check layer and camera settings
                if (collider != null)
                {
                    Debug.Log($"[CharacterMove] DRAG DEBUG: {obj.name} - Layer: {obj.layer}, Collider Layer: {collider.gameObject.layer}");
                }
            }
        }
        
        // Check camera settings
        if (Camera.main != null)
        {
            Camera mainCam = Camera.main;
            Debug.Log($"[CharacterMove] CAMERA DEBUG: Main camera culling mask: {mainCam.cullingMask}, event mask: {mainCam.eventMask}");
            Debug.Log($"[CharacterMove] CAMERA DEBUG: Main camera position: {mainCam.transform.position}, orthographic: {mainCam.orthographic}");
            
            // Check if Default layer is included in camera's culling mask
            int defaultLayer = LayerMask.NameToLayer("Default");
            bool canSeeDefaultLayer = (mainCam.cullingMask & (1 << defaultLayer)) != 0;
            Debug.Log($"[CharacterMove] CAMERA DEBUG: Can see Default layer (layer {defaultLayer}): {canSeeDefaultLayer}");
            
            // Force camera to see Default layer if it doesn't
            if (!canSeeDefaultLayer)
            {
                mainCam.cullingMask |= (1 << defaultLayer);
                Debug.Log($"[CharacterMove] CAMERA DEBUG: Added Default layer to camera culling mask");
            }
        }
        
        // Check for Canvas elements that might block mouse events
        Canvas[] canvases = FindObjectsOfType<Canvas>();
        foreach (Canvas canvas in canvases)
        {
            Debug.Log($"[CharacterMove] CANVAS DEBUG: Found Canvas '{canvas.name}' - renderMode: {canvas.renderMode}, sortingOrder: {canvas.sortingOrder}");
            if (canvas.renderMode == RenderMode.ScreenSpaceOverlay)
            {
                Debug.Log($"[CharacterMove] CANVAS DEBUG: ScreenSpaceOverlay canvas '{canvas.name}' may block mouse events on world objects");
            }
        }


        // Per-level timer and initial command snapshot (after guided queue / palette are configured).
        levelStartTime = Time.time;
        CaptureInitialProgramTelemetry();

        EnsureCornerHintPanel();
        EnsureActionBlockIntro();

        LevelData ld = GetCurrentLevelData();
        bool introWillRun = actionBlockIntro != null && actionBlockIntro.ShouldRunIntro(ld);
        if (!introWillRun && cornerHintPanel != null && ld != null)
            cornerHintPanel.Show(ld.cornerHint, introMode: false);

        if (actionBlockIntro != null)
            actionBlockIntro.TryBeginAfterLevelSetup(levelNumber, ld);
    }

    private void EnsureCornerHintPanel()
    {
        if (cornerHintPanel == null)
            cornerHintPanel = GetComponent<LevelCornerHintPanel>();
        if (cornerHintPanel == null)
            cornerHintPanel = gameObject.AddComponent<LevelCornerHintPanel>();
        cornerHintPanel.EnsureBuilt();
    }

    private void EnsureActionBlockIntro()
    {
        if (actionBlockIntro == null)
            actionBlockIntro = GetComponent<ActionBlockIntroManager>();
        if (actionBlockIntro == null)
            actionBlockIntro = gameObject.AddComponent<ActionBlockIntroManager>();
        actionBlockIntro.Initialize(this);
    }

    /// <summary>After intro ends, show the level's normal top-right hint.</summary>
    public void RefreshLevelCornerHint()
    {
        EnsureCornerHintPanel();
        LevelData ld = GetCurrentLevelData();
        if (ld != null && cornerHintPanel != null && !IsActionBlockIntroActive)
            cornerHintPanel.Show(ld.cornerHint, introMode: IsIntroLevel(ld));
    }

    /// <summary>Removes every block from the yellow program strip (data + UI).</summary>
    private void ClearActionQueueVisual()
    {
        CleanupInsertionPlaceholders();
        if (actionQueueTransform != null)
        {
            for (int i = actionQueueTransform.childCount - 1; i >= 0; i--)
                Destroy(actionQueueTransform.GetChild(i).gameObject);
        }
        actionQueue.Clear();
        blankSlotInstances.Clear();
        blankSlotQueueIndices.Clear();
        currentBlankIndexInSequence = 0;
        userBlankChoices.Clear();
    }

    /// <summary>Clears user-added blocks from the action queue UI (used between intro steps).</summary>
    public void ClearUserActionQueue()
    {
        if (actionQueueTransform == null) return;
        for (int i = actionQueueTransform.childCount - 1; i >= 0; i--)
        {
            var child = actionQueueTransform.GetChild(i);
            if (child.GetComponent<QueueInsertionPlaceholder>() != null) continue;
            var refComp = child.GetComponent<QueuedActionRef>();
            if (refComp != null && !refComp.deletable) continue;
            Destroy(child.gameObject);
        }
        actionQueue.Clear();
    }

    private static string NormalizeActionLabel(string action)
    {
        if (string.IsNullOrWhiteSpace(action)) return null;
        string a = action.Trim().ToLowerInvariant().Replace("_", " ");
        if (a == "left" || a == "turnleft") return "turn left";
        if (a == "right" || a == "turnright") return "turn right";
        if (a == "up") return "forward";
        if (a == "down") return "backward";
        return a;
    }

    private bool ShouldLockProgramQueue(LevelData levelData)
    {
        if (levelData == null || levelData.guidedActions == null || levelData.guidedActions.Count == 0)
            return false;
        if (UsesGuidedBlankFlow(levelData)) return false;
        if (levelData.useFlagPlacement) return true;
        return string.Equals(levelData.levelType, "FLAG_PLACEMENT", System.StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Rebuilds the yellow strip from <see cref="LevelData.guidedActions"/> (flag / fixed-program items).</summary>
    private void SeedGuidedProgramQueue(LevelData levelData)
    {
        if (levelData?.guidedActions == null || levelData.guidedActions.Count == 0) return;

        ClearActionQueueVisual();
        waitingForGuidedInput = false;
        wrongAnswersCount = 0;

        // Edit-starter / debugging levels seed the buggy program but the student must be
        // able to remove blocks to fix it — so those seeded blocks are deletable (they get
        // a close button + drag-out-to-delete). Flag-placement and blank-fill flows stay
        // read-only.
        bool editableSeed = !UsesGuidedBlankFlow(levelData) && !ShouldLockProgramQueue(levelData);

        for (int i = 0; i < levelData.guidedActions.Count; i++)
        {
            string action = NormalizeActionLabel(levelData.guidedActions[i]);
            if (action == "forward")
                EnqueueAction(new MoveAction(Vector3.forward), forwardSprite, editableSeed);
            else if (action == "backward")
                EnqueueAction(new MoveAction(-Vector3.forward), backwardSprite, editableSeed);
            else if (action == "turn left")
                EnqueueAction(new RotateAction(-rotationAngle), rotateLeftSprite, editableSeed);
            else if (action == "turn right")
                EnqueueAction(new RotateAction(rotationAngle), rotateRightSprite, editableSeed);
            else if (action == "blank")
            {
                var blankSlotInstance = Instantiate(actionImagePrefab, actionQueueTransform);
                var img = blankSlotInstance.GetComponent<Image>();
                if (blankSlotSprite != null) img.sprite = blankSlotSprite;
                img.color = Color.yellow;

                blankSlotInstances.Add(blankSlotInstance);
                blankSlotQueueIndices.Add(actionQueue.Count);
                actionQueue.Enqueue(null);
            }
            else
            {
                Debug.LogWarning($"[CharacterMove] Unknown guided action '{levelData.guidedActions[i]}' — skipped.");
            }
        }

        Debug.Log($"[CharacterMove] Seeded program ({actionQueue.Count} steps): {string.Join(", ", levelData.guidedActions)}");

        if (blankSlotInstances.Count > 0)
        {
            if (moveForwardButton != null) moveForwardButton.interactable = false;
            if (moveDownButton != null) moveDownButton.interactable = false;
            if (rotateLeftButton != null) rotateLeftButton.interactable = false;
            if (rotateRightButton != null) rotateRightButton.interactable = false;
            if (runButton != null) runButton.interactable = false;
            ActivateBlank(0);
        }
        else if (ShouldLockProgramQueue(levelData))
        {
            // Flag-placement / fixed-program items: show the teacher program read-only in the yellow strip.
            if (moveForwardButton != null) moveForwardButton.interactable = false;
            if (moveDownButton != null) moveDownButton.interactable = false;
            if (rotateLeftButton != null) rotateLeftButton.interactable = false;
            if (rotateRightButton != null) rotateRightButton.interactable = false;
        }
    }

    private float CalculateDifficultyMultiplier()
    {
        float difficultyMultiplier = 1.0f;
        
        // Get the scores from PlayerPrefs
        string userId = PlayerPrefs.GetString("UserId", "UnknownUser");
        int level1Score = PlayerPrefs.GetInt($"{userId}_Level1_Score", 0);
        int level2Score = PlayerPrefs.GetInt($"{userId}_Level2_Score", 0);
        
        int totalAssessments = 0;
        float avgScore = 0f;

        // Only count levels that have been completed
        if (level1Score > 0)
        {
            avgScore += level1Score;
            totalAssessments++;
        }
        if (level2Score > 0)
        {
            avgScore += level2Score;
            totalAssessments++;
        }

        if (totalAssessments > 0)
        {
            avgScore /= totalAssessments;
            // Scale from 0.5 to 1.5 based on average score (assuming max score is 20)
            // Lower scores mean easier placement (closer to robot)
            difficultyMultiplier = 0.5f + (avgScore / 20f);
        }

        Debug.Log($"[CharacterMove] Calculated difficulty multiplier: {difficultyMultiplier} based on Level1 score: {level1Score}, Level2 score: {level2Score}");
        return difficultyMultiplier;
    }





    private void Start()
    {
        // Check if user is logged in
        if (!PlayerPrefs.HasKey("UserId"))
        {
            Debug.LogError("User not logged in!");
            // SceneManager.LoadScene("MainMenu"); // Or your login scene name
            return;
        }
        currentUserId = PlayerPrefs.GetString("UserId");
        Debug.Log($"Logged in with ID: {currentUserId}");

        // Mark browser tab session — do not reset saved progress here (WebGL reloads often).
        string sessionKey = currentUserId + "_session_active";
        if (!PlayerPrefs.HasKey(sessionKey))
        {
            PlayerPrefs.SetInt(sessionKey, 1);
            PlayerPrefs.Save();
            Debug.Log("[CharacterMove] New browser session — progress will resume from server/local save.");
        }

        currentLevel = PlayerPrefs.GetInt(currentUserId + "_currentLevel", 1);
        Debug.Log($"[CharacterMove] Local saved slot before level list load: {currentLevel}");

        // Establish virtual-matrix origin in world space.
        if (gridOriginTransform != null)
        {
            SyncGridOriginCache();
            Debug.Log($"[CharacterMove] Grid playfield origin: anchor={gridOriginTransform.position}, cell(0,0)={robotStartWorldPos}, gridSize={gridSize}, autoCenter={gridAutoCenterOnOrigin}");
        }
        else
        {
            SyncGridOriginCache();
            Debug.LogWarning("[CharacterMove] No gridOriginTransform assigned — using this transform as playfield anchor. Add GridOriginAnchor at the center of the playfield.");
        }

        animator = GetComponent<Animator>();

        // Click-to-enqueue is only wired up when drag-and-drop is OFF. With drag-and-drop on,
        // the user must drag a button onto an ActionQueueDropZone instead.
        if (!useDragAndDropForActions)
        {
            rotateLeftButton.onClick.AddListener(() => { EnqueueAction(new RotateAction(-rotationAngle), rotateLeftSprite, true); playerActions.Add("left"); });
            rotateRightButton.onClick.AddListener(() => { EnqueueAction(new RotateAction(rotationAngle), rotateRightSprite, true); playerActions.Add("right"); });
            moveForwardButton.onClick.AddListener(() => { EnqueueAction(new MoveAction(Vector3.forward), forwardSprite, true); playerActions.Add("forward"); });
            moveDownButton.onClick.AddListener(() => { EnqueueAction(new MoveAction(-Vector3.forward), backwardSprite, true); playerActions.Add("backward"); });
        }

        // Drag-and-drop wiring: makes the four action buttons draggable into the action
        // queue panel without any extra Inspector setup. Safe to call every time; the helper
        // methods are idempotent (they reuse existing components if already present).
        if (useDragAndDropForActions)
        {
            AutoWireDragAndDrop();
            ConfigureEventSystemForTouch();
        }

        runButton.onClick.AddListener(StartActionProcessing);

        if (studentResetButton != null)
        {
            studentResetButton.onClick.RemoveAllListeners();
            studentResetButton.onClick.AddListener(StudentResetLevel);
        }

        successPopup.SetActive(false); 
        if (successPopupContinueButton != null) 
        {
            successPopupContinueButton.onClick.AddListener(OnSuccessPopupContinue);
        }
        else
        {
            Debug.LogWarning("[CharacterMove] successPopupContinueButton is not assigned in the inspector!");
        }
        // appleObject.SetActive(false); // This might be an old reference

        if (spriteRenderer == null) spriteRenderer = GetComponent<SpriteRenderer>();
        // fadeCoroutine = StartCoroutine(FadeInAndOut(repeatCount)); // Fading might be distracting now
        StopFadingAndResetSpriteColor(); // Ensure sprite is visible

        if (PlayerPrefs.HasKey("ServerResponse"))
        {
            string jsonResponse = PlayerPrefs.GetString("ServerResponse");
            HandleServerResponse(jsonResponse);
            PlayerPrefs.DeleteKey("ServerResponse");
        }
        audioSource = GetComponent<AudioSource>();
        if (audioSource == null) audioSource = gameObject.AddComponent<AudioSource>();
        audioSource1 = GetComponent<AudioSource>();
        if (audioSource1 == null) audioSource1 = gameObject.AddComponent<AudioSource>();

        // Debug and validate rotation angle value
        Debug.Log($"[CharacterMove] rotationAngle is set to: {rotationAngle}");
        
        // Fix rotation angle if it was accidentally changed in inspector
        if (rotationAngle != 90f)
        {
            Debug.LogWarning($"[CharacterMove] rotationAngle was {rotationAngle}, fixing to 90 degrees");
            rotationAngle = 90f;
        }
        
        StartCoroutine(BootstrapLevelsThenSetup());
    }

    private IEnumerator BootstrapLevelsThenSetup()
    {
        var loader = PlatformLevelLoader.Instance;
        if (loader == null)
        {
            var go = new GameObject("PlatformLevelLoader");
            loader = go.AddComponent<PlatformLevelLoader>();
        }

        List<LevelData> remote = null;
        yield return loader.LoadLevelsCoroutine(list => remote = list);

        if (remote != null && remote.Count > 0)
        {
            allLevelsData = remote;
            Debug.Log($"[CharacterMove] Using {remote.Count} level(s) from teacher dashboard.");
        }
        else if (loader != null && loader.usePlatformLevels)
        {
            allLevelsData = new List<LevelData>();
            Debug.LogError(
                $"[CharacterMove] Could not load levels from platform ({loader.LastError ?? "unknown"}). " +
                "Will not fall back to built-in introduction.");
            if (chatGPTResponseText != null)
                chatGPTResponseText.text = "Could not load your assigned items. Please ask your teacher to check the dashboard.";
        }
        else
        {
            InitializeLevelData();
            if (loader != null && !string.IsNullOrEmpty(loader.LastError))
                Debug.LogWarning($"[CharacterMove] Platform levels unavailable ({loader.LastError}); using built-in levels.");
            else
                Debug.Log("[CharacterMove] Using built-in levels.");
        }

        if (allLevelsData == null || allLevelsData.Count == 0)
        {
            yield break;
        }

        LoadPlayerLevel();
        ResolveCurrentLevelSlotAfterLevelsLoaded();
        MaybeSkipCompletedIntroLevel();
        if (currentLevel > allLevelsData.Count)
            currentLevel = 1;
        SetupLevel(currentLevel);
    }

    /// <summary>
    /// Maps saved progress onto the current assigned level list. Resets to the first assigned
    /// item when the assignment set changes; otherwise continues by level key or clamped slot.
    /// </summary>
    private void ResolveCurrentLevelSlotAfterLevelsLoaded()
    {
        if (allLevelsData == null || allLevelsData.Count == 0) return;
        if (string.IsNullOrEmpty(currentUserId) || currentUserId == "UnknownUser") return;

        string prefsPrefix = currentUserId;
        string levelListKey = string.Join("|", allLevelsData.ConvertAll(ld => ld.levelKey ?? ""));
        PlayerPrefs.SetString(prefsPrefix + "_assignedLevelKeys", levelListKey);

        var loader = PlatformLevelLoader.Instance;
        if (loader != null && loader.HasServerResume)
        {
            if (TryApplyResumeByLevelKey(loader.ResumeLevelKey, prefsPrefix,
                    $"Resuming from server at slot {{0}} ({loader.ResumeLevelKey})."))
                return;

            currentLevel = Mathf.Clamp(loader.ResumeSlot, 1, allLevelsData.Count);
            PersistCurrentLevelSlot(prefsPrefix);
            Debug.Log($"[CharacterMove] Resuming from server slot {currentLevel} ({GetPlatformLevelKey(currentLevel)}).");
            return;
        }

        string savedLevelKey = PlayerPrefs.GetString(prefsPrefix + "_currentLevelKey", "");
        if (TryApplyResumeByLevelKey(savedLevelKey, prefsPrefix,
                $"Resuming at {savedLevelKey} (slot {{0}})."))
            return;

        int slot = PlayerPrefs.GetInt(prefsPrefix + "_currentLevel", 1);
        currentLevel = Mathf.Clamp(slot, 1, allLevelsData.Count);
        PersistCurrentLevelSlot(prefsPrefix);
        Debug.Log($"[CharacterMove] Resuming at slot {currentLevel} ({GetPlatformLevelKey(currentLevel)}).");
    }

    private bool TryApplyResumeByLevelKey(string levelKey, string prefsPrefix, string logFormat)
    {
        if (string.IsNullOrEmpty(levelKey) || allLevelsData == null) return false;
        for (int i = 0; i < allLevelsData.Count; i++)
        {
            if (allLevelsData[i]?.levelKey != levelKey) continue;
            currentLevel = i + 1;
            PersistCurrentLevelSlot(prefsPrefix);
            Debug.Log(string.Format("[CharacterMove] " + logFormat, currentLevel));
            return true;
        }
        return false;
    }

    private void PersistCurrentLevelSlot(string prefsPrefix)
    {
        PlayerPrefs.SetInt(prefsPrefix + "_currentLevel", currentLevel);
        string levelKey = GetPlatformLevelKey(currentLevel);
        if (!string.IsNullOrEmpty(levelKey))
            PlayerPrefs.SetString(prefsPrefix + "_currentLevelKey", levelKey);
        PlayerPrefs.Save();
    }

    public static bool IsIntroLevel(LevelData ld)
    {
        if (ld == null) return false;
        if (ld.levelKey == "level_0") return true;
        return !string.IsNullOrEmpty(ld.levelType) &&
               ld.levelType.Equals("INTRO", System.StringComparison.OrdinalIgnoreCase);
    }

    private bool IsIntroCompleted(LevelData ld)
    {
        if (ld?.actionBlockIntro == null) return true;
        return ActionBlockIntroManager.IsIntroCompletedForStudent(ld.actionBlockIntro, currentUserId);
    }

    private void MaybeSkipCompletedIntroLevel()
    {
        if (allLevelsData == null || allLevelsData.Count == 0) return;

        LevelData current = GetCurrentLevelData();
        if (current == null || !IsIntroLevel(current)) return;
        if (!IsIntroCompleted(current)) return;

        for (int i = currentLevel; i < allLevelsData.Count; i++)
        {
            if (!IsIntroLevel(allLevelsData[i]))
            {
                currentLevel = i + 1;
                SavePlayerLevel();
                Debug.Log(
                    $"[CharacterMove] Introduction already completed for {currentUserId} — advancing from intro to slot {currentLevel} ({allLevelsData[i]?.levelKey}).");
                return;
            }
        }
    }

    /// <summary>Called when Level 0 block introduction finishes — advances to Level 1.</summary>
    public void OnIntroLevelComplete()
    {
        LevelData ld = GetCurrentLevelData();
        if (ld != null && IsIntroLevel(ld))
            StartCoroutine(IntroCompleteReportAndAdvance());
    }

    private IEnumerator IntroCompleteReportAndAdvance()
    {
        if (!_skipNextPlatformReport && !_currentRunReportedToPlatform)
            yield return ReportCurrentRunToPlatformRoutine(true);

        if (GameAssessmentClient.Instance != null)
            yield return GameAssessmentClient.Instance.WaitForPendingReports();

        if (GameAssessmentClient.Instance != null)
            GameAssessmentClient.Instance.ClearCurrentAttempt();

        AdvanceToNextLevel();
    }

    private void OnSuccessPopupContinue()
    {
        StartCoroutine(OnSuccessPopupContinueRoutine());
    }

    private IEnumerator OnSuccessPopupContinueRoutine()
    {
        successPopup.SetActive(false);
        if (!_skipNextPlatformReport && !_currentRunReportedToPlatform)
            yield return ReportCurrentRunToPlatformRoutine(pendingLevelPassed);
        else
            _skipNextPlatformReport = false;

        if (GameAssessmentClient.Instance != null)
            yield return GameAssessmentClient.Instance.WaitForPendingReports();

        AdvanceToNextLevel();
    }

    private string GetPlatformLevelKey(int levelNumber)
    {
        if (allLevelsData != null && levelNumber >= 1 && levelNumber <= allLevelsData.Count)
        {
            var ld = allLevelsData[levelNumber - 1];
            if (ld != null && !string.IsNullOrEmpty(ld.levelKey))
                return ld.levelKey;
        }
        return $"level_{levelNumber}";
    }

    private string BuildCommandsString(string[] commands)
    {
        if (commands == null || commands.Length == 0) return "";
        return string.Join("; ", commands);
    }

    private void EnsurePlatformRunAttemptStarted()
    {
        if (string.IsNullOrEmpty(currentUserId) || currentUserId == "UnknownUser") return;
        if (GameAssessmentClient.Instance == null) return;

        string levelKey = GetPlatformLevelKey(currentLevel);
        var client = GameAssessmentClient.Instance;
        if (!string.IsNullOrEmpty(client.CurrentAttemptId) && client.CurrentLevelId != levelKey)
            client.ClearCurrentAttempt();

        string initial = BuildCommandsString(_telemetryInitialCommands);
        client.SetStudent(currentUserId);
        client.StartLevel(levelKey, string.IsNullOrEmpty(initial) ? null : initial, currentLevel);
    }

    private void ReportCurrentRunToPlatform(bool passed)
    {
        StartCoroutine(ReportCurrentRunToPlatformRoutine(passed));
    }

    private IEnumerator ReportCurrentRunToPlatformRoutine(bool passed)
    {
        if (currentLevel < 1 || currentLevel > allLevelsData.Count) yield break;
        if (string.IsNullOrEmpty(currentUserId) || currentUserId == "UnknownUser") yield break;
        if (GameAssessmentClient.Instance == null) yield break;
        if (_currentRunReportedToPlatform) yield break;

        LevelData levelData = GetCurrentLevelData();
        string levelKey = GetPlatformLevelKey(currentLevel);
        var client = GameAssessmentClient.Instance;

        if (string.IsNullOrEmpty(client.CurrentAttemptId))
        {
            EnsurePlatformRunAttemptStarted();
            yield return client.WaitForAttemptReady(levelKey);
        }

        if (string.IsNullOrEmpty(client.CurrentAttemptId))
        {
            Debug.LogWarning("[CharacterMove] level-end skipped: no attempt id after RUN.");
            yield break;
        }

        string finalCmd = BuildCommandsString(_telemetryFinalCommands);
        if (string.IsNullOrEmpty(finalCmd))
            finalCmd = passed ? "Level Completed" : "Run failed";

        int score = ComputeLevelEndScore(levelData, passed);
        float duration = levelStartTime > 0f
            ? Time.time - levelStartTime
            : (_runAttemptStartTime > 0f ? Time.time - _runAttemptStartTime : 0f);

        string initial = BuildCommandsString(_telemetryInitialCommands);
        var assessmentExtras = BuildAssessmentExtras(levelData) ?? new GameAssessmentClient.AssessmentExtrasPayload();
        assessmentExtras.inLevelRunNumber = _activeInLevelRunNumber > 0
            ? _activeInLevelRunNumber
            : Mathf.Max(1, currentAttempt + (passed ? 1 : 0));
        assessmentExtras.maxLevelRuns = levelData != null ? levelData.maxAttempts : 0;
        assessmentExtras.playSlot = currentLevel;

        _currentRunReportedToPlatform = true;
        client.ReportLevelComplete(
            levelKey,
            currentUserId,
            initial,
            finalCmd,
            score,
            duration,
            passed: passed,
            status: passed ? "correct" : "incorrect",
            objectVisit: BuildObjectVisitPayload(levelData),
            assessmentExtras: assessmentExtras);
    }

    /// <summary>Item score sent to the platform — never default failed attempts to 100.</summary>
    private int ComputeLevelEndScore(LevelData levelData, bool passed)
    {
        if (levelData != null && UsesGuidedBlankFlow(levelData))
        {
            int blankCount = levelData.blanks?.Count ?? 0;
            bool blankCorrect = IsBlankAnswerCorrect();
            bool filled = blankCount > 0 && userBlankChoices.Count >= blankCount;

            if (blankCorrect && passed) return 100;
            if (filled) return 35;
            return 15;
        }

        if (!passed) return 0;

        int saved = PlayerPrefs.GetInt($"{currentUserId}_Level{currentLevel}_Score", 0);
        return saved > 0 ? saved : 100;
    }

    private GameAssessmentClient.AssessmentExtrasPayload BuildAssessmentExtras(LevelData levelData)
    {
        if (levelData == null) return null;

        var extras = new GameAssessmentClient.AssessmentExtrasPayload();

        if (UsesGuidedBlankFlow(levelData) && levelData.blanks != null && levelData.blanks.Count > 0)
        {
            extras.blankAnswers = userBlankChoices.ToArray();
            extras.correctBlankAnswers = levelData.blanks
                .Select(b => b.correctAnswer)
                .Where(a => !string.IsNullOrEmpty(a))
                .ToArray();
            extras.blankAnswersCorrect = IsBlankAnswerCorrect();
        }

        if (IsFlagPlacementActive && IsFlagPlaced)
        {
            extras.flagCellX = flagCell.x;
            extras.flagCellY = flagCell.y;
            extras.flagPredictionCorrect = IsFlagPredictionCorrect(levelData);
            Vector2Int expected = ResolveEndGoalCell(levelData);
            if (expected.x >= 0 && expected.y >= 0)
            {
                extras.expectedCellX = expected.x;
                extras.expectedCellY = expected.y;
            }
        }

        return extras;
    }

    private GameAssessmentClient.ObjectVisitPayload BuildObjectVisitPayload(LevelData levelData)
    {
        if (levelData == null) return null;

        bool hasVisitObjects = UsesVisitObjectSequence(levelData) ||
            (levelData.gridObjects != null &&
             levelData.gridObjects.Any(g => g.isStartObject || g.isEndObject));
        if (!hasVisitObjects && !UsesNumberLine(levelData)) return null;

        bool reachedStart = hasReachedStartObject || visitedStartObjectThisLevel;
        bool reachedEnd = hasReachedEndObject || visitedEndObjectThisLevel;

        string startType = levelStartObjectType;
        string endType = levelEndObjectType;
        if (levelData.gridObjects != null)
        {
            foreach (var gridObject in levelData.gridObjects)
            {
                if (gridObject.isStartObject && string.IsNullOrEmpty(startType))
                    startType = gridObject.objectType;
                if (gridObject.isEndObject && string.IsNullOrEmpty(endType))
                    endType = gridObject.objectType;
            }
        }

        string pattern;
        if (reachedStart && reachedEnd) pattern = "both";
        else if (reachedStart) pattern = "start_only";
        else if (reachedEnd) pattern = "end_only";
        else pattern = "neither";

        return new GameAssessmentClient.ObjectVisitPayload
        {
            startObjectType = startType ?? "",
            endObjectType = endType ?? "",
            reachedStart = reachedStart,
            reachedEnd = reachedEnd,
            visitPattern = pattern
        };
    }
    
    private void AdvanceToNextLevel()
    {
        int nextLevel = currentLevel + 1;
        if (nextLevel <= MAX_LEVELS && nextLevel <= allLevelsData.Count)
        {
            currentLevel = nextLevel;
            SavePlayerLevel();
            StartCoroutine(SetupNextLevel());
        }
        else
        {
            chatGPTResponseText.text = "";
            Debug.Log("[CharacterMove] All levels completed!");
            levelStartTime = -1f;
        }
        foreach (var obj in activeObstacles) { if (obj != null) Destroy(obj); }
        activeObstacles.Clear();
    }

    private IEnumerator SetupNextLevel()
    {
        yield return new WaitForEndOfFrame();

        if (GameAssessmentClient.Instance != null)
            yield return GameAssessmentClient.Instance.WaitForPendingReports();

        SetupLevel(currentLevel);
    }

    void Update()
    {
        // Existing code...

        // Update the last safe position if the character is moving
        if (!isProcessing && animator.GetBool("isWalking"))
        {
            lastSafePosition = transform.position;
        }
        
        // Ensure the time scale is normal when the success popup is active
        if (successPopup.activeSelf && Time.timeScale < 1.0f)
        {
            Debug.Log("[CharacterMove] Detected paused game with active popup. Restoring time scale.");
            Time.timeScale = 1.0f;
        }


    }

    [System.Serializable]
    public class ServerResponse
    {
        public string results;
        public string status;
    }

    public void HandleServerResponse(string jsonResponse)
    {
        Debug.Log("Received JSON: " + jsonResponse);
        ServerResponse serverResponse = JsonUtility.FromJson<ServerResponse>(jsonResponse);

        if (serverResponse.status == "success")
        {
            string[] results = serverResponse.results.Split(',');
            for (int i = 0; i < results.Length; i++)
            {
                results[i] = results[i].Trim();
            }

            foreach (var result in results)
            {
                if (result == "forward")
                {
                    EnqueueAction(new MoveAction(Vector3.forward), forwardSprite);
                }
                else if (result == "left")
                {
                    EnqueueAction(new RotateAction(-rotationAngle), rotateLeftSprite);
                }
                else if (result == "right")
                {
                    EnqueueAction(new RotateAction(rotationAngle), rotateRightSprite);
                }
                else
                {
                    Debug.LogWarning("Unknown result: " + result);
                }
            }
            StartActionProcessing();
        }
    }

    /// <summary>
    /// Attaches <see cref="DraggableActionBlock"/> to each of the four action buttons and
    /// an <see cref="ActionQueueDropZone"/> to the action-queue panel at runtime, so
    /// drag-and-drop works without any manual Inspector setup. Idempotent.
    /// </summary>
    private void AutoWireDragAndDrop()
    {
        AttachDraggable(moveForwardButton, DraggableActionBlock.ActionKind.Forward);
        AttachDraggable(moveDownButton,    DraggableActionBlock.ActionKind.Backward);
        AttachDraggable(rotateLeftButton,  DraggableActionBlock.ActionKind.TurnLeft);
        AttachDraggable(rotateRightButton, DraggableActionBlock.ActionKind.TurnRight);

        // Decide which panel becomes the drop zone:
        //   1. If the inspector field dropZonePanel is set, use it (e.g. the yellow strip).
        //   2. Otherwise fall back to actionQueueTransform.
        // The fallback case still works but only catches drops that land on the (often
        // tightly fitted) queue itself.
        GameObject zoneGoTarget = null;
        if (dropZonePanel != null)
        {
            zoneGoTarget = dropZonePanel.gameObject;
        }
        else if (actionQueueTransform != null)
        {
            zoneGoTarget = actionQueueTransform.gameObject;
        }

        if (zoneGoTarget != null)
        {
            var zone = zoneGoTarget.GetComponent<ActionQueueDropZone>();
            if (zone == null) zone = zoneGoTarget.AddComponent<ActionQueueDropZone>();
            zone.characterMove = this;

            // UI drops only fire on active GameObjects. Make sure both the drop-zone host
            // and the inner queue stay active so the drop zone can always receive drops.
            if (!zoneGoTarget.activeSelf) zoneGoTarget.SetActive(true);
            if (actionQueueTransform != null && !actionQueueTransform.gameObject.activeSelf)
            {
                actionQueueTransform.gameObject.SetActive(true);
            }
        }
        else
        {
            Debug.LogWarning("[CharacterMove] No drop-zone target available (both dropZonePanel and actionQueueTransform are null).");
        }
    }

    private void AttachDraggable(Button button, DraggableActionBlock.ActionKind kind)
    {
        if (button == null) return;
        var draggable = button.GetComponent<DraggableActionBlock>();
        if (draggable == null) draggable = button.gameObject.AddComponent<DraggableActionBlock>();
        draggable.actionKind = kind;
        draggable.characterMove = this;
    }

    /// <summary>True when a palette block may be dragged into the yellow strip (includes action-block intro).</summary>
    public bool CanDragPaletteBlockToQueue(DraggableActionBlock.ActionKind kind)
    {
        if (isProcessing) return false;
        LevelData ld = GetCurrentLevelData();
        if (ShouldLockProgramQueue(ld)) return false;
        if (IsActionBlockIntroActive && actionBlockIntro != null)
            return actionBlockIntro.AllowsPaletteDrag() && actionBlockIntro.AllowsKind(kind);
        return IsKindInteractable(kind);
    }

    /// <summary>Finds the queue drop zone when the pointer is over the yellow strip rect (not only over a block).</summary>
    public ActionQueueDropZone FindDropZoneAtScreenPoint(Vector2 screenPosition)
    {
        Camera cam = null;
        if (dropZonePanel != null)
        {
            var canvas = dropZonePanel.GetComponentInParent<Canvas>();
            if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
                cam = canvas.worldCamera;
            var zone = dropZonePanel.GetComponent<ActionQueueDropZone>();
            if (zone != null && zone.ContainsScreenPoint(screenPosition, cam))
                return zone;
        }

        if (actionQueueTransform != null)
        {
            var canvas = actionQueueTransform.GetComponentInParent<Canvas>();
            if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
                cam = canvas.worldCamera;
            var zone = actionQueueTransform.GetComponent<ActionQueueDropZone>();
            if (zone != null && zone.ContainsScreenPoint(screenPosition, cam))
                return zone;
        }

        return null;
    }

    /// <summary>
    /// Called by <see cref="ActionQueueDropZone.OnDrop"/> when the user drags one of the action
    /// buttons (forward, backward, turn left, turn right) into the queue area. Mirrors the
    /// behaviour of the original click-to-enqueue listeners. Equivalent to
    /// <see cref="InsertActionFromDrag"/> with the index pointing to the end.
    /// </summary>
    public void EnqueueActionFromDrag(DraggableActionBlock.ActionKind kind)
    {
        if (actionQueueTransform == null)
        {
            InsertActionFromDrag(kind, 0);
        }
        else
        {
            InsertActionFromDrag(kind, actionQueueTransform.childCount);
        }
    }

    /// <summary>
    /// Inserts a user-added action block at <paramref name="uiIndex"/> in the action queue.
    /// Used by <see cref="ActionQueueDropZone.OnDrop"/> when the user drops a dragged block
    /// between existing blocks. Falls back to appending if the index is out of range.
    /// </summary>
    public void InsertActionFromDrag(DraggableActionBlock.ActionKind kind, int uiIndex)
    {
        if (!CanDragPaletteBlockToQueue(kind)) return;

        CharacterAction action;
        Sprite sprite;
        string label;
        BuildActionForKind(kind, out action, out sprite, out label);

        // Spawn the UI block at the requested sibling index.
        GameObject blockGo = Instantiate(actionImagePrefab, actionQueueTransform);
        var img = blockGo.GetComponent<Image>();
        if (img != null) img.sprite = sprite;

        int clampedIndex = Mathf.Clamp(uiIndex, 0, actionQueueTransform.childCount - 1);
        blockGo.transform.SetSiblingIndex(clampedIndex);

        var refComp = blockGo.AddComponent<QueuedActionRef>();
        refComp.action = action;
        refComp.deletable = !IsActionBlockIntroActive;
        refComp.actionLabel = label;

        if (addCloseButtonsToQueuedBlocks && refComp.deletable)
        {
            AttachCloseButton(blockGo);
        }
        if (!IsActionBlockIntroActive)
            AttachQueuedBlockDragBehaviour(blockGo);

        // Scratch-style "satisfying" drop feedback.
        PlayBlockDropBounce(blockGo.transform);

        // Rebuild the execution queue so its order matches the visual order.
        RebuildActionQueueFromUI();

        // Keep the analytics log chronological: append the user's input even though we
        // also re-derive the execution queue from UI order.
        playerActions.Add(label);
        currentAttemptActionLog.Add(new PlayerActionLogEntry { action = label, timestamp = Time.time });

        actionQueueTransform.gameObject.SetActive(true);

        if (actionBlockIntro != null && actionBlockIntro.IsActive)
            actionBlockIntro.OnBlockInserted(kind);
    }

    /// <summary>
    /// Called by the close button on a queued block. Removes the block from the
    /// execution queue immediately (so a Run pressed during the animation runs the
    /// correct shorter program) and animates the visual block shrinking + fading out
    /// while neighbour blocks slide in to fill the gap.
    /// </summary>
    public void RemoveQueuedBlock(GameObject blockGo)
    {
        if (blockGo == null) return;
        if (isProcessing) return;
        if (actionQueueTransform == null) return;

        var refComp = blockGo.GetComponent<QueuedActionRef>();
        string removedLabel = refComp != null ? refComp.actionLabel : "unknown";

        // Defensive: never remove a non-deletable block (guided pre-loaded actions).
        if (refComp != null && !refComp.deletable) return;

        // Prevent double-click on the close button while the animation plays.
        var closeBtnTf = blockGo.transform.Find("CloseButton");
        if (closeBtnTf != null)
        {
            var btn = closeBtnTf.GetComponent<Button>();
            if (btn != null) btn.interactable = false;
        }

        // Mark the block as a "placeholder" so it is skipped by RebuildActionQueueFromUI,
        // ProcessActions and CleanupInsertionPlaceholders during the shrink animation.
        if (blockGo.GetComponent<QueueInsertionPlaceholder>() == null)
        {
            blockGo.AddComponent<QueueInsertionPlaceholder>();
        }

        // Drop the block from the underlying execution queue *now* so the logical
        // state matches what the user sees (one fewer block in the program).
        RebuildActionQueueFromUI();

        string evt = "remove:" + removedLabel;
        playerActions.Add(evt);
        currentAttemptActionLog.Add(new PlayerActionLogEntry { action = evt, timestamp = Time.time });

        StartCoroutine(ShrinkAndDestroyBlock(blockGo, 0.15f));
    }

    private IEnumerator ShrinkAndDestroyBlock(GameObject blockGo, float duration)
    {
        if (blockGo == null) yield break;
        var rt = blockGo.transform as RectTransform;
        if (rt == null) { Destroy(blockGo); yield break; }

        // Use a LayoutElement so the parent LayoutGroup honours our shrinking width
        // and re-flows the neighbouring blocks each frame.
        var le = blockGo.GetComponent<LayoutElement>();
        if (le == null) le = blockGo.AddComponent<LayoutElement>();
        float startWidth = rt.rect.width;
        le.minWidth = 0f;
        le.flexibleWidth = 0f;
        le.preferredWidth = startWidth;

        var cg = blockGo.GetComponent<CanvasGroup>();
        if (cg == null) cg = blockGo.AddComponent<CanvasGroup>();
        cg.blocksRaycasts = false;
        cg.interactable = false;
        float startAlpha = cg.alpha;

        if (duration <= 0f)
        {
            Destroy(blockGo);
            yield break;
        }

        float elapsed = 0f;
        while (elapsed < duration && blockGo != null)
        {
            elapsed += Time.unscaledDeltaTime;
            float t = Mathf.Clamp01(elapsed / duration);
            float eased = 1f - Mathf.Pow(1f - t, 3f); // ease-out cubic
            float w = Mathf.Lerp(startWidth, 0f, eased);
            if (le != null) le.preferredWidth = w;
            if (rt != null) rt.sizeDelta = new Vector2(w, rt.sizeDelta.y);
            if (cg != null) cg.alpha = Mathf.Lerp(startAlpha, 0f, eased);
            yield return null;
        }
        if (blockGo != null) Destroy(blockGo);
    }

    /// <summary>
    /// Raises <see cref="UnityEngine.EventSystems.EventSystem.pixelDragThreshold"/> so a
    /// finger tap on a small button (e.g. the close X) doesn't accidentally trigger a
    /// reorder drag. Touch screens have noisier press locations than a mouse.
    /// </summary>
    private void ConfigureEventSystemForTouch()
    {
        if (touchFriendlyDragThreshold <= 0) return;
        var es = UnityEngine.EventSystems.EventSystem.current;
        if (es == null) return;
        // Never lower an existing higher threshold set by other code.
        if (es.pixelDragThreshold < touchFriendlyDragThreshold)
        {
            es.pixelDragThreshold = touchFriendlyDragThreshold;
        }
    }

    /// <summary>
    /// Called by <see cref="DraggableQueuedBlock"/> when a queued block is released
    /// OUTSIDE the drop zone (Scratch-style "drag the block off the script area to
    /// throw it away"). Logs the deletion and animates the block out from wherever
    /// the user dropped it.
    /// </summary>
    public void HandleQueuedBlockDroppedOutsideQueue(GameObject blockGo)
    {
        if (blockGo == null) return;
        if (!dragOutQueuedToDelete) return;
        if (isProcessing) return;

        var refComp = blockGo.GetComponent<QueuedActionRef>();
        if (refComp != null && !refComp.deletable) return;
        string label = refComp != null ? refComp.actionLabel : "unknown";

        // The execution queue was already updated when the block was picked up
        // (OnQueuedBlockPickedUp -> RebuildActionQueueFromUI without this block), so
        // no further rebuild is needed. Just log + animate destroy.
        string evt = "remove:" + label;
        playerActions.Add(evt);
        currentAttemptActionLog.Add(new PlayerActionLogEntry { action = evt, timestamp = Time.time });

        StartCoroutine(FadeAndShrinkAwayBlock(blockGo, 0.18f));
    }

    private IEnumerator FadeAndShrinkAwayBlock(GameObject blockGo, float duration)
    {
        if (blockGo == null) yield break;
        var cg = blockGo.GetComponent<CanvasGroup>();
        if (cg == null) cg = blockGo.AddComponent<CanvasGroup>();
        cg.blocksRaycasts = false;
        cg.interactable = false;
        float startAlpha = cg.alpha;
        Vector3 startScale = blockGo.transform.localScale;

        if (duration <= 0f) { Destroy(blockGo); yield break; }

        float elapsed = 0f;
        while (elapsed < duration && blockGo != null)
        {
            elapsed += Time.unscaledDeltaTime;
            float t = Mathf.Clamp01(elapsed / duration);
            float eased = 1f - Mathf.Pow(1f - t, 3f);
            blockGo.transform.localScale = Vector3.Lerp(startScale, Vector3.zero, eased);
            if (cg != null) cg.alpha = Mathf.Lerp(startAlpha, 0f, eased);
            yield return null;
        }
        if (blockGo != null) Destroy(blockGo);
    }

    /// <summary>
    /// Plays a small scale-pop on a block that just landed in the queue (after an
    /// insert from a source button OR a reorder drop). Visual acknowledgement that
    /// the drop registered. No-op if <see cref="enableDropBounce"/> is false.
    /// </summary>
    public void PlayBlockDropBounce(Transform t)
    {
        if (t == null) return;
        if (!enableDropBounce) return;
        if (dropBounceDuration <= 0f || dropBounceAmount <= 0f) return;
        StartCoroutine(BlockDropBounceCoroutine(t, dropBounceAmount, dropBounceDuration));
    }

    private IEnumerator BlockDropBounceCoroutine(Transform t, float amount, float duration)
    {
        if (t == null) yield break;
        Vector3 baseScale = t.localScale;
        float elapsed = 0f;
        while (elapsed < duration && t != null)
        {
            elapsed += Time.unscaledDeltaTime;
            float p = Mathf.Clamp01(elapsed / duration);
            // A half-sine pulse: 0 -> 1 -> 0.
            float bump = Mathf.Sin(p * Mathf.PI) * amount;
            t.localScale = baseScale * (1f + bump);
            yield return null;
        }
        if (t != null) t.localScale = baseScale;
    }

    /// <summary>
    /// True while a Run is in progress. <see cref="DraggableQueuedBlock"/> reads this to
    /// prevent the user from reordering blocks while the robot is executing the program.
    /// </summary>
    public bool IsActionQueueLocked()
    {
        return isProcessing;
    }

    /// <summary>
    /// Called by <see cref="DraggableQueuedBlock.OnBeginDrag"/> right after the block
    /// is reparented away from the queue. Rebuilds the execution queue so that
    /// pressing Run mid-drag does not execute the picked-up block.
    /// </summary>
    public void OnQueuedBlockPickedUp()
    {
        if (isProcessing) return;
        RebuildActionQueueFromUI();
    }

    /// <summary>
    /// Called by <see cref="DraggableQueuedBlock.AcceptReorderedDrop"/> after the user
    /// drops a queued block at a new index in the queue. Rebuilds the execution queue
    /// from the new UI order and records a "reorder" entry in the analytics log.
    /// </summary>
    public void OnQueuedBlockReordered()
    {
        if (isProcessing) return;
        RebuildActionQueueFromUI();
        playerActions.Add("reorder");
        currentAttemptActionLog.Add(new PlayerActionLogEntry { action = "reorder", timestamp = Time.time });
    }

    /// <summary>
    /// Adds the <see cref="DraggableQueuedBlock"/> component to a user-added block so it
    /// can be picked up and dragged to a new position within the queue.
    /// </summary>
    private void AttachQueuedBlockDragBehaviour(GameObject blockGo)
    {
        if (blockGo == null) return;
        if (!allowReorderQueuedBlocks) return;
        var drag = blockGo.GetComponent<DraggableQueuedBlock>();
        if (drag == null) drag = blockGo.AddComponent<DraggableQueuedBlock>();
        drag.characterMove = this;
    }

    /// <summary>
    /// Re-derives <see cref="actionQueue"/> from the current UI order so insert/delete
    /// operations stay consistent with the executed sequence. Each block in the UI must
    /// carry a <see cref="QueuedActionRef"/> (added automatically by EnqueueAction).
    /// Transient drag placeholders (<see cref="QueueInsertionPlaceholder"/>) are skipped.
    /// </summary>
    private void RebuildActionQueueFromUI()
    {
        if (actionQueueTransform == null) return;
        actionQueue.Clear();
        for (int i = 0; i < actionQueueTransform.childCount; i++)
        {
            var child = actionQueueTransform.GetChild(i);
            if (child.GetComponent<QueueInsertionPlaceholder>() != null) continue;
            var refComp = child.GetComponent<QueuedActionRef>();
            actionQueue.Enqueue(refComp != null ? refComp.action : null);
        }
    }

    /// <summary>
    /// Removes any transient drop-zone placeholders from the action queue parent.
    /// Called at the start of a Run so the placeholder cannot get confused with a real
    /// block (the user may have clicked Run mid-animation).
    /// </summary>
    private void CleanupInsertionPlaceholders()
    {
        if (actionQueueTransform == null) return;
        for (int i = actionQueueTransform.childCount - 1; i >= 0; i--)
        {
            var child = actionQueueTransform.GetChild(i);
            if (child.GetComponent<QueueInsertionPlaceholder>() != null)
            {
                child.SetParent(null, false);
                Destroy(child.gameObject);
            }
        }
    }

    /// <summary>
    /// Destroys the first child of the action queue UI that is NOT a transient
    /// <see cref="QueueInsertionPlaceholder"/>. Used by <see cref="ProcessActions"/> so
    /// a placeholder lingering during a shrink-out animation can never be mistaken for
    /// the next executed block.
    /// </summary>
    private void DestroyFirstNonPlaceholderQueueChild()
    {
        if (actionQueueTransform == null) return;
        for (int i = 0; i < actionQueueTransform.childCount; i++)
        {
            var child = actionQueueTransform.GetChild(i);
            if (child.GetComponent<QueueInsertionPlaceholder>() != null) continue;
            Destroy(child.gameObject);
            return;
        }
        Debug.LogWarning("[ProcessActions] Tried to destroy child from empty actionQueueTransform.");
    }

    /// <summary>
    /// Tints the first non-placeholder block in the queue with
    /// <see cref="executingBlockHighlightColor"/>. Used by <see cref="ProcessActions"/>
    /// so the kid can see which block of the program is currently firing.
    /// </summary>
    private void HighlightFirstNonPlaceholderQueueChild()
    {
        if (!highlightExecutingBlock) return;
        if (actionQueueTransform == null) return;
        for (int i = 0; i < actionQueueTransform.childCount; i++)
        {
            var child = actionQueueTransform.GetChild(i);
            if (child.GetComponent<QueueInsertionPlaceholder>() != null) continue;
            var img = child.GetComponent<Image>();
            if (img != null) img.color = executingBlockHighlightColor;
            return;
        }
    }

    private bool IsKindInteractable(DraggableActionBlock.ActionKind kind)
    {
        if (IsActionBlockIntroActive && actionBlockIntro != null && !actionBlockIntro.AllowsKind(kind))
            return false;

        switch (kind)
        {
            case DraggableActionBlock.ActionKind.Forward:   return moveForwardButton == null || moveForwardButton.interactable;
            case DraggableActionBlock.ActionKind.Backward:  return moveDownButton    == null || moveDownButton.interactable;
            case DraggableActionBlock.ActionKind.TurnLeft:  return rotateLeftButton  == null || rotateLeftButton.interactable;
            case DraggableActionBlock.ActionKind.TurnRight: return rotateRightButton == null || rotateRightButton.interactable;
        }
        return true;
    }

    private void BuildActionForKind(DraggableActionBlock.ActionKind kind, out CharacterAction action, out Sprite sprite, out string label)
    {
        switch (kind)
        {
            case DraggableActionBlock.ActionKind.Forward:
                action = new MoveAction(Vector3.forward);
                sprite = forwardSprite;
                label = "forward";
                return;
            case DraggableActionBlock.ActionKind.Backward:
                action = new MoveAction(-Vector3.forward);
                sprite = backwardSprite;
                label = "backward";
                return;
            case DraggableActionBlock.ActionKind.TurnLeft:
                action = new RotateAction(-rotationAngle);
                sprite = rotateLeftSprite;
                label = "left";
                return;
            case DraggableActionBlock.ActionKind.TurnRight:
            default:
                action = new RotateAction(rotationAngle);
                sprite = rotateRightSprite;
                label = "right";
                return;
        }
    }

    /// <summary>
    /// Adds a close button to an action-queue block. The button is anchored to the
    /// block's top-right corner and removes the block when clicked.
    /// - If closeButtonSprite is assigned the sprite IS the button (no extra glyph drawn).
    /// - Otherwise a red square background + a programmatic white "X" is drawn (font-free).
    /// A LayoutElement with ignoreLayout=true is added so that even if the action-block
    /// prefab has its own LayoutGroup the close button keeps the size specified by
    /// closeButtonSize and never gets squashed.
    /// </summary>
    private void AttachCloseButton(GameObject blockGo)
    {
        if (blockGo == null) return;
        // Avoid duplicates if EnqueueAction is called twice on the same block.
        if (blockGo.transform.Find("CloseButton") != null) return;

        var btnGo = new GameObject("CloseButton", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
        btnGo.transform.SetParent(blockGo.transform, false);
        btnGo.transform.SetAsLastSibling(); // draw on top of the block icon
        var rt = (RectTransform)btnGo.transform;
        rt.anchorMin = new Vector2(1f, 1f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.pivot     = new Vector2(1f, 1f);
        rt.sizeDelta = new Vector2(closeButtonSize, closeButtonSize);
        // anchoredPosition with pivot (1,1) at anchor (1,1):
        //   (0,0)            => button top-right corner sits exactly on block top-right corner (fully inside).
        //   (+x,+y) with overhang=true => button sticks OUT past block by (x,y).
        //   (-x,-y) with overhang=false => button is inset (x,y) px inside the block.
        Vector2 anchored = closeButtonOverhang
            ? new Vector2(Mathf.Abs(closeButtonOffset.x), Mathf.Abs(closeButtonOffset.y))
            : new Vector2(-Mathf.Abs(closeButtonOffset.x), -Mathf.Abs(closeButtonOffset.y));
        rt.anchoredPosition = anchored;

        // Force the button's size regardless of any LayoutGroup the prefab might add.
        var le = btnGo.GetComponent<LayoutElement>();
        le.ignoreLayout = true;

        var bgImg = btnGo.GetComponent<Image>();
        bgImg.raycastTarget = true;
        bgImg.preserveAspect = false;
        bgImg.type = Image.Type.Simple;

        if (closeButtonSprite != null)
        {
            // Treat user-provided sprite as a fully-drawn close icon.
            bgImg.sprite = closeButtonSprite;
            bgImg.color = Color.white;
        }
        else
        {
            bgImg.sprite = null;
            bgImg.color = closeButtonColor;
            // Two diagonal lines forming an X glyph (no font dependency).
            AddCloseGlyphLine(btnGo.transform,  45f);
            AddCloseGlyphLine(btnGo.transform, -45f);
        }

        var button = btnGo.GetComponent<Button>();
        var capturedBlock = blockGo;
        button.onClick.AddListener(() => RemoveQueuedBlock(capturedBlock));
    }

    private void AddCloseGlyphLine(Transform parent, float zRotationDegrees)
    {
        var line = new GameObject("XLine", typeof(RectTransform), typeof(Image));
        line.transform.SetParent(parent, false);
        var rt = (RectTransform)line.transform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(closeButtonSize * 0.65f, Mathf.Max(2f, closeButtonSize * 0.12f));
        rt.localRotation = Quaternion.Euler(0f, 0f, zRotationDegrees);
        var img = line.GetComponent<Image>();
        img.color = closeButtonGlyphColor;
        img.raycastTarget = false;
    }

    private void EnqueueAction(CharacterAction action, Sprite actionSprite)
    {
        EnqueueAction(action, actionSprite, false);
    }

    /// <summary>
    /// Adds an action to the end of the queue and instantiates the matching UI block.
    /// When <paramref name="deletable"/> is true (and addCloseButtonsToQueuedBlocks is on)
    /// the block gets a small close button so the user can remove it before pressing Run.
    /// </summary>
    private void EnqueueAction(CharacterAction action, Sprite actionSprite, bool deletable)
    {
        actionQueue.Enqueue(action);

        currentAttemptActionLog.Add(new PlayerActionLogEntry { action = GetActionLogString(action), timestamp = Time.time });

        GameObject actionImageInstance = Instantiate(actionImagePrefab, actionQueueTransform);
        var img = actionImageInstance.GetComponent<Image>();
        if (img != null) img.sprite = actionSprite;

        var refComp = actionImageInstance.AddComponent<QueuedActionRef>();
        refComp.action = action;
        refComp.deletable = deletable;
        refComp.actionLabel = GetActionLogString(action);

        if (deletable && addCloseButtonsToQueuedBlocks)
        {
            AttachCloseButton(actionImageInstance);
        }
        if (deletable)
        {
            AttachQueuedBlockDragBehaviour(actionImageInstance);
        }

        actionQueueTransform.gameObject.SetActive(true);
    }

    private void StartActionProcessing()
    {
        StartCoroutine(StartActionProcessingRoutine());
    }

    private IEnumerator StartActionProcessingRoutine()
    {
        LevelData runLevel = GetCurrentLevelData();
        if (IsRunBlockedByFlagRequirement())
        {
            if (chatGPTResponseText != null)
                chatGPTResponseText.text = "Place the flag on a cell first — that cell is your goal.";
            Debug.Log("[CharacterMove] RUN blocked: flag not placed yet (flag-placement level only).");
            yield break;
        }

        if (IsActionBlockIntroActive && actionBlockIntro != null && !actionBlockIntro.CanStartRun())
            yield break;

        if (IsActionBlockIntroActive && actionBlockIntro != null)
            actionBlockIntro.NotifyRunStarted();

        var client = GameAssessmentClient.Instance;
        if (client != null)
            yield return client.WaitForPendingReports();

        StopFadingAndResetSpriteColor();
        CleanupInsertionPlaceholders();

        if (runLevel != null && runLevel.showCommandHistory)
            EnsureCommandHistoryAttemptRow(GetCommandHistoryDisplayAttempt());

        _activeInLevelRunNumber = currentAttempt + 1;
        _runAttemptStartTime = Time.time;
        _currentRunReportedToPlatform = false;
        _lastMoveBlocked = false;
        EnsurePlatformRunAttemptStarted();

        if (client != null)
            yield return client.WaitForAttemptReady(GetPlatformLevelKey(currentLevel));

        RecordTelemetryBeforeRun();

        ResetRobotToLevelStart();

        attemptStartGridPos = robotGridPosition;
        attemptStartFacing = facingDirection;
        movesUsedInCurrentAttempt = 0;
        Debug.Log($"[StartActionProcessing] Recording attempt start: pos={attemptStartGridPos}, facing={attemptStartFacing}, movesUsed=0, currentAttempt={currentAttempt}");
        if (!isProcessing && actionQueue.Count > 0)
        {
            isProcessing = true;
            if (runLevel != null && !runLevel.runRobotOnSubmit)
            {
                if (chatGPTResponseText != null)
                    chatGPTResponseText.text = "Checking your answer…";
                currentMoveCoroutine = StartCoroutine(ProcessActionsWithoutRobotAnimation());
            }
            else
            {
                currentMoveCoroutine = StartCoroutine(ProcessActions());
            }
        }
    }

    /// <summary>
    /// Lets <see cref="MultiTargetCamera"/> switch to follow / run-friendly framing while
    /// the robot executes the queued blocks (UI highlights pair with motion on screen).
    /// </summary>
    private void NotifyCameraRunPresentation(bool active)
    {
        if (multiTargetCamera != null)
            multiTargetCamera.SetRunPresentationActive(active);
    }

    /// <summary>Increments attempt counter and shows try-again or max-attempts popup. Returns true when max attempts reached.</summary>
    private string ResolvePopupMessage(string template, LevelData levelData, string failureReason = null)
    {
        if (template == null) return null;
        return template
            .Replace("{levelName}", levelData?.levelName ?? "")
            .Replace("{maxAttempts}", (levelData?.maxAttempts ?? 3).ToString())
            .Replace("{attempt}", currentAttempt.ToString())
            .Replace("{reason}", failureReason ?? "");
    }

    /// <summary>Dashboard popup text: empty string when unset; no built-in fallback text.</summary>
    private string GetConfiguredPopupText(string template, LevelData levelData, string failureReason = null)
    {
        if (template == null) return "";
        return ResolvePopupMessage(template, levelData, failureReason) ?? "";
    }

    private void ApplyStudentResetButton(LevelData levelData)
    {
        if (studentResetButton == null) return;
        bool show = levelData == null || levelData.showStudentResetButton;
        studentResetButton.gameObject.SetActive(show);
    }

    /// <summary>Disable Reset while success/fail popups are open; respect dashboard visibility.</summary>
    private void RefreshStudentResetButtonState()
    {
        if (studentResetButton == null) return;

        LevelData levelData = GetCurrentLevelData();
        if (levelData != null && !levelData.showStudentResetButton)
        {
            studentResetButton.gameObject.SetActive(false);
            return;
        }

        studentResetButton.gameObject.SetActive(true);
        bool popupOpen =
            (successPopup != null && successPopup.activeSelf) ||
            (wrongAnswerPopup != null && wrongAnswerPopup.activeSelf);
        studentResetButton.interactable = !popupOpen && !isProcessing;
    }

    /// <summary>Student-facing reset: stop RUN if active, clear program strip, robot to start (same attempt).</summary>
    public void StudentResetLevel()
    {
        LevelData levelData = GetCurrentLevelData();
        if (levelData == null) return;

        if (isProcessing)
        {
            if (currentMoveCoroutine != null)
            {
                StopCoroutine(currentMoveCoroutine);
                currentMoveCoroutine = null;
            }
            isProcessing = false;
            NotifyCameraRunPresentation(false);
            if (animator != null)
                animator.SetBool("isWalking", false);
            CleanupInsertionPlaceholders();
            StopFadingAndResetSpriteColor();
        }

        if (wrongAnswerPopup != null)
            wrongAnswerPopup.SetActive(false);

        ClearCommandHistoryStripUI();
        ResetCurrentLevel();
        SnapRobotToLogicalGridCell();
        RefreshLevelCornerHint();

        if (GameAssessmentClient.Instance != null)
            GameAssessmentClient.Instance.RecordStudentReset();

        RefreshStudentResetButtonState();
        Debug.Log("[CharacterMove] Student reset: program cleared, robot at level start.");
    }

    private void ClearCommandHistoryStripUI()
    {
        if (actionHistoryTransform == null) return;
        _commandHistoryActiveRow = null;
        _commandHistoryActiveAttempt = -1;
        for (int i = actionHistoryTransform.childCount - 1; i >= 0; i--)
            Destroy(actionHistoryTransform.GetChild(i).gameObject);
    }

    private IEnumerator AdvanceAfterPendingReports()
    {
        if (GameAssessmentClient.Instance != null)
            yield return GameAssessmentClient.Instance.WaitForPendingReports();
        AdvanceToNextLevel();
    }

    private bool HandleRunFailure(LevelData levelData, string failureReason = null)
    {
        if (levelData == null) return false;

        currentAttempt++;
        Debug.Log($"[CharacterMove] Run failed: attempt {currentAttempt} of {levelData.maxAttempts}");

        ReportCurrentRunToPlatform(false);

        if (currentAttempt >= levelData.maxAttempts)
        {
            pendingLevelPassed = false;
            _skipNextPlatformReport = true;
            if (successPopup != null && successPopupText != null)
            {
                successPopupText.text = GetConfiguredPopupText(levelData.maxAttemptsMessage, levelData, failureReason);
                successPopup.SetActive(true);
                GameInteractionSounds.PlayFailPopup();
            }
            else
            {
                StartCoroutine(AdvanceAfterPendingReports());
            }
            if (runButton != null) runButton.interactable = false;
            RefreshStudentResetButtonState();
            return true;
        }

        if (wrongAnswerPopup != null)
        {
            wrongAnswerPopup.SetActive(true);
            GameInteractionSounds.PlayFailPopup();
            var popupText = wrongAnswerPopup.GetComponentInChildren<TextMeshProUGUI>();
            if (popupText != null)
                popupText.text = GetConfiguredPopupText(levelData.attemptFailureMessage, levelData, failureReason);
        }
        if (runButton != null) runButton.interactable = false;
        RefreshStudentResetButtonState();
        return false;
    }

    private static bool UsesVisitObjectSequence(LevelData levelData) =>
        levelData != null && levelData.visitObjectSequence;

    private static bool UsesGuidedBlankFlow(LevelData levelData) =>
        levelData?.guidedActions != null && levelData.guidedActions.Contains("blank");

    private Vector2Int ResolveEndGoalCell(LevelData levelData)
    {
        if (levelData == null) return new Vector2Int(-1, -1);
        if (IsFlagPlacementActive && IsFlagPlaced) return flagCell;
        if (endObjectPosition != Vector2Int.zero) return endObjectPosition;
        if (designatedEndObjectCell.x >= 0) return designatedEndObjectCell;
        if (levelData.gridObjects != null)
        {
            foreach (var go in levelData.gridObjects)
            {
                if (go.isEndObject) return go.position;
            }
        }
        if (levelData.goalCell.x >= 0 && levelData.goalCell.y >= 0) return levelData.goalCell;
        return new Vector2Int(-1, -1);
    }

    private bool RobotIsOnVisitEndCell() => RobotIsOnGoalCell(endObjectPosition);

    private bool VisitSequenceEndReached(LevelData levelData) =>
        RobotIsOnVisitEndCell() || visitedEndObjectThisLevel;

    private Vector2Int ComputeSimulatedProgramEndCell(LevelData levelData)
    {
        if (levelData == null) return new Vector2Int(-1, -1);

        Vector2Int pos = levelData.robotStartPosition;
        Vector2Int facing = levelData.robotStartFacing;
        // RUN records the attempt start immediately before simulating.
        pos = attemptStartGridPos;
        facing = attemptStartFacing;
        int moveCount = 0;
        int blankIdx = 0;

        IEnumerable<CharacterAction> steps = actionQueue != null && actionQueue.Count > 0
            ? actionQueue.ToArray()
            : null;

        if (steps != null)
        {
            foreach (var action in steps)
            {
                string cmd = ResolveQueuedCommand(action, ref blankIdx);
                if (string.IsNullOrEmpty(cmd)) continue;
                SimulateOneCommandOnGrid(levelData, ref pos, ref facing, cmd, ref moveCount);
            }
            return pos;
        }

        if (levelData.guidedActions != null)
        {
            foreach (var raw in levelData.guidedActions)
            {
                string label = NormalizeActionLabel(raw);
                if (label == "blank")
                {
                    if (userBlankChoices != null && blankIdx < userBlankChoices.Count)
                    {
                        string choice = userBlankChoices[blankIdx++];
                        if (!string.IsNullOrEmpty(choice))
                            SimulateOneCommandOnGrid(levelData, ref pos, ref facing, choice, ref moveCount);
                    }
                    continue;
                }
                if (string.IsNullOrEmpty(label)) continue;
                SimulateOneCommandOnGrid(levelData, ref pos, ref facing, label, ref moveCount);
            }
        }

        return pos;
    }

    private bool IsFlagPredictionCorrect(LevelData levelData)
    {
        if (levelData == null || !levelData.useFlagPlacement) return true;
        if (!IsFlagPlaced) return false;

        // After RUN (simulation or animation) the robot should be on the predicted cell.
        if (robotGridPosition == flagCell) return true;

        Vector2Int expectedEnd = ComputeSimulatedProgramEndCell(levelData);
        if (expectedEnd.x >= 0 && expectedEnd.y >= 0 && flagCell == expectedEnd)
            return true;

        Vector3 robotWorld = transform.position;
        Vector3 flagWorld = GridCellToWorld(flagCell);
        return Vector3.Distance(robotWorld, flagWorld) < gridSize * 0.55f;
    }

    private string ResolveQueuedCommand(CharacterAction action, ref int blankIdx)
    {
        if (action != null) return GetActionLogString(action);
        if (userBlankChoices == null || blankIdx >= userBlankChoices.Count) return null;
        return userBlankChoices[blankIdx++];
    }

    private void SimulateOneCommandOnGrid(LevelData levelData, ref Vector2Int pos, ref Vector2Int facing, string command, ref int moveCount)
    {
        if (string.IsNullOrWhiteSpace(command)) return;
        string cmd = command.Trim().ToLowerInvariant();

        if (cmd == "turn left")
        {
            facing = new Vector2Int(-facing.y, facing.x);
            return;
        }
        if (cmd == "turn right")
        {
            facing = new Vector2Int(facing.y, -facing.x);
            return;
        }
        if (cmd != "forward" && cmd != "backward") return;

        if (UsesNumberLine(levelData) && facing.y != 0 && facing.x == 0)
            return;

        Vector2Int delta = cmd == "forward" ? facing : new Vector2Int(-facing.x, -facing.y);
        Vector2Int candidate = pos + delta;
        if (UsesNumberLine(levelData))
            candidate.y = levelData.robotStartPosition.y;

        Vector2Int savedPos = robotGridPosition;
        robotGridPosition = pos;
        bool canEnter = CanRobotEnterCell(candidate);
        robotGridPosition = savedPos;

        moveCount++;

        if (!canEnter) return;

        if (UsesNumberLine(levelData))
        {
            int ticks = levelData.numberLine != null && levelData.numberLine.tickCount > 0
                ? Mathf.Clamp(levelData.numberLine.tickCount, 3, 20)
                : gridCols;
            if (candidate.x < 0 || candidate.x >= ticks) return;
        }
        else if (!CellInGridBounds(candidate))
        {
            return;
        }

        pos = candidate;
    }

    private Queue<CharacterAction> SimulateQueuedActionsWithoutAnimation(LevelData levelData)
    {
        var executed = new Queue<CharacterAction>();
        int blankIdx = 0;
        movesUsedInCurrentAttempt = 0;
        hasReachedStartObject = false;
        hasReachedEndObject = false;
        visitedStartObjectThisLevel = false;
        visitedEndObjectThisLevel = false;

        robotGridPosition = attemptStartGridPos;
        facingDirection = attemptStartFacing;

        foreach (var action in actionQueue.ToArray())
        {
            executed.Enqueue(action);
            string cmd = ResolveQueuedCommand(action, ref blankIdx);
            if (string.IsNullOrEmpty(cmd)) continue;

            Vector2Int prev = robotGridPosition;
            SimulateOneCommandOnGrid(levelData, ref robotGridPosition, ref facingDirection, cmd, ref movesUsedInCurrentAttempt);
            if (hiddenMatrix != null)
                OnRobotMovedInMatrix(prev, robotGridPosition);
            SyncStartObjectReachedState();
            CheckGridObjectInteractions();
        }

        return executed;
    }

    private bool RobotReachedEndAfterRun(LevelData levelData)
    {
        if (UsesNumberLine(levelData))
        {
            Vector2Int goal = ResolveEndGoalCell(levelData);
            bool atGoalTick = goal.x >= 0 && robotGridPosition.x == goal.x;
            bool startOk = hasReachedStartObject || visitedStartObjectThisLevel ||
                           startObjectPosition.x < 0;
            if (UsesVisitObjectSequence(levelData))
                return atGoalTick && startOk;
            return atGoalTick && (startOk || startObjectPosition == Vector2Int.zero);
        }

        if (UsesVisitObjectSequence(levelData))
            return VisitSequenceEndReached(levelData);

        if (hasReachedStartObject || startObjectPosition == Vector2Int.zero)
        {
            if (IsFlagPlacementActive && IsFlagPlaced)
                return RobotIsOnEndGoalCell();
            return RobotIsOnVisitEndCell() || RobotIsOnEndGoalCell();
        }

        return false;
    }

    private void FinishInstantRunQueueUI(Queue<CharacterAction> executedActions)
    {
        AddToActionHistoryUI(executedActions);
        actionQueue.Clear();
        if (!useDragAndDropForActions && actionQueueTransform != null)
            actionQueueTransform.gameObject.SetActive(false);
    }

    private IEnumerator ProcessActionsWithoutRobotAnimation()
    {
        try
        {
            LevelData levelData = GetCurrentLevelData();
            Queue<CharacterAction> executedActions = SimulateQueuedActionsWithoutAnimation(levelData);

            if (IsActionBlockIntroActive && actionBlockIntro != null)
            {
                FinishInstantRunQueueUI(executedActions);
                isProcessing = false;
                ResetRobotToLevelStart();
                SnapRobotToLogicalGridCell();
                actionBlockIntro.OnIntroRunFinished();
                yield break;
            }

            if (UsesGuidedBlankFlow(levelData) && !IsBlankAnswerCorrect())
            {
                FinishInstantRunQueueUI(executedActions);
                isProcessing = false;
                HandleRunFailure(levelData, null);
                ResetRobotToLevelStart();
                SnapRobotToLogicalGridCell();
                yield break;
            }

            if (levelData != null && levelData.useFlagPlacement && IsFlagPlaced)
            {
                bool flagCorrect = IsFlagPredictionCorrect(levelData);
                FinishInstantRunQueueUI(executedActions);
                isProcessing = false;

                if (flagCorrect)
                {
                    hasReachedEndObject = true;
                    visitedEndObjectThisLevel = true;
                    pendingLevelPassed = true;
                    HideEndObjectAtCurrentPosition();
                    ResetRobotToLevelStart();
                    SnapRobotToLogicalGridCell();
                    StartCoroutine(CompleteLevelSuccessfully());
                    yield break;
                }

                Debug.Log($"[CharacterMove] Flag prediction wrong: flag={flagCell}, robotAfterRun={robotGridPosition}, expected={ComputeSimulatedProgramEndCell(levelData)}");
                HandleRunFailure(levelData, null);
                ResetRobotToLevelStart();
                SnapRobotToLogicalGridCell();
                yield break;
            }

            FinishInstantRunQueueUI(executedActions);
            isProcessing = false;

            bool robotReachedEndObject = RobotReachedEndAfterRun(levelData);

            if (robotReachedEndObject)
            {
                bool correctMovesUsed = CheckIfCorrectMovesUsed(levelData);
                bool objectsInCorrectPositions = CheckIfObjectsInCorrectGuidedPositions();
                if (UsesNumberLine(levelData))
                    objectsInCorrectPositions = true;
                bool flagPredictionOk = IsFlagPredictionCorrect(levelData);

                if (correctMovesUsed && objectsInCorrectPositions && flagPredictionOk)
                {
                    hasReachedEndObject = true;
                    visitedEndObjectThisLevel = true;
                    pendingLevelPassed = true;
                    HideEndObjectAtCurrentPosition();
                    ResetRobotToLevelStart();
                    SnapRobotToLogicalGridCell();
                    StartCoroutine(CompleteLevelSuccessfully());
                    yield break;
                }

                HandleRunFailure(levelData, null);
                ResetRobotToLevelStart();
                SnapRobotToLogicalGridCell();
                yield break;
            }

            HandleRunFailure(levelData, null);
            ResetRobotToLevelStart();
            SnapRobotToLogicalGridCell();
        }
        finally
        {
            isProcessing = false;
        }
    }

    private IEnumerator ProcessActions()
    {
        NotifyCameraRunPresentation(true);
        try
        {
        int actionsInThisRun = actionQueue.Count; 
        Queue<CharacterAction> successfullyExecutedActions = new Queue<CharacterAction>();
        LevelData levelData = GetCurrentLevelData();
        isProcessing = true;
        while (actionQueue.Count > 0)
        {
            var action = actionQueue.Dequeue();
            HighlightFirstNonPlaceholderQueueChild();
            if (action != null)
                yield return action.Execute(this);
            if (_lastMoveBlocked)
            {
                _lastMoveBlocked = false;
                isProcessing = false;
                HandleRunFailure(levelData, "Blocked by obstacle");
                yield break;
            }
            successfullyExecutedActions.Enqueue(action);
            DestroyFirstNonPlaceholderQueueChild();

        }
        isProcessing = false;
        // Keep the queue panel active in drag-and-drop mode so it can still receive drops
        // when empty. Otherwise restore the original "hide when empty" behaviour.
        if (!useDragAndDropForActions)
        {
            actionQueueTransform.gameObject.SetActive(false);
        }
        AddToActionHistoryUI(successfullyExecutedActions);
        actionQueue.Clear();

        if (IsActionBlockIntroActive && actionBlockIntro != null)
        {
            actionBlockIntro.OnIntroRunFinished();
            yield break;
        }

        // Check for wrong blank answer after all actions
        levelData = GetCurrentLevelData();
        if (levelData != null && levelData.guidedActions != null && levelData.guidedActions.Contains("blank"))
        {
            if (!IsBlankAnswerCorrect())
            {
                HandleRunFailure(levelData, null);
                yield break;
            }
        }

        if (levelData != null && levelData.useFlagPlacement && IsFlagPlaced)
        {
            if (IsFlagPredictionCorrect(levelData))
            {
                hasReachedEndObject = true;
                pendingLevelPassed = true;
                HideEndObjectAtCurrentPosition();
                StartCoroutine(CompleteLevelSuccessfully());
                yield break;
            }

            HandleRunFailure(levelData, null);
            yield break;
        }

        ApplyVisitSequenceFlagsFromRunReplay(levelData, successfullyExecutedActions);
        bool robotReachedEndObject = RobotReachedEndAfterRun(levelData);

        if (robotReachedEndObject)
        {
            bool correctMovesUsed = CheckIfCorrectMovesUsed(levelData);
            bool objectsInCorrectPositions = CheckIfObjectsInCorrectGuidedPositions();
            if (UsesNumberLine(levelData))
                objectsInCorrectPositions = true;
            bool flagPredictionOk = IsFlagPredictionCorrect(levelData);

            if (correctMovesUsed && objectsInCorrectPositions && flagPredictionOk)
            {
                hasReachedEndObject = true;
                visitedEndObjectThisLevel = true;
                pendingLevelPassed = true;
                Debug.Log($"[ProcessActions] Robot completed level successfully with correct moves ({movesUsedInCurrentAttempt}) and objects in correct positions");

                HideEndObjectAtCurrentPosition();
                StartCoroutine(CompleteLevelSuccessfully());
                yield break;
            }

            HandleRunFailure(levelData, null);
            yield break;
        }

        Debug.Log($"[ProcessActions] Robot did not reach end object. attempt={currentAttempt} max={levelData.maxAttempts}");
        HandleRunFailure(levelData, null);
        yield break; 
        }
        finally
        {
            NotifyCameraRunPresentation(false);
        }
    }



    private void AddToActionHistoryUI(Queue<CharacterAction> executedActions)
    {
        LevelData ld = GetCurrentLevelData();
        if (ld == null || !ld.showCommandHistory || actionHistoryTransform == null || actionImagePrefab == null)
            return;

        int attemptNum = GetCommandHistoryDisplayAttempt();
        Transform row = EnsureCommandHistoryAttemptRow(attemptNum);
        if (row == null) return;

        foreach (var action in executedActions)
        {
            actionHistory.Enqueue(action);
            actionHistoryList.Add(action);

            GameObject historyImageInstance = Instantiate(actionImagePrefab, row);
            var img = historyImageInstance.GetComponent<Image>();
            if (img != null)
            {
                img.sprite = GetSpriteForAction(action);
                img.preserveAspect = true;
                img.raycastTarget = false;
            }
            StyleCommandHistoryIcon(historyImageInstance);

            PersistCommandHistoryEntry(GetActionLogString(action), "submitted", attemptNum);
        }
    }

    public IEnumerator RotateCoroutine(float angle)
    {
        // Force the angle to be exactly 90 or -90 degrees to prevent inspector issues
        float targetAngle = angle > 0 ? 90f : -90f;
        
        Quaternion startRotation = transform.rotation;
        Quaternion endRotation = startRotation * Quaternion.Euler(0, targetAngle, 0);
        
        Debug.Log($"[CharacterMove] Starting rotation: {targetAngle} degrees (requested: {angle})");
        Debug.Log($"[CharacterMove] From {startRotation.eulerAngles.y:F1} to {endRotation.eulerAngles.y:F1}");
        
        // Temporarily disable animator if it might interfere
        bool animatorWasEnabled = false;
        if (animator != null)
        {
            animatorWasEnabled = animator.enabled;
            animator.enabled = false;
        }
        
        float elapsedTime = 0;
        float rotationDuration = 0.8f; // Slightly longer for smoother animation
        
        // Smoothly rotate over time using Slerp for better rotation interpolation
        while (elapsedTime < rotationDuration)
        {
            float rotationProgress = elapsedTime / rotationDuration;
            // Use a smooth curve for more natural rotation
            float smoothProgress = Mathf.SmoothStep(0f, 1f, rotationProgress);
            Quaternion currentRotation = Quaternion.Slerp(startRotation, endRotation, smoothProgress);
            transform.rotation = currentRotation;
            
            elapsedTime += Time.deltaTime;
            yield return null;
        }
        
        // Ensure final rotation is exact
        transform.rotation = endRotation;
        
        // Re-enable animator
        if (animator != null)
        {
            animator.enabled = animatorWasEnabled;
        }

        // Update facingDirection based on the actual target angle
        Vector2Int oldFacing = facingDirection;
        if (targetAngle > 0) // Turn right (90 degrees)
        {
            facingDirection = new Vector2Int(facingDirection.y, -facingDirection.x);
        }
        else // Turn left (-90 degrees)
        {
            facingDirection = new Vector2Int(-facingDirection.y, facingDirection.x);
        }
        
        Debug.Log($"[CharacterMove] Rotation complete: {targetAngle} degrees. Final rotation: {transform.rotation.eulerAngles.y:F1}");
        Debug.Log($"[CharacterMove] Facing direction changed from {oldFacing} to {facingDirection}");

        SnapRobotToLogicalGridCell();
    }

    public IEnumerator MoveCoroutine(Vector3 direction)
    {
        _lastMoveBlocked = false;
        Vector2Int candidateCell = robotGridPosition;
        bool isLinearMove = direction == Vector3.forward || direction == -Vector3.forward;
        if (isLinearMove)
        {
            if (direction == Vector3.forward)
                candidateCell += facingDirection;
            else
                candidateCell -= facingDirection;

            LevelData ld = GetCurrentLevelData();
            if (ld != null && UsesNumberLine(ld))
                candidateCell.y = ld.robotStartPosition.y;

            if (!CanRobotEnterCell(candidateCell))
            {
                _lastMoveBlocked = true;
                lastSafePosition = transform.position;
                Vector3 bumpDir = Quaternion.Euler(0, transform.eulerAngles.y, 0) * direction * gridSize;
                Vector3 bumpTarget = lastSafePosition + bumpDir * 0.35f;
                animator.SetBool("isWalking", true);
                if (audioSource1 != null && footstepsround != null && !audioSource1.isPlaying)
                    audioSource1.PlayOneShot(footstepsround);

                float bumpElapsed = 0f;
                float bumpDuration = moveDuration * 0.35f;
                while (bumpElapsed < bumpDuration)
                {
                    transform.position = Vector3.Lerp(lastSafePosition, bumpTarget, bumpElapsed / bumpDuration);
                    bumpElapsed += Time.deltaTime;
                    yield return null;
                }

                yield return MoveBackCoroutine();
                animator.SetBool("isWalking", false);
                if (audioSource1 != null) audioSource1.Stop();
                Debug.Log($"[CharacterMove] Move blocked at cell {candidateCell}; robot stays at {robotGridPosition}");
                yield break;
            }
        }

        Vector3 adjustedDirection = Quaternion.Euler(0, transform.eulerAngles.y, 0) * direction * gridSize;
        Vector3 startPosition = transform.position;
        Vector3 endPosition = startPosition + adjustedDirection;

        float elapsedTime = 0;
        
        animator.SetBool("isWalking", true);
        if (audioSource1 != null && footstepsround != null && !audioSource1.isPlaying) // Null checks
        {
            audioSource1.PlayOneShot(footstepsround);
        }



        while (elapsedTime < moveDuration)
        {
            Vector3 currentPosition = Vector3.Lerp(startPosition, endPosition, elapsedTime / moveDuration);
            transform.position = currentPosition;
            elapsedTime += Time.deltaTime;
            yield return null;
        }

        transform.position = endPosition;
        lastSafePosition = endPosition;
        animator.SetBool("isWalking", false);
        if (audioSource1 != null) audioSource1.Stop(); // Null check

        // Advance logical cell first, then snap XZ to same math as props (physics bounds.center pulled wrong tile at edges).
        Vector2Int prevRobotCell = robotGridPosition;
        if (direction == Vector3.forward)
            robotGridPosition += facingDirection;
        else if (direction == -Vector3.forward)
            robotGridPosition -= facingDirection;

        if (isLinearMove)
        {
            SnapRobotToLogicalGridCell();
            OnRobotMovedInMatrix(prevRobotCell, robotGridPosition);
            movesUsedInCurrentAttempt++;
            Debug.Log($"[CharacterMove] Move counter: {movesUsedInCurrentAttempt}");
        }

        AddFootprint(); // After snap so prints match logical cell centers

        Debug.Log($"[CharacterMove] Robot is now at grid position: {robotGridPosition}, facing: {facingDirection}");

        // NEW: Check for start/end object interactions AFTER grid position is updated
        CheckGridObjectInteractions();
    }

    private IEnumerator MoveBackCoroutine()
    {
        float elapsedTime = 0;
        Vector3 startPosition = transform.position;

        while (elapsedTime < moveDuration)
        {
            transform.position = Vector3.Lerp(startPosition, lastSafePosition, elapsedTime / moveDuration);
            elapsedTime += Time.deltaTime;
            yield return null;
        }
        transform.position = lastSafePosition;
        SnapRobotToLogicalGridCell();
    }





    private void AfterTaskCompletion(int taskIndex) // This method and its calls will be removed
    {
        // This entire method is part of the old task system and will be removed.
    }

    private void ShowCompletionPopup(string message) // This method seems to be for the old task system popup
    {
        // This logic is now handled by the successPopup and OnSuccessPopupContinue
        // Time.timeScale = 1.0f;
        // ConfigureSuccessPopup(); // This was an old name, might be mixed with successPopup setup
        // if (successPopup.GetComponentInChildren<Text>() != null) 
        //     successPopup.GetComponentInChildren<Text>().text = message;
        // else if (successPopup.GetComponentInChildren<TextMeshProUGUI>() != null) 
        //     successPopup.GetComponentInChildren<TextMeshProUGUI>().text = message;
        // successPopup.SetActive(true);
    }

    private bool CellMatchesVisitStart(Vector2Int cell, LevelData levelData)
    {
        if (startObjectPosition.x < 0 && startObjectPosition.y < 0) return false;
        if (UsesNumberLine(levelData))
            return cell.x == startObjectPosition.x;
        return cell == startObjectPosition;
    }

    private bool CellMatchesVisitEnd(Vector2Int cell, LevelData levelData)
    {
        if (endObjectPosition.x < 0 && endObjectPosition.y < 0) return false;
        if (UsesNumberLine(levelData))
            return cell.x == endObjectPosition.x;
        return cell == endObjectPosition;
    }

    private void ApplyVisitSequenceFlagsFromRunReplay(LevelData levelData, IEnumerable<CharacterAction> executedActions)
    {
        if (levelData == null || executedActions == null) return;
        if (!UsesVisitObjectSequence(levelData) &&
            startObjectPosition == Vector2Int.zero &&
            endObjectPosition == Vector2Int.zero)
            return;

        Vector2Int pos = attemptStartGridPos;
        Vector2Int facing = attemptStartFacing;
        int moveCount = 0;
        int blankIdx = 0;
        bool crossedStart = hasReachedStartObject || visitedStartObjectThisLevel;
        bool crossedEnd = hasReachedEndObject || visitedEndObjectThisLevel;

        foreach (var action in executedActions)
        {
            if (action == null) continue;
            string cmd = ResolveQueuedCommand(action, ref blankIdx);
            if (string.IsNullOrEmpty(cmd)) continue;
            SimulateOneCommandOnGrid(levelData, ref pos, ref facing, cmd, ref moveCount);

            if (!crossedStart && CellMatchesVisitStart(pos, levelData))
                crossedStart = true;
            if (!crossedEnd && CellMatchesVisitEnd(pos, levelData))
                crossedEnd = true;
        }

        if (!crossedStart && CellMatchesVisitStart(robotGridPosition, levelData))
            crossedStart = true;
        if (!crossedEnd && CellMatchesVisitEnd(robotGridPosition, levelData))
            crossedEnd = true;

        if (crossedStart)
        {
            hasReachedStartObject = true;
            visitedStartObjectThisLevel = true;
        }
        if (crossedEnd)
        {
            hasReachedEndObject = true;
            visitedEndObjectThisLevel = true;
        }
    }

    private static bool IsBagOrBackpackObjectType(string objectType)
    {
        if (string.IsNullOrEmpty(objectType)) return false;
        string key = objectType.ToLower();
        return key == "bag" || key == "backpack";
    }

    private GameObject GetGridObjectPrefab(string objectType)
    {
        GameObject prefab = null;
        
        switch (objectType.ToLower())
        {
            case "banana": 
                prefab = bananaPrefab;
                break;
            case "bin": 
                prefab = binPrefab;
                break;
            case "newspaper": 
                prefab = newspaperPrefab;
                break;
            case "recycle": 
                prefab = recyclePrefab;
                break;
            case "apple": 
                prefab = applePrefab;
                break;
            case "box": 
                prefab = boxPrefab;
                break;
            case "amazon-box":
            case "amazonbox":
                prefab = amazonBoxPrefab;
                break;
            case "block":
                prefab = blockPrefab;
                break;
            case "bed": 
                prefab = bedPrefab;
                break;
            case "chair": 
                prefab = chairPrefab;
                break;
            case "vacuum": 
                prefab = vacuumPrefab;
                break;
            case "bag":
            case "backpack":
                prefab = bagPrefab; // platform "backpack" === bagPrefab
                break;
            case "book": 
                prefab = bookPrefab;
                break;
            case "cesar":
            case "scissors":
                prefab = scissorsPrefab;
                break;
            case "crayon":
            case "black-crayon":
                prefab = blackCrayonPrefab != null ? blackCrayonPrefab : crayonsPrefab;
                break;
            case "crayon-box":
            case "crayons": 
                prefab = crayonsPrefab;
                break;
            case "glue": 
                prefab = gluePrefab;
                break;
            case "home": 
                prefab = homePrefab;
                break;
            case "mail": 
                prefab = mailPrefab;
                break;
            case "outlet":
                prefab = outletPrefab;
                break;
            case "package": 
                prefab = packagePrefab;
                break;
            case "pencil": 
                prefab = pencilPrefab;
                break;
            case "post": 
                prefab = postPrefab;
                break;
            case "school": 
                prefab = schoolPrefab;
                break;
            case "tree":
                prefab = treePrefab;
                break;
            case "greentree": 
                prefab = greentreePrefab;
                break;
            default:
                Debug.LogWarning($"[CharacterMove] Unknown grid object type: {objectType}");
                return null;
        }
        
        if (prefab == null && IsBagOrBackpackObjectType(objectType))
            prefab = bagPrefab;

        if (prefab == null)
            prefab = TryLoadRuntimeGridPrefab(objectType);

        if (prefab == null)
        {
            Debug.LogError(
                IsBagOrBackpackObjectType(objectType)
                    ? "[CharacterMove] bagPrefab is not assigned — required for object types 'bag' and 'backpack'."
                    : $"[CharacterMove] Prefab for '{objectType}' is not assigned in the inspector!");
        }
        
        return prefab;
    }

    private void UpdateLevelDisplay()
    {
        if (allLevelsData == null || currentLevel <= 0 || currentLevel > allLevelsData.Count)
        {
            if (applesNeededText != null)
            applesNeededText.text = "Loading level data...";
            return;
        }
        LevelData levelData = allLevelsData[currentLevel - 1];
        int remainingAttempts = levelData.maxAttempts - currentAttempt;
        if (applesNeededText != null)
            applesNeededText.text = $"{levelData.levelName}: {remainingAttempts} attempts left";
    }

    private void AddFootprint()
    {
        GameObject footprintInstance = Instantiate(footprintPrefab, transform.position + footprintOffset, Quaternion.Euler(0, transform.eulerAngles.y + 180, 0));
        Destroy(footprintInstance, footprintLifetime);
    }

    public Queue<CharacterAction> GetActionHistory()
    {
        return new Queue<CharacterAction>(actionHistory);
    }

    public void ClearActionHistory()
    {
        actionHistory.Clear();
        actionHistoryList.Clear();
        actionLog.Add(new PlayerActionLogEntry { action = "undo", timestamp = Time.time }); // Log undo
    }
    private void AddToActionHistory(Queue<CharacterAction> currentActions)
    {
        foreach (var action in currentActions)
        {
            actionHistory.Enqueue(action);
            GameObject historyImageInstance = Instantiate(actionImagePrefab);
            historyImageInstance.GetComponent<Image>().sprite = GetSpriteForAction(action);
        }
    }
    private Sprite GetSpriteForAction(CharacterAction action)
    {
        if (action is MoveAction ma) // Use pattern matching
        {
            if (ma.Direction == Vector3.forward)
                return forwardSprite;
            else
                return backwardSprite;
        }
        else if (action is RotateAction ra) // Use pattern matching
        {
            if (ra.Angle == rotationAngle)
                return rotateRightSprite;
            else
                return rotateLeftSprite;
        }
        return null;
    }

    private void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("tree")) 
        {
            Debug.Log("Collided with tree");
            if (currentMoveCoroutine != null)
            {
                StopCoroutine(currentMoveCoroutine);
            }
            isProcessing = false;
            animator.SetBool("isWalking", false);
            if(audioSource1 != null) audioSource1.Stop();

            // Remove the last action image from the UI queue if it was a planned action
            // Check against actionQueue (planned) vs actionHistory (executed)
            // If ProcessActions was running, the action log might be ahead of UI queue.
            // Safest to just clear the UI queue for simplicity upon collision during execution.
            // However, the original logic was to remove the *last child* of actionQueueTransform.
            // This implies it was the last *added* to the UI, not necessarily the one being executed.

            // If actionQueue is not empty, it means these actions were planned but not fully executed.
            // Clearing the UI (actionQueueTransform) is appropriate.
            // The actual actionQueue (data) is cleared by ProcessActions or StartActionProcessing on next run.
            if (actionQueueTransform.childCount > 0 && actionQueue.Count > 0) // Check if there are planned actions in UI and data queue
            {
                // This part is tricky. If a collision happens mid-sequence (ProcessActions),
                // actionQueue (data) is being emptied one by one. actionQueueTransform (UI) is also emptied one by one.
                // If collision stops ProcessActions, actionQueue might still have items.
                // The original line just destroyed the last child of actionQueueTransform.
                // Let's clear all children of actionQueueTransform to reflect a reset of the current attempt.
                foreach (Transform child in actionQueueTransform)
                {
                    Destroy(child.gameObject);
                }
                // The underlying actionQueue (data) should also be cleared to prevent these actions from re-running immediately.
                actionQueue.Clear(); 
            }
            else if (actionQueueTransform.childCount > 0) // If only UI elements but no data queue (e.g. run not pressed yet)
            {
                Destroy(actionQueueTransform.GetChild(actionQueueTransform.childCount - 1).gameObject);
                 // Also remove from the data queue if it exists there
                 if (actionQueue.Count > 0) actionQueue = new Queue<CharacterAction>(actionQueue.ToList().GetRange(0, actionQueue.Count -1));
            }


            StartCoroutine(MoveBackCoroutine());
        }
    }

    private void InitializeTasksForLevel1() // This method and its calls will be removed
    {
        // Part of the old task system
    }

    private void InitializeTask2() // This method and its calls will be removed
    {
        // Part of the old task system
    }

    private void CheckTaskCompletion() // This method and its calls will be removed
    {
        // Part of the old task system
    }

    private void TryEnqueueAction(CharacterAction action, Sprite actionSprite) // This method seems unused.
    {
        // Part of the old task system or an unused helper
    }
    public void ClosePopup() // This is for the general successPopup
    {
        successPopup.SetActive(false);
        Time.timeScale = 1.0f;
    }

    private void ConfigureSuccessPopup()
    {
        Canvas popupCanvas = successPopup.GetComponent<Canvas>();
        if (popupCanvas == null)
        {
            popupCanvas = successPopup.AddComponent<Canvas>();
            popupCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
            popupCanvas.sortingOrder = 999; 
        }
        if (successPopup.GetComponent<GraphicRaycaster>() == null)
        {
            successPopup.AddComponent<GraphicRaycaster>();
        }
        Button closeButton = successPopup.GetComponentInChildren<Button>();
        if (closeButton != null)
        {
            closeButton.onClick.RemoveAllListeners();
            closeButton.onClick.AddListener(ClosePopup);
            closeButton.interactable = true;
        }
        Time.timeScale = 1.0f;
    }

    IEnumerator FadeInAndOut(int count)
    {
        while (count > 0 && spriteRenderer != null) // Null check for spriteRenderer
        {
            yield return StartCoroutine(FadeAlpha(1, 0));
            yield return StartCoroutine(FadeAlpha(0, 1));
            count--;
        }
    }

    IEnumerator FadeAlpha(float startAlpha, float endAlpha)
    {
        if (spriteRenderer == null) yield break; // Guard clause

        float elapsedTime = 0;
        while (elapsedTime < fadeDuration)
        {
            elapsedTime += Time.deltaTime;
            float newAlpha = Mathf.Lerp(startAlpha, endAlpha, elapsedTime / fadeDuration);
            spriteRenderer.color = new Color(spriteRenderer.color.r, spriteRenderer.color.g, spriteRenderer.color.b, newAlpha);
            yield return null;
        }
        // Ensure final alpha is set
        if (spriteRenderer != null) // Check again in case it was destroyed during yield
             spriteRenderer.color = new Color(spriteRenderer.color.r, spriteRenderer.color.g, spriteRenderer.color.b, endAlpha);
    }

    public void StopFadingAndResetSpriteColor()
    {
        if (fadeCoroutine != null)
        {
            StopCoroutine(fadeCoroutine);
            fadeCoroutine = null;
        }
        if (spriteRenderer != null) // Null check
            spriteRenderer.color = new Color(spriteRenderer.color.r, spriteRenderer.color.g, spriteRenderer.color.b, 0);
    }

    IEnumerator PlayCollectSound(float delay)
    {
        Debug.Log("Trying to play collect sound.");
        yield return new WaitForSeconds(delay); 
        
        // Ensure audio is unlocked for WebGL
        AudioInitializer.EnsureAudioUnlocked();
        
        if (collectSound != null && audioSource != null) // Null checks
        {
            Debug.Log("Playing collect sound.");
            audioSource.PlayOneShot(collectSound);
        }
        else
        {
            Debug.LogError("CollectSound or AudioSource is null.");
        }
    }


    private void LoadNextLevel()
    {
        SceneManager.LoadScene("level2");
    }

    private bool CheckIfCorrectMovesUsed(LevelData levelData = null)
    {
        levelData = levelData ?? GetCurrentLevelData();
        if (levelData == null) return true;

        // Flag-prediction and choose-action items validate answers separately.
        if (levelData.useFlagPlacement || UsesGuidedBlankFlow(levelData))
            return true;

        int expectedMoves = CountExpectedMoveActions(levelData);
        if (expectedMoves <= 0) return true;
        return movesUsedInCurrentAttempt == expectedMoves;
    }

    private int CountExpectedMoveActions(LevelData levelData)
    {
        if (levelData?.guidedActions == null) return 0;
        int count = 0;
        foreach (var action in levelData.guidedActions)
        {
            string normalized = NormalizeActionLabel(action);
            if (normalized == "blank") continue;
            if (normalized == "forward" || normalized == "backward")
                count++;
        }
        return count;
    }
    
    private bool CheckIfObjectsInCorrectGuidedPositions()
    {
        if (allLevelsData == null || currentLevel <= 0 || currentLevel > allLevelsData.Count)
            return true;
            
        LevelData levelData = allLevelsData[currentLevel - 1];

        // Goal is the flag cell the player chose â€” no dragging objects to guidedEndPosition.
        if (levelData.useFlagPlacement && levelData.playerPicksEndCellWithFlag)
            return true;
        
        // Check if this level has guided actions and requires object positioning
        if (levelData.guidedActions == null || levelData.guidedActions.Count == 0)
            return true;
            
        // Check each object that has a guided end position
        foreach (var gridObject in levelData.gridObjects)
        {
            if (gridObject.guidedEndPosition != Vector2Int.zero)
            {
                // Find the actual object in the scene
                Vector3 expectedWorldPos = GridCellToWorld(gridObject.guidedEndPosition);
                bool objectInCorrectPosition = false;
                
                foreach (var obj in activeGridObjects)
                {
                    if (obj != null && obj.activeInHierarchy)
                    {
                        // Check if this object is the right type and in the correct position
                        if (Vector3.Distance(obj.transform.position, expectedWorldPos) < 0.1f)
                        {
                            // Verify it's the correct object type by checking the original grid object
                            Vector3 originalWorldPos = GridCellToWorld(gridObject.position);
                            if (Vector3.Distance(obj.transform.position, originalWorldPos) < 0.1f || 
                                obj.name.ToLower().Contains(gridObject.objectType.ToLower()))
                            {
                                objectInCorrectPosition = true;
                                break;
                            }
                        }
                    }
                }
                
                if (!objectInCorrectPosition)
                {
                    Debug.Log($"[CharacterMove] Object {gridObject.objectType} not in correct guided position {gridObject.guidedEndPosition}");
                    return false;
                }
            }
        }
        
        Debug.Log("[CharacterMove] All objects in correct guided positions");
        return true;
    }

    private void CheckGridObjectInteractions()
    {
        // Check if robot reached start object
        Debug.Log($"[CheckGridObjectInteractions] Checking start object: hasReachedStartObject={hasReachedStartObject}, robotGridPosition={robotGridPosition}, startObjectPosition={startObjectPosition}");
        if (!hasReachedStartObject && robotGridPosition == startObjectPosition)
        {
            hasReachedStartObject = true;
            Debug.Log($"[CharacterMove] Robot reached start object at {startObjectPosition}");
            
            if (chatGPTResponseText != null)
            {
                chatGPTResponseText.text = "Great! Now find the end object.";
            }
        }
        
        // Hide start object when robot moves away from start position
        if (hasReachedStartObject && robotGridPosition != startObjectPosition)
        {
            // Check if start object is still visible (not already hidden)
            bool startObjectStillVisible = false;
            foreach (var obj in activeGridObjects)
            {
                if (obj != null && obj.activeInHierarchy)
                {
                    Vector3 objWorldPos = obj.transform.position;
                    Vector3 expectedWorldPos = GridCellToWorld(startObjectPosition);
                    
                    if (Vector3.Distance(objWorldPos, expectedWorldPos) < 0.1f)
                    {
                        startObjectStillVisible = true;
                        break;
                    }
                }
            }
            
            if (startObjectStillVisible)
            {
                Debug.Log($"[CharacterMove] Robot moved away from start object. Hiding start object with effect.");
                HideGridObjectAtPosition(startObjectPosition, true);
            }
        }
        
        // Check if robot reached end object (considering it might have been dragged)
        Debug.Log($"[CheckGridObjectInteractions] Checking end object: hasReachedStartObject={hasReachedStartObject}, hasReachedEndObject={hasReachedEndObject}, robotGridPosition={robotGridPosition}, endObjectPosition={endObjectPosition}, movesUsed={movesUsedInCurrentAttempt}");
        
        if (hasReachedStartObject && !hasReachedEndObject)
        {
            if (IsFlagPlacementActive && IsFlagPlaced && RobotIsOnEndGoalCell())
            {
                Debug.Log($"[CheckGridObjectInteractions] Robot reached flag goal at {endObjectPosition}");
            }
            else if (!IsFlagPlacementActive || !IsFlagPlaced)
            {
                LevelData currentLevelData = allLevelsData[currentLevel - 1];
                foreach (var gridObject in currentLevelData.gridObjects)
                {
                    if (gridObject.isEndObject)
                    {
                        foreach (var obj in activeGridObjects)
                        {
                            if (obj != null && obj.activeInHierarchy)
                            {
                                Vector3 originalWorldPos = GridCellToWorld(gridObject.position);
                                if (Vector3.Distance(obj.transform.position, originalWorldPos) < 0.1f ||
                                    obj.name.ToLower().Contains(gridObject.objectType.ToLower()))
                                {
                                    Vector3 robotWorldPos = transform.position;
                                    if (Vector3.Distance(robotWorldPos, obj.transform.position) < gridSize * 0.5f)
                                    {
                                        hasReachedEndObject = true;
                                        visitedEndObjectThisLevel = true;
                                        Debug.Log($"[CharacterMove] Robot reached end object '{gridObject.objectType}' at {obj.transform.position}");
                                        break;
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    private GameObject FindActiveGridObjectAtCell(Vector2Int gridCell, string objectTypeHint = null)
    {
        Vector3 expectedWorldPos = GridCellToWorld(gridCell);
        GameObject typeFallback = null;
        foreach (var obj in activeGridObjects)
        {
            if (obj == null) continue;
            if (Vector3.Distance(obj.transform.position, expectedWorldPos) < gridSize * 0.6f)
                return obj;
            if (!string.IsNullOrEmpty(objectTypeHint) &&
                obj.name.ToLower().Contains(objectTypeHint.ToLower()))
                typeFallback = obj;
        }
        return typeFallback;
    }

    private static void RestoreGridObjectVisual(GameObject obj)
    {
        if (obj == null) return;
        var renderer = obj.GetComponent<Renderer>();
        if (renderer != null && renderer.material != null)
        {
            Color c = renderer.material.color;
            renderer.material.color = new Color(c.r, c.g, c.b, 1f);
        }
        var spriteRenderer = obj.GetComponent<SpriteRenderer>();
        if (spriteRenderer != null)
        {
            Color c = spriteRenderer.color;
            spriteRenderer.color = new Color(c.r, c.g, c.b, 1f);
            spriteRenderer.enabled = true;
        }
        foreach (var sr in obj.GetComponentsInChildren<SpriteRenderer>(true))
        {
            Color c = sr.color;
            sr.color = new Color(c.r, c.g, c.b, 1f);
            sr.enabled = true;
        }
        obj.SetActive(true);
    }

    private void StopGridObjectFadeCoroutines()
    {
        for (int i = 0; i < _gridObjectFadeCoroutines.Count; i++)
        {
            if (_gridObjectFadeCoroutines[i] != null)
                StopCoroutine(_gridObjectFadeCoroutines[i]);
        }
        _gridObjectFadeCoroutines.Clear();
    }

    /// <summary>Bring back hidden visit/start/end props for a new RUN or Try Again.</summary>
    private void RestoreAllGridObjectsForNewAttempt()
    {
        StopGridObjectFadeCoroutines();

        LevelData levelData = GetCurrentLevelData();
        if (levelData?.gridObjects == null) return;

        foreach (var gridObject in levelData.gridObjects)
        {
            var obj = FindActiveGridObjectAtCell(gridObject.position, gridObject.objectType);
            if (obj == null) continue;

            obj.transform.position = WorldPositionForGridCell(gridObject.position, levelData);
            RestoreGridObjectVisual(obj);
            Debug.Log($"[CharacterMove] Restored grid object '{gridObject.objectType}' at {gridObject.position} for new attempt");
        }
    }

    private void StartGridObjectFadeOut(GameObject obj, bool isStartObject)
    {
        var fade = StartCoroutine(FadeOutObject(obj, isStartObject));
        _gridObjectFadeCoroutines.Add(fade);
    }

    private void HideGridObjectAtPosition(Vector2Int position, bool isStartObject)
    {
        var obj = FindActiveGridObjectAtCell(position);
        if (obj != null && obj.activeInHierarchy)
            StartGridObjectFadeOut(obj, isStartObject);
    }
    
    private void HideEndObjectAtCurrentPosition()
    {
        // Find the end object and hide it at its current position
        LevelData currentLevelData = allLevelsData[currentLevel - 1];
        foreach (var gridObject in currentLevelData.gridObjects)
        {
            if (gridObject.isEndObject)
            {
                foreach (var obj in activeGridObjects)
                {
                    if (obj != null && obj.activeInHierarchy)
                    {
                        // Check if this is the end object by comparing positions
                        Vector3 originalWorldPos = GridCellToWorld(gridObject.position);
                        if (Vector3.Distance(obj.transform.position, originalWorldPos) < 0.1f || 
                            obj.name.ToLower().Contains(gridObject.objectType.ToLower()))
                        {
                            // This is the end object, hide it at its current position
                            StartGridObjectFadeOut(obj, false);
                            Debug.Log($"[CharacterMove] Hiding end object '{gridObject.objectType}' at its current position {obj.transform.position}");
                            break;
                        }
                    }
                }
                break;
            }
        }
    }

    private IEnumerator FadeOutObject(GameObject obj, bool isStartObject)
    {
        Renderer renderer = obj.GetComponent<Renderer>();
        if (renderer != null)
        {
            // Use faster fade for start object, slower for end object
            float fadeTime = isStartObject ? 0.2f : 1.0f;
            float elapsedTime = 0f;
            Color originalColor = renderer.material.color;
            
            while (elapsedTime < fadeTime)
            {
                elapsedTime += Time.deltaTime;
                float alpha = Mathf.Lerp(1f, 0f, elapsedTime / fadeTime);
                renderer.material.color = new Color(originalColor.r, originalColor.g, originalColor.b, alpha);
                yield return null;
            }
        }
        
        obj.SetActive(false);
        
        string objectType = isStartObject ? "start" : "end";
        Debug.Log($"[CharacterMove] {objectType} object hidden with fade effect (duration: {(isStartObject ? 0.3f : 1.0f)}s)");
        _gridObjectFadeCoroutines.RemoveAll(c => c == null);
    }

    private IEnumerator CompleteLevelSuccessfully()
    {
        yield return new WaitForSeconds(1.0f);

        if (!_skipNextPlatformReport && !_currentRunReportedToPlatform)
            yield return ReportCurrentRunToPlatformRoutine(pendingLevelPassed);
        else if (GameAssessmentClient.Instance != null)
            yield return GameAssessmentClient.Instance.WaitForPendingReports();
        
        LevelData completedLevel = GetCurrentLevelData();
        if (successPopup != null && successPopupText != null)
        {
            successPopupText.text = GetConfiguredPopupText(completedLevel?.attemptSuccessMessage, completedLevel);
            successPopup.SetActive(true);
            GameInteractionSounds.PlaySuccessPopup();
            RefreshStudentResetButtonState();
        }
        else
        {
            Debug.LogWarning("[CharacterMove] successPopup or successPopupText not assigned!");
            if (GameAssessmentClient.Instance != null)
                yield return GameAssessmentClient.Instance.WaitForPendingReports();
            AdvanceToNextLevel();
        }
    }

    private void ResetCurrentLevel()
    {
        Debug.Log($"[CharacterMove] Resetting level {currentLevel}");
        
        // Don't reset attempt counter here - it should stay at current value
        // The attempt counter is managed by the retry button
        
        currentAttemptActionLog.Clear();
        ClearActionQueueVisual();
        
        // Reset robot position and state
        LevelData levelData = GetCurrentLevelData();
        if (levelData == null && allLevelsData != null && currentLevel >= 1 && currentLevel <= allLevelsData.Count)
            levelData = allLevelsData[currentLevel - 1];
        if (levelData == null) return;
        robotGridPosition = levelData.robotStartPosition;
        facingDirection = levelData.robotStartFacing;
        
        // Set robot rotation
        if (facingDirection == Vector2Int.up)
            transform.rotation = Quaternion.identity;
        else if (facingDirection == Vector2Int.right)
            transform.rotation = Quaternion.Euler(0, 90, 0);
        else if (facingDirection == Vector2Int.down)
            transform.rotation = Quaternion.Euler(0, 180, 0);
        else if (facingDirection == Vector2Int.left)
            transform.rotation = Quaternion.Euler(0, 270, 0);
        
        // Position robot
        Vector3 targetPosition = RobotWorldPositionAtCell(robotGridPosition);
        transform.position = targetPosition;
        lastSafePosition = transform.position;
        
        // Reset per-attempt visit flags (level-wide assessment flags stay)
        hasReachedStartObject = false;
        hasReachedEndObject = false;

        RestoreAllGridObjectsForNewAttempt();
        ResetPlayfieldForNewAttempt(levelData);

        hasReachedStartObject = false;
        visitedStartObjectThisLevel = false;
        SyncStartObjectReachedState();
        CheckGridObjectInteractions();
        
        // Check if robot starts on the start object position
        if (robotGridPosition == startObjectPosition)
        {
            hasReachedStartObject = true;
            Debug.Log($"[CharacterMove] Robot starts on start object position. hasReachedStartObject set to true.");
        }
        
        // Reset grid objects to their original positions
        foreach (var gridObject in levelData.gridObjects)
        {
            Vector3 originalWorldPos = GridCellToWorld(gridObject.position);
            
            // Find the corresponding active object
            foreach (var obj in activeGridObjects)
            {
                if (obj != null)
                {
                    // Check if this is the right object by comparing object types
                    if (obj.name.ToLower().Contains(gridObject.objectType.ToLower()))
                    {
                        // Reset to original position
                        obj.transform.position = originalWorldPos;
                        obj.SetActive(true);
                        
                        // Reset renderer color
                        Renderer renderer = obj.GetComponent<Renderer>();
                        if (renderer != null)
                        {
                            Color color = renderer.material.color;
                            renderer.material.color = new Color(color.r, color.g, color.b, 1f);
                        }
                        
                        Debug.Log($"[CharacterMove] Reset {gridObject.objectType} to original position {gridObject.position}");
                        break;
                    }
                }
            }
        }
        
        if (moveForwardButton != null) moveForwardButton.interactable = true;
        if (moveDownButton != null) moveDownButton.interactable = true;
        if (rotateLeftButton != null) rotateLeftButton.interactable = true;
        if (rotateRightButton != null) rotateRightButton.interactable = true;

        if (levelData.guidedActions != null && levelData.guidedActions.Count > 0)
            SeedGuidedProgramQueue(levelData);
        else
            ClearActionQueueVisual();

        if (runButton != null && !UsesGuidedBlankFlow(levelData))
            runButton.interactable = !IsRunBlockedByFlagRequirement();

        RefreshStudentResetButtonState();
        
        // Update UI text with level-specific instructions
        if (chatGPTResponseText != null)
        {
            string startObjectType = "";
            string endObjectType = "";
            foreach (var obj in levelData.gridObjects)
            {
                if (obj.isStartObject) startObjectType = obj.objectType;
                if (obj.isEndObject) endObjectType = obj.objectType;
            }
            
            string dragInstruction = levelData.allowGridObjectDrag ? " You can drag any object to reposition it." : "";
            string guidedInstruction = "";
            bool useFlag = levelData.useFlagPlacement;

            foreach (var gridObject in levelData.gridObjects)
            {
                if (gridObject.guidedEndPosition != Vector2Int.zero)
                {
                    guidedInstruction = useFlag
                        ? $" Place the flag at position ({gridObject.guidedEndPosition.x}, {gridObject.guidedEndPosition.y})."
                        : $" Drag the {gridObject.objectType} to position ({gridObject.guidedEndPosition.x}, {gridObject.guidedEndPosition.y}).";
                    break;
                }
            }

            if (useFlag)
            {
                chatGPTResponseText.text =
                    $"Level {currentLevel} reset. Tap a cell to place the flag, then guide the robot to reach it. " +
                    $"You have {levelData.maxAttempts} attempts.{guidedInstruction}";
            }
            else
            {
                chatGPTResponseText.text = $"Level {currentLevel} reset. First find the {startObjectType}, then reach the {endObjectType}. You have {levelData.maxAttempts} attempts.{dragInstruction}{guidedInstruction}";
            }
        }
        
        // Update level display
        UpdateLevelDisplay();
        
        Debug.Log($"[CharacterMove] Level {currentLevel} reset successfully");
    }




    private void RequestChatGPTFeedback()
    {
        if (!enableChatGPT)
        {
            if (chatGPTResponseText != null)
                chatGPTResponseText.text = chatGPTDisabledFallback;
            return;
        }

        string currentActionLogStr = string.Join(", ", actionLog.Select(entry => entry.action));
        string targetObject = hasReachedStartObject ? "end object" : "start object";
        Vector2Int targetPos = hasReachedStartObject ? endObjectPosition : startObjectPosition;

        string prompt = $"The robot is on a {gridRows}x{gridCols} grid at robot position {robotGridPosition}. " +
                        $"The robot needs to reach the {targetObject} at {targetPos}. " +
                        $"The player's recent actions were: {currentActionLogStr}. " +
                        "The robot did not reach the target. What should the player try next? Give a short, clear tip.";
        
        if (chatGPTManager != null)
            chatGPTManager.SendMessage(prompt, OnChatGPTFeedback);
    }

    private void OnChatGPTFeedback(string response)
    {
        if (!enableChatGPT)
        {
            if (chatGPTResponseText != null)
                chatGPTResponseText.text = chatGPTDisabledFallback;
            return;
        }

        if (chatGPTResponseText != null) // Update text field regardless
        {
            // Provide a fallback if response is empty/null for better UI experience
            chatGPTResponseText.text = !string.IsNullOrEmpty(response) ? response : "Keep up the great work!"; 
        }
        
        if (!string.IsNullOrEmpty(response)) 
        {
            this.unityFeedbackLog.Add(response); // Only log actual feedback from ChatGPT
            Debug.Log($"[CharacterMove] Added to unityFeedbackLog: {response}");
        }
    }
    
    // Modified AssessComputationalThinking to call the new Flask endpoint
    private void AssessComputationalThinking(bool endOfLevel = false, int actionsBeforeRunForThisAttempt = 0, bool reachedAppleForThisAttempt = false)
    {
        string userId = PlayerPrefs.GetString("UserId");
        if (string.IsNullOrEmpty(userId))
        {
            Debug.LogError("UserId not found in PlayerPrefs. Cannot send assessment.");
            return;
        }

        // If it's not an endOfLevel assessment, the currentAttemptActionLog becomes the log for this specific run.
        // If it IS an endOfLevel assessment, currentAttemptActionLog might contain the very last set of actions leading to level completion.
        // The main actionLog should already contain all previous attempts for this level.
        List<PlayerActionLogEntry> logForThisAssessment;
        LevelData levelData = allLevelsData[currentLevel-1]; // Data for the level being assessed

        bool isPerAppleAssessment = !endOfLevel;
        bool isLevelSummaryAssessment = endOfLevel;

        if (isPerAppleAssessment)
        {
            logForThisAssessment = new List<PlayerActionLogEntry>(currentAttemptActionLog);
            actionLog.AddRange(currentAttemptActionLog); // Add attempt to the main level log
        }
        else if (isLevelSummaryAssessment)
        {
            // For a level summary, ensure the last attempt's logs are also in the main actionLog before sending.
            actionLog.AddRange(currentAttemptActionLog); 
            logForThisAssessment = new List<PlayerActionLogEntry>(actionLog); // Send the complete log for the level
        }
        else
        {
            currentAttemptActionLog.Clear();
            return;
        }
        
        Debug.Log($"[AssessComputationalThinking] Called. endOfLevel: {endOfLevel}, isL1Run: {isPerAppleAssessment}, isSummary: {isLevelSummaryAssessment}. Log count: {logForThisAssessment.Count}");

        string robotPosStr = $"{robotGridPosition.x},{robotGridPosition.y}";
        string targetPosStr = "unknown"; 

        if (isLevelSummaryAssessment) {
            targetPosStr = "level_completed";
        } else if (hasReachedEndObject) {
            targetPosStr = $"{endObjectPosition.x},{endObjectPosition.y}";
        } else if (hasReachedStartObject) {
            targetPosStr = $"{startObjectPosition.x},{startObjectPosition.y}";
        }

        CTAssessmentRequest requestPayload = new CTAssessmentRequest
        {
            student_id = userId,
            level = levelData.levelName,
            log = logForThisAssessment, // Use the determined log
            robot_position = robotPosStr,
            apple_position = targetPosStr,
            unity_chatgpt_feedback_log = new List<string>(this.unityFeedbackLog), // Full feedback log for summaries too
            grid_rows = this.gridRows,
            grid_cols = this.gridCols,
            is_level_summary = isLevelSummaryAssessment,
            level_duration_seconds = -1f,
            initial_facing = new int[] { facingDirection.x, facingDirection.y },
            attempt_number = 1, // Assuming a single attempt for now
            time_taken = Time.time - levelStartTime,
            hints_used = 0, // Assuming no hints used for now
            block_efficiency = 100, // Assuming 100% block efficiency for now
            min_blocks = 1, // Assuming minimum blocks used is 1 for now
            used_blocks = 1, // Assuming used blocks is 1 for now
            previous_attempts = new List<List<PlayerActionLogEntry>>(), // Assuming no previous attempts for now
            robot_start_position = $"{attemptStartGridPos.x},{attemptStartGridPos.y}", // TRUE START POSITION
            robot_start_facing = new int[] { attemptStartFacing.x, attemptStartFacing.y }, // TRUE START FACING
            number_of_attempts = 1, // Assuming a single attempt for now
            time_on_task = Time.time - levelStartTime, // Assuming time_on_task is the time taken for the level
            persistence_score = 100, // Assuming 100% persistence score for now
            creativity_score = 100, // Assuming 100% creativity score for now
            error_types = new List<string> { "None" }, // Assuming no errors for now
            collaboration_events = new List<string> { "None" }, // Assuming no collaboration events for now
            // --- New fields for guided/fill-in-the-blank ---
            guidedActions = levelData.guidedActions,
            correctBlankAnswer = levelData.correctBlankAnswer,
            blankEnabledArrows = levelData.blankEnabledArrows,
            correctBlankAnswers = levelData.blanks,
            userBlankAnswers = new List<string>(),
            // --- NEW DETAILED TRACKING FIELDS ---
            user_blank_answers = new List<string>(userBlankChoices), // Student's actual answers to blanks
            correct_blank_answers = levelData.blanks, // Correct answers for blanks
            guided_actions = levelData.guidedActions, // The guided action sequence
            robot_final_position = robotPosStr, // Current robot position as final position
            apple_positions = new List<Vector2Int> { startObjectPosition, endObjectPosition }, // Start and end positions
            level_completed = hasReachedEndObject, // Whether the level was completed
            wrong_answers_count = wrongAnswersCount, // Use tracked wrong answers count
            time_to_first_action = logForThisAssessment.Count > 0 ? logForThisAssessment[0].timestamp - levelStartTime : 0, // Time from level start to first action
            time_between_actions = CalculateTimeBetweenActions(logForThisAssessment), // Intervals between actions
            level_telemetry_json = BuildLevelTelemetryJson((levelStartTime > 0f) ? (Time.time - levelStartTime) : -1f)
        };

        if (levelData.levelName == "Level 1")
        {
            if (isPerAppleAssessment)
            {
                requestPayload.level1_starting_position_index = hasReachedStartObject ? 1 : 0; 
                requestPayload.actions_before_run = actionsBeforeRunForThisAttempt; 
                requestPayload.forward_press_intervals = CalculateForwardPressIntervals(currentAttemptActionLog); // Use currentAttempt for intervals of this run
                Debug.Log($"[L1 Run Assess] StartPosIndex: {requestPayload.level1_starting_position_index}, ActionsBeforeRun: {requestPayload.actions_before_run}");
            }
            else if (isLevelSummaryAssessment) // Specifically Level 1 Summary
            {
                if (levelStartTime > 0f) {
                    requestPayload.level_duration_seconds = Time.time - levelStartTime;
                    Debug.Log($"[L1 Summary Assess] Level 1 duration: {requestPayload.level_duration_seconds}s");
                }
            }
        }

        StartCoroutine(SubmitCTAssessmentToFlaskCoroutine(requestPayload));
        
        currentAttemptActionLog.Clear(); // Clear attempt log after it has been processed or added to main log

        if (isLevelSummaryAssessment) 
        {
            actionLog.Clear(); // Clear main log for the level just summarized
            unityFeedbackLog.Clear(); // Clear feedback log for the level just summarized
            if (levelData.levelName == "Level 1") { 
                levelStartTime = -1f;
                Debug.Log("[CharacterMove] Level 1 logs and start time cleared after summary assessment.");
            }
            else
            {
                levelStartTime = -1f;
            }
        }
    }

    private List<float> CalculateForwardPressIntervals(List<PlayerActionLogEntry> attemptLog)
    {
        List<float> intervals = new List<float>();
        PlayerActionLogEntry lastForwardAction = null;

        foreach (var entry in attemptLog)
        {
            if (entry.action.ToLower() == "forward")
            {
                if (lastForwardAction != null)
                {
                    intervals.Add(entry.timestamp - lastForwardAction.timestamp);
                }
                lastForwardAction = entry;
            }
        }
        return intervals;
    }

    private List<float> CalculateTimeBetweenActions(List<PlayerActionLogEntry> attemptLog)
    {
        List<float> intervals = new List<float>();
        
        for (int i = 1; i < attemptLog.Count; i++)
        {
            intervals.Add(attemptLog[i].timestamp - attemptLog[i-1].timestamp);
        }
        
        return intervals;
    }

    IEnumerator SubmitCTAssessmentToFlaskCoroutine(CTAssessmentRequest payload)
    {
        string url = "http://localhost:5000/api/ct_assessment";
        string jsonPayload = JsonUtility.ToJson(payload);

        Debug.Log($"[SubmitCTAssessmentToFlaskCoroutine] Sending JSON: {jsonPayload} to {url}");

        using (UnityWebRequest www = new UnityWebRequest(url, "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonPayload);
            www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            www.downloadHandler = new DownloadHandlerBuffer();
            www.SetRequestHeader("Content-Type", "application/json");
            yield return www.SendWebRequest();
            
            if (www.result == UnityWebRequest.Result.Success)
            {
                Debug.Log($"[SubmitCTAssessmentToFlaskCoroutine] Assessment response received successfully: {www.downloadHandler.text}");
                try
                {
                    var response = JsonUtility.FromJson<AssessmentResponse>(www.downloadHandler.text);
                    if (response != null && response.scores != null)
                    {
                        int totalScore = 0;
                        if (response.scores.ContainsKey("decomposition")) totalScore += response.scores["decomposition"];
                        if (response.scores.ContainsKey("pattern_recognition")) totalScore += response.scores["pattern_recognition"];
                        if (response.scores.ContainsKey("abstraction")) totalScore += response.scores["abstraction"];
                        if (response.scores.ContainsKey("algorithm_design")) totalScore += response.scores["algorithm_design"];
                        if (response.scores.ContainsKey("debugging")) totalScore += response.scores["debugging"];

                        string userId = PlayerPrefs.GetString("UserId", "UnknownUser");
                        PlayerPrefs.SetInt($"{userId}_Level{currentLevel}_Score", totalScore);
                        PlayerPrefs.Save();
                        Debug.Log($"[SubmitCTAssessmentToFlaskCoroutine] Saved score {totalScore} for Level {currentLevel}");
                    }
                    // Store per-apple assessment for Level 1 (not summary)
                    if (payload.level == "Level 1" && !payload.is_level_summary && response != null)
                    {
                        level1AssessmentResults.Add(response);
                    }
                }
                catch (Exception e)
                {
                    Debug.LogError($"[SubmitCTAssessmentToFlaskCoroutine] Error parsing assessment response: {e.Message}");
                }
            }
            else
            {
                Debug.LogError($"[SubmitCTAssessmentToFlaskCoroutine] Assessment request failed: {www.error}");
            }
        }
    }
    
    // Keep SendAssessmentRequestNonBlocking if it's used elsewhere or for a different purpose.
    // For now, it seems replaced by SubmitCTAssessmentToFlaskCoroutine for the CT assessment.
    // If it was specifically for the OLD /api/assessment endpoint, it might be deprecated.
    // For safety, I'm leaving its definition here, but it's not called by the new AssessComputationalThinking.
    IEnumerator SendAssessmentRequestNonBlocking(string studentId, string level) // This seems to be for the old endpoint
    {
        Debug.LogWarning("[CharacterMove] SendAssessmentRequestNonBlocking (for old /api/assessment) was called. This might be deprecated.");
        // Create payload for the old endpoint (if still needed for something)
        var oldPayload = new Dictionary<string, object> {
            { "student_id", studentId },
            { "level", level },
            { "log", actionLog.Select(e => e.action).ToList() } // Old endpoint might expect List<string>
        };
        string jsonPayload = JsonUtility.ToJson(oldPayload); // This won't serialize Dictionary well.
                                                              // For Dictionaries, custom JSON construction or a proper serializable class is needed.
                                                              // Given the shift to /api/ct_assessment, this method is likely obsolete for CT.
        
                    using (UnityWebRequest www = new UnityWebRequest("http://localhost:5000/api/assessment", "POST")) // OLD URL
        {
            // This part needs proper JSON serialization for Dictionary if used.
            // byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonPayload); 
            // www.uploadHandler = new UploadHandlerRaw(bodyRaw);
            // www.downloadHandler = new DownloadHandlerBuffer();
            // www.SetRequestHeader("Content-Type", "application/json");
            // yield return www.SendWebRequest(); // ...
        }
        yield return null; // Placeholder
    }

    [System.Serializable]
    private class AssessmentResponse
    {
        public Dictionary<string, int> scores;
        public string assessment;
    }

    [Tooltip("Deprecated: assign on GameInteractionSoundsSettings as Guided Blank Prompt Clip.")]
    public AudioClip whichArrowAudioClip;
    private bool waitingForGuidedInput = false;

    // Call this when the user picks left or right for the blank slot
    public void OnGuidedBlankFilled(string userChoice)
    {
        if (!waitingForGuidedInput) return;

        LevelData levelData = GetCurrentLevelData();
        if (levelData?.blanks == null || currentBlankIndexInSequence >= levelData.blanks.Count)
            return;

        var currentBlankData = levelData.blanks[currentBlankIndexInSequence];

        if (GuidedAnswerMatches(userChoice, currentBlankData.correctAnswer))
        {
            // Correct answer
            waitingForGuidedInput = false;
            userBlankChoices.Add(userChoice);

            // Deactivate choice buttons
            if (blankLeftButton != null) blankLeftButton.gameObject.SetActive(false);
            if (blankRightButton != null) blankRightButton.gameObject.SetActive(false);
            if (blankForwardButton != null) blankForwardButton.gameObject.SetActive(false);
            if (blankBackwardButton != null) blankBackwardButton.gameObject.SetActive(false);

            // Update the UI for the slot that was just filled
            var slotToFill = blankSlotInstances[currentBlankIndexInSequence];
            var img = slotToFill.GetComponent<Image>();
            if (userChoice == "turn left") img.sprite = rotateLeftSprite;
            else if (userChoice == "turn right") img.sprite = rotateRightSprite;
            else if (userChoice == "forward") img.sprite = forwardSprite;
            else if (userChoice == "backward") img.sprite = backwardSprite;
            img.color = Color.white; // Reset color from pulsing

            // Update the actionQueue with the real action
            int queueIndex = blankSlotQueueIndices[currentBlankIndexInSequence];
            var actions = actionQueue.ToList();
            CharacterAction filledAction = null;
            if (userChoice == "turn left") 
            {
                Debug.Log($"[OnGuidedBlankFilled] Creating RotateAction with angle: {-rotationAngle} (rotationAngle = {rotationAngle})");
                filledAction = new RotateAction(-rotationAngle);
            }
            else if (userChoice == "turn right") 
            {
                Debug.Log($"[OnGuidedBlankFilled] Creating RotateAction with angle: {rotationAngle}");
                filledAction = new RotateAction(rotationAngle);
            }
            else if (userChoice == "forward") filledAction = new MoveAction(Vector3.forward);
            else if (userChoice == "backward") filledAction = new MoveAction(-Vector3.forward);
            actions[queueIndex] = filledAction;
            actionQueue = new Queue<CharacterAction>(actions);

            // Move to the next blank or finish
            currentBlankIndexInSequence++;
            if (currentBlankIndexInSequence < levelData.blanks.Count)
            {
                // There's another blank to fill
                ActivateBlank(currentBlankIndexInSequence);
            }
            else
            {
                if (blankLeftButton != null) blankLeftButton.gameObject.SetActive(false);
                if (blankRightButton != null) blankRightButton.gameObject.SetActive(false);
                if (blankForwardButton != null) blankForwardButton.gameObject.SetActive(false);
                if (blankBackwardButton != null) blankBackwardButton.gameObject.SetActive(false);

                TryStartRunAfterGuidedBlank();
            }
        }
        else
        {
            // Wrong answer - execute the wrong action first, then show popup
            wrongAnswersCount++; // Increment wrong answers count
            waitingForGuidedInput = false;
            userBlankChoices.Add(userChoice);
            
            // Deactivate choice buttons
            if (blankLeftButton != null) blankLeftButton.gameObject.SetActive(false);
            if (blankRightButton != null) blankRightButton.gameObject.SetActive(false);
            if (blankForwardButton != null) blankForwardButton.gameObject.SetActive(false);
            if (blankBackwardButton != null) blankBackwardButton.gameObject.SetActive(false);

            // Update the UI for the slot that was just filled with wrong choice
            var slotToFill = blankSlotInstances[currentBlankIndexInSequence];
            var img = slotToFill.GetComponent<Image>();
            if (userChoice == "turn left") img.sprite = rotateLeftSprite;
            else if (userChoice == "turn right") img.sprite = rotateRightSprite;
            else if (userChoice == "forward") img.sprite = forwardSprite;
            else if (userChoice == "backward") img.sprite = backwardSprite;
            img.color = Color.white;

            // Update the actionQueue with the wrong action
            int queueIndex = blankSlotQueueIndices[currentBlankIndexInSequence];
            var actions = actionQueue.ToList();
            CharacterAction wrongAction = null;
            if (userChoice == "turn left") wrongAction = new RotateAction(-rotationAngle);
            else if (userChoice == "turn right") wrongAction = new RotateAction(rotationAngle);
            else if (userChoice == "forward") wrongAction = new MoveAction(Vector3.forward);
            else if (userChoice == "backward") wrongAction = new MoveAction(-Vector3.forward);
            actions[queueIndex] = wrongAction;
            actionQueue = new Queue<CharacterAction>(actions);

            // Execute the wrong action sequence and then show popup
            StartCoroutine(ExecuteWrongActionAndShowPopup());
        }
    }

    private void ActivateBlank(int blankIndex)
    {
        var levelData = allLevelsData[currentLevel - 1];
        if (levelData.blanks == null || blankIndex >= levelData.blanks.Count) return;

        var blankData = levelData.blanks[blankIndex];
        
        // Enable only the specified arrow buttons for this blank
        if (blankLeftButton != null)
        {
            blankLeftButton.gameObject.SetActive(true);
            blankLeftButton.interactable = blankData.enabledArrows.Contains("turn left");
            blankLeftButton.onClick.RemoveAllListeners();
            blankLeftButton.onClick.AddListener(() => OnGuidedBlankFilled("turn left"));
        }
        if (blankRightButton != null)
        {
            blankRightButton.gameObject.SetActive(true);
            blankRightButton.interactable = blankData.enabledArrows.Contains("turn right");
            blankRightButton.onClick.RemoveAllListeners();
            blankRightButton.onClick.AddListener(() => OnGuidedBlankFilled("turn right"));
        }
        if (blankForwardButton != null)
        {
            blankForwardButton.gameObject.SetActive(true);
            blankForwardButton.interactable = blankData.enabledArrows.Contains("forward");
            blankForwardButton.onClick.RemoveAllListeners();
            blankForwardButton.onClick.AddListener(() => OnGuidedBlankFilled("forward"));
        }
        if (blankBackwardButton != null)
        {
            blankBackwardButton.gameObject.SetActive(true);
            blankBackwardButton.interactable = blankData.enabledArrows.Contains("backward");
            blankBackwardButton.onClick.RemoveAllListeners();
            blankBackwardButton.onClick.AddListener(() => OnGuidedBlankFilled("backward"));
        }

        // Start pulsing the current blank slot
        if (blankIndex < blankSlotInstances.Count)
        {
            StartCoroutine(PulseBlankSlot(blankSlotInstances[blankIndex]));
        }

        waitingForGuidedInput = true;
        PlayWhichArrowAudio();
    }


    private void PlayWhichArrowAudio()
    {
        GameInteractionSounds.PlayGuidedBlankPrompt();
        // Optionally, show a text prompt as well
        if (chatGPTResponseText != null)
        {
            chatGPTResponseText.text = "Which arrow belongs here?";
        }
    }

    /// <summary>One-time copy from scene fields into <see cref="GameInteractionSoundsSettings"/>.</summary>
    public void MigrateInteractionSoundClipsTo(GameInteractionSoundsSettings target)
    {
        if (target == null) return;
        if (target.guidedBlankPromptClip == null && whichArrowAudioClip != null)
            target.guidedBlankPromptClip = whichArrowAudioClip;
    }



    public Sprite blankSlotSprite; // Assign a question mark or blank icon in inspector
    public Button blankLeftButton; // Assign in inspector, for 'turn left' choice
    public Button blankRightButton; // Assign in inspector, for 'turn right' choice

    private string userBlankChoice = null; // Track user's answer for blank

    private void ResetBlankSlotUI()
    {
        // This method is now obsolete as the level reloads on wrong answer
    }

    private bool IsBlankAnswerCorrect()
    {
        LevelData levelData = GetCurrentLevelData();
        if (levelData?.blanks == null || levelData.blanks.Count == 0) return true;
        if (userBlankChoices.Count < levelData.blanks.Count) return false;
        for (int i = 0; i < levelData.blanks.Count; i++)
        {
            if (!GuidedAnswerMatches(userBlankChoices[i], levelData.blanks[i].correctAnswer))
                return false;
        }
        return true;
    }

    private static bool GuidedAnswerMatches(string userChoice, string expected)
    {
        return string.Equals(userChoice?.Trim(), expected?.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Runs the guided queue after a blank is filled (same path as wrong-answer run).</summary>
    private IEnumerator RunGuidedProgramAfterBlankFillCoroutine()
    {
        // Let queue/UI updates from OnGuidedBlankFilled finish this frame.
        yield return null;

        if (actionQueue == null || actionQueue.Count == 0)
        {
            Debug.LogWarning("[CharacterMove] Guided run skipped: action queue is empty.");
            yield break;
        }

        if (IsRunBlockedByFlagRequirement())
        {
            if (chatGPTResponseText != null)
                chatGPTResponseText.text = "Place the flag on a cell first — that cell is your goal.";
            Debug.Log("[CharacterMove] Guided run blocked: flag not placed yet (flag-placement level only).");
            yield break;
        }

        if (isProcessing && currentMoveCoroutine != null)
        {
            StopCoroutine(currentMoveCoroutine);
            currentMoveCoroutine = null;
        }
        isProcessing = false;

        CleanupInsertionPlaceholders();
        StopFadingAndResetSpriteColor();
        ResetRobotToLevelStart();
        attemptStartGridPos = robotGridPosition;
        attemptStartFacing = facingDirection;
        movesUsedInCurrentAttempt = 0;

        if (runButton != null) runButton.interactable = true;
        isProcessing = true;
        yield return StartCoroutine(ProcessActions());
    }

    /// <summary>After all guided blanks are filled, enable RUN and optionally auto-start the queue.</summary>
    private void TryStartRunAfterGuidedBlank()
    {
        if (runButton != null) runButton.interactable = true;

        if (autoRunAfterGuidedBlankFilled)
        {
            if (chatGPTResponseText != null)
                chatGPTResponseText.text = "Running your programâ€¦";
            StartCoroutine(RunGuidedProgramAfterBlankFillCoroutine());
        }
        else if (chatGPTResponseText != null)
        {
            chatGPTResponseText.text = "Press RUN to go!";
        }
    }

    private static readonly Quaternion GridSpriteFlatRotation = Quaternion.Euler(90f, 0f, 0f);

    private bool _presentation3DAngled;

    public bool IsPresentation3DAngled() => _presentation3DAngled;
    public float Presentation3DObjectYaw => presentation3DObjectYaw;

    /// <summary>Called by MultiTargetCamera when switching to/from Chess Corner (3D) view.</summary>
    public void SetPresentation3DAngled(bool angled)
    {
        if (_presentation3DAngled == angled) return;
        _presentation3DAngled = angled;
        LevelData ld = GetCurrentLevelData();
        if (UsesNumberLine(ld))
            EnsureNumberLineVisual(ld);
        else
            CreateOrRefreshGridImage();
        foreach (var go in activeGridObjects)
            Apply3DPresentationToSpawnedObject(go, angled);
        if (activeFlag != null)
            Apply3DPresentationToSpawnedObject(activeFlag, angled);
    }

    private void Apply3DPresentationToSpawnedObject(GameObject obj, bool angled)
    {
        if (obj == null) return;
        if (angled)
        {
            var sr = obj.GetComponentInChildren<SpriteRenderer>(true);
            if (sr != null)
            {
                obj.transform.rotation = Quaternion.Euler(58f, presentation3DObjectYaw, 0f);
                MakeSpriteRendererDoubleSided(sr);
            }
            foreach (var r in obj.GetComponentsInChildren<Renderer>(true))
                r.enabled = true;
        }
        else
        {
            var sr = obj.GetComponentInChildren<SpriteRenderer>(true);
            if (sr != null)
                obj.transform.localRotation = GridSpriteFlatRotation;
        }
    }

    private static void MakeSpriteRendererDoubleSided(SpriteRenderer sr)
    {
        if (sr == null || sr.sharedMaterial == null) return;
        var mat = new Material(sr.sharedMaterial);
        if (mat.HasProperty("_Cull"))
            mat.SetInt("_Cull", (int)UnityEngine.Rendering.CullMode.Off);
        sr.sharedMaterial = mat;
    }

    private void NormalizeSpawnedGridObject(GameObject obj, GridObjectData gridObject)
    {
        if (obj == null) return;

        var spriteRenderer = obj.GetComponentInChildren<SpriteRenderer>(true);
        if (spriteRenderer != null)
        {
            float x = obj.transform.localEulerAngles.x;
            if (x < 45f || x > 315f)
                obj.transform.localRotation = GridSpriteFlatRotation;

            spriteRenderer.enabled = true;
            if (spriteRenderer.color.a < 0.02f)
                spriteRenderer.color = Color.white;
        }

        if (_presentation3DAngled)
            Apply3DPresentationToSpawnedObject(obj, true);
        else
            ApplySpawnedGridObjectVisuals(obj, gridObject);
    }

    private void EnsureNumberLineVisual(LevelData levelData)
    {
        if (levelData == null || !UsesNumberLine(levelData)) return;
        if (numberLineVisual == null)
            numberLineVisual = GetComponent<NumberLineVisual>();
        if (numberLineVisual == null)
            numberLineVisual = gameObject.AddComponent<NumberLineVisual>();
        numberLineVisual.characterMove = this;
        numberLineVisual.gameObject.SetActive(true);
        numberLineVisual.BuildForLevel(levelData);
    }

    /// <summary>Swaps the 6×6 grid floor for a number-line axis (or the reverse) when a level loads.</summary>
    private void ApplyPlayfieldVisualLayout(LevelData levelData)
    {
        if (levelData == null) return;

        if (UsesNumberLine(levelData))
        {
            SetGridPlayfieldVisible(false);
            DestroyGridImage(forceIncludeManual: true);
            if (numberLineVisual != null)
                numberLineVisual.Clear();
            EnsureNumberLineVisual(levelData);
            Debug.Log($"[CharacterMove] Playfield: NUMBER_LINE ({levelData.levelKey}, ticks={levelData.numberLine?.tickCount})");
        }
        else
        {
            if (numberLineVisual != null)
            {
                numberLineVisual.Clear();
                numberLineVisual.gameObject.SetActive(false);
            }
            SetGridPlayfieldVisible(true);
            if (!_presentation3DAngled)
                CreateOrRefreshGridImage();
            Debug.Log($"[CharacterMove] Playfield: GRID ({levelData.levelKey})");
        }
    }

    /// <summary>Show or hide the 6×6 grid floor (including scene-placed GridImage_Stretched).</summary>
    private void SetGridPlayfieldVisible(bool visible)
    {
        Transform stretched = ResolveGridImageStretchedTransform();
        if (stretched != null)
            stretched.gameObject.SetActive(visible);

        if (_gridImageRoot != null)
            _gridImageRoot.gameObject.SetActive(visible);

        void SetUnder(Transform root)
        {
            if (root == null) return;
            for (int i = root.childCount - 1; i >= 0; i--)
            {
                Transform child = root.GetChild(i);
                if (!child.name.Contains("GridImage"))
                    continue;
                child.gameObject.SetActive(visible);
            }
        }

        SetUnder(transform);
        SetUnder(gridOriginTransform);

        Transform auto = transform.Find("GridImage (auto)");
        if (auto != null)
            auto.gameObject.SetActive(visible);
    }

    private bool RobotIsOnVisitStartCell()
    {
        if (startObjectPosition.x < 0 && startObjectPosition.y < 0) return false;
        LevelData ld = PlayfieldLevelData();
        if (UsesNumberLine(ld))
            return robotGridPosition.x == startObjectPosition.x;
        return RobotIsOnGoalCell(startObjectPosition);
    }

    private bool RobotIsOnGoalCell(Vector2Int cell)
    {
        if (cell.x < 0 || cell.y < 0) return false;

        LevelData ld = PlayfieldLevelData();
        if (robotGridPosition == cell) return true;

        float spacing = GetCellSpacingForLayout(ld);
        Vector3 goalWorld = UsesNumberLine(ld)
            ? WorldPositionForGridCell(cell, ld)
            : GridCellToWorld(cell, ld);

        Vector3 robotFlat = new Vector3(transform.position.x, 0f, transform.position.z);
        Vector3 goalFlat = new Vector3(goalWorld.x, 0f, goalWorld.z);
        return Vector3.Distance(robotFlat, goalFlat) < spacing * 0.55f;
    }

    /// <summary>Number-line robots use the line row; start props often share tick X but a different Y.</summary>
    private void SyncStartObjectReachedState()
    {
        LevelData ld = GetCurrentLevelData();
        if (ld == null) return;

        if (startObjectPosition.x < 0 && startObjectPosition.y < 0)
        {
            if (UsesNumberLine(ld))
                hasReachedStartObject = true;
            return;
        }

        if (UsesNumberLine(ld))
        {
            if (RobotIsOnVisitStartCell())
            {
                hasReachedStartObject = true;
                visitedStartObjectThisLevel = true;
                Debug.Log($"[CharacterMove] Start tick visited (number line): tick={startObjectPosition.x} robot={robotGridPosition}");
            }
            return;
        }

        if (robotGridPosition == startObjectPosition)
        {
            hasReachedStartObject = true;
            visitedStartObjectThisLevel = true;
            Debug.Log($"[CharacterMove] Robot on start object cell {startObjectPosition}");
        }
    }

    /// <summary>Raises draw order / visibility for important grid props (start / end markers like box, bin).</summary>
    private void ApplySpawnedGridObjectVisuals(GameObject obj, GridObjectData gridObject)
    {
        if (obj == null || gridObject == null) return;

        if (gridObject.isEndObject || gridObject.isStartObject)
        {
            Vector3 p = obj.transform.position;
            obj.transform.position = new Vector3(p.x, p.y + 0.03f, p.z);
        }

        int minOrder = cellBlinkSortingOrder + (gridObject.isEndObject ? endObjectSortingOrderBoost : 5);
        foreach (var s in obj.GetComponentsInChildren<SpriteRenderer>(true))
        {
            s.enabled = true;
            if (s.color.a < 0.02f)
                s.color = Color.white;
            s.sortingOrder = Mathf.Max(s.sortingOrder, minOrder);
        }

        foreach (var r in obj.GetComponentsInChildren<Renderer>(true))
            r.enabled = true;
    }

    private void ShowTryAgainMessage()
    {
        if (chatGPTResponseText != null)
            chatGPTResponseText.text = "Try again! Which arrow belongs here?";
    }

    private IEnumerator PulseBlankSlot(GameObject slot)
    {
        if (slot == null) yield break;
        Color colorA = Color.blue;
        Color colorB = Color.white;
        float flashSpeed = 2.5f; // Flash speed
        float t = 0f;
        Image img = slot.GetComponent<Image>();
        while (waitingForGuidedInput && slot != null)
        {
            t += Time.deltaTime;
            // Flash
            float flash = (Mathf.Sin(t * flashSpeed) + 1f) / 2f;
            if (img != null)
                img.color = Color.Lerp(colorA, colorB, flash);
            yield return null;
        }
        if (slot != null && img != null)
            img.color = colorA;
    }

    public GameObject wrongAnswerPopup; // Assign in Inspector
    public Button wrongAnswerTryAgainButton; // Assign in Inspector

    public MultiTargetCamera multiTargetCamera; // Assign in Inspector

    public Button blankForwardButton;  // Assign in Inspector, for 'forward' choice
    public Button blankBackwardButton; // Assign in Inspector, for 'backward' choice
    


    // Coroutine to execute wrong action sequence and then show popup
    private IEnumerator ExecuteWrongActionAndShowPopup()
    {
        yield return StartCoroutine(RunGuidedProgramAfterBlankFillCoroutine());
    }




    
    // Add this helper method for grid object drag functionality
    // Called by GridObjectCluster when drag ends (OnMouseUp)
    public void UpdateDraggedGridObjectPosition(Vector3 worldPos, GameObject draggedObject)
    {
        if (draggedObject == null) return;

        // Draggable goal flag (world pickup, same wiring as banana / box)
        if (IsFlagPlacementActive && activeFlag != null && ReferenceEquals(draggedObject, activeFlag))
        {
            Vector2Int newGridPos = WorldToGridCell(worldPos);
            if (!CanPlaceFlagOnCell(newGridPos))
            {
                Vector3 revert = GridCellToWorld(flagCell);
                draggedObject.transform.position = new Vector3(revert.x, draggedObject.transform.position.y, revert.z);
                var rbSnap = draggedObject.GetComponent<Rigidbody>();
                if (rbSnap != null)
                {
                    rbSnap.velocity = Vector3.zero;
                    rbSnap.angularVelocity = Vector3.zero;
                }

                Debug.Log($"[CharacterMove] Flag drag rejected â€” cell {newGridPos} occupied or invalid.");
                return;
            }

            Vector2Int prevFlag = flagCell;
            flagCell          = newGridPos;
            endObjectPosition = newGridPos;

            if (hiddenMatrix != null)
            {
                if (IsInsideMatrix(prevFlag) &&
                    hiddenMatrix[prevFlag.x, prevFlag.y].kind == HiddenCellKind.EndObject)
                {
                    hiddenMatrix[prevFlag.x, prevFlag.y] = new HiddenCell { kind = HiddenCellKind.Empty };
                }

                hiddenMatrix[newGridPos.x, newGridPos.y] = new HiddenCell
                {
                    kind         = HiddenCellKind.EndObject,
                    objectType   = "flag",
                    instance     = activeFlag,
                };
            }

            Debug.Log($"[CharacterMove] Flag dragged to grid {prevFlag} -> {newGridPos}");
            return;
        }

        if (allLevelsData != null && currentLevel > 0 && currentLevel <= allLevelsData.Count)
        {
            var levelData = allLevelsData[currentLevel - 1];
            
            // Calculate grid position from world position (same convention as placement/snap)
            Vector2Int newGridPos = WorldToGridCell(worldPos);

            // Update the grid object's position in the level data
            foreach (var gridObject in levelData.gridObjects)
            {
                // Find the grid object that matches the dragged object
                Vector3 objWorldPos = GridCellToWorld(gridObject.position);
                if (Vector3.Distance(objWorldPos, draggedObject.transform.position) < 0.1f)
                {
                    Vector2Int prevCell = gridObject.position;
                    gridObject.position = newGridPos;
                    OnGridObjectMovedInMatrix(prevCell, newGridPos);
                    Debug.Log($"[CharacterMove] Updated {gridObject.objectType} position {prevCell} -> {newGridPos}");
                    break;
                }
            }
        }
    }

    // (Old manual-calibration helpers removed â€” use gridOriginTransform instead.)

    // Clean up old AppleCluster scripts from the scene
    private void CleanupOldAppleClusterScripts()
    {
        // Use reflection to find AppleCluster components safely
        var appleClusterType = System.Type.GetType("AppleCluster");
        if (appleClusterType != null)
        {
            var oldAppleClusters = FindObjectsOfType(appleClusterType);
            if (oldAppleClusters.Length > 0)
            {
                Debug.Log($"[CharacterMove] Found {oldAppleClusters.Length} old AppleCluster scripts to clean up");
                foreach (var oldCluster in oldAppleClusters)
                {
                    if (oldCluster != null)
                    {
                        Debug.Log($"[CharacterMove] Removing old AppleCluster script from {oldCluster.name}");
                        DestroyImmediate(oldCluster);
                    }
                }
            }
        }
        else
        {
            Debug.Log("[CharacterMove] AppleCluster type not found - no cleanup needed");
        }
    }

    // Helper method to calculate grid size from two adjacent grid positions
    [ContextMenu("Calculate Grid Size")]
    public void CalculateGridSize()
    {
        // Create two temporary objects to measure
        GameObject temp1 = new GameObject("GridMeasure1");
        GameObject temp2 = new GameObject("GridMeasure2");
        
        // Position them at adjacent grid cells
        temp1.transform.position = GridCellToWorld(Vector2Int.zero);
        temp2.transform.position = GridCellToWorld(new Vector2Int(1, 0)); // One cell to the right
        
        // Calculate distance
        float calculatedGridSize = Vector3.Distance(temp1.transform.position, temp2.transform.position);
        
        // Update the gridSize
        gridSize = calculatedGridSize;
        
        // Clean up
        DestroyImmediate(temp1);
        DestroyImmediate(temp2);
        
        Debug.Log($"[CharacterMove] Calculated grid size: {calculatedGridSize}");
    }

    // Helper method to measure distance between two world positions
    public float MeasureDistance(Vector3 pos1, Vector3 pos2)
    {
        return Vector3.Distance(pos1, pos2);
    }

    // -------------------------------------------------------------------------------------
    // Grid auto-calibration
    // -------------------------------------------------------------------------------------
    // Why this exists:
    //   The visual tile sprite/mesh in the scene defines the "real" tile width. The script
    //   computes movement and object placement off (gridSize, robotStartWorldPos).
    //   If any of those is slightly off, the robot's forward step won't span a full tile and
    //   props end up on tile intersections instead of tile centers (the exact symptoms in the
    //   reported screenshot). Letting the user drop two empty markers at known cell centers
    //   removes the guesswork entirely.
    // â”€â”€ Grid computation helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    /// <summary>Logs the active virtual-matrix parameters to the Console.</summary>
    [ContextMenu("Log Virtual Matrix Info")]
    public void LogGridInfo()
    {
        string origin = GetGridOriginWorld().ToString("F2");
        Debug.Log($"[CharacterMove] gridSize={gridSize:F2} | cell(0,0)={origin} | autoCenter={gridAutoCenterOnOrigin} | {gridCols}×{gridRows} virtual matrix (cells (0,0)..({gridCols - 1},{gridRows - 1}))");
    }

    // -------------------------------------------------------------------
    // Auto-scale spawned objects to the current cell size.
    // -------------------------------------------------------------------

    private bool _robotOriginalScaleCached;
    private Vector3 _robotOriginalScale = Vector3.one;

    /// <summary>Reset robot to its original (prefab) scale, then fit it to the current cell size.</summary>
    public void FitRobotToCell()
    {
        float cellSize = GetCellSpacingForLayout(PlayfieldLevelData());
        if (!autoFitRobotToCell || cellSize <= 0f) return;
        if (!_robotOriginalScaleCached)
        {
            _robotOriginalScale = transform.localScale;
            _robotOriginalScaleCached = true;
        }
        transform.localScale = _robotOriginalScale;
        FitObjectToCell(gameObject, robotCellFillMultiplier);
    }

    /// <summary>
    /// Scales <paramref name="obj"/> so its largest XZ-axis bounds equals
    /// <see cref="gridSize"/> * <see cref="cellFillRatio"/> * <paramref name="extraMultiplier"/>.
    /// Bounds are computed from the union of Renderer / SpriteRenderer / RectTransform.
    /// </summary>
    public void FitObjectToCell(GameObject obj, float extraMultiplier = 1f)
    {
        LevelData ld = PlayfieldLevelData();
        float cellSize = GetCellSpacingForLayout(ld);
        if (obj == null || cellSize <= 0f || !autoFitObjectsToCell) return;

        if (!TryGetObjectWorldExtents(obj, out Vector3 worldSize) || worldSize.x <= 0.0001f) return;

        float layoutScale = 1f;
        if (ld != null && UsesNumberLine(ld))
            layoutScale = obj == gameObject ? GetNumberLineRobotScale(ld) : GetNumberLineObjectScale(ld);

        float desired = cellSize * cellFillRatio * extraMultiplier * layoutScale;
        float largest = Mathf.Max(worldSize.x, Mathf.Max(worldSize.y, worldSize.z));
        if (largest <= 0.0001f) return;

        float k = desired / largest;
        obj.transform.localScale *= k;
    }

    private static bool TryGetObjectWorldExtents(GameObject obj, out Vector3 size)
    {
        size = Vector3.zero;
        bool any = false;
        Bounds total = default;

        foreach (var r in obj.GetComponentsInChildren<Renderer>(true))
        {
            if (!any) { total = r.bounds; any = true; }
            else total.Encapsulate(r.bounds);
        }

        if (!any)
        {
            foreach (var rt in obj.GetComponentsInChildren<RectTransform>(true))
            {
                Vector3[] corners = new Vector3[4];
                rt.GetWorldCorners(corners);
                Bounds b = new Bounds(corners[0], Vector3.zero);
                for (int i = 1; i < 4; i++) b.Encapsulate(corners[i]);
                if (!any) { total = b; any = true; }
                else total.Encapsulate(b);
            }
        }

        if (any) size = total.size;
        return any;
    }

    // -------------------------------------------------------------------
    // Optional grid image (aligned to the gizmo grid)
    // -------------------------------------------------------------------

    /// <summary>Parent transform that holds spawned grid-image sprites.</summary>
    private Transform _gridImageRoot;
    private Transform _cellBlinkRoot;

    /// <summary>Removes runtime blink overlays on start/end cells.</summary>
    public void ClearCellBlinkHighlights()
    {
        if (_cellBlinkRoot != null)
        {
            if (Application.isPlaying) Destroy(_cellBlinkRoot.gameObject);
            else DestroyImmediate(_cellBlinkRoot.gameObject);
            _cellBlinkRoot = null;
        }
    }

    /// <summary>
    /// Spawns blinking squares on fixed start/end cells (Level 1, 3, â€¦).
    /// Skipped when <see cref="LevelData.playerPicksEndCellWithFlag"/> is true (Level 2).
    /// </summary>
    public void RefreshCellBlinkHighlights(LevelData levelData)
    {
        ClearCellBlinkHighlights();
        float spacing = GetCellSpacingForLayout(levelData);
        if (!showGoalCellBlink || levelData == null || spacing <= 0f) return;
        if (!levelData.showCellBlinkHighlights) return;
        if (levelData.useFlagPlacement && levelData.playerPicksEndCellWithFlag) return;

        bool hasGoalCell = levelData.goalCell.x >= 0 && levelData.goalCell.y >= 0;
        if ((levelData.gridObjects == null || levelData.gridObjects.Count == 0) && !hasGoalCell) return;

        Vector3 origin = GetGridOriginWorld();
        _cellBlinkRoot = new GameObject("GridCellHighlights").transform;
        if (gridOriginTransform != null)
        {
            Vector3 lossy = gridOriginTransform.lossyScale;
            bool clean = Mathf.Abs(lossy.x - 1f) < 0.001f && Mathf.Abs(lossy.y - 1f) < 0.001f && Mathf.Abs(lossy.z - 1f) < 0.001f;
            if (clean)
            {
                _cellBlinkRoot.SetParent(gridOriginTransform, false);
                _cellBlinkRoot.localPosition = Vector3.zero;
                _cellBlinkRoot.localRotation = Quaternion.identity;
                _cellBlinkRoot.localScale = Vector3.one;
            }
            else
            {
                _cellBlinkRoot.position = origin;
            }
        }

        float side = spacing * Mathf.Clamp(cellBlinkSizeRatio, 0.5f, 1.1f);

        int spawned = 0;
        bool goalBlinkFromCell = false;

        if (levelData.gridObjects != null)
        {
            foreach (var entry in levelData.gridObjects)
            {
                if (entry.isStartObject && levelData.blinkStartCells)
                {
                    SpawnCellBlinkMarker(levelData, entry.position, GridCellBlinkMarker.MarkerKind.Start, side, origin);
                    spawned++;
                }

                if (entry.isEndObject && levelData.blinkEndCells)
                {
                    Vector2Int endCell = (entry.guidedEndPosition != Vector2Int.zero)
                        ? entry.guidedEndPosition
                        : entry.position;
                    SpawnCellBlinkMarker(levelData, endCell, GridCellBlinkMarker.MarkerKind.End, side, origin);
                    if (hasGoalCell && endCell == levelData.goalCell) goalBlinkFromCell = true;
                    spawned++;
                }
            }
        }

        if (hasGoalCell && levelData.blinkEndCells && !goalBlinkFromCell)
        {
            SpawnCellBlinkMarker(levelData, levelData.goalCell, GridCellBlinkMarker.MarkerKind.End, side, origin);
            spawned++;
        }

        Debug.Log($"[CharacterMove] Cell blink highlights: {spawned} marker(s) for '{levelData.levelName}' " +
                  $"(start={levelData.blinkStartCells}, end={levelData.blinkEndCells}, numberLine={UsesNumberLine(levelData)}).");
    }

    /// <summary>On NUMBER_LINE levels, blink on the tick column (line row), not on prop offset rows.</summary>
    private Vector2Int ResolveBlinkHighlightCell(LevelData levelData, Vector2Int objectCell)
    {
        if (levelData != null && UsesNumberLine(levelData))
            return new Vector2Int(objectCell.x, GetNumberLineRow(levelData));
        return objectCell;
    }

    private int BlinkMarkerSortingOrder(LevelData levelData, GridCellBlinkMarker.MarkerKind kind)
    {
        if (levelData != null && UsesNumberLine(levelData))
        {
            int boost = kind == GridCellBlinkMarker.MarkerKind.End ? endObjectSortingOrderBoost : 5;
            return numberLineSortingOrder + boost;
        }
        return cellBlinkSortingOrder + (kind == GridCellBlinkMarker.MarkerKind.End ? endObjectSortingOrderBoost : 0);
    }

    private void SpawnCellBlinkMarker(LevelData levelData, Vector2Int cell, GridCellBlinkMarker.MarkerKind kind, float worldSide, Vector3 origin)
    {
        Vector2Int blinkCell = ResolveBlinkHighlightCell(levelData, cell);
        if (!CellInGridBounds(blinkCell)) return;

        Vector3 cellWorld = GridCellToWorld(blinkCell, levelData);
        Vector3 center = new Vector3(cellWorld.x, cellWorld.y + cellBlinkYOffset, cellWorld.z);

        var go = new GameObject(kind == GridCellBlinkMarker.MarkerKind.End
            ? $"Blink_End_{blinkCell.x}_{blinkCell.y}"
            : $"Blink_Start_{blinkCell.x}_{blinkCell.y}");
        go.transform.SetParent(_cellBlinkRoot, true);
        go.transform.position = center;
        go.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
        go.transform.localScale = new Vector3(worldSide, worldSide, 1f);

        var marker = go.AddComponent<GridCellBlinkMarker>();
        Color c = (kind == GridCellBlinkMarker.MarkerKind.End) ? endCellBlinkColor : startCellBlinkColor;
        marker.Configure(kind, c, BlinkMarkerSortingOrder(levelData, kind), cellBlinkSpeed);
    }

    /// <summary>Right-click the component → "Create/Refresh Grid Image" to spawn (or rebuild)
    /// a sprite that exactly matches the current gizmo grid (gridCols × gridRows × gridSize).
    /// Uses <see cref="gridImageSprite"/>. If <see cref="tilePerCell"/> is on, spawns one sprite per cell;
    /// otherwise spawns one stretched sprite covering the whole matrix.
    /// When <see cref="preserveManualGridImageTransform"/> is on, an existing GridImage_Stretched keeps its Transform.
    /// </summary>
    [ContextMenu("Create/Refresh Grid Image")]
    public void CreateOrRefreshGridImage()
    {
        LevelData ld = PlayfieldLevelData();
        if (ld != null && UsesNumberLine(ld))
        {
            SetGridPlayfieldVisible(false);
            return;
        }

        if (gridImageSprite == null)
        {
            Debug.LogWarning("[CharacterMove] Assign 'Grid Image Sprite' first, then run this command.");
            return;
        }
        if (gridSize <= 0f || gridCols < 1 || gridRows < 1)
        {
            Debug.LogWarning("[CharacterMove] gridSize / gridCols / gridRows must be > 0.");
            return;
        }

        if (!tilePerCell && preserveManualGridImageTransform &&
            TryRefreshManualGridImageStretched(out Transform manualStretched))
        {
            _gridImageRoot = null;
            Debug.Log($"[CharacterMove] Grid image refreshed (manual transform kept): {manualStretched.name} at {manualStretched.position}");
            return;
        }

        Vector3 origin = GetGridOriginWorld();

        DestroyGridImage();
        var root = new GameObject("GridImage (auto)").transform;
        // IMPORTANT: don't parent to the robot â€” the robot is auto-scaled by FitRobotToCell, and the
        // image would inherit that scale and appear oversized. Parent to GridOriginTransform if it's
        // a clean (scale = 1) anchor, otherwise leave at scene root.
        Vector3 lossy = (gridOriginTransform != null) ? gridOriginTransform.lossyScale : Vector3.zero;
        bool gridOriginCleanScale = gridOriginTransform != null &&
                                    Mathf.Abs(lossy.x - 1f) < 0.001f &&
                                    Mathf.Abs(lossy.y - 1f) < 0.001f &&
                                    Mathf.Abs(lossy.z - 1f) < 0.001f;
        if (gridOriginCleanScale)
        {
            root.SetParent(gridOriginTransform, false);
            root.localPosition = Vector3.zero;
            root.localRotation = Quaternion.identity;
            root.localScale = Vector3.one;
        }
        else
        {
            root.SetParent(null, false);
            root.position = origin;
            root.rotation = Quaternion.identity;
            root.localScale = Vector3.one;
        }
        _gridImageRoot = root;

        Vector2 spritePxSize = gridImageSprite.rect.size;
        float ppu = gridImageSprite.pixelsPerUnit;
        if (ppu <= 0f) ppu = 100f;

        float spriteWWorld = spritePxSize.x / ppu;
        float spriteHWorld = spritePxSize.y / ppu;
        float mul = Mathf.Max(0.0001f, gridImageScaleMultiplier);

        if (tilePerCell)
        {
            // One sprite per cell â€” each sprite scaled in world units to gridSize * multiplier.
            for (int col = 0; col < gridCols; col++)
            {
                for (int row = 0; row < gridRows; row++)
                {
                    Vector3 worldCenter = new Vector3(
                        origin.x + col * gridSize,
                        origin.y + gridImageYOffset,
                        origin.z + row * gridSize);

                    var go = new GameObject($"Cell_{col}_{row}");
                    go.transform.SetParent(root, true);
                    go.transform.position = worldCenter;
                    go.transform.rotation = Quaternion.Euler(90f, 0f, 0f); // lay flat in XZ
                    if (spriteWWorld > 0.0001f && spriteHWorld > 0.0001f)
                        go.transform.localScale = new Vector3((gridSize * mul) / spriteWWorld, (gridSize * mul) / spriteHWorld, 1f);

                    var sr = go.AddComponent<SpriteRenderer>();
                    sr.sprite = gridImageSprite;
                    sr.color = gridImageTint;
                    sr.sortingOrder = gridImageSortingOrder;
                }
            }
        }
        else
        {
            // One stretched sprite covering the whole matrix in world units.
            Vector3 matrixCenter = origin + new Vector3((gridCols - 1) * 0.5f * gridSize, gridImageYOffset, (gridRows - 1) * 0.5f * gridSize);
            float totalW = gridCols * gridSize * mul;
            float totalD = gridRows * gridSize * mul;

            var go = new GameObject("GridImage_Stretched");
            go.transform.SetParent(root, true);
            go.transform.position = matrixCenter;
            go.transform.rotation = Quaternion.Euler(90f, 0f, 0f); // sprite lies flat in XZ
            if (spriteWWorld > 0.0001f && spriteHWorld > 0.0001f)
                go.transform.localScale = new Vector3(totalW / spriteWWorld, totalD / spriteHWorld, 1f);

            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = gridImageSprite;
            sr.color = gridImageTint;
            sr.sortingOrder = gridImageSortingOrder;
        }

        Debug.Log($"[CharacterMove] Grid image spawned. {gridCols}×{gridRows}, gridSize={gridSize}, tilePerCell={tilePerCell}");
    }

    private Transform ResolveGridImageStretchedTransform()
    {
        if (gridImageStretchedOverride != null)
            return gridImageStretchedOverride;

        if (gridOriginTransform != null)
        {
            foreach (Transform child in gridOriginTransform.GetComponentsInChildren<Transform>(true))
            {
                if (child.name == "GridImage_Stretched")
                    return child;
            }
        }

        var sceneObject = GameObject.Find("GridImage_Stretched");
        return sceneObject != null ? sceneObject.transform : null;
    }

    private bool TryRefreshManualGridImageStretched(out Transform stretched)
    {
        stretched = ResolveGridImageStretchedTransform();
        if (stretched == null) return false;

        var sr = stretched.GetComponent<SpriteRenderer>();
        if (sr == null)
            sr = stretched.gameObject.AddComponent<SpriteRenderer>();

        sr.sprite = gridImageSprite;
        sr.color = gridImageTint;
        sr.sortingOrder = gridImageSortingOrder;
        sr.enabled = true;
        return true;
    }

    private bool ContainsGridImageStretched(Transform root)
    {
        if (root == null) return false;
        if (root.name == "GridImage_Stretched") return true;
        for (int i = 0; i < root.childCount; i++)
        {
            if (ContainsGridImageStretched(root.GetChild(i)))
                return true;
        }
        return false;
    }

    /// <summary>Destroys spawned grid-image sprites (robot child, grid origin, or scene-persisted).</summary>
    [ContextMenu("Destroy Grid Image")]
    public void DestroyGridImage(bool forceIncludeManual = false)
    {
        if (_gridImageRoot != null)
        {
            bool keepManualHierarchy = !forceIncludeManual &&
                                       preserveManualGridImageTransform &&
                                       ContainsGridImageStretched(_gridImageRoot);
            if (!keepManualHierarchy)
            {
                if (Application.isPlaying) Destroy(_gridImageRoot.gameObject);
                else DestroyImmediate(_gridImageRoot.gameObject);
            }
            _gridImageRoot = null;
        }

        void DestroyGridImagesUnder(Transform root)
        {
            if (root == null) return;
            for (int i = root.childCount - 1; i >= 0; i--)
            {
                Transform child = root.GetChild(i);
                if (!child.name.Contains("GridImage"))
                    continue;

                if (!forceIncludeManual &&
                    preserveManualGridImageTransform &&
                    ContainsGridImageStretched(child))
                    continue;

                if (Application.isPlaying) Destroy(child.gameObject);
                else DestroyImmediate(child.gameObject);
            }
        }

        DestroyGridImagesUnder(transform);
        DestroyGridImagesUnder(gridOriginTransform);

        var existing = transform.Find("GridImage (auto)");
        if (existing != null &&
            (forceIncludeManual ||
             !(preserveManualGridImageTransform && ContainsGridImageStretched(existing))))
        {
            if (Application.isPlaying) Destroy(existing.gameObject);
            else DestroyImmediate(existing.gameObject);
        }

        if (forceIncludeManual)
        {
            Transform stretched = ResolveGridImageStretchedTransform();
            if (stretched != null)
                stretched.gameObject.SetActive(false);
        }
    }

#if UNITY_EDITOR
    [Header("Gizmo Labels")]
    [Tooltip("Show cell coordinate labels (col,row) in the Scene view next to each cell center.")]
    public bool drawCellCoordinateLabels = true;

    private void OnDrawGizmos()
    {
        if (!drawGridGizmos) return;
        if (gridSize <= 0f || gridCols < 1 || gridRows < 1) return;

        // Use the assigned origin transform when available (works in Edit mode before Start runs).
        Vector3 origin = GetGridOriginWorld();

        // Outer boundary of the virtual matrix
        Vector3 matrixCenter = origin + new Vector3((gridCols - 1) * 0.5f * gridSize, 0f, (gridRows - 1) * 0.5f * gridSize);
        Vector3 matrixSize   = new Vector3(gridCols * gridSize, 0.04f, gridRows * gridSize);
        Gizmos.color = new Color(gridGizmoCellOutlineColor.r, gridGizmoCellOutlineColor.g, gridGizmoCellOutlineColor.b, 1f);
        Gizmos.DrawWireCube(matrixCenter, matrixSize);

        var labelStyle = new GUIStyle { fontSize = 10, normal = { textColor = Color.white } };
        for (int col = 0; col < gridCols; col++)
        {
            for (int row = 0; row < gridRows; row++)
            {
                Vector3 center = new Vector3(
                    origin.x + col * gridSize,
                    origin.y,
                    origin.z + row * gridSize);

                Gizmos.color = gridGizmoCellOutlineColor;
                Gizmos.DrawWireCube(center, new Vector3(gridSize, 0.02f, gridSize));

                Gizmos.color = gridGizmoCellCenterColor;
                Gizmos.DrawSphere(center, gridSize * 0.06f);

                if (drawCellCoordinateLabels)
                    UnityEditor.Handles.Label(center + new Vector3(0f, gridSize * 0.02f, 0f), $"({col},{row})", labelStyle);
            }
        }

        // (0,0) marker
        Gizmos.color = Color.red;
        Gizmos.DrawSphere(origin, gridSize * 0.1f);
        if (drawCellCoordinateLabels)
            UnityEditor.Handles.Label(origin + new Vector3(0f, gridSize * 0.18f, 0f), "(0,0)",
                new GUIStyle { fontSize = 12, fontStyle = FontStyle.Bold, normal = { textColor = Color.red } });
    }
#endif
}
