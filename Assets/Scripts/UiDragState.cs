using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;

/// <summary>
/// Tracks active UI drag-and-drop (action palette, yellow strip reorder) and
/// exposes helpers so world-space drag handlers ignore touches meant for UI.
/// </summary>
public static class UiDragState
{
    private static int _activeDragCount;

    public static bool IsDragging => _activeDragCount > 0;

    public static void BeginDrag()
    {
        _activeDragCount++;
    }

    public static void EndDrag()
    {
        if (_activeDragCount > 0) _activeDragCount--;
    }

    public static bool ShouldBlockWorldPointer(Vector2 screenPos, int pointerId = -1)
    {
        if (IsDragging) return true;
        return IsScreenPointOverActionUi(screenPos, pointerId);
    }

    /// <summary>
    /// True when the pointer is over action palette, queue strip, or other gameplay UI —
    /// not the 3D game view.
    /// </summary>
    public static bool IsScreenPointOverActionUi(Vector2 screenPos, int pointerId = -1)
    {
        if (EventSystem.current == null) return false;

        var ped = new PointerEventData(EventSystem.current)
        {
            position = screenPos,
            pointerId = pointerId
        };
        var results = new List<RaycastResult>();
        EventSystem.current.RaycastAll(ped, results);
        for (int i = 0; i < results.Count; i++)
        {
            var go = results[i].gameObject;
            if (go == null) continue;
            if (go.GetComponentInParent<DraggableActionBlock>() != null) return true;
            if (go.GetComponentInParent<DraggableQueuedBlock>() != null) return true;
            if (go.GetComponentInParent<DraggableCommandBagBlock>() != null) return true;
            if (go.GetComponentInParent<ActionQueueDropZone>() != null) return true;
        }

        return false;
    }

    /// <summary>
    /// True over real controls (buttons, strip, hint) that should win over grid drawing.
    /// Full-screen transparent canvases are ignored so mouse and touch can still draw on the grid.
    /// </summary>
    public static bool IsScreenPointOverBlockingUi(Vector2 screenPos, int pointerId = -1)
    {
        if (IsDragging) return true;
        if (EventSystem.current == null) return false;

        var ped = new PointerEventData(EventSystem.current)
        {
            position = screenPos,
            pointerId = pointerId
        };
        var results = new List<RaycastResult>();
        EventSystem.current.RaycastAll(ped, results);
        for (int i = 0; i < results.Count; i++)
        {
            var go = results[i].gameObject;
            if (go == null) continue;
            if (IsPaletteBackground(go)) continue;
            if (go.GetComponentInParent<DraggableActionBlock>() != null) return true;
            if (go.GetComponentInParent<DraggableQueuedBlock>() != null) return true;
            if (go.GetComponentInParent<DraggableCommandBagBlock>() != null) return true;
            if (go.GetComponentInParent<ActionQueueDropZone>() != null) return true;
            var btn = go.GetComponentInParent<UnityEngine.UI.Button>();
            if (IsBlockingButton(btn)) return true;
            if (IsUnderNamedParent(go, "GeometryDrawTools")) return true;
            if (go.GetComponentInParent<UnityEngine.UI.Toggle>() != null) return true;
            if (go.GetComponentInParent<UnityEngine.UI.Slider>() != null) return true;
            if (go.GetComponentInParent<UnityEngine.UI.Scrollbar>() != null) return true;
            if (go.GetComponentInParent<UnityEngine.UI.InputField>() != null) return true;
            if (go.GetComponentInParent<TMPro.TMP_InputField>() != null) return true;
            if (go.GetComponentInParent<UnityEngine.UI.ScrollRect>() != null) return true;
            if (go.GetComponentInParent<LevelCornerHintPanel>() != null) return true;
        }
        return false;
    }

    static bool IsUnderNamedParent(GameObject go, string name)
    {
        Transform t = go != null ? go.transform : null;
        while (t != null)
        {
            if (t.name == name) return true;
            t = t.parent;
        }
        return false;
    }

    static bool IsPaletteBackground(GameObject go)
    {
        Transform t = go != null ? go.transform : null;
        while (t != null)
        {
            if (string.Equals(t.name, "blue", System.StringComparison.OrdinalIgnoreCase))
                return true;
            t = t.parent;
        }
        return false;
    }

    static bool IsBlockingButton(UnityEngine.UI.Button btn)
    {
        if (btn == null || !btn.isActiveAndEnabled || !btn.interactable) return false;
        if (string.Equals(btn.name, "blue", System.StringComparison.OrdinalIgnoreCase)) return false;
        return true;
    }
}
