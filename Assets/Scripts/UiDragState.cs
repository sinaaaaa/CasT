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
            if (go.GetComponentInParent<ActionQueueDropZone>() != null) return true;
        }

        return false;
    }
}
