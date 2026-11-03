using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// Drag the robot on the grid before RUN. Toy-style: center = move; left/right sides = rotate.
/// With orbit mode, side press+drag spins the robot smoothly (mouse/touch direction); release snaps to N/E/S/W.
/// Short tap on a side still triggers a single 90° step.
/// On DRAW_PATH, CharacterMove only allows this while the Move tool is selected.
/// </summary>
[DisallowMultipleComponent]
public class RobotGridDrag : MonoBehaviour
{
    public CharacterMove characterMove;

    private enum InteractionMode
    {
        None,
        MoveGrid,
        OrbitRotate
    }

    private InteractionMode _mode;
    private bool _moveDragging;
    private Vector3 _offset;
    private Vector2Int _cellBeforeDrag;
    private Camera _camera;

    private Vector2 _lastPointerScreen;
    private float _orbitAccumulatedScreenPx;
    private float _lastFloorYawDeg;
    private bool _orbitFloorAngleInitialized;
    private bool _orbitSideIsRight;
    private int _activeTouchFingerId = -1;
    private bool _usingTouch;
    private bool _grabPoseActive;
    private Vector3 _grabBasePosition;

    public bool IsManipulating => _mode != InteractionMode.None || _moveDragging;

    private void Awake()
    {
        if (characterMove == null)
            characterMove = GetComponent<CharacterMove>();
    }

    private void LateUpdate()
    {
        if (characterMove == null) return;
        if (_mode == InteractionMode.OrbitRotate || _moveDragging)
            characterMove.AccumulateRobotInteractionTime(Time.deltaTime);
    }

    private void Update()
    {
        if (characterMove == null) return;
        HandleTouchInput();
        if (!_moveDragging || !characterMove.CanDragRobot()) return;
        if (characterMove.rotateRobotWithScrollWhileDragging)
        {
            float mw = Input.mouseScrollDelta.y;
            if (mw > 0.01f)
                characterMove.RotateRobotFacingQuarterTurn(false);
            else if (mw < -0.01f)
                characterMove.RotateRobotFacingQuarterTurn(true);
        }
        if (Input.GetKeyDown(KeyCode.Q))
            characterMove.RotateRobotFacingQuarterTurn(false);
        if (Input.GetKeyDown(KeyCode.E))
            characterMove.RotateRobotFacingQuarterTurn(true);
    }

    private void HandleTouchInput()
    {
        if (Input.touchCount == 0)
        {
            if (_activeTouchFingerId >= 0 && (_mode != InteractionMode.None || _moveDragging))
                EndPointerInteraction();
            _activeTouchFingerId = -1;
            return;
        }

        // Ignore pinch / multi-touch so accidental zoom gestures do not move the robot.
        if (Input.touchCount > 1)
        {
            if (_activeTouchFingerId >= 0 && (_mode != InteractionMode.None || _moveDragging))
                EndPointerInteraction();
            return;
        }

        Touch t = Input.GetTouch(0);
        if (_activeTouchFingerId < 0)
            _activeTouchFingerId = t.fingerId;

        if (t.fingerId != _activeTouchFingerId) return;

        if (UiDragState.IsDragging)
        {
            if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
                EndPointerInteraction();
            return;
        }

        if (t.phase == TouchPhase.Began)
        {
            EnsureInteractionCamera();
            if (UiDragState.IsDragging)
                return;
            if (WouldBeginGrab(t.position))
            {
                BeginPointerInteraction(t.position, touch: true);
                return;
            }
            if (UiDragState.ShouldBlockWorldPointer(t.position, t.fingerId))
                return;
        }
        else if (t.phase == TouchPhase.Moved)
            ContinuePointerInteraction(t.position);
        else if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
            EndPointerInteraction();
    }

    private void OnMouseDown()
    {
        if (Input.touchCount > 0) return;
        EnsureInteractionCamera();
        if (UiDragState.IsDragging) return;
        if (WouldBeginGrab(Input.mousePosition))
        {
            BeginPointerInteraction(Input.mousePosition, touch: false);
            return;
        }
        if (UiDragState.ShouldBlockWorldPointer(Input.mousePosition)) return;
    }

    private void EnsureInteractionCamera()
    {
        if (_camera == null && characterMove != null)
            _camera = characterMove.GetGridInteractionCamera();
    }

    private void BeginPointerInteraction(Vector2 screenPos, bool touch)
    {
        if (characterMove == null || !characterMove.CanDragRobot())
            return;

        _camera = characterMove.GetGridInteractionCamera();
        if (_camera == null) return;

        _usingTouch = touch;
        var draw = characterMove.GetComponent<GeometryPathDrawInput>();
        draw?.CancelStrokeForRobotGrab();
        characterMove.NotifyRobotManipulationStarted();
        GameInteractionSounds.PlayRobotTouch();
        GameHaptics.PlayGrab();
        ApplyGrabPose();

        bool preciseHit = TryGetLateralHitOnRobot(screenPos, out float lateral);
        if (characterMove.tangibleSideTapRotate && preciseHit)
        {
            float halfCell = characterMove.GetCellSpacingForLayout(characterMove.PlayfieldLevelData()) * 0.5f;
            float bandFrac = Mathf.Clamp(characterMove.tangibleCenterDragBandFraction, 0.1f, 0.49f);
            if (touch) bandFrac = Mathf.Min(0.48f, bandFrac * 1.35f);
            float band = halfCell * bandFrac;

            if (lateral < -band || lateral > band)
            {
                bool right = lateral > band;
                if (characterMove.tangibleOrbitDragRotate)
                {
                    _mode = InteractionMode.OrbitRotate;
                    _moveDragging = false;
                    _orbitSideIsRight = right;
                    _lastPointerScreen = screenPos;
                    _orbitAccumulatedScreenPx = 0f;
                    _orbitFloorAngleInitialized = false;
                    characterMove.SetManualOrbitDragActive(true);
                    return;
                }

                GameHaptics.PlayTurn();
                characterMove.RotateRobotFacingQuarterTurn(right);
                ClearGrabPose();
                characterMove.NotifyRobotManipulationEnded();
                return;
            }
        }

        _mode = InteractionMode.MoveGrid;
        _moveDragging = true;
        _cellBeforeDrag = characterMove.RobotGridPosition;
        Vector3 world = GetPointerWorldOnFloor(screenPos);
        _offset = transform.position - world;
        _offset.y += GrabLiftHeight();
    }

    private void OnMouseDrag()
    {
        if (Input.touchCount > 0) return;
        ContinuePointerInteraction(Input.mousePosition);
    }

    private void ContinuePointerInteraction(Vector2 screenPos)
    {
        if (characterMove == null) return;

        if (_mode == InteractionMode.OrbitRotate)
        {
            Vector2 cur = screenPos;
            Vector2 d = cur - _lastPointerScreen;
            _lastPointerScreen = cur;
            _orbitAccumulatedScreenPx += d.magnitude;

            float yaw = d.x * characterMove.orbitScreenDegreesPerPixel;
            if (characterMove.orbitUseVerticalScreenDelta)
                yaw += d.y * characterMove.orbitScreenDegreesPerPixel * characterMove.orbitVerticalToYawScale;

            if (characterMove.orbitBlendFloorAngle)
            {
                Vector3 floor = GetPointerWorldOnFloor(screenPos);
                float fy = FloorYawDegreesFromPointer(floor);
                if (!_orbitFloorAngleInitialized)
                {
                    _lastFloorYawDeg = fy;
                    _orbitFloorAngleInitialized = true;
                }
                else
                {
                    float floorDelta = Mathf.DeltaAngle(_lastFloorYawDeg, fy);
                    _lastFloorYawDeg = fy;
                    yaw += floorDelta * 0.45f;
                }
            }

            transform.Rotate(0f, yaw, 0f, Space.World);
            return;
        }

        if (!_moveDragging || !characterMove.CanDragRobot())
            return;

        Vector3 world = GetPointerWorldOnFloor(screenPos);
        LevelData ld = characterMove.GetCurrentLevelData();
        if (ld != null && CharacterMove.UsesNumberLine(ld))
        {
            Vector2Int tickCell = characterMove.WorldToGridCellForRobotDrag(world + _offset);
            Vector3 snap = characterMove.RobotWorldPositionAtCell(tickCell);
            Ray ray = new Ray(new Vector3(snap.x, transform.position.y + 0.5f, snap.z), Vector3.down);
            if (Physics.Raycast(ray, out RaycastHit hit, 4f, characterMove.gridLayer))
                snap.y = hit.point.y;
            else
                snap.y = transform.position.y;
            transform.position = snap;
        }
        else
        {
            transform.position = world + _offset;
        }

        if (characterMove.orientRobotTowardDrag && !characterMove.IsLevelStartFacingLocked)
            ApplyFacingTowardPointer(world);
    }

    private static float FloorYawDegreesFromPointer(Vector3 robotPos, Vector3 pointerOnFloor)
    {
        Vector3 flat = pointerOnFloor - robotPos;
        flat.y = 0f;
        if (flat.sqrMagnitude < 1e-8f)
            return 0f;
        return Mathf.Atan2(flat.x, flat.z) * Mathf.Rad2Deg;
    }

    private float FloorYawDegreesFromPointer(Vector3 pointerOnFloor)
    {
        return FloorYawDegreesFromPointer(transform.position, pointerOnFloor);
    }

    private void ApplyFacingTowardPointer(Vector3 pointerOnFloor)
    {
        LevelData ld = characterMove.GetCurrentLevelData();
        if (ld != null && characterMove.RobotGridPosition == ld.robotStartPosition)
            return;

        Vector3 delta = pointerOnFloor - transform.position;
        delta.y = 0f;
        if (delta.sqrMagnitude < 1e-4f)
            return;

        float ax = Mathf.Abs(delta.x);
        float az = Mathf.Abs(delta.z);
        Vector2Int fd;
        if (Mathf.Approximately(ax, az))
            return;
        fd = (ax > az)
            ? (delta.x >= 0f ? Vector2Int.right : Vector2Int.left)
            : (delta.z >= 0f ? Vector2Int.up : Vector2Int.down);

        if (fd != characterMove.RobotFacing)
            characterMove.SetRobotFacingDirection(fd);
    }

    private void OnMouseUp()
    {
        if (Input.touchCount > 0) return;
        EndPointerInteraction();
    }

    private void EndPointerInteraction()
    {
        if (characterMove == null)
            return;

        characterMove.NotifyRobotManipulationEnded();
        ClearGrabPose();

        if (_mode == InteractionMode.OrbitRotate)
        {
            if (_orbitAccumulatedScreenPx < characterMove.orbitTapVsDragPixelThreshold)
            {
                GameHaptics.PlayTurn();
                characterMove.RotateRobotFacingQuarterTurn(_orbitSideIsRight);
            }
            else
            {
                GameHaptics.PlayDrop();
                characterMove.SnapRobotFacingToNearestCardinalFromTransform();
            }

            characterMove.SetManualOrbitDragActive(false);
            characterMove.RestoreAnimatorAfterOrbitIfIdle();
            _mode = InteractionMode.None;
            _activeTouchFingerId = -1;
            _usingTouch = false;
            return;
        }

        if (!_moveDragging)
        {
            _mode = InteractionMode.None;
            _activeTouchFingerId = -1;
            _usingTouch = false;
            return;
        }

        _moveDragging = false;
        _mode = InteractionMode.None;
        _activeTouchFingerId = -1;
        _usingTouch = false;
        Vector2Int cell = characterMove.WorldToGridCellForRobotDrag(transform.position);
        if (!characterMove.TryPlaceRobotOnCell(cell))
            characterMove.RevertRobotToCell(_cellBeforeDrag);
        else
            GameHaptics.PlayDrop();
    }

    private void OnDisable()
    {
        if (characterMove != null && _mode == InteractionMode.OrbitRotate)
        {
            characterMove.SnapRobotFacingToNearestCardinalFromTransform();
            characterMove.SetManualOrbitDragActive(false);
            characterMove.RestoreAnimatorAfterOrbitIfIdle();
        }
        _mode = InteractionMode.None;
        _moveDragging = false;
        _usingTouch = false;
        ClearGrabPose();
    }

    public bool WouldBeginGrab(Vector2 screenPos)
    {
        if (characterMove == null || !characterMove.CanDragRobot()) return false;
        EnsureInteractionCamera();
        if (TryGetLateralHitOnRobot(screenPos, out _)) return true;
        return IsWithinGrabRadius(screenPos);
    }

    /// <summary>Lateral offset of the ray hit on the robot, along robot's flattened right axis (+ = right).</summary>
    private bool TryGetLateralHitOnRobot(Vector2 screenPos, out float lateral)
    {
        lateral = 0f;
        EnsureInteractionCamera();
        if (_camera == null) return false;

        Ray ray = _camera.ScreenPointToRay(screenPos);
        const float maxDist = 500f;
        var hits = Physics.RaycastAll(ray, maxDist);
        if (hits == null || hits.Length == 0) return false;

        System.Array.Sort(hits, (a, b) => a.distance.CompareTo(b.distance));

        foreach (var h in hits)
        {
            if (h.collider == null) continue;
            Transform t = h.collider.transform;
            if (t != transform && !t.IsChildOf(transform))
                continue;

            Vector3 right = transform.right;
            right.y = 0f;
            if (right.sqrMagnitude < 1e-4f)
                right = Vector3.right;
            else
                right.Normalize();

            Vector3 flat = h.point - transform.position;
            flat.y = 0f;
            lateral = Vector3.Dot(flat, right);
            return true;
        }

        return false;
    }

    bool IsWithinGrabRadius(Vector2 screenPos)
    {
        EnsureInteractionCamera();
        if (_camera == null) return false;
        Bounds b = characterMove != null ? characterMove.RobotVisibleBounds() : new Bounds(transform.position, Vector3.one);
        Vector3 robotScreen = _camera.WorldToScreenPoint(b.center);
        if (robotScreen.z < 0.05f) return false;
        float radius = GrabScreenRadius(b);
        return Vector2.Distance(screenPos, new Vector2(robotScreen.x, robotScreen.y)) <= radius;
    }

    float GrabScreenRadius(Bounds worldBounds)
    {
        EnsureInteractionCamera();
        if (_camera == null) return 88f;
        Vector3 c = worldBounds.center;
        Vector3 edge = c + _camera.transform.right * (worldBounds.extents.x + worldBounds.extents.z) * 0.5f;
        Vector2 sc = _camera.WorldToScreenPoint(c);
        Vector2 se = _camera.WorldToScreenPoint(edge);
        float fromMesh = Vector2.Distance(sc, se) + 36f;
        float minPx = _usingTouch || Input.touchCount > 0 ? 72f : 56f;
        return Mathf.Clamp(fromMesh, minPx, 140f);
    }

    float GrabLiftHeight()
    {
        Bounds b = characterMove != null ? characterMove.RobotVisibleBounds() : new Bounds(transform.position, Vector3.one);
        return Mathf.Clamp(b.size.y * 0.12f, 0.04f, 0.45f);
    }

    void ApplyGrabPose()
    {
        if (_grabPoseActive) return;
        _grabPoseActive = true;
        _grabBasePosition = transform.position;
        Vector3 p = transform.position;
        p.y += GrabLiftHeight();
        transform.position = p;
    }

    void ClearGrabPose()
    {
        _grabPoseActive = false;
    }

    private Vector3 GetPointerWorldOnFloor(Vector2 screenPos)
    {
        if (_camera == null)
            _camera = characterMove != null ? characterMove.GetGridInteractionCamera() : Camera.main;
        if (_camera == null) return transform.position;

        Ray ray = _camera.ScreenPointToRay(screenPos);
        float y = transform.position.y;
        var plane = new Plane(Vector3.up, new Vector3(0f, y, 0f));
        if (plane.Raycast(ray, out float dist))
            return ray.GetPoint(dist);
        return transform.position;
    }
}
