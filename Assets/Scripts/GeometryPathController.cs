using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Observes robot grid moves, draws target geometry + trail, and validates Geometry Path levels.
/// Does not control robot movement — hooks into CharacterMove via NotifyRobotMoved / ValidateAfterRun.
/// </summary>
public class GeometryPathController : MonoBehaviour
{
    public static GeometryPathController Instance { get; private set; }

    [Header("Visuals")]
    [Tooltip("Y offset above the floor as a fraction of cell size.")]
    [Range(0.02f, 0.25f)] public float heightFraction = 0.08f;
    [Range(0.04f, 0.30f)] public float targetWidthFraction = 0.09f;
    [Range(0.04f, 0.30f)] public float trailWidthFraction = 0.18f;
    public Color targetIdleColor = new Color(0.62f, 0.38f, 0.98f, 0.45f);
    public Color targetCompletedColor = new Color(0.22f, 0.92f, 0.48f, 0.4f);
    public Color trailColor = new Color(0.05f, 0.78f, 1f, 1f);
    public Color offPathColor = new Color(1f, 0.32f, 0.28f, 1f);
    public Color targetGlowColor = new Color(0.85f, 0.70f, 1f, 0.18f);
    public Color studentDrawColor = new Color(1f, 0.82f, 0.12f, 0.95f);
    public Color studentEraseColor = new Color(1f, 0.42f, 0.58f, 0.95f);

    [Header("Motion / UX")]
    [Range(0.08f, 0.6f)] public float trailDrawDuration = 0.22f;
    [Range(0.2f, 1.2f)] public float introRevealDuration = 0.55f;
    [Range(0.5f, 3f)] public float idlePulseSpeed = 1.4f;

    CharacterMove _cm;
    GeometryPathData _config;
    Transform _root;
    readonly List<LineRenderer> _targetLines = new List<LineRenderer>();
    readonly List<LineRenderer> _targetGlowLines = new List<LineRenderer>();
    readonly List<LineRenderer> _trailLines = new List<LineRenderer>();
    readonly List<LineRenderer> _drawnLines = new List<LineRenderer>();
    readonly HashSet<string> _completedKeys = new HashSet<string>();
    readonly HashSet<string> _traveledKeys = new HashSet<string>();
    readonly List<string> _travelOrder = new List<string>();
    readonly HashSet<string> _drawnKeys = new HashSet<string>();
    readonly List<string> _drawnOrder = new List<string>();
    readonly HashSet<string> _expectedKeys = new HashSet<string>();
    /// <summary>Frozen after EndRunTracking so Try Again restore does not wipe report telemetry.</summary>
    string[] _lastTraveledKeys = System.Array.Empty<string>();
    string[] _lastCompletedKeys = System.Array.Empty<string>();
    string[] _lastTravelOrder = System.Array.Empty<string>();
    string[] _lastDrawnKeys = System.Array.Empty<string>();
    string[] _lastExpectedKeys = System.Array.Empty<string>();
    string[] _lastRobotTraveledKeys = System.Array.Empty<string>();
    Vector2Int _lastRobotCell;
    Vector2Int _lastRobotFacing;
    GameObject _startMarker;
    GameObject _hoverMarker;
    GameObject _drawStartMarker;
    GameObject _penMarker;
    GameObject _toolCursor;
    Sprite _pencilCursorSprite;
    Sprite _eraserCursorSprite;
    LineRenderer _previewLine;
    readonly List<GameObject> _nodeMarkers = new List<GameObject>();
    readonly List<GameObject> _neighborPads = new List<GameObject>();
    static readonly Vector2Int[] OrthoDirs =
    {
        new Vector2Int(1, 0), new Vector2Int(-1, 0),
        new Vector2Int(0, 1), new Vector2Int(0, -1)
    };
    Material _lineMat;
    Material _trailMat;
    bool _runActive;
    Coroutine _introCo;
    Coroutine _pulseCo;

    void Awake()
    {
        Instance = this;
        _cm = GetComponent<CharacterMove>();
        if (_cm == null) _cm = FindObjectOfType<CharacterMove>();
    }

    void OnDestroy()
    {
        if (Instance == this) Instance = null;
        StopAnimCoroutines();
        if (_lineMat != null) Destroy(_lineMat);
        if (_trailMat != null) Destroy(_trailMat);
        if (_root != null) Destroy(_root.gameObject);
    }

    public bool IsDrawPathTask => _config != null && _config.IsDrawPathTask;

    public bool IsActive =>
        _config != null && _config.enabled &&
        (IsDrawPathTask || (_config.segments != null && _config.segments.Count > 0));

    public bool AllowStudentDrawing => IsActive && IsDrawPathTask && !_runActive;

    public bool HasStudentDrawing => _drawnKeys.Count > 0;

    public void BindLevel(LevelData level)
    {
        ClearAll(keepConfig: false);
        _config = level != null ? level.geometryPath : null;
        if (_config == null && level != null &&
            !string.IsNullOrEmpty(level.levelType) &&
            level.levelType.Equals("GEOMETRY_PATH", StringComparison.OrdinalIgnoreCase))
        {
            Debug.LogWarning("[GeometryPath] Level is GEOMETRY_PATH but config.geometryPath is missing/empty.");
        }
        if (!IsActive)
        {
            Debug.Log($"[GeometryPath] Inactive (segments={_config?.segments?.Count ?? 0})");
            return;
        }
        ResolveCharacterMove();
        ApplyConfigVisuals();
        if (IsDrawPathTask)
        {
            EnsureRoot();
            ShowRoot(true);
            EnsureDrawScaffold();
            if (gameObject.activeInHierarchy && _pulseCo == null)
                _pulseCo = StartCoroutine(IdlePulseLoop());
            Debug.Log("[GeometryPath] DRAW_PATH: program is shown; student draws the predicted path.");
        }
        else
        {
            ForceRebuildTargetOverlay(playIntro: true);
            Debug.Log($"[GeometryPath] Drew {_config.segments.Count} target edges.");
        }
    }

    /// <summary>
    /// After wrong answer / Try Again / Reset: clear trail and always re-show the target shape.
    /// </summary>
    public void RestoreForNewAttempt(LevelData level)
    {
        if (level != null && level.geometryPath != null)
            _config = level.geometryPath;

        ResolveCharacterMove();
        ApplyConfigVisuals();
        _runActive = false;
        _completedKeys.Clear();
        _traveledKeys.Clear();
        _travelOrder.Clear();
        ClearTrailVisuals();

        if (!IsActive)
        {
            Debug.LogWarning("[GeometryPath] RestoreForNewAttempt: no segments — cannot show shape.");
            return;
        }

        if (IsDrawPathTask)
        {
            ClearStudentDrawing();
            EnsureRoot();
            ShowRoot(true);
            SetTargetOverlayVisible(false);
            EnsureDrawScaffold();
            SetDrawScaffoldVisible(true);
            RebuildDrawnOverlay();
            if (gameObject.activeInHierarchy && _pulseCo == null)
                _pulseCo = StartCoroutine(IdlePulseLoop());
            Debug.Log("[GeometryPath] DRAW_PATH new attempt: drawing cleared.");
            return;
        }

        ForceRebuildTargetOverlay(playIntro: true);
        Debug.Log($"[GeometryPath] Restored shape for new attempt ({_targetLines.Count} edges).");
    }

    public void ResetAttempt()
    {
        ClearStudentDrawing();
        LevelData ld = _cm != null ? _cm.GetCurrentLevelData() : null;
        RestoreForNewAttempt(ld);
    }

    public void BeginRunTracking()
    {
        ResolveCharacterMove();
        if (!IsActive && _cm != null)
        {
            var ld = _cm.GetCurrentLevelData();
            if (ld?.geometryPath != null) _config = ld.geometryPath;
        }
        if (!IsActive) return;

        ApplyConfigVisuals();
        _completedKeys.Clear();
        _traveledKeys.Clear();
        _travelOrder.Clear();
        ClearTrailVisuals();
        EnsureRoot();
        ShowRoot(true);
        if (IsDrawPathTask)
        {
            RebuildDrawnOverlay();
            SetDrawScaffoldVisible(false);
            ClearDrawPointerPreview();
        }

        bool keepShape = _config != null && _config.keepShapeVisibleDuringRun && !IsDrawPathTask;
        if (keepShape)
        {
            EnsureTargetOverlay();
            SetTargetOverlayVisible(true);
            // Soft underlay so the robot trail reads clearly on top.
            SoftenTargetUnderlayForTrail();
            if (gameObject.activeInHierarchy && _pulseCo == null)
                _pulseCo = StartCoroutine(IdlePulseLoop());
        }
        else
        {
            // Hide guide shape so only the robot-drawn path is visible.
            SetTargetOverlayVisible(false);
        }
        _runActive = true;
    }

    public void EndRunTracking()
    {
        SnapshotRunTelemetry();
        _runActive = false;
        ShowRoot(true);
        if (IsDrawPathTask)
            SetDrawScaffoldVisible(true);
        bool keepShape = _config != null && _config.keepShapeVisibleDuringRun && !IsDrawPathTask;
        if (keepShape)
        {
            EnsureTargetOverlay();
            SetTargetOverlayVisible(true);
            RefreshTargetColors();
        }
        else
        {
            // Trail stays; shape stays hidden until RestoreForNewAttempt.
            SetTargetOverlayVisible(false);
        }
    }

    /// <summary>Freeze traveled/completed edges for platform level-end (before restore clears live sets).</summary>
    public void SnapshotRunTelemetry(Vector2Int? robotCell = null, Vector2Int? robotFacing = null)
    {
        if (IsDrawPathTask)
        {
            _lastDrawnKeys = HashSetToArray(_drawnKeys);
            _lastExpectedKeys = HashSetToArray(_expectedKeys);
            _lastRobotTraveledKeys = HashSetToArray(_traveledKeys);
            _lastTraveledKeys = _lastDrawnKeys;
            var completed = new HashSet<string>();
            foreach (var k in _drawnKeys)
                if (_expectedKeys.Contains(k)) completed.Add(k);
            _lastCompletedKeys = HashSetToArray(completed);
            _lastTravelOrder = _drawnOrder.ToArray();
        }
        else
        {
            _lastTraveledKeys = HashSetToArray(_traveledKeys);
            _lastCompletedKeys = HashSetToArray(_completedKeys);
            _lastTravelOrder = _travelOrder.ToArray();
            _lastDrawnKeys = System.Array.Empty<string>();
            _lastExpectedKeys = System.Array.Empty<string>();
            _lastRobotTraveledKeys = System.Array.Empty<string>();
        }
        if (robotCell.HasValue) _lastRobotCell = robotCell.Value;
        if (robotFacing.HasValue) _lastRobotFacing = robotFacing.Value;
    }

    public void CaptureRobotPose(Vector2Int cell, Vector2Int facing)
    {
        _lastRobotCell = cell;
        _lastRobotFacing = facing;
    }

    public string[] GetLastTraveledKeys() => _lastTraveledKeys ?? System.Array.Empty<string>();
    public string[] GetLastCompletedKeys() => _lastCompletedKeys ?? System.Array.Empty<string>();
    public string[] GetLastTravelOrder() => _lastTravelOrder ?? System.Array.Empty<string>();
    public string[] GetLastDrawnKeys() => _lastDrawnKeys ?? System.Array.Empty<string>();
    public string[] GetLastExpectedKeys() => _lastExpectedKeys ?? System.Array.Empty<string>();
    public string[] GetLastRobotTraveledKeys() => _lastRobotTraveledKeys ?? System.Array.Empty<string>();
    public string GetStudentTask() => IsDrawPathTask ? "DRAW_PATH" : "PROGRAM";
    public Vector2Int GetLastRobotCell() => _lastRobotCell;
    public Vector2Int GetLastRobotFacing() => _lastRobotFacing;

    /// <summary>True when the activity requires a post-shape destination (or FINAL_POSITION* modes).</summary>
    public bool RequiresFinalDestination()
    {
        if (_config == null) return false;
        string behavior = string.IsNullOrEmpty(_config.afterShapeBehavior)
            ? "SHAPE_COMPLETE"
            : _config.afterShapeBehavior.Trim().ToUpperInvariant();
        if (behavior == "CONTINUE_TO_DESTINATION") return true;
        string mode = string.IsNullOrEmpty(_config.validationMode)
            ? "TRACE_TARGET"
            : _config.validationMode.Trim().ToUpperInvariant();
        return mode == "FINAL_POSITION" || mode == "FINAL_POSITION_DIRECTION";
    }

    public string GetFailureHint()
    {
        if (IsDrawPathTask)
            return "Draw the path the yellow-strip program will take.";
        if (RequiresFinalDestination())
            return "Trace the glowing shape, then go to the destination.";
        return "Trace the glowing path with your program.";
    }

    public void NotifyRobotMoved(Vector2Int from, Vector2Int to)
    {
        if (!IsActive || !_runActive || from == to) return;
        if (!AreAdjacent(from, to)) return;

        string key = SegmentKey(from, to);
        _traveledKeys.Add(key);
        _travelOrder.Add(key);

        bool onTarget = IsDrawPathTask ? _drawnKeys.Contains(key) : HasTargetKey(key);
        if (!IsDrawPathTask && onTarget) _completedKeys.Add(key);

        if (_config.drawRobotTrail)
        {
            Color col = IsDrawPathTask ? trailColor : (onTarget ? trailColor : offPathColor);
            StartCoroutine(AnimateTrailSegment(from, to, col));
        }

        if (_config.keepShapeVisibleDuringRun && onTarget)
        {
            // Don't pulse-widen the target underlay — that covers the robot trail.
            SoftenTargetUnderlayForTrail();
        }
        else if (onTarget)
            StartCoroutine(PulseCompletedEdge(key));

        if (_config.keepShapeVisibleDuringRun)
            RefreshTargetColors();
    }

    /// <summary>Also enforce optional PROGRAM_STRUCTURE requirements from level config.</summary>
    public bool ValidateAfterRun(LevelData level, Vector2Int robotCell, Vector2Int robotFacing)
    {
        CaptureRobotPose(robotCell, robotFacing);

        if (!IsActive) return true;

        if (IsDrawPathTask)
        {
            CollectExpectedKeysFromProgram();
            SnapshotRunTelemetry(robotCell, robotFacing);
            if (_expectedKeys.Count == 0) return _drawnKeys.Count == 0;
            return SetsEqual(_drawnKeys, _expectedKeys);
        }

        SnapshotRunTelemetry(robotCell, robotFacing);

        string mode = string.IsNullOrEmpty(_config.validationMode)
            ? "TRACE_TARGET"
            : _config.validationMode.Trim().ToUpperInvariant();

        bool pathOk;
        switch (mode)
        {
            case "FINAL_POSITION":
                // Destination-only: finish cell is the whole goal.
                pathOk = MatchesFinishCell(robotCell);
                break;
            case "FINAL_POSITION_DIRECTION":
                pathOk = MatchesFinishCell(robotCell) && MatchesFinishFacing(robotFacing);
                break;
            case "EXACT_PATH":
                pathOk = TargetFullyCompleted() && NoExtraSegments();
                break;
            case "SHAPE_MATCH":
                pathOk = TargetFullyCompleted() && SetsEqual(_completedKeys, TargetKeySet());
                break;
            case "PROGRAM_STRUCTURE":
                pathOk = TargetFullyCompleted() && MeetsProgramStructureRequirements(level);
                break;
            case "TRACE_TARGET":
            default:
                pathOk = TargetFullyCompleted();
                break;
        }

        // Soft requirements can apply alongside any mode when flagged on config.
        if (pathOk && mode != "PROGRAM_STRUCTURE")
            pathOk = MeetsProgramStructureRequirements(level);

        // Combined activities: shape completion alone is not enough — also require destination.
        // Do not short-circuit when shape hits 100% mid-run; this runs only after the full program.
        if (pathOk && mode != "FINAL_POSITION" && mode != "FINAL_POSITION_DIRECTION")
        {
            if (RequiresFinalDestination())
            {
                if (!MatchesFinishCell(robotCell))
                    pathOk = false;
                else if (RequiresFinishFacing() && !MatchesFinishFacing(robotFacing))
                    pathOk = false;
            }
        }

        return pathOk;
    }

    bool RequiresFinishFacing()
    {
        if (_config == null) return false;
        if (_config.requireFinishFacing) return true;
        string mode = string.IsNullOrEmpty(_config.validationMode)
            ? ""
            : _config.validationMode.Trim().ToUpperInvariant();
        return mode == "FINAL_POSITION_DIRECTION";
    }

    bool MeetsProgramStructureRequirements(LevelData level)
    {
        if (_config == null) return true;
        bool needRepeat = _config.requireRepeat;
        bool needChunk = _config.requireActionChunk;
        bool needBag = _config.requireCommandBag;
        if (!needRepeat && !needChunk && !needBag) return true;

        if (_cm != null)
        {
            if (needRepeat && !_cm.ProgramStripHasRepeat()) return false;
            if (needChunk && !_cm.ProgramStripHasActionChunk()) return false;
            if (needBag && !_cm.ProgramStripHasCommandBag()) return false;
            return true;
        }
        return true;
    }

    void ResolveCharacterMove()
    {
        if (_cm == null)
        {
            _cm = GetComponent<CharacterMove>();
            if (_cm == null) _cm = FindObjectOfType<CharacterMove>();
        }
    }

    /// <summary>Apply teacher-chosen colors from level config (hex strings).</summary>
    void ApplyConfigVisuals()
    {
        if (_config == null) return;

        if (TryParseHexColor(_config.targetColor, out var tc))
        {
            // Keep enough alpha so the teacher-picked hue reads clearly (not washed pink).
            targetIdleColor = new Color(tc.r, tc.g, tc.b, 0.85f);
            targetGlowColor = new Color(tc.r, tc.g, tc.b, 0.28f);
            // Completed target stays a soft tint of the shape color (not the trail color).
            targetCompletedColor = new Color(tc.r, tc.g, tc.b, 0.55f);
        }
        else if (!string.IsNullOrWhiteSpace(_config.targetColor))
        {
            Debug.LogWarning("[GeometryPath] Could not parse targetColor='" + _config.targetColor + "'");
        }

        if (TryParseHexColor(_config.trailColor, out var tr))
            trailColor = new Color(tr.r, tr.g, tr.b, 1f);
        else if (!string.IsNullOrWhiteSpace(_config.trailColor))
            Debug.LogWarning("[GeometryPath] Could not parse trailColor='" + _config.trailColor + "'");

        Debug.Log(
            "[GeometryPath] Colors applied — shape=" +
            ColorUtility.ToHtmlStringRGB(targetIdleColor) +
            " trail=" + ColorUtility.ToHtmlStringRGB(trailColor) +
            " (config target='" + (_config.targetColor ?? "") +
            "' trail='" + (_config.trailColor ?? "") + "')");
    }

    static bool TryParseHexColor(string hex, out Color color)
    {
        color = Color.white;
        if (string.IsNullOrWhiteSpace(hex)) return false;
        string s = hex.Trim();
        // Strip alpha channel if teachers paste #RRGGBBAA
        if (s.StartsWith("#") && s.Length == 9)
            s = s.Substring(0, 7);
        else if (!s.StartsWith("#") && s.Length == 8)
            s = "#" + s.Substring(0, 6);
        if (!s.StartsWith("#")) s = "#" + s;
        if (s.Length != 7) return false;
        return ColorUtility.TryParseHtmlString(s, out color);
    }

    bool MatchesFinishCell(Vector2Int cell)
    {
        if (_config.finishCell.x >= 0 && _config.finishCell.y >= 0)
            return cell == _config.finishCell;
        // CONTINUE_TO_DESTINATION without an authored cell cannot pass.
        string behavior = string.IsNullOrEmpty(_config.afterShapeBehavior)
            ? "SHAPE_COMPLETE"
            : _config.afterShapeBehavior.Trim().ToUpperInvariant();
        if (behavior == "CONTINUE_TO_DESTINATION")
            return false;
        // FINAL_POSITION* without finishCell: fall back to last segment endpoint.
        if (_config.segments.Count == 0) return false;
        var last = _config.segments[_config.segments.Count - 1];
        return cell.x == last.to.x && cell.y == last.to.y;
    }

    bool MatchesFinishFacing(Vector2Int facing)
    {
        if (_config.finishFacing.x == 0 && _config.finishFacing.y == 0)
            return !RequiresFinishFacing();
        return facing == _config.finishFacing;
    }

    bool TargetFullyCompleted()
    {
        var keys = TargetKeySet();
        if (keys.Count == 0) return false;
        foreach (var k in keys)
            if (!_completedKeys.Contains(k)) return false;
        return true;
    }

    bool NoExtraSegments()
    {
        var keys = TargetKeySet();
        foreach (var k in _traveledKeys)
            if (!keys.Contains(k)) return false;
        return true;
    }

    static bool SetsEqual(HashSet<string> a, HashSet<string> b)
    {
        if (a.Count != b.Count) return false;
        foreach (var x in a)
            if (!b.Contains(x)) return false;
        return true;
    }

    HashSet<string> TargetKeySet()
    {
        var set = new HashSet<string>();
        if (_config?.segments == null) return set;
        for (int i = 0; i < _config.segments.Count; i++)
        {
            var s = _config.segments[i];
            set.Add(SegmentKey(new Vector2Int(s.from.x, s.from.y), new Vector2Int(s.to.x, s.to.y)));
        }
        return set;
    }

    bool HasTargetKey(string key) => TargetKeySet().Contains(key);

    void EnsureRoot()
    {
        if (_root != null) return;
        var go = new GameObject("GeometryPathOverlay");
        // Parent beside the robot, NOT under it — robot motion must never hide/move the shape hierarchy.
        if (_cm != null && _cm.transform.parent != null)
            go.transform.SetParent(_cm.transform.parent, true);
        else
            go.transform.SetParent(null, true);
        _root = go.transform;
        _root.position = Vector3.zero;
        _root.rotation = Quaternion.identity;
        _root.localScale = Vector3.one;
    }

    void ShowRoot(bool on)
    {
        if (_root != null)
            _root.gameObject.SetActive(on);
    }

    void SetTargetOverlayVisible(bool visible)
    {
        for (int i = 0; i < _targetLines.Count; i++)
            if (_targetLines[i] != null) _targetLines[i].gameObject.SetActive(visible);
        for (int i = 0; i < _targetGlowLines.Count; i++)
            if (_targetGlowLines[i] != null) _targetGlowLines[i].gameObject.SetActive(visible);
        if (_startMarker != null)
            _startMarker.SetActive(visible);
        if (!visible)
        {
            // Pause idle pulse while the guide shape is hidden.
            if (_pulseCo != null) { StopCoroutine(_pulseCo); _pulseCo = null; }
            if (_introCo != null) { StopCoroutine(_introCo); _introCo = null; }
        }
    }

    void ForceRebuildTargetOverlay(bool playIntro)
    {
        StopAnimCoroutines();
        DestroyLineList(_targetLines);
        DestroyLineList(_targetGlowLines);
        DestroyStartMarker();
        EnsureRoot();
        ShowRoot(true);
        BuildTargetOverlay();
        BuildStartMarker();
        RefreshTargetColors();
        if (playIntro && gameObject.activeInHierarchy)
            _introCo = StartCoroutine(AnimateIntroReveal());
        if (gameObject.activeInHierarchy)
            _pulseCo = StartCoroutine(IdlePulseLoop());
    }

    void EnsureTargetOverlay()
    {
        if (!IsActive) return;

        bool needsRebuild = _targetLines.Count != _config.segments.Count || _root == null;
        if (!needsRebuild)
        {
            for (int i = 0; i < _targetLines.Count; i++)
            {
                if (_targetLines[i] == null)
                {
                    needsRebuild = true;
                    break;
                }
            }
        }

        if (needsRebuild)
        {
            ForceRebuildTargetOverlay(playIntro: false);
            return;
        }

        for (int i = 0; i < _targetLines.Count && i < _config.segments.Count; i++)
        {
            var s = _config.segments[i];
            var from = new Vector2Int(s.from.x, s.from.y);
            var to = new Vector2Int(s.to.x, s.to.y);
            SetLineEndpoints(_targetLines[i], from, to);
            if (i < _targetGlowLines.Count)
                SetLineEndpoints(_targetGlowLines[i], from, to);
        }
        ShowRoot(true);
    }

    void BuildTargetOverlay()
    {
        if (_cm == null || _config.segments == null) return;
        for (int i = 0; i < _config.segments.Count; i++)
        {
            var s = _config.segments[i];
            var from = new Vector2Int(s.from.x, s.from.y);
            var to = new Vector2Int(s.to.x, s.to.y);

            var glow = CreateLine("TargetGlow_" + i, targetGlowColor, targetWidthFraction * 1.4f, dashed: false);
            SetLineEndpoints(glow, from, to);
            _targetGlowLines.Add(glow);

            var lr = CreateLine("TargetEdge_" + i, targetIdleColor, targetWidthFraction, dashed: true);
            SetLineEndpoints(lr, from, to);
            _targetLines.Add(lr);
        }
    }

    /// <summary>
    /// Shows where to start tracing — only when the robot has to drive to the shape first. Edges can be traced
    /// in any order, so when the robot already stands on the shape, a marker at the first drawn edge would
    /// wrongly suggest the student must start there.
    /// </summary>
    void BuildStartMarker()
    {
        if (_cm == null || _config?.segments == null || _config.segments.Count == 0) return;
        var level = _cm.GetCurrentLevelData();
        if (level != null && ShapeHasVertex(level.robotStartPosition)) return;
        var s0 = _config.segments[0];
        Vector3 pos = CellWorld(new Vector2Int(s0.from.x, s0.from.y));

        _startMarker = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        _startMarker.name = "GeometryStartMarker";
        _startMarker.transform.SetParent(_root, true);
        float r = CellSpacing() * 0.16f;
        _startMarker.transform.position = pos;
        _startMarker.transform.localScale = Vector3.one * (r * 2f);

        var col = _startMarker.GetComponent<Collider>();
        if (col != null) Destroy(col);

        var rend = _startMarker.GetComponent<Renderer>();
        if (rend != null)
        {
            var markerColor = new Color(0.98f, 0.45f, 0.09f, 0.95f); // orange start marker
            rend.sharedMaterial = CreateColoredLineMaterial(markerColor, 3100);
            rend.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            rend.receiveShadows = false;
        }
    }

    bool ShapeHasVertex(Vector2Int cell)
    {
        foreach (var s in _config.segments)
        {
            if ((s.from.x == cell.x && s.from.y == cell.y) || (s.to.x == cell.x && s.to.y == cell.y))
                return true;
        }
        return false;
    }

    void DestroyStartMarker()
    {
        if (_startMarker != null)
        {
            Destroy(_startMarker);
            _startMarker = null;
        }
    }

    IEnumerator AnimateTrailSegment(Vector2Int from, Vector2Int to, Color color)
    {
        // Draw above the target underlay (higher Y + higher sorting) so both stay readable.
        var lr = CreateLine("Trail_" + _trailLines.Count, color, trailWidthFraction, dashed: false, forTrail: true);
        _trailLines.Add(lr);

        const float trailLift = 2.4f;
        Vector3 a = CellWorld(from, trailLift);
        Vector3 b = CellWorld(to, trailLift);
        lr.positionCount = 2;
        lr.SetPosition(0, a);
        lr.SetPosition(1, a);
        lr.sortingOrder = 120;

        float w = ResolveWidth(trailWidthFraction) * 1.15f;
        lr.startWidth = w * 1.4f;
        lr.endWidth = w * 0.65f;

        float t = 0f;
        while (t < trailDrawDuration)
        {
            if (lr == null) yield break;
            t += Time.unscaledDeltaTime;
            float u = Mathf.Clamp01(t / trailDrawDuration);
            float ease = 1f - Mathf.Pow(1f - u, 3f);
            lr.SetPosition(1, Vector3.Lerp(a, b, ease));
            yield return null;
        }
        if (lr != null)
        {
            lr.SetPosition(1, b);
            lr.startWidth = w;
            lr.endWidth = w;
            ApplyColorToLine(lr, color);
        }
    }

    IEnumerator PulseCompletedEdge(string key)
    {
        int idx = IndexOfTargetKey(key);
        if (idx < 0 || idx >= _targetLines.Count) yield break;
        var lr = _targetLines[idx];
        if (lr == null) yield break;

        Color baseCol = targetCompletedColor;
        float baseW = ResolveWidth(targetWidthFraction);
        float elapsed = 0f;
        const float dur = 0.28f;
        while (elapsed < dur)
        {
            if (lr == null) yield break;
            elapsed += Time.unscaledDeltaTime;
            float u = Mathf.Sin(Mathf.Clamp01(elapsed / dur) * Mathf.PI);
            lr.startColor = Color.Lerp(baseCol, Color.white, u * 0.55f);
            lr.endColor = lr.startColor;
            float w = baseW * (1f + u * 0.45f);
            lr.startWidth = w;
            lr.endWidth = w;
            yield return null;
        }
        RefreshTargetColors();
    }

    IEnumerator AnimateIntroReveal()
    {
        try
        {
            // Soft “draw the shape” intro so kids notice the target path.
            if (_startMarker != null)
            {
                Vector3 full = Vector3.one * (CellSpacing() * 0.16f * 2f);
                _startMarker.transform.localScale = Vector3.zero;
                float pop = 0f;
                const float popDur = 0.22f;
                while (pop < popDur)
                {
                    if (_startMarker == null) break;
                    pop += Time.unscaledDeltaTime;
                    float u = Mathf.Clamp01(pop / popDur);
                    float ease = 1f - Mathf.Pow(1f - u, 3f);
                    _startMarker.transform.localScale = full * ease;
                    yield return null;
                }
                if (_startMarker != null) _startMarker.transform.localScale = full;
            }

            for (int i = 0; i < _targetLines.Count; i++)
            {
                var lr = _targetLines[i];
                var glow = i < _targetGlowLines.Count ? _targetGlowLines[i] : null;
                if (lr == null) continue;
                if (_config.segments == null || i >= _config.segments.Count) continue;

                var s = _config.segments[i];
                Vector3 a = CellWorld(new Vector2Int(s.from.x, s.from.y));
                Vector3 b = CellWorld(new Vector2Int(s.to.x, s.to.y));

                lr.SetPosition(0, a);
                lr.SetPosition(1, a);
                if (glow != null)
                {
                    glow.SetPosition(0, a);
                    glow.SetPosition(1, a);
                }

                float slice = introRevealDuration / Mathf.Max(1, _targetLines.Count);
                float t = 0f;
                while (t < slice)
                {
                    if (lr == null) yield break;
                    t += Time.unscaledDeltaTime;
                    float u = Mathf.Clamp01(t / slice);
                    float ease = 1f - Mathf.Pow(1f - u, 2.5f);
                    Vector3 p = Vector3.Lerp(a, b, ease);
                    lr.SetPosition(1, p);
                    if (glow != null) glow.SetPosition(1, p);
                    yield return null;
                }
                if (lr != null) lr.SetPosition(1, b);
                if (glow != null) glow.SetPosition(1, b);
            }
            RefreshTargetColors();
        }
        finally
        {
            _introCo = null;
        }
    }

    IEnumerator IdlePulseLoop()
    {
        float baseMarkerRadius = CellSpacing() * 0.16f * 2f;
        while (IsActive && _root != null && _root.gameObject.activeInHierarchy)
        {
            float pulse = 0.5f + 0.5f * Mathf.Sin(Time.unscaledTime * idlePulseSpeed);
            for (int i = 0; i < _targetGlowLines.Count; i++)
            {
                var glow = _targetGlowLines[i];
                if (glow == null) continue;
                bool done = false;
                if (_config?.segments != null && i < _config.segments.Count)
                {
                    var s = _config.segments[i];
                    done = _completedKeys.Contains(
                        SegmentKey(new Vector2Int(s.from.x, s.from.y), new Vector2Int(s.to.x, s.to.y)));
                }
                if (done)
                {
                    glow.startColor = new Color(targetCompletedColor.r, targetCompletedColor.g, targetCompletedColor.b, 0.2f);
                    glow.endColor = glow.startColor;
                    continue;
                }
                Color c = targetGlowColor;
                c.a = Mathf.Lerp(0.18f, 0.42f, pulse);
                glow.startColor = c;
                glow.endColor = c;
            }

            if (_startMarker != null && (_introCo == null))
            {
                bool firstDone = false;
                if (_config?.segments != null && _config.segments.Count > 0)
                {
                    var s = _config.segments[0];
                    firstDone = _completedKeys.Contains(
                        SegmentKey(new Vector2Int(s.from.x, s.from.y), new Vector2Int(s.to.x, s.to.y)));
                }
                _startMarker.SetActive(!firstDone);
                if (!firstDone)
                {
                    float mul = Mathf.Lerp(0.92f, 1.18f, pulse);
                    _startMarker.transform.localScale = Vector3.one * (baseMarkerRadius * mul);
                }
            }
            if (_drawStartMarker != null && IsDrawPathTask && !_runActive)
            {
                float spacing = CellSpacing();
                float mul = Mathf.Lerp(0.92f, 1.16f, pulse);
                float r = spacing * 0.28f * mul;
                _drawStartMarker.transform.localScale = new Vector3(r * 2f, spacing * 0.045f, r * 2f);
            }
            yield return null;
        }
    }

    int IndexOfTargetKey(string key)
    {
        if (_config?.segments == null) return -1;
        for (int i = 0; i < _config.segments.Count; i++)
        {
            var s = _config.segments[i];
            if (SegmentKey(new Vector2Int(s.from.x, s.from.y), new Vector2Int(s.to.x, s.to.y)) == key)
                return i;
        }
        return -1;
    }

    Material GetLineMaterial()
    {
        if (_lineMat != null) return _lineMat;
        _lineMat = CreateColoredLineMaterial(Color.white, 3100);
        return _lineMat;
    }

    Material GetTrailMaterial()
    {
        if (_trailMat != null) return _trailMat;
        _trailMat = CreateColoredLineMaterial(Color.white, 3200);
        return _trailMat;
    }

    static Shader ResolveLineShader()
    {
        // Same resolution order as NumberLineVisual — avoids magenta error shader in URP/WebGL.
        string[] shaderNames =
        {
            "Sprites/Default",
            "Unlit/Color",
            "Universal Render Pipeline/Unlit",
            "Universal Render Pipeline/Particles/Unlit",
            "UI/Default",
            "Legacy Shaders/Particles/Alpha Blended Premultiply",
            "Mobile/Particles/Alpha Blended",
            "Standard",
        };
        for (int i = 0; i < shaderNames.Length; i++)
        {
            var shader = Shader.Find(shaderNames[i]);
            if (shader != null) return shader;
        }
        Debug.LogError("[GeometryPath] No usable line shader found — lines may render magenta.");
        return Shader.Find("Hidden/InternalErrorShader");
    }

    Material CreateColoredLineMaterial(Color color, int renderQueue)
    {
        var shader = ResolveLineShader();
        var mat = new Material(shader);
        BakeColorIntoMaterial(mat, color);
        mat.renderQueue = renderQueue;
        return mat;
    }

    static void BakeColorIntoMaterial(Material mat, Color color)
    {
        if (mat == null) return;
        // Cover common property names across Built-in / URP / Particles / Sprites.
        if (mat.HasProperty("_BaseColor")) mat.SetColor("_BaseColor", color);
        if (mat.HasProperty("_Color")) mat.SetColor("_Color", color);
        if (mat.HasProperty("_TintColor")) mat.SetColor("_TintColor", color);
        if (mat.HasProperty("_EmissionColor"))
        {
            mat.EnableKeyword("_EMISSION");
            mat.SetColor("_EmissionColor", color);
        }
    }

    float CellSpacing()
    {
        if (_cm == null) return 1f;
        return Mathf.Max(0.2f, _cm.gridSize);
    }

    float ResolveWidth(float fractionOfCell)
    {
        float spacing = CellSpacing();
        return Mathf.Clamp(spacing * fractionOfCell, spacing * 0.05f, spacing * 0.28f);
    }

    float LiftHeight()
    {
        float spacing = CellSpacing();
        return Mathf.Clamp(spacing * heightFraction, 0.05f, spacing * 0.2f);
    }

    Vector3 CellWorld(Vector2Int cell, float liftMul = 1f)
    {
        Vector3 p = _cm.GridCellToWorld(cell);
        p.y += LiftHeight() * liftMul;
        return p;
    }

    void SetLineEndpoints(LineRenderer lr, Vector2Int from, Vector2Int to)
    {
        if (lr == null || _cm == null) return;
        lr.SetPosition(0, CellWorld(from, 1f));
        lr.SetPosition(1, CellWorld(to, 1f));
    }

    /// <summary>
    /// Bake tint into a unique material. URP Unlit often ignores LineRenderer vertex colors,
    /// and a missing shader falls back to magenta — which looked like "both pink".
    /// </summary>
    void ApplyColorToLine(LineRenderer lr, Color color)
    {
        if (lr == null) return;
        lr.startColor = color;
        lr.endColor = color;

        int queue = (lr.name != null && lr.name.StartsWith("Trail", StringComparison.Ordinal)) ? 3200 : 3100;
        var mat = CreateColoredLineMaterial(color, queue);

        if (lr.sharedMaterial != null &&
            lr.sharedMaterial != _lineMat &&
            lr.sharedMaterial != _trailMat)
            Destroy(lr.sharedMaterial);
        lr.sharedMaterial = mat;
    }

    LineRenderer CreateLine(string name, Color color, float widthFraction, bool dashed, bool forTrail = false)
    {
        EnsureRoot();
        var go = new GameObject(name);
        go.transform.SetParent(_root, false);
        var lr = go.AddComponent<LineRenderer>();
        lr.positionCount = 2;
        float w = ResolveWidth(widthFraction);
        if (dashed) w *= 0.75f;
        lr.startWidth = w;
        lr.endWidth = w;
        lr.useWorldSpace = true;
        lr.numCapVertices = 8;
        lr.numCornerVertices = 8;
        lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        lr.receiveShadows = false;
        lr.alignment = LineAlignment.View;
        lr.textureMode = LineTextureMode.Stretch;
        ApplyColorToLine(lr, color);
        // Target underlay stays below robot trail.
        lr.sortingOrder = forTrail ? 120 : (dashed ? 20 : 30);
        return lr;
    }

    void ClearTrailVisuals()
    {
        DestroyLineList(_trailLines);
    }

    /// <summary>
    /// When shape stays visible during run, keep it thin/transparent so the robot trail is obvious.
    /// </summary>
    void SoftenTargetUnderlayForTrail()
    {
        float underW = ResolveWidth(targetWidthFraction) * 0.7f;
        for (int i = 0; i < _targetLines.Count; i++)
        {
            var lr = _targetLines[i];
            if (lr == null) continue;
            Color c = lr.startColor;
            c.a = Mathf.Min(c.a, 0.38f);
            ApplyColorToLine(lr, c);
            lr.startWidth = underW;
            lr.endWidth = underW;
            lr.sortingOrder = 20;
        }
        for (int i = 0; i < _targetGlowLines.Count; i++)
        {
            var glow = _targetGlowLines[i];
            if (glow == null) continue;
            Color c = glow.startColor;
            c.a = Mathf.Min(c.a, 0.14f);
            ApplyColorToLine(glow, c);
            float gw = ResolveWidth(targetWidthFraction) * 1.35f;
            glow.startWidth = gw;
            glow.endWidth = gw;
            glow.sortingOrder = 10;
        }
    }

    void RefreshTargetColors()
    {
        if (_config?.segments == null) return;
        // Target must stay thinner than the robot trail — never match trail width
        // (that made the shape paint over the robot line when keep-shape was on).
        float idleW = ResolveWidth(targetWidthFraction) * (_runActive && _config.keepShapeVisibleDuringRun ? 0.7f : 1f);
        float doneW = idleW;

        for (int i = 0; i < _targetLines.Count && i < _config.segments.Count; i++)
        {
            var s = _config.segments[i];
            string key = SegmentKey(new Vector2Int(s.from.x, s.from.y), new Vector2Int(s.to.x, s.to.y));
            bool done = _completedKeys.Contains(key);
            Color c = done ? targetCompletedColor : targetIdleColor;
            if (_runActive && _config.keepShapeVisibleDuringRun)
                c.a = Mathf.Min(c.a, done ? 0.32f : 0.38f);
            var lr = _targetLines[i];
            if (lr == null) continue;
            ApplyColorToLine(lr, c);
            float w = done ? doneW : idleW;
            lr.startWidth = w;
            lr.endWidth = w;
            lr.sortingOrder = 20;
        }

        for (int i = 0; i < _targetGlowLines.Count && i < _config.segments.Count; i++)
        {
            var glow = _targetGlowLines[i];
            if (glow == null) continue;
            Color gc = targetGlowColor;
            if (_runActive && _config.keepShapeVisibleDuringRun)
                gc.a = Mathf.Min(gc.a, 0.14f);
            ApplyColorToLine(glow, gc);
        }

        if (_runActive && _config.keepShapeVisibleDuringRun)
            SoftenTargetUnderlayForTrail();
    }

    void DestroyLineList(List<LineRenderer> list)
    {
        for (int i = 0; i < list.Count; i++)
        {
            if (list[i] == null) continue;
            if (list[i].sharedMaterial != null &&
                list[i].sharedMaterial != _lineMat &&
                list[i].sharedMaterial != _trailMat)
                Destroy(list[i].sharedMaterial);
            Destroy(list[i].gameObject);
        }
        list.Clear();
    }

    void StopAnimCoroutines()
    {
        if (_introCo != null) { StopCoroutine(_introCo); _introCo = null; }
        if (_pulseCo != null) { StopCoroutine(_pulseCo); _pulseCo = null; }
    }

    void ClearAll(bool keepConfig)
    {
        StopAnimCoroutines();
        _completedKeys.Clear();
        _traveledKeys.Clear();
        _travelOrder.Clear();
        _drawnKeys.Clear();
        _drawnOrder.Clear();
        _expectedKeys.Clear();
        ClearTrailVisuals();
        ClearDrawPointerPreview();
        DestroyLineList(_drawnLines);
        DestroyLineList(_targetLines);
        DestroyLineList(_targetGlowLines);
        DestroyStartMarker();
        DestroyDrawScaffold();
        if (_hoverMarker != null)
        {
            Destroy(_hoverMarker);
            _hoverMarker = null;
        }
        if (_previewLine != null)
        {
            if (_previewLine.sharedMaterial != null &&
                _previewLine.sharedMaterial != _lineMat &&
                _previewLine.sharedMaterial != _trailMat)
                Destroy(_previewLine.sharedMaterial);
            Destroy(_previewLine.gameObject);
            _previewLine = null;
        }
        if (_root != null)
        {
            Destroy(_root.gameObject);
            _root = null;
        }
        _hoverMarker = null;
        _previewLine = null;
        _toolCursor = null;
        _drawStartMarker = null;
        _penMarker = null;
        _nodeMarkers.Clear();
        _neighborPads.Clear();
        if (!keepConfig) _config = null;
        _runActive = false;
    }

    public bool TryAddDrawnEdge(Vector2Int from, Vector2Int to)
    {
        if (!AllowStudentDrawing || from == to || !AreAdjacent(from, to)) return false;
        if (_cm != null && (!_cm.CellInGridBounds(from) || !_cm.CellInGridBounds(to))) return false;
        string key = SegmentKey(from, to);
        if (_drawnKeys.Contains(key)) return false;
        _drawnKeys.Add(key);
        _drawnOrder.Add(key);
        EnsureRoot();
        ShowRoot(true);
        var lr = CreateLine("Drawn_" + _drawnLines.Count, studentDrawColor, trailWidthFraction * 1.05f, dashed: false);
        SetLineEndpoints(lr, from, to);
        lr.sortingOrder = 80;
        _drawnLines.Add(lr);
        return true;
    }

    /// <summary>
    /// Walk orthogonally from <paramref name="from"/> to <paramref name="to"/>, removing edges that exist.
    /// </summary>
    public int EraseDrawnPath(Vector2Int from, Vector2Int to)
    {
        if (!AllowStudentDrawing || from == to) return 0;
        int changes = 0;
        Vector2Int cur = from;
        int guard = gridStepGuard();
        while (cur != to && guard-- > 0)
        {
            Vector2Int next = StepToward(cur, to);
            if (next == cur) break;
            if (RemoveDrawnEdge(SegmentKey(cur, next))) changes++;
            cur = next;
        }
        return changes;
    }

    /// <summary>Erase every drawn edge that touches this cell (tap-to-erase).</summary>
    public int EraseEdgesTouching(Vector2Int cell)
    {
        if (!AllowStudentDrawing) return 0;
        var keys = new List<string>(_drawnOrder);
        int changes = 0;
        for (int i = 0; i < keys.Count; i++)
        {
            if (!TryParseKey(keys[i], out var a, out var b)) continue;
            if (a != cell && b != cell) continue;
            if (RemoveDrawnEdge(keys[i])) changes++;
        }
        return changes;
    }

    public bool HasDrawnEdge(Vector2Int from, Vector2Int to)
    {
        return _drawnKeys.Contains(SegmentKey(from, to));
    }

    /// <summary>
    /// Walk orthogonally from <paramref name="from"/> to <paramref name="to"/>, adding edges.
    /// Dragging backward over the last edge undoes it (natural mouse/touch correction).
    /// </summary>
    public int ConnectDrawnPath(Vector2Int from, Vector2Int to)
    {
        if (!AllowStudentDrawing || from == to) return 0;
        int changes = 0;
        Vector2Int cur = from;
        int guard = gridStepGuard();
        while (cur != to && guard-- > 0)
        {
            Vector2Int next = StepToward(cur, to);
            if (next == cur) break;
            if (TryConnectDrawnCells(cur, next)) changes++;
            cur = next;
        }
        return changes;
    }

    bool TryConnectDrawnCells(Vector2Int from, Vector2Int to)
    {
        if (!AreAdjacent(from, to)) return false;
        string key = SegmentKey(from, to);
        if (_drawnOrder.Count > 0 && _drawnOrder[_drawnOrder.Count - 1] == key)
        {
            RemoveLastDrawnEdge();
            return true;
        }
        return TryAddDrawnEdge(from, to);
    }

    void RemoveLastDrawnEdge()
    {
        if (_drawnOrder.Count == 0) return;
        RemoveDrawnEdge(_drawnOrder[_drawnOrder.Count - 1]);
    }

    bool RemoveDrawnEdge(string key)
    {
        if (string.IsNullOrEmpty(key) || !_drawnKeys.Contains(key)) return false;
        _drawnKeys.Remove(key);
        int idx = _drawnOrder.IndexOf(key);
        if (idx >= 0) _drawnOrder.RemoveAt(idx);
        if (idx >= 0 && idx < _drawnLines.Count)
        {
            var lr = _drawnLines[idx];
            _drawnLines.RemoveAt(idx);
            if (lr != null)
            {
                if (lr.sharedMaterial != null && lr.sharedMaterial != _lineMat && lr.sharedMaterial != _trailMat)
                    Destroy(lr.sharedMaterial);
                Destroy(lr.gameObject);
            }
        }
        else if (_drawnLines.Count != _drawnOrder.Count)
        {
            RebuildDrawnOverlay();
        }
        return true;
    }

    static Vector2Int StepToward(Vector2Int from, Vector2Int to)
    {
        int dx = to.x - from.x;
        int dy = to.y - from.y;
        if (dx == 0 && dy == 0) return from;
        if (Mathf.Abs(dx) >= Mathf.Abs(dy) && dx != 0)
            return new Vector2Int(from.x + (dx > 0 ? 1 : -1), from.y);
        if (dy != 0)
            return new Vector2Int(from.x, from.y + (dy > 0 ? 1 : -1));
        return from;
    }

    int gridStepGuard()
    {
        int cols = _cm != null ? Mathf.Max(1, _cm.gridCols) : 6;
        int rows = _cm != null ? Mathf.Max(1, _cm.gridRows) : 6;
        return cols * rows + 4;
    }

    public void SetDrawToolSprites(Sprite pencil, Sprite eraser)
    {
        if (pencil != null) _pencilCursorSprite = pencil;
        if (eraser != null) _eraserCursorSprite = eraser;
    }

    public void SetDrawPointerPreview(Vector2Int? hover, Vector2Int? from, bool drawing, bool eraseMode = false, Vector3? cursorWorld = null)
    {
        if (!AllowStudentDrawing)
        {
            ClearDrawPointerPreview();
            return;
        }
        if (!hover.HasValue && !from.HasValue && !cursorWorld.HasValue)
        {
            ClearDrawPointerPreview();
            return;
        }

        EnsureRoot();
        ShowRoot(true);
        EnsureHoverMarker();
        EnsureNeighborPads();
        EnsurePenMarker();
        EnsureToolCursor();

        Color accent = eraseMode ? studentEraseColor : studentDrawColor;
        if (!from.HasValue && !hover.HasValue)
        {
            if (_penMarker != null) _penMarker.SetActive(false);
            if (_hoverMarker != null) _hoverMarker.SetActive(false);
            if (_previewLine != null) _previewLine.gameObject.SetActive(false);
            for (int i = 0; i < _neighborPads.Count; i++)
                if (_neighborPads[i] != null) _neighborPads[i].SetActive(false);
            UpdateToolCursor(cursorWorld.Value, eraseMode, visible: true);
            return;
        }

        Vector2Int padOrigin = from ?? hover.Value;
        float spacing = CellSpacing();
        float pulse = 0.9f + 0.1f * Mathf.Sin(Time.unscaledTime * 5.4f);

        if (from.HasValue)
        {
            _penMarker.SetActive(true);
            _penMarker.transform.position = CellWorld(from.Value, 0.2f);
            float penR = spacing * 0.7f * pulse;
            _penMarker.transform.localScale = new Vector3(penR, spacing * 0.04f, penR);
            TintPrimitive(_penMarker, accent, 0.38f);
        }
        else if (_penMarker != null)
        {
            _penMarker.SetActive(false);
        }

        if (hover.HasValue && (!from.HasValue || hover.Value != from.Value))
        {
            _hoverMarker.SetActive(true);
            _hoverMarker.transform.position = CellWorld(hover.Value, 0.24f);
            float h = spacing * (AreAdjacent(padOrigin, hover.Value) ? 0.78f : 0.62f);
            _hoverMarker.transform.localScale = new Vector3(h, spacing * 0.035f, h);
            TintPrimitive(_hoverMarker, accent, drawing ? 0.55f : 0.36f);
        }
        else if (_hoverMarker != null)
        {
            _hoverMarker.SetActive(false);
        }

        for (int i = 0; i < _neighborPads.Count && i < OrthoDirs.Length; i++)
        {
            var pad = _neighborPads[i];
            if (pad == null) continue;
            Vector2Int n = padOrigin + OrthoDirs[i];
            bool inBounds = _cm != null && _cm.CellInGridBounds(n);
            bool hasEdge = inBounds && _drawnKeys.Contains(SegmentKey(padOrigin, n));
            bool show = inBounds && (eraseMode ? hasEdge : true);
            pad.SetActive(show);
            if (!show) continue;
            bool aimed = hover.HasValue && hover.Value == n;
            pad.transform.position = CellWorld(n, 0.26f);
            float s = spacing * (aimed ? 0.58f : 0.5f) * pulse;
            pad.transform.localScale = new Vector3(s, spacing * 0.04f, s);
            TintPrimitive(pad, accent, aimed ? 0.78f : (eraseMode ? 0.55f : 0.62f));
        }

        if (from.HasValue && hover.HasValue && from.Value != hover.Value && AreAdjacent(from.Value, hover.Value))
        {
            EnsurePreviewLine();
            SetLineEndpoints(_previewLine, from.Value, hover.Value);
            Color pc = accent;
            pc.a = 0.8f;
            ApplyColorToLine(_previewLine, pc);
            _previewLine.gameObject.SetActive(true);
        }
        else if (_previewLine != null)
        {
            _previewLine.gameObject.SetActive(false);
        }

        Vector3 cursorAt = cursorWorld.HasValue
            ? cursorWorld.Value
            : (hover.HasValue ? CellWorld(hover.Value, 1.6f) : (from.HasValue ? CellWorld(from.Value, 1.6f) : Vector3.zero));
        bool showCursor = drawing || hover.HasValue || cursorWorld.HasValue;
        UpdateToolCursor(cursorAt, eraseMode, visible: showCursor);
    }

    public void ClearDrawPointerPreview()
    {
        if (_hoverMarker != null) _hoverMarker.SetActive(false);
        if (_previewLine != null) _previewLine.gameObject.SetActive(false);
        if (_toolCursor != null) _toolCursor.SetActive(false);
        if (_penMarker != null) _penMarker.SetActive(false);
        for (int i = 0; i < _neighborPads.Count; i++)
            if (_neighborPads[i] != null) _neighborPads[i].SetActive(false);
    }

    void EnsureHoverMarker()
    {
        if (_hoverMarker != null) return;
        _hoverMarker = CreateFloorDisc("DrawHoverCell", studentDrawColor, 0.28f);
    }

    void EnsurePreviewLine()
    {
        if (_previewLine != null) return;
        Color c = studentDrawColor;
        c.a = 0.4f;
        _previewLine = CreateLine("DrawPreview", c, trailWidthFraction * 0.85f, dashed: true);
        _previewLine.sortingOrder = 70;
    }

    void EnsureNeighborPads()
    {
        bool ready = _neighborPads.Count == OrthoDirs.Length;
        if (ready)
        {
            for (int i = 0; i < _neighborPads.Count; i++)
                if (_neighborPads[i] == null) { ready = false; break; }
        }
        if (ready) return;
        DestroyNeighborPads();
        for (int i = 0; i < OrthoDirs.Length; i++)
        {
            var pad = CreateFloorDisc("DrawNeighbor_" + i, studentDrawColor, 0.45f);
            pad.SetActive(false);
            _neighborPads.Add(pad);
        }
    }

    void EnsurePenMarker()
    {
        if (_penMarker != null) return;
        _penMarker = CreateFloorDisc("DrawPenCell", studentDrawColor, 0.4f);
        _penMarker.SetActive(false);
    }

    void EnsureToolCursor()
    {
        if (_toolCursor != null) return;
        _toolCursor = CreateFloorDisc("DrawContact", studentDrawColor, 0.9f);
        _toolCursor.SetActive(false);
    }

    void UpdateToolCursor(Vector3 world, bool eraseMode, bool visible)
    {
        if (_toolCursor == null) return;
        if (!visible)
        {
            _toolCursor.SetActive(false);
            return;
        }
        _toolCursor.SetActive(true);
        float spacing = CellSpacing();
        float r = spacing * (eraseMode ? 0.28f : 0.18f);
        Vector3 p = world;
        p.y += LiftHeight() * 1.8f;
        _toolCursor.transform.position = p;
        _toolCursor.transform.localScale = new Vector3(r, spacing * 0.045f, r);
        Color c = eraseMode ? studentEraseColor : studentDrawColor;
        TintPrimitive(_toolCursor, c, eraseMode ? 0.62f : 0.88f);
    }

    void EnsureDrawScaffold()
    {
        if (!IsDrawPathTask) return;
        EnsureRoot();
        BuildNodeLattice();
        BuildDrawStartMarker();
    }

    void SetDrawScaffoldVisible(bool on)
    {
        for (int i = 0; i < _nodeMarkers.Count; i++)
            if (_nodeMarkers[i] != null) _nodeMarkers[i].SetActive(on);
        if (_drawStartMarker != null) _drawStartMarker.SetActive(on && !_runActive);
        if (!on) ClearDrawPointerPreview();
    }

    void BuildNodeLattice()
    {
        if (_cm == null) return;
        if (_nodeMarkers.Count > 0 && _nodeMarkers[0] != null) return;
        DestroyNodeLattice();
        int cols = Mathf.Max(1, _cm.gridCols);
        int rows = Mathf.Max(1, _cm.gridRows);
        float spacing = CellSpacing();
        Color nodeCol = new Color(1f, 0.92f, 0.55f, 0.42f);
        for (int x = 0; x < cols; x++)
        {
            for (int y = 0; y < rows; y++)
            {
                var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                go.name = "DrawNode";
                go.transform.SetParent(_root, true);
                go.transform.position = CellWorld(new Vector2Int(x, y), 0.55f);
                go.transform.localScale = Vector3.one * (spacing * 0.09f);
                var col = go.GetComponent<Collider>();
                if (col != null)
                {
                    col.enabled = false;
                    Destroy(col);
                }
                var rend = go.GetComponent<Renderer>();
                if (rend != null)
                {
                    rend.sharedMaterial = CreateColoredLineMaterial(nodeCol, 3040);
                    rend.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                    rend.receiveShadows = false;
                }
                _nodeMarkers.Add(go);
            }
        }
    }

    void BuildDrawStartMarker()
    {
        if (_drawStartMarker != null || _cm == null) return;
        var level = _cm.GetCurrentLevelData();
        Vector2Int start = level != null ? level.robotStartPosition : Vector2Int.zero;
        _drawStartMarker = CreateFloorDisc("DrawStartCell", new Color(1f, 0.55f, 0.12f, 0.9f), 0.55f);
        float spacing = CellSpacing();
        float r = spacing * 0.3f;
        _drawStartMarker.transform.position = CellWorld(start, 0.18f);
        _drawStartMarker.transform.localScale = new Vector3(r * 2f, spacing * 0.045f, r * 2f);
    }

    GameObject CreateFloorDisc(string name, Color color, float alpha)
    {
        EnsureRoot();
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        go.name = name;
        go.transform.SetParent(_root, true);
        var col = go.GetComponent<Collider>();
        if (col != null)
        {
            col.enabled = false;
            Destroy(col);
        }
        var rend = go.GetComponent<Renderer>();
        if (rend != null)
        {
            Color c = color;
            c.a = alpha;
            rend.sharedMaterial = CreateColoredLineMaterial(c, 3050);
            rend.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            rend.receiveShadows = false;
        }
        return go;
    }

    static void TintPrimitive(GameObject go, Color color, float alpha)
    {
        if (go == null) return;
        var rend = go.GetComponent<Renderer>();
        if (rend == null || rend.sharedMaterial == null) return;
        Color c = color;
        c.a = alpha;
        BakeColorIntoMaterial(rend.sharedMaterial, c);
    }

    void DestroyDrawScaffold()
    {
        DestroyNodeLattice();
        DestroyNeighborPads();
        if (_drawStartMarker != null)
        {
            Destroy(_drawStartMarker);
            _drawStartMarker = null;
        }
        if (_penMarker != null)
        {
            Destroy(_penMarker);
            _penMarker = null;
        }
        if (_toolCursor != null)
        {
            Destroy(_toolCursor);
            _toolCursor = null;
        }
    }

    void DestroyNodeLattice()
    {
        for (int i = 0; i < _nodeMarkers.Count; i++)
            if (_nodeMarkers[i] != null) Destroy(_nodeMarkers[i]);
        _nodeMarkers.Clear();
    }

    void DestroyNeighborPads()
    {
        for (int i = 0; i < _neighborPads.Count; i++)
            if (_neighborPads[i] != null) Destroy(_neighborPads[i]);
        _neighborPads.Clear();
    }

    public void ClearStudentDrawing()
    {
        _drawnKeys.Clear();
        _drawnOrder.Clear();
        DestroyLineList(_drawnLines);
        ClearDrawPointerPreview();
    }

    public void SetExpectedKeys(IEnumerable<string> keys)
    {
        _expectedKeys.Clear();
        if (keys == null) return;
        foreach (var k in keys)
        {
            if (!string.IsNullOrEmpty(k)) _expectedKeys.Add(k);
        }
    }

    void CollectExpectedKeysFromProgram()
    {
        _expectedKeys.Clear();
        if (_cm == null) return;
        var keys = _cm.CollectGeometryProgramPathEdgeKeys();
        if (keys == null) return;
        for (int i = 0; i < keys.Count; i++)
            if (!string.IsNullOrEmpty(keys[i])) _expectedKeys.Add(keys[i]);
    }

    void RebuildDrawnOverlay()
    {
        DestroyLineList(_drawnLines);
        if (_drawnOrder.Count == 0) return;
        EnsureRoot();
        for (int i = 0; i < _drawnOrder.Count; i++)
        {
            if (!TryParseKey(_drawnOrder[i], out var from, out var to)) continue;
            var lr = CreateLine("Drawn_" + i, studentDrawColor, trailWidthFraction * 1.05f, dashed: false);
            SetLineEndpoints(lr, from, to);
            lr.sortingOrder = 80;
            _drawnLines.Add(lr);
        }
    }

    static bool TryParseKey(string key, out Vector2Int from, out Vector2Int to)
    {
        from = Vector2Int.zero;
        to = Vector2Int.zero;
        if (string.IsNullOrEmpty(key)) return false;
        int bar = key.IndexOf('|');
        if (bar <= 0) return false;
        string a = key.Substring(0, bar);
        string b = key.Substring(bar + 1);
        int ac = a.IndexOf(',');
        int bc = b.IndexOf(',');
        if (ac <= 0 || bc <= 0) return false;
        if (!int.TryParse(a.Substring(0, ac), out int ax)) return false;
        if (!int.TryParse(a.Substring(ac + 1), out int ay)) return false;
        if (!int.TryParse(b.Substring(0, bc), out int bx)) return false;
        if (!int.TryParse(b.Substring(bc + 1), out int by)) return false;
        from = new Vector2Int(ax, ay);
        to = new Vector2Int(bx, by);
        return true;
    }

    static string[] HashSetToArray(HashSet<string> set)
    {
        if (set == null || set.Count == 0) return System.Array.Empty<string>();
        var arr = new string[set.Count];
        set.CopyTo(arr);
        return arr;
    }

    public static string SegmentKey(Vector2Int a, Vector2Int b)
    {
        bool aFirst = a.x < b.x || (a.x == b.x && a.y <= b.y);
        var from = aFirst ? a : b;
        var to = aFirst ? b : a;
        return from.x + "," + from.y + "|" + to.x + "," + to.y;
    }

    static bool AreAdjacent(Vector2Int a, Vector2Int b)
    {
        int dx = Mathf.Abs(a.x - b.x);
        int dy = Mathf.Abs(a.y - b.y);
        return (dx == 1 && dy == 0) || (dx == 0 && dy == 1);
    }
}

[Serializable]
public class GeometryPathSegmentData
{
    public Vector2Int from;
    public Vector2Int to;
}

[Serializable]
public class GeometryPathToolsData
{
    public bool individualCommands = true;
    public bool repeat;
    public bool actionChunks;
    public bool commandBags;
}

[Serializable]
public class GeometryPathData
{
    public bool enabled = true;
    public string shapeType = "SQUARE";
    public List<GeometryPathSegmentData> segments = new List<GeometryPathSegmentData>();
    public bool drawRobotTrail = true;
    public bool keepShapeVisibleDuringRun;
    public string targetColor;
    public string trailColor;
    public bool requireRepeat;
    public bool requireActionChunk;
    public bool requireCommandBag;
    public string validationMode = "TRACE_TARGET";
    public string afterShapeBehavior = "SHAPE_COMPLETE";
    public Vector2Int finishCell = new Vector2Int(-1, -1);
    public Vector2Int finishFacing = Vector2Int.zero;
    public bool requireFinishFacing;
    public string finishObjectType;
    public GeometryPathToolsData tools = new GeometryPathToolsData();
    public string studentTask = "PROGRAM";
    public bool seedStarterProgram;

    public bool IsDrawPathTask =>
        !string.IsNullOrEmpty(studentTask) &&
        studentTask.Trim().Equals("DRAW_PATH", StringComparison.OrdinalIgnoreCase);
}
