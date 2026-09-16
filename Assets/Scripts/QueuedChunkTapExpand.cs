using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// Mockup chunk UX: tap the yellow-strip chunk chip (or its expand icon) to peek inside.
/// Drag-reorder still uses DraggableQueuedBlock — taps are ignored once a drag starts.
/// </summary>
[RequireComponent(typeof(QueuedActionRef))]
public class QueuedChunkTapExpand : MonoBehaviour,
    IPointerClickHandler,
    IPointerDownHandler,
    IPointerUpHandler
{
    public CharacterMove characterMove;

    const float MaxTapPixels = 24f;

    Vector2 _downScreen;
    bool _downValid;
    bool _suppressClick;

    public void OnPointerDown(PointerEventData eventData)
    {
        _downValid = false;
        _suppressClick = false;
        if (eventData == null) return;
        // ExpandIcon Button owns that gesture — do not also handle it here
        // (PointerUp + Button.onClick would open then immediately close).
        if (IsOnReservedControl(eventData)) return;

        var refComp = GetComponent<QueuedActionRef>();
        if (refComp == null || !refComp.isCommandChunk) return;
        if (characterMove != null && characterMove.IsActionQueueLocked()) return;

        _downScreen = eventData.position;
        _downValid = true;
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        if (!_downValid || eventData == null)
        {
            _downValid = false;
            return;
        }

        if (IsOnReservedControl(eventData))
        {
            _downValid = false;
            return;
        }

        var drag = GetComponent<DraggableQueuedBlock>();
        if (drag != null && drag.IsDragging)
        {
            _suppressClick = true;
            _downValid = false;
            return;
        }

        if ((eventData.position - _downScreen).sqrMagnitude > MaxTapPixels * MaxTapPixels)
        {
            _suppressClick = true;
            _downValid = false;
            return;
        }

        // PointerUp path — works even when PointerClick is swallowed by drag handlers.
        _downValid = false;
        OpenPeek();
        _suppressClick = true; // avoid double-toggle if Click also fires
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        if (_suppressClick)
        {
            _suppressClick = false;
            return;
        }
        if (eventData == null) return;
        if (IsOnReservedControl(eventData)) return;

        var drag = GetComponent<DraggableQueuedBlock>();
        if (drag != null && drag.IsDragging) return;

        OpenPeek();
    }

    /// <summary>Wired from the expand/collapse icon Button.</summary>
    public void OnExpandIconClicked()
    {
        var drag = GetComponent<DraggableQueuedBlock>();
        if (drag != null && drag.IsDragging) return;
        OpenPeek();
    }

    void OpenPeek()
    {
        var refComp = GetComponent<QueuedActionRef>();
        if (refComp == null || !refComp.isCommandChunk) return;
        if (characterMove != null && characterMove.IsActionQueueLocked()) return;

        if (characterMove == null)
            characterMove = FindObjectOfType<CharacterMove>();
        if (characterMove == null) return;

        characterMove.ToggleChunkPeekPanel(gameObject);
    }

    /// <summary>Close (X) and ExpandIcon are owned by their own Buttons — skip tap-expand.</summary>
    static bool IsOnReservedControl(PointerEventData eventData)
    {
        if (eventData == null) return false;
        if (IsReservedTarget(eventData.pointerPressRaycast.gameObject)) return true;
        if (IsReservedTarget(eventData.pointerCurrentRaycast.gameObject)) return true;
        if (eventData.pointerPress != null && IsReservedTarget(eventData.pointerPress)) return true;
        return false;
    }

    static bool IsReservedTarget(GameObject go)
    {
        if (go == null) return false;
        if (go.GetComponentInParent<QueuedBlockCloseButton>() != null) return true;
        Transform t = go.transform;
        while (t != null)
        {
            if (t.name == "CloseButton" || t.name == "ExpandIcon") return true;
            if (t.GetComponent<QueuedActionRef>() != null) break;
            t = t.parent;
        }
        return false;
    }
}
