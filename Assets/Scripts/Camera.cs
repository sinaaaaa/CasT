using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Grid-aware tracking camera.
///
/// What it does each frame:
///   1. Auto-discovers CharacterMove and the current grid (gridCols × gridRows × gridSize,
///      anchored at robotStartWorldPos).
///   2. Computes a world-space bounds that includes:
///         • the entire virtual matrix,
///         • the character's renderer bounds,
///         • every active obstacle + grid object's renderer bounds.
///   3. Picks a camera position + orthographic size / perspective distance so that the
///      bounds always fit on screen with a small padding margin.
///   4. SmoothDamps both position and size every frame.
///
/// Compatible with the older API used by CharacterMove, CameraControllerUI, CameraSetupGuide:
///   targets, CameraMode, currentMode, SetCameraMode, ResetCameraToGrid,
///   SetRunPresentationActive, AddTarget, gridSize/gridRows/gridCols/robotStartWorldPos.
/// </summary>
[RequireComponent(typeof(Camera))]
public class MultiTargetCamera : MonoBehaviour
{
    public enum CameraMode { TopDown, ChessCorner, Isometric, Follow, Strategic }

    [Header("Tracking")]
    [Tooltip("CharacterMove that owns the grid + the robot. Auto-found on Start if left empty.")]
    public CharacterMove characterMove;

    [Tooltip("Extra transforms (besides characterMove) that the camera must keep in view. Optional.")]
    public List<Transform> targets = new List<Transform>();

    [Tooltip("Include every active obstacle / grid object in the framing. Recommended ON.")]
    public bool includeGridObjects = true;

    [Tooltip("Always include the full virtual matrix (gridCols × gridRows × gridSize) in the framing. Recommended ON so the camera shows the whole board.")]
    public bool includeGridArea = true;

    [Header("View preset")]
    [Tooltip("Quick camera style. Chess Corner = 3D view from a board corner (like chess.com). Applied on Play.")]
    public CameraMode viewPreset = CameraMode.TopDown;

    [Tooltip("Tilt toward the board for Chess Corner view (X rotation).")]
    [Range(20f, 70f)]
    public float chessCornerPitch = 38f;

    [Tooltip("Which corner to look from (Y rotation). 45 = NE corner, 135 = NW, 225 = SW, 315 = SE.")]
    [Range(0f, 360f)]
    public float chessCornerYaw = 45f;

    [Tooltip("Pull the camera back further in angled 3D views (Chess Corner / Isometric).")]
    [Range(1f, 2.5f)]
    public float angledViewDistanceMultiplier = 1.45f;

    [Header("Framing")]
    [Tooltip("Camera angle. (90,0,0) = pure top-down. Set via View Preset or adjust manually.")]
    public Vector3 lookAngle = new Vector3(90f, 0f, 0f);

    [Header("Position tuning (Inspector)")]
    [Tooltip("World-space nudge after auto-framing. X/Z slide on the map; Y nudges height (perspective only — see Height / Zoom below for orthographic).")]
    public Vector3 cameraPositionOffset = Vector3.zero;

    [Tooltip("Push the camera further from the board along the view direction.")]
    public float extraViewDistance = 0f;

    [Tooltip("When on, camera Y is always Manual Camera Height (auto framing still sets X and Z).")]
    public bool useManualCameraHeight = false;

    [Tooltip("Fixed world Y (height). Enable Use Manual Camera Height.")]
    public float manualCameraHeight = 100f;

    [Tooltip("When on, world Z is fixed to Locked World Z (auto framing still sets X and Y).")]
    public bool lockWorldZ = false;

    [Tooltip("Camera transform.position.z when Lock World Z is enabled.")]
    public float lockedWorldZ = 0f;

    [Header("Height / zoom (orthographic top-down)")]
    [Tooltip("Top-down orthographic cameras do NOT change zoom when you move Y — use these instead.")]
    public bool useManualOrthographicSize = false;

    [Tooltip("Fixed orthographic size (zoom). Lower = zoomed in, higher = zoomed out.")]
    public float manualOrthographicSize = 80f;

    [Tooltip("Added to the auto-calculated orthographic size when manual size is off.")]
    public float orthographicSizeOffset = 0f;

    [Tooltip("Extra padding around the framed bounds. -1 = auto (uses 30% of gridSize). Higher values pull the camera further out.")]
    public float worldPadding = -1f;

    [Tooltip("Shifts the framing toward the character. 0 = center on whole bounds. 0.25 = slight emphasis on the character WHILE keeping the entire grid + every object visible.")]
    [Range(0f, 1f)] public float characterFocus = 0f;

    [Tooltip("Lerp time for position / zoom. 0.10 snappy, 0.25 smooth.")]
    [Min(0.0001f)] public float smoothTime = 0.18f;

    [Header("Camera Projection")]
    [Tooltip("If ON, the script uses orthographic size to frame the bounds. If OFF, perspective FOV is used.")]
    public bool forceOrthographic = false;

    [Tooltip("FOV used when not orthographic.")]
    [Range(20f, 100f)] public float perspectiveFOV = 60f;

    [Tooltip("Min orthographic size / FOV multiplier — keeps the camera from over-zooming when the board is tiny.")]
    public float minOrthoSize = 50f;

    [Header("Run Presentation")]
    [Tooltip("When CharacterMove starts running the program, raise the focus on the character so the robot reads bigger in the camera. Reverts after the run.")]
    public bool emphasizeCharacterDuringRun = true;
    [Range(0f, 1f)] public float runFocusBoost = 0.25f;

    // ---------------------------------------------------------------
    // Public legacy fields/methods kept so other scripts still compile.
    // ---------------------------------------------------------------
    [HideInInspector] public CameraMode currentMode = CameraMode.TopDown;
    [HideInInspector] public float gridSize = 200f;
    [HideInInspector] public int gridRows = 6;
    [HideInInspector] public int gridCols = 6;
    [HideInInspector] public Vector3 robotStartWorldPos = Vector3.zero;
    [HideInInspector] public float topDownHeight = 25f;
    [HideInInspector] public float topDownFOV = 100f;
    [HideInInspector] public Vector3 isometricOffset = new Vector3(8, 8, -8);
    [HideInInspector] public float isometricFOV = 60f;
    [HideInInspector] public Vector3 followOffset = new Vector3(0, 5, -5);
    [HideInInspector] public float followFOV = 50f;
    [HideInInspector] public Vector3 strategicOffset = new Vector3(0, 12, -8);
    [HideInInspector] public float strategicFOV = 55f;
    [HideInInspector] public bool enableMouseZoom = false;
    [HideInInspector] public bool enableMousePan = false;
    [HideInInspector] public float mouseZoomSpeed = 0f;
    [HideInInspector] public float mousePanSpeed = 0f;
    [HideInInspector] public float keyboardPanSpeed = 0f;

    private Camera _cam;
    private Vector3 _posVelocity;
    private float _sizeVelocity;
    private float _fovVelocity;
    private bool _isRunPresentation;
    private float _baseFocusValue;

    private static readonly List<Renderer> _rendererBuffer = new List<Renderer>(8);

    private void Awake()
    {
        _cam = GetComponent<Camera>();
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        _baseFocusValue = characterFocus;
        if (forceOrthographic) _cam.orthographic = true;
        if (!_cam.orthographic) _cam.fieldOfView = perspectiveFOV;
    }

    private void Start()
    {
        SyncGridFromCharacterMove();
        ApplyViewPreset(viewPreset);
        SnapNow();
    }

    private void LateUpdate()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        SyncGridFromCharacterMove();
        // Keep the grid/camera stable while the student drags action blocks on touch devices.
        if (UiDragState.IsDragging) return;
        TickCamera(Time.deltaTime);
    }

    private void SyncGridFromCharacterMove()
    {
        if (characterMove == null) return;
        gridSize = characterMove.gridSize;
        gridRows = characterMove.gridRows;
        gridCols = characterMove.gridCols;
        robotStartWorldPos = characterMove.GetGridOriginWorld();
    }

    private bool IsAngled3DView => lookAngle.x < 80f;

    private float GetPerspectiveDistanceScale() => IsAngled3DView ? angledViewDistanceMultiplier : 1f;

    // ----------------------------------------------------------------
    // Framing — what to include + how to compute the bounds
    // ----------------------------------------------------------------

    /// <summary>
    /// Builds the world-space bounds the camera must fit, with padding applied.
    /// Includes the grid area, the character, all active grid objects, all extra targets.
    /// </summary>
    private bool BuildFramingBounds(out Bounds bounds, out Vector3 characterPosition)
    {
        bool any = false;
        bounds = new Bounds();
        characterPosition = Vector3.zero;

        if (includeGridArea && gridSize > 0f && gridCols > 0 && gridRows > 0)
        {
            Vector3 center = robotStartWorldPos + new Vector3((gridCols - 1) * 0.5f * gridSize, 0f, (gridRows - 1) * 0.5f * gridSize);
            float boardH = IsAngled3DView ? Mathf.Max(gridSize * 0.45f, 8f) : 0.1f;
            Vector3 size   = new Vector3(gridCols * gridSize, boardH, gridRows * gridSize);
            bounds = new Bounds(center, size);
            any = true;
        }

        if (characterMove != null)
        {
            characterPosition = characterMove.transform.position;
            AddObjectBoundsToFraming(characterMove.gameObject, ref bounds, ref any);

            if (includeGridObjects)
            {
                if (characterMove.activeGridObjects != null)
                {
                    for (int i = 0; i < characterMove.activeGridObjects.Count; i++)
                    {
                        var go = characterMove.activeGridObjects[i];
                        if (go == null || !go.activeInHierarchy) continue;
                        AddObjectBoundsToFraming(go, ref bounds, ref any);
                    }
                }
                if (characterMove.activeObstacles != null)
                {
                    for (int i = 0; i < characterMove.activeObstacles.Count; i++)
                    {
                        var go = characterMove.activeObstacles[i];
                        if (go == null || !go.activeInHierarchy) continue;
                        AddObjectBoundsToFraming(go, ref bounds, ref any);
                    }
                }
                if (characterMove.activeFlag != null && characterMove.activeFlag.activeInHierarchy)
                    AddObjectBoundsToFraming(characterMove.activeFlag, ref bounds, ref any);
            }
        }

        if (targets != null)
        {
            for (int i = 0; i < targets.Count; i++)
            {
                Transform t = targets[i];
                if (t == null || !t.gameObject.activeInHierarchy) continue;
                AddObjectBoundsToFraming(t.gameObject, ref bounds, ref any);
            }
        }

        if (!any) return false;

        float pad = (worldPadding < 0f) ? Mathf.Max(gridSize, 1f) * 0.30f : worldPadding;
        bounds.Expand(new Vector3(pad, pad, pad) * 2f);
        return true;
    }

    private static void AddObjectBoundsToFraming(GameObject obj, ref Bounds bounds, ref bool any)
    {
        if (obj == null) return;
        obj.GetComponentsInChildren(true, _rendererBuffer);
        Bounds objBounds = default;
        bool hasObj = false;
        for (int i = 0; i < _rendererBuffer.Count; i++)
        {
            var r = _rendererBuffer[i];
            if (r == null || !r.enabled) continue;
            if (!hasObj) { objBounds = r.bounds; hasObj = true; }
            else objBounds.Encapsulate(r.bounds);
        }

        if (!hasObj)
        {
            // Fallback to transform position so we still keep it in view.
            if (!any) { bounds = new Bounds(obj.transform.position, Vector3.zero); any = true; }
            else bounds.Encapsulate(obj.transform.position);
            return;
        }

        if (!any) { bounds = objBounds; any = true; }
        else bounds.Encapsulate(objBounds);
    }

    /// <summary>Worst-case half-width / half-height / depth of the bounds from <paramref name="focus"/> along camera axes.</summary>
    private static void MeasureBoundsInCameraSpace(Bounds bounds, Vector3 focus, Quaternion camRot,
        out float halfWidth, out float halfHeight, out float depth)
    {
        Vector3 right = camRot * Vector3.right;
        Vector3 up    = camRot * Vector3.up;
        Vector3 fwd   = camRot * Vector3.forward;

        Vector3 min = bounds.min, max = bounds.max;
        float w = 0f, h = 0f, d = 0f;
        for (int i = 0; i < 8; i++)
        {
            Vector3 corner = new Vector3(
                ((i & 1) == 0) ? min.x : max.x,
                ((i & 2) == 0) ? min.y : max.y,
                ((i & 4) == 0) ? min.z : max.z);
            Vector3 delta = corner - focus;
            w = Mathf.Max(w, Mathf.Abs(Vector3.Dot(delta, right)));
            h = Mathf.Max(h, Mathf.Abs(Vector3.Dot(delta, up)));
            d = Mathf.Max(d, Mathf.Abs(Vector3.Dot(delta, fwd)));
        }
        halfWidth = w;
        halfHeight = h;
        depth = d;
    }

    // ----------------------------------------------------------------
    // Position + zoom computation
    // ----------------------------------------------------------------

    private void ComputeCameraTarget(out Vector3 targetPos, out Quaternion targetRot,
        out float targetOrthoSize, out float targetFOV)
    {
        targetPos = transform.position;
        targetRot = Quaternion.Euler(lookAngle);
        targetOrthoSize = _cam != null ? _cam.orthographicSize : 5f;
        targetFOV = perspectiveFOV;

        if (!BuildFramingBounds(out Bounds bounds, out Vector3 characterPos)) return;

        Vector3 focus = bounds.center;
        if (characterMove != null && characterFocus > 0f)
            focus = Vector3.Lerp(bounds.center, characterPos, characterFocus);

        MeasureBoundsInCameraSpace(bounds, focus, targetRot, out float halfW, out float halfH, out float depth);

        if (forceOrthographic && _cam != null) _cam.orthographic = true;
        bool ortho = _cam != null && _cam.orthographic;

        float aspect = (_cam != null && _cam.aspect > 0f) ? _cam.aspect : 1.6f;
        float distance;
        if (ortho)
        {
            distance = Mathf.Max(depth + 10f, minOrthoSize);
            targetOrthoSize = Mathf.Max(halfH, halfW / aspect, 1f);
        }
        else
        {
            float vFov = perspectiveFOV * Mathf.Deg2Rad;
            float distV = halfH / Mathf.Tan(vFov * 0.5f);
            float distH = halfW / (Mathf.Tan(vFov * 0.5f) * aspect);
            distance = Mathf.Max(distV, distH, 5f) * GetPerspectiveDistanceScale();
            targetFOV = perspectiveFOV;
        }

        Vector3 forward = targetRot * Vector3.forward;
        distance += extraViewDistance;
        targetPos = focus - forward * distance;
        targetPos += cameraPositionOffset;
        if (useManualCameraHeight)
            targetPos.y = manualCameraHeight;
        if (lockWorldZ)
            targetPos.z = lockedWorldZ;
    }

    private float ApplyOrthographicTuning(float computedOrtho)
    {
        if (useManualOrthographicSize)
            return Mathf.Max(0.01f, manualOrthographicSize);
        return Mathf.Max(0.01f, computedOrtho + orthographicSizeOffset);
    }

    private void TickCamera(float dt)
    {
        ComputeCameraTarget(out Vector3 tPos, out Quaternion tRot, out float tOrtho, out float tFov);
        tOrtho = ApplyOrthographicTuning(tOrtho);

        transform.position = Vector3.SmoothDamp(transform.position, tPos, ref _posVelocity, smoothTime);

        float rotLerp = 1f - Mathf.Exp(-dt / Mathf.Max(smoothTime, 0.0001f));
        transform.rotation = Quaternion.Slerp(transform.rotation, tRot, rotLerp);

        if (_cam == null) return;
        if (_cam.orthographic)
            _cam.orthographicSize = Mathf.SmoothDamp(_cam.orthographicSize, tOrtho, ref _sizeVelocity, smoothTime);
        else
            _cam.fieldOfView = Mathf.SmoothDamp(_cam.fieldOfView, tFov, ref _fovVelocity, smoothTime);
    }

    /// <summary>Snap to the target framing immediately, no smoothing.</summary>
    public void SnapNow()
    {
        if (_cam == null) _cam = GetComponent<Camera>();
        EnsureClipPlanesForGrid();
        ComputeCameraTarget(out Vector3 tPos, out Quaternion tRot, out float tOrtho, out float tFov);
        tOrtho = ApplyOrthographicTuning(tOrtho);
        transform.position = tPos;
        transform.rotation = tRot;
        if (_cam != null)
        {
            if (_cam.orthographic) _cam.orthographicSize = tOrtho;
            else                   _cam.fieldOfView      = tFov;
        }
        _posVelocity = Vector3.zero;
        _sizeVelocity = 0f;
        _fovVelocity = 0f;
    }

    // ----------------------------------------------------------------
    // Public API — preserved for other scripts.
    // ----------------------------------------------------------------

    public void AddTarget(Transform t)
    {
        if (t == null) return;
        if (targets == null) targets = new List<Transform>();
        if (!targets.Contains(t)) targets.Add(t);
    }

    public void ClearTargets()
    {
        if (targets != null) targets.Clear();
    }

    /// <summary>Snap immediately to a correctly framed view. Call from CharacterMove after SetupLevel.</summary>
    public void ResetCameraToGrid()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        SyncGridFromCharacterMove();
        SnapNow();
    }

    /// <summary>
    /// Called by CharacterMove around each run. Raises character focus during the run, restores after.
    /// </summary>
    public void SetRunPresentationActive(bool active)
    {
        if (_isRunPresentation == active) return;
        _isRunPresentation = active;
        if (!emphasizeCharacterDuringRun) return;
        if (active)
        {
            _baseFocusValue = characterFocus;
            characterFocus = Mathf.Clamp01(characterFocus + runFocusBoost);
            }
            else
        {
            characterFocus = Mathf.Clamp01(_baseFocusValue);
        }
    }

    /// <summary>Apply a view preset (TopDown, ChessCorner, Isometric, …).</summary>
    public void ApplyViewPreset(CameraMode mode)
    {
        viewPreset = mode;
        SetCameraMode(mode);
    }

    /// <summary>Change look angle to a preset. Auto-framing still tracks the full grid.</summary>
    public void SetCameraMode(CameraMode mode)
    {
        currentMode = mode;
        viewPreset = mode;

        switch (mode)
        {
            case CameraMode.TopDown:
                lookAngle = new Vector3(90f, 0f, 0f);
                break;
            case CameraMode.ChessCorner:
                lookAngle = new Vector3(chessCornerPitch, chessCornerYaw, 0f);
                forceOrthographic = false;
                if (_cam == null) _cam = GetComponent<Camera>();
                if (_cam != null) _cam.orthographic = false;
                perspectiveFOV = 52f;
                break;
            case CameraMode.Isometric:
                lookAngle = new Vector3(45f, 45f, 0f);
                forceOrthographic = false;
                if (_cam != null) _cam.orthographic = false;
                break;
            case CameraMode.Follow:
                lookAngle = new Vector3(55f, 30f, 0f);
                forceOrthographic = false;
                if (_cam != null) _cam.orthographic = false;
                break;
            case CameraMode.Strategic:
                lookAngle = new Vector3(58f, 45f, 0f);
                forceOrthographic = false;
                if (_cam != null) _cam.orthographic = false;
                break;
        }

        ApplyPresentationModeForView(mode);
        EnsureClipPlanesForGrid();
        SnapNow();
    }

    private void ApplyPresentationModeForView(CameraMode mode)
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        if (characterMove == null) return;

        bool angled = mode == CameraMode.ChessCorner || mode == CameraMode.Isometric
            || mode == CameraMode.Follow || mode == CameraMode.Strategic;
        characterMove.SetPresentation3DAngled(angled);

        if (mode == CameraMode.ChessCorner || mode == CameraMode.Isometric)
        {
            useManualCameraHeight = false;
            useManualOrthographicSize = false;
        }
    }

    private void EnsureClipPlanesForGrid()
    {
        if (_cam == null) _cam = GetComponent<Camera>();
        if (_cam == null) return;

        float span = Mathf.Max(gridCols, gridRows) * Mathf.Max(gridSize, 1f);
        _cam.nearClipPlane = Mathf.Clamp(span * 0.002f, 0.05f, 5f);
        _cam.farClipPlane = Mathf.Max(_cam.farClipPlane, span * 4f + 200f);
    }

#if UNITY_EDITOR
    private void OnValidate()
    {
        if (Application.isPlaying) return;
        if (viewPreset == CameraMode.ChessCorner)
            lookAngle = new Vector3(chessCornerPitch, chessCornerYaw, 0f);
    }
#endif

    [ContextMenu("Apply Chess Corner View (3D)")]
    private void ApplyChessCornerContextMenu() => ApplyViewPreset(CameraMode.ChessCorner);

    [ContextMenu("Apply Top Down View")]
    private void ApplyTopDownContextMenu() => ApplyViewPreset(CameraMode.TopDown);

    [ContextMenu("Capture Current Transform As Manual Height/Z")]
    private void CaptureCurrentTransformLocks()
    {
        manualCameraHeight = transform.position.y;
        lockedWorldZ = transform.position.z;
        useManualCameraHeight = true;
        Debug.Log($"[MultiTargetCamera] Manual height Y={manualCameraHeight:F2}, locked Z={lockedWorldZ:F2}");
    }

    [ContextMenu("Capture Current Orthographic Size")]
    private void CaptureCurrentOrthographicSize()
    {
        if (_cam == null) _cam = GetComponent<Camera>();
        if (_cam != null && _cam.orthographic)
        {
            manualOrthographicSize = _cam.orthographicSize;
            useManualOrthographicSize = true;
            Debug.Log($"[MultiTargetCamera] Manual orthographic size = {manualOrthographicSize:F2}");
        }
    }

#if UNITY_EDITOR
    [Header("Debug")]
    public bool drawFramingGizmos = false;
    public Color framingGizmoColor = new Color(0.2f, 1f, 0.4f, 0.5f);
    private void OnDrawGizmosSelected()
    {
        if (!drawFramingGizmos) return;

        // IMPORTANT: do NOT mutate serialized fields here (gridSize, gridRows, ...).
        // Doing so during the Inspector's render pass triggers
        // "SerializedObject of SerializedProperty has been Disposed".
        // Read values locally and draw without touching the fields.
        CharacterMove cm = characterMove;
        if (cm == null && !Application.isPlaying) cm = FindObjectOfType<CharacterMove>();

        float gs = (cm != null) ? cm.gridSize          : gridSize;
        int   gc = (cm != null) ? cm.gridCols          : gridCols;
        int   gr = (cm != null) ? cm.gridRows          : gridRows;
        Vector3 origin = (cm != null) ? cm.robotStartWorldPos : robotStartWorldPos;

        if (gs <= 0f || gc < 1 || gr < 1) return;
        Vector3 center = origin + new Vector3((gc - 1) * 0.5f * gs, 0f, (gr - 1) * 0.5f * gs);
        Vector3 size   = new Vector3(gc * gs, 0.1f, gr * gs);

        float pad = (worldPadding < 0f) ? Mathf.Max(gs, 1f) * 0.30f : worldPadding;
        size += new Vector3(pad, pad, pad) * 2f;

        Gizmos.color = framingGizmoColor;
        Gizmos.DrawWireCube(center, size);
    }
#endif
}
