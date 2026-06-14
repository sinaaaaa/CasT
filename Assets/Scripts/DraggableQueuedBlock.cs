using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// Attached at runtime to each user-added block in the action queue.
/// Lets the user pick the block up and drag it to a new position inside the queue
/// (reorder), or away from the queue and back (snaps back if released outside).
///
/// Behaviour:
///   - OnBeginDrag : the block is reparented to the canvas root so it floats above
///                   the rest of the UI; a CanvasGroup dims it; an
///                   <see cref="ActionQueueDropZone"/> placeholder is opened at the
///                   block's original index so existing neighbours stay arranged.
///   - OnDrag      : the block follows the cursor; the drop-zone placeholder
///                   re-anchors to whichever gap the cursor is currently over and
///                   the existing blocks slide aside via the LayoutGroup reflow.
///   - OnDrop (via ActionQueueDropZone): the block is reparented back into the
///                   queue at the placeholder's index. Order in
///                   <see cref="CharacterMove"/>'s execution queue is rebuilt.
///   - OnEndDrag (no drop): the block snaps back to its original index.
///
/// Notes:
///   - Reorder is disabled while the program is running
///     (<see cref="CharacterMove.IsActionQueueLocked"/>).
///   - The close button on the block is a child Button; if the user presses the close
///     button and moves the cursor far enough Unity will start a reorder drag on this
///     block instead of firing the close-button click. That's the standard Unity
///     "click vs drag" disambiguation and matches Scratch-style block UX.
/// </summary>
[RequireComponent(typeof(RectTransform))]
public class DraggableQueuedBlock : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler
{
    [Header("References")]
    public CharacterMove characterMove;
    [Tooltip("Optional. If empty the root Canvas is auto-detected at runtime.")]
    public Canvas rootCanvas;

    [Header("Drag Visual")]
    [Range(0.1f, 1f)] public float draggedAlpha = 0.55f;
    [Tooltip("Optional scale applied to the block while it is being dragged. 1 = no change.")]
    public float draggedScale = 1.05f;

    private RectTransform rt;
    private Transform originalParent;
    private int originalSiblingIndex;
    private Vector3 originalLocalScale;
    private Vector2 originalAnchoredPos;
    private CanvasGroup canvasGroup;
    private float originalAlpha = 1f;
    private bool addedCanvasGroup = false;
    private ActionQueueDropZone hoveredZone;
    private bool isDragging;

    private static readonly List<RaycastResult> s_raycastBuffer = new List<RaycastResult>();

    void Awake()
    {
        rt = (RectTransform)transform;
    }

    private Sprite ResolveBlockSprite()
    {
        var img = GetComponent<Image>();
        return img != null ? img.sprite : null;
    }

    private bool CanReorder()
    {
        if (characterMove == null) return false;
        if (characterMove.IsActionQueueLocked()) return false;
        var refComp = GetComponent<QueuedActionRef>();
        return refComp == null || refComp.deletable;
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (!CanReorder()) return;

        if (rootCanvas == null)
        {
            var c = GetComponentInParent<Canvas>();
            if (c != null) rootCanvas = c.rootCanvas;
        }
        if (rootCanvas == null) return;

        originalParent = transform.parent;
        originalSiblingIndex = transform.GetSiblingIndex();
        originalLocalScale = transform.localScale;
        originalAnchoredPos = rt.anchoredPosition;

        canvasGroup = GetComponent<CanvasGroup>();
        if (canvasGroup == null)
        {
            canvasGroup = gameObject.AddComponent<CanvasGroup>();
            addedCanvasGroup = true;
        }
        originalAlpha = canvasGroup.alpha;
        canvasGroup.alpha = draggedAlpha;
        canvasGroup.blocksRaycasts = false;
        canvasGroup.interactable = false;

        // Float the block above the rest of the UI. Preserve world position so it
        // doesn't visually jump when reparented.
        transform.SetParent(rootCanvas.transform, true);
        transform.SetAsLastSibling();
        transform.localScale = originalLocalScale * draggedScale;

        // Drop the picked-up block out of the execution queue immediately. If the user
        // clicks Run while still dragging, the run should not include this block.
        characterMove.OnQueuedBlockPickedUp();

        isDragging = true;
        UiDragState.BeginDrag();
        DragDropTutorialController.NotifyStudentDragStarted();
        hoveredZone = FindDropZoneUnderPointer(eventData);
        if (hoveredZone != null)
        {
            hoveredZone.UpdateInsertionPreview(eventData, ResolveBlockSprite());
        }
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (!isDragging) return;

        // Block follows the cursor (in canvas-local space).
        var canvasRect = (RectTransform)rootCanvas.transform;
        Camera cam = rootCanvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : rootCanvas.worldCamera;
        Vector2 localPoint;
        if (RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, eventData.position, cam, out localPoint))
        {
            rt.localPosition = localPoint;
        }

        var zone = FindDropZoneUnderPointer(eventData);
        if (zone == null && characterMove != null)
            zone = characterMove.FindDropZoneAtScreenPoint(eventData.position);

        if (zone != hoveredZone)
        {
            if (hoveredZone != null) hoveredZone.HideInsertionPreview();
            hoveredZone = zone;
        }
        if (zone != null) zone.UpdateInsertionPreview(eventData, ResolveBlockSprite());
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        // If the drop zone already handled this via AcceptReorderedDrop, isDragging is false.
        if (!isDragging) return;
        isDragging = false;
        UiDragState.EndDrag();

        var finalZone = FindDropZoneUnderPointer(eventData);
        if (finalZone == null && characterMove != null)
            finalZone = characterMove.FindDropZoneAtScreenPoint(eventData.position);
        if (finalZone == null && hoveredZone != null) finalZone = hoveredZone;
        if (hoveredZone != null) hoveredZone.HideInsertionPreview(false);
        hoveredZone = null;

        // Scratch-style: released OUTSIDE the drop zone? Throw the block away.
        if (finalZone == null && characterMove != null && characterMove.dragOutQueuedToDelete)
        {
            // Block currently lives under the canvas root (we reparented at OnBeginDrag).
            // CharacterMove will fade & shrink it in place and log the deletion.
            characterMove.HandleQueuedBlockDroppedOutsideQueue(gameObject);
            return;
        }

        // Otherwise snap back to the original index.
        if (originalParent != null)
        {
            transform.SetParent(originalParent, false);
            int idx = Mathf.Clamp(originalSiblingIndex, 0, Mathf.Max(0, originalParent.childCount - 1));
            transform.SetSiblingIndex(idx);
        }
        RestoreVisualState();

        // Put the block back into the execution queue (no analytics "reorder" event,
        // because the user cancelled).
        if (characterMove != null) characterMove.OnQueuedBlockPickedUp();
    }

    /// <summary>
    /// Called by <see cref="ActionQueueDropZone.OnDrop"/> when this block is dropped
    /// over the drop zone. Reparents the block back into the queue at the requested
    /// index, restores its visual state and asks <see cref="CharacterMove"/> to rebuild
    /// the execution queue. After this the OnEndDrag callback is a no-op.
    /// </summary>
    public void AcceptReorderedDrop(int newIndex)
    {
        if (!isDragging) return;
        isDragging = false;
        UiDragState.EndDrag();

        if (originalParent == null) return;

        transform.SetParent(originalParent, false);
        int clamped = Mathf.Clamp(newIndex, 0, Mathf.Max(0, originalParent.childCount - 1));
        transform.SetSiblingIndex(clamped);

        RestoreVisualState();

        if (hoveredZone != null) hoveredZone.HideInsertionPreview(false);
        hoveredZone = null;

        if (characterMove != null)
        {
            characterMove.OnQueuedBlockReordered();
            characterMove.PlayBlockDropBounce(transform);
        }
    }

    private void RestoreVisualState()
    {
        transform.localScale = originalLocalScale;
        rt.anchoredPosition = originalAnchoredPos;
        if (canvasGroup != null)
        {
            canvasGroup.alpha = originalAlpha;
            canvasGroup.blocksRaycasts = true;
            canvasGroup.interactable = true;
            if (addedCanvasGroup)
            {
                Destroy(canvasGroup);
                canvasGroup = null;
                addedCanvasGroup = false;
            }
        }
    }

    private static ActionQueueDropZone FindDropZoneUnderPointer(PointerEventData eventData)
    {
        if (EventSystem.current == null) return null;
        s_raycastBuffer.Clear();
        EventSystem.current.RaycastAll(eventData, s_raycastBuffer);
        for (int i = 0; i < s_raycastBuffer.Count; i++)
        {
            var go = s_raycastBuffer[i].gameObject;
            if (go == null) continue;
            var zone = go.GetComponentInParent<ActionQueueDropZone>();
            if (zone != null) return zone;
        }
        return null;
    }
}
