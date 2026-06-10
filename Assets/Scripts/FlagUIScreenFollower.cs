using UnityEngine;

/// <summary>
/// Keeps a UI RectTransform glued to the screen position of a grid cell by
/// projecting <see cref="CharacterMove.GridCellToWorld"/> each frame through a camera.
/// Use this when <see cref="CharacterMove.flagPrefab"/> is UI (Overlay / Camera canvas),
/// because world-space positions do not paint on Screen Space UI.
/// </summary>
[DisallowMultipleComponent]
[RequireComponent(typeof(RectTransform))]
public class FlagUIScreenFollower : MonoBehaviour
{
    private CharacterMove _characterMove;
    private RectTransform   _canvasRect;
    private Canvas          _canvas;
    private RectTransform   _rt;
    private Camera          _worldCamera;

    /// <summary>Pixel offset applied after WorldToScreen (e.g. nudge icon above cell).</summary>
    public Vector2 screenOffset;

    private Vector2Int _gridCell;

    public void Configure(CharacterMove characterMove, RectTransform uiParentRect, Camera worldCamera,
                          Vector2Int gridCell)
    {
        _characterMove = characterMove;
        _canvasRect    = uiParentRect;
        _canvas        = uiParentRect != null ? uiParentRect.GetComponentInParent<Canvas>() : null;
        _rt            = GetComponent<RectTransform>();
        _worldCamera   = worldCamera;
        _gridCell      = gridCell;

        if (_rt != null && uiParentRect != null)
        {
            _rt.SetParent(uiParentRect, false);
            _rt.localRotation = Quaternion.identity;
            _rt.localScale    = Vector3.one;
            _rt.anchorMin     = _rt.anchorMax = new Vector2(0.5f, 0.5f);
            _rt.pivot         = new Vector2(0.5f, 0.5f);
            _rt.SetAsLastSibling();
        }

        LateUpdatePosition();
    }

    public void SetGridCell(Vector2Int cell)
    {
        _gridCell = cell;
        LateUpdatePosition();
    }

    private void LateUpdate() => LateUpdatePosition();

    private void LateUpdatePosition()
    {
        if (_characterMove == null || _rt == null || _canvasRect == null) return;

        Camera cam = _worldCamera;
        if (cam == null) cam = _characterMove.gridInteractionCamera;
        if (cam == null) cam = Camera.main;
        if (cam == null) return;

        Vector3 world  = _characterMove.GridCellToWorld(_gridCell);
        Vector3 screen = cam.WorldToScreenPoint(world);
        if (screen.z <= 0f)
        {
            _rt.gameObject.SetActive(false);
            return;
        }

        _rt.gameObject.SetActive(true);
        screen.x += screenOffset.x;
        screen.y += screenOffset.y;

        Camera eventCam = null;
        if (_canvas != null && _canvas.renderMode == RenderMode.ScreenSpaceCamera)
            eventCam = _canvas.worldCamera != null ? _canvas.worldCamera : cam;

        if (RectTransformUtility.ScreenPointToLocalPointInRectangle(_canvasRect, screen, eventCam, out Vector2 local))
            _rt.anchoredPosition = local;
    }
}
