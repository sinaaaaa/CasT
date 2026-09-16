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
    readonly HashSet<string> _completedKeys = new HashSet<string>();
    readonly HashSet<string> _traveledKeys = new HashSet<string>();
    readonly List<string> _travelOrder = new List<string>();
    /// <summary>Frozen after EndRunTracking so Try Again restore does not wipe report telemetry.</summary>
    string[] _lastTraveledKeys = System.Array.Empty<string>();
    string[] _lastCompletedKeys = System.Array.Empty<string>();
    string[] _lastTravelOrder = System.Array.Empty<string>();
    Vector2Int _lastRobotCell;
    Vector2Int _lastRobotFacing;
    GameObject _startMarker;
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

    public bool IsActive =>
        _config != null && _config.enabled && _config.segments != null && _config.segments.Count > 0;

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
        ForceRebuildTargetOverlay(playIntro: true);
        Debug.Log($"[GeometryPath] Drew {_config.segments.Count} target edges.");
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

        ForceRebuildTargetOverlay(playIntro: true);
        Debug.Log($"[GeometryPath] Restored shape for new attempt ({_targetLines.Count} edges).");
    }

    public void ResetAttempt()
    {
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

        bool keepShape = _config != null && _config.keepShapeVisibleDuringRun;
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
        bool keepShape = _config != null && _config.keepShapeVisibleDuringRun;
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
        _lastTraveledKeys = new string[_traveledKeys.Count];
        _traveledKeys.CopyTo(_lastTraveledKeys);
        _lastCompletedKeys = new string[_completedKeys.Count];
        _completedKeys.CopyTo(_lastCompletedKeys);
        _lastTravelOrder = _travelOrder.ToArray();
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

        bool onTarget = HasTargetKey(key);
        if (onTarget) _completedKeys.Add(key);

        if (_config.drawRobotTrail)
        {
            Color col = onTarget ? trailColor : offPathColor;
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
        SnapshotRunTelemetry(robotCell, robotFacing);

        if (!IsActive) return true;
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

    void BuildStartMarker()
    {
        if (_cm == null || _config?.segments == null || _config.segments.Count == 0) return;
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
        ClearTrailVisuals();
        DestroyLineList(_targetLines);
        DestroyLineList(_targetGlowLines);
        DestroyStartMarker();
        if (_root != null)
        {
            Destroy(_root.gameObject);
            _root = null;
        }
        if (!keepConfig) _config = null;
        _runActive = false;
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
}
