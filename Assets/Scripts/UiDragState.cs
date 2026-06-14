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

    /// <summary>
    /// True when the pointer is over any UI canvas (buttons, yellow strip, etc.).
    /// </summary>
    public static bool IsScreenPointOverUi(Vector2 screenPos, int pointerId = -1)
    {
        if (EventSystem.current == null) return false;

        if (pointerId >= 0 && EventSystem.current.IsPointerOverGameObject(pointerId))
            return true;

        var ped = new PointerEventData(EventSystem.current)
        {
            position = screenPos,
            pointerId = pointerId
        };
        var results = new List<RaycastResult>();
        EventSystem.current.RaycastAll(ped, results);
        for (int i = 0; i < results.Count; i++)
        {
            if (results[i].gameObject == null) continue;
            if (results[i].gameObject.GetComponentInParent<Canvas>() != null)
                return true;
        }

        return false;
    }

    public static bool ShouldBlockWorldPointer(Vector2 screenPos, int pointerId = -1)
    {
        return IsDragging || IsScreenPointOverUi(screenPos, pointerId);
    }
}
