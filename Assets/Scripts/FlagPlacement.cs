using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// Listens for mouse / touch input and asks CharacterMove to place (or move)
/// the goal flag on the cell the player tapped.
///
/// Setup:
///  1. Set `LevelData.useFlagPlacement = true` on flag levels (e.g. Level 2) in CharacterMove.
///     The legacy "Flag Placement Mode" inspector toggle no longer affects other levels.
///  2. Drop this component on ANY GameObject in the scene (e.g. the same one
///     that has CharacterMove). Assign `characterMove` if you don't want it
///     auto-discovered.
///  3. Press Play. Click / tap a valid cell (including cells with grid objects) to place the flag.
///     Click another cell to move it (if CharacterMove.allowFlagMove is true).
///
/// The flag uses CharacterMove.flagPrefab and becomes the level's end-target,
/// so all existing win-check logic continues to work unchanged.
/// </summary>
public class FlagPlacement : MonoBehaviour
{
    [Header("References")]
    public CharacterMove characterMove;

    [Header("Input")]
    [Tooltip("Maximum distance from press to release for the gesture to count as a 'tap'. " +
             "Larger drags are ignored so dragging the camera / queue blocks doesn't place a flag.")]
    public float maxTapDragPixels = 28f;
    [Tooltip("If true, taps over UI (buttons, panels) are ignored. " +
             "Turn OFF if the grid never receives taps (fullscreen UI blocking).")]
    public bool ignoreClicksOverUI = false;

    [Header("Optional Hover Preview (world flags only; off by default)")]
    [Tooltip("If true, a ghost is shown under the desktop cursor — only works for non-UI flag prefabs. " +
             "Turn OFF — Destroy() on previews caused editor noise and leaks when misconfigured.")]
    public bool showHoverPreview = false;
    [Range(0f, 1f)] public float hoverAlpha = 0.35f;

    [Header("Debug")]
    public bool logEvents = false;

    private Vector2 _pressScreenPos;
    private bool    _pressing;
    private GameObject _hoverGhost;

    private void Awake()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
    }

    private void Update()
    {
        if (characterMove == null) return;
        if (!characterMove.IsFlagPlacementActive) { HideHoverGhost(); return; }

        UpdateHoverGhost();

        // Touch + mouse unified: we only react to a quick tap (press-and-release
        // close to the same screen position) to avoid hijacking other drags.
        bool pressed  = false;
        bool released = false;
        Vector2 pos   = Vector2.zero;

#if ENABLE_INPUT_SYSTEM && !ENABLE_LEGACY_INPUT_MANAGER
        // Optional: support new input system if the user is on it.
        if (UnityEngine.InputSystem.Touchscreen.current != null &&
            UnityEngine.InputSystem.Touchscreen.current.primaryTouch.press.isPressed)
        {
            pos = UnityEngine.InputSystem.Touchscreen.current.primaryTouch.position.ReadValue();
            pressed  = UnityEngine.InputSystem.Touchscreen.current.primaryTouch.press.wasPressedThisFrame;
            released = UnityEngine.InputSystem.Touchscreen.current.primaryTouch.press.wasReleasedThisFrame;
        }
        else if (UnityEngine.InputSystem.Mouse.current != null)
        {
            pos = UnityEngine.InputSystem.Mouse.current.position.ReadValue();
            pressed  = UnityEngine.InputSystem.Mouse.current.leftButton.wasPressedThisFrame;
            released = UnityEngine.InputSystem.Mouse.current.leftButton.wasReleasedThisFrame;
        }
#else
        if (Input.touchSupported && Input.touchCount > 0)
        {
            Touch t = Input.GetTouch(0);
            pos = t.position;
            pressed  = (t.phase == TouchPhase.Began);
            released = (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled);
        }
        else
        {
            pos = Input.mousePosition;
            pressed  = Input.GetMouseButtonDown(0);
            released = Input.GetMouseButtonUp(0);
        }
#endif

        if (pressed)
        {
            if (ignoreClicksOverUI && IsPointerOverUI(pos)) { _pressing = false; return; }
            _pressing = true;
            _pressScreenPos = pos;
        }
        else if (released && _pressing)
        {
            _pressing = false;
            if (Vector2.Distance(pos, _pressScreenPos) > maxTapDragPixels)
            {
                if (logEvents) Debug.Log("[FlagPlacement] Gesture was a drag, not a tap. Ignoring.");
                return;
            }
            if (ignoreClicksOverUI && IsPointerOverUI(pos)) return;

            if (characterMove.TryScreenToGridCell(pos, out Vector2Int cell))
            {
                if (characterMove.MustUseDesignatedEndCellForFlag() && !characterMove.IsDesignatedEndCell(cell))
                {
                    if (logEvents)
                        Debug.Log($"[FlagPlacement] Tap cell {cell} is not the preset goal — use {characterMove.DesignatedEndObjectCell}.");
                    return;
                }
                bool ok = characterMove.TryPlaceOrMoveFlag(cell);
                if (logEvents) Debug.Log($"[FlagPlacement] Tap @ screen={pos} -> cell={cell} -> placed={ok}");
            }
            else if (logEvents)
            {
                Debug.Log($"[FlagPlacement] Tap @ screen={pos} did not hit any grid cell.");
            }
        }
    }

    private static bool IsPointerOverUI(Vector2 screenPos)
    {
        if (EventSystem.current == null) return false;
        // Mouse path.
        if (!Input.touchSupported || Input.touchCount == 0)
            return EventSystem.current.IsPointerOverGameObject();
        // Touch path.
        for (int i = 0; i < Input.touchCount; i++)
        {
            if (EventSystem.current.IsPointerOverGameObject(Input.GetTouch(i).fingerId)) return true;
        }
        return false;
    }

    // ---------------------------------------------------------------
    // Hover preview ghost (desktop only — mobile has no hover state).
    // ---------------------------------------------------------------
    private void UpdateHoverGhost()
    {
        if (!showHoverPreview || characterMove == null || characterMove.flagPrefab == null) return;
        // UI prefabs must not become world ghosts — they spawn endlessly and confuse the Editor.
        if (characterMove.flagPrefab.GetComponentInChildren<RectTransform>(true) != null)
            return;
        if (characterMove.flagOverlayCanvas != null) return;
#if UNITY_ANDROID || UNITY_IOS
        return; // mobile has no hover.
#else
        Vector2 mp = Input.mousePosition;
        if (ignoreClicksOverUI && IsPointerOverUI(mp)) { HideHoverGhost(); return; }
        if (!characterMove.TryScreenToGridCell(mp, out Vector2Int cell)) { HideHoverGhost(); return; }
        if (!characterMove.CanPlaceFlagOnCell(cell))                     { HideHoverGhost(); return; }

        if (_hoverGhost == null)
        {
            _hoverGhost = Instantiate(characterMove.flagPrefab);
            _hoverGhost.name = "_FlagHoverGhost";
            foreach (var col in _hoverGhost.GetComponentsInChildren<Collider>(true))
            {
                if (col != null) col.enabled = false;
            }
            foreach (var r   in _hoverGhost.GetComponentsInChildren<Renderer>())
            {
                foreach (var m in r.materials)
                {
                    if (m.HasProperty("_BaseColor"))
                    {
                        Color c = m.GetColor("_BaseColor"); c.a = hoverAlpha; m.SetColor("_BaseColor", c);
                    }
                    if (m.HasProperty("_Color"))
                    {
                        Color c = m.color; c.a = hoverAlpha; m.color = c;
                    }
                }
            }
        }
        _hoverGhost.SetActive(true);
        Vector3 wp = characterMove.GridCellToWorld(cell);
        _hoverGhost.transform.position = wp;
#endif
    }

    private void HideHoverGhost()
    {
        if (_hoverGhost != null) _hoverGhost.SetActive(false);
    }

    private void OnDisable()
    {
        HideHoverGhost();
        DestroyHoverGhostNow();
    }

    private void OnDestroy()
    {
        DestroyHoverGhostNow();
    }

    private void DestroyHoverGhostNow()
    {
        if (_hoverGhost != null)
        {
            Destroy(_hoverGhost);
            _hoverGhost = null;
        }
    }
}
