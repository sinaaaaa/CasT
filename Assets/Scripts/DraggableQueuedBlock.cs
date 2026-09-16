using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// Attached at runtime to each user-added block in the action queue.
/// Lets the user pick the block up and drag it to a new position inside the queue
/// (reorder), or away from the queue and back (snaps back if released outside).
/// </summary>
[RequireComponent(typeof(RectTransform))]
public class DraggableQueuedBlock : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler, IPointerDownHandler, IInitializePotentialDragHandler
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
    private ScrollRect parentScroll;
    private bool parentScrollWasEnabled;

    /// <summary>True while this block is being reordered (tap-expand should ignore).</summary>
    public bool IsDragging => isDragging;

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

    public void OnPointerDown(PointerEventData eventData)
    {
        if (IsPressOnCloseButton(eventData)) return;
        if (!CanReorder()) return;
        GameInteractionSounds.PlayActionTap();
    }

    static bool IsCloseTarget(GameObject go)
    {
        if (go == null) return false;
        if (go.GetComponentInParent<QueuedBlockCloseButton>() != null) return true;
        Transform t = go.transform;
        while (t != null)
        {
            if (t.name == "CloseButton" || t.name == "ExpandIcon") return true;
            if (t.GetComponent<DraggableQueuedBlock>() != null) break;
            t = t.parent;
        }
        return false;
    }

    /// <summary>
    /// True when the press landed on this block's X or expand icon.
    /// Those controls own the gesture — do not start a reorder drag.
    /// </summary>
    static bool IsPressOnCloseButton(PointerEventData eventData)
    {
        if (eventData == null) return false;
        if (IsCloseTarget(eventData.pointerPressRaycast.gameObject)) return true;
        if (eventData.pointerPress != null && IsCloseTarget(eventData.pointerPress)) return true;
        return false;
    }

    public void OnInitializePotentialDrag(PointerEventData eventData)
    {
        if (eventData == null) return;

        // Leave pointerDrag owned by QueuedBlockCloseButton — do not null it.
        if (IsPressOnCloseButton(eventData))
            return;

        if (!CanReorder()) return;

        // Claim the drag so parent ProgramBagScroll (ScrollRect) cannot steal it.
        eventData.pointerDrag = gameObject;
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (!CanReorder())
        {
            if (eventData != null && !IsPressOnCloseButton(eventData))
                eventData.pointerDrag = null;
            return;
        }

        // Close button owns this gesture — never start a reorder from the X.
        if (IsPressOnCloseButton(eventData))
            return;

        if (rootCanvas == null)
        {
            var c = GetComponentInParent<Canvas>();
            if (c != null) rootCanvas = c.rootCanvas;
        }
        if (rootCanvas == null)
        {
            Debug.LogWarning("[DraggableQueuedBlock] No root Canvas — cannot reorder.");
            return;
        }

        originalParent = transform.parent;
        originalSiblingIndex = transform.GetSiblingIndex();
        originalLocalScale = transform.localScale;
        originalAnchoredPos = rt.anchoredPosition;

        // Pause horizontal program-strip scrolling while reordering bags/arrows.
        parentScroll = GetComponentInParent<ScrollRect>();
        if (parentScroll != null)
        {
            parentScrollWasEnabled = parentScroll.enabled;
            parentScroll.StopMovement();
            parentScroll.enabled = false;
        }

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

        transform.SetParent(rootCanvas.transform, true);
        transform.SetAsLastSibling();
        transform.localScale = originalLocalScale * draggedScale;

        if (characterMove != null)
            characterMove.OnQueuedBlockPickedUp();

        isDragging = true;
        UiDragState.BeginDrag();
        GameInteractionSounds.PlayActionDrag();
        DragDropTutorialController.NotifyStudentDragStarted();
        hoveredZone = FindDropZoneUnderPointer(eventData);
        if (hoveredZone != null)
            hoveredZone.UpdateInsertionPreview(eventData, ResolveBlockSprite());

        Debug.Log($"[DraggableQueuedBlock] Begin reorder '{name}' from index {originalSiblingIndex}");
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (!isDragging) return;

        var canvasRect = (RectTransform)rootCanvas.transform;
        Camera cam = rootCanvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : rootCanvas.worldCamera;
        Vector2 localPoint;
        if (RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, eventData.position, cam, out localPoint))
            rt.localPosition = localPoint;

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
        if (!isDragging) return;

        var finalZone = FindDropZoneUnderPointer(eventData);
        if (finalZone == null && characterMove != null)
            finalZone = characterMove.FindDropZoneAtScreenPoint(eventData.position);
        if (finalZone == null && hoveredZone != null) finalZone = hoveredZone;

        if (finalZone != null)
        {
            finalZone.TryAcceptReorderedDrop(eventData, this);
            // If AcceptReorderedDrop did not run, snap back so drag cannot stick.
            if (isDragging)
            {
                isDragging = false;
                UiDragState.EndDrag();
                if (originalParent != null)
                {
                    transform.SetParent(originalParent, false);
                    int idx = Mathf.Clamp(originalSiblingIndex, 0, Mathf.Max(0, originalParent.childCount - 1));
                    transform.SetSiblingIndex(idx);
                }
                RestoreVisualState();
                if (characterMove != null) characterMove.OnQueuedBlockPickedUp();
            }
            RestoreParentScroll();
            return;
        }

        isDragging = false;
        UiDragState.EndDrag();
        RestoreParentScroll();

        if (hoveredZone != null) hoveredZone.HideInsertionPreview(false);
        hoveredZone = null;

        if (characterMove != null && characterMove.dragOutQueuedToDelete)
        {
            characterMove.HandleQueuedBlockDroppedOutsideQueue(gameObject);
            return;
        }

        if (originalParent != null)
        {
            transform.SetParent(originalParent, false);
            int idx = Mathf.Clamp(originalSiblingIndex, 0, Mathf.Max(0, originalParent.childCount - 1));
            transform.SetSiblingIndex(idx);
        }
        RestoreVisualState();

        if (characterMove != null) characterMove.OnQueuedBlockPickedUp();
    }

    public void AcceptReorderedDrop(int newIndex)
    {
        if (!isDragging) return;
        isDragging = false;
        UiDragState.EndDrag();
        RestoreParentScroll();

        if (originalParent == null) return;

        transform.SetParent(originalParent, false);
        int clamped = Mathf.Clamp(newIndex, 0, Mathf.Max(0, originalParent.childCount - 1));
        transform.SetSiblingIndex(clamped);

        RestoreVisualState();
        if (originalParent is RectTransform ort)
            LayoutRebuilder.ForceRebuildLayoutImmediate(ort);

        if (hoveredZone != null) hoveredZone.HideInsertionPreview(false);
        hoveredZone = null;

        if (characterMove != null)
        {
            characterMove.OnQueuedBlockReordered();
            characterMove.PlayBlockDropBounce(transform);
        }

        Debug.Log($"[DraggableQueuedBlock] Reordered '{name}' → index {clamped}");
    }

    private void RestoreParentScroll()
    {
        if (parentScroll != null)
        {
            parentScroll.enabled = parentScrollWasEnabled;
            parentScroll = null;
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
