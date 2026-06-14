using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

/// <summary>
/// Attach this script to each of the four action buttons (Forward, Backward, Turn Left, Turn Right).
/// When the user presses and drags the button, a "ghost" image of its icon follows the cursor.
/// When released over an <see cref="ActionQueueDropZone"/>, the matching action is enqueued
/// via <see cref="CharacterMove.EnqueueActionFromDrag"/>.
///
/// Inspector setup per button:
///   - Add this component on the same GameObject that has the Button.
///   - Pick the ActionKind that matches the button.
///   - Assign the CharacterMove reference (the robot in the scene).
///   - Leave rootCanvas empty to auto-detect, or assign explicitly if multiple canvases exist.
/// </summary>
[RequireComponent(typeof(RectTransform))]
public class DraggableActionBlock : MonoBehaviour, IBeginDragHandler, IDragHandler, IEndDragHandler, IPointerDownHandler, IPointerUpHandler
{
    public enum ActionKind
    {
        Forward,
        Backward,
        TurnLeft,
        TurnRight
    }

    [Header("Action")]
    public ActionKind actionKind = ActionKind.Forward;

    [Header("References")]
    public CharacterMove characterMove;
    [Tooltip("Optional. If empty, the parent Canvas of this button is used.")]
    public Canvas rootCanvas;
    [Tooltip("Optional override. If empty, the sprite is taken from CharacterMove based on actionKind.")]
    public Sprite overrideSprite;

    [Header("Drag Visual")]
    [Range(0.1f, 1f)]
    public float ghostAlpha = 0.85f;
    [Tooltip("Size multiplier for the dragged ghost. 1 = same size as the button icon.")]
    public float ghostScale = 1f;
    [Tooltip("Draw the ghost above all other canvases (yellow strip, queue). Recommended on.")]
    public bool ghostUsesTopSortingLayer = true;
    [Tooltip("Extra Canvas.sortingOrder on top of the highest canvas in the scene (when ghostUsesTopSortingLayer is on).")]
    public int ghostSortingOrderBump = 200;

    private GameObject ghostInstance;
    private RectTransform ghostRect;
    private bool isDragging = false;
    private Button cachedButton;
    private ActionQueueDropZone lastHoveredZone;
    private static readonly List<RaycastResult> s_raycastBuffer = new List<RaycastResult>();

    void Awake()
    {
        cachedButton = GetComponent<Button>();
        if (rootCanvas == null)
        {
            rootCanvas = GetComponentInParent<Canvas>();
            if (rootCanvas != null) rootCanvas = rootCanvas.rootCanvas;
        }
    }

    public Sprite ResolveSprite()
    {
        if (overrideSprite != null) return overrideSprite;
        if (characterMove == null) return null;
        switch (actionKind)
        {
            case ActionKind.Forward:   return characterMove.forwardSprite;
            case ActionKind.Backward:  return characterMove.backwardSprite;
            case ActionKind.TurnLeft:  return characterMove.rotateLeftSprite;
            case ActionKind.TurnRight: return characterMove.rotateRightSprite;
        }
        return null;
    }

    public void OnPointerDown(PointerEventData eventData)
    {
        if (characterMove == null) return;
        if (cachedButton != null && !cachedButton.interactable) return;
        if (!characterMove.CanDragPaletteBlockToQueue(actionKind)) return;
        UiDragState.BeginDrag();
    }

    public void OnPointerUp(PointerEventData eventData)
    {
        UiDragState.EndDrag();
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (characterMove == null)
        {
            Debug.LogWarning("[DraggableActionBlock] CharacterMove reference is missing; drag ignored.");
            return;
        }

        if (cachedButton != null && !cachedButton.interactable)
        {
            return;
        }

        if (!characterMove.CanDragPaletteBlockToQueue(actionKind))
        {
            return;
        }

        if (rootCanvas == null)
        {
            rootCanvas = GetComponentInParent<Canvas>();
            if (rootCanvas != null) rootCanvas = rootCanvas.rootCanvas;
        }
        if (rootCanvas == null)
        {
            Debug.LogWarning("[DraggableActionBlock] No Canvas found in parents; drag ignored.");
            return;
        }

        isDragging = true;
        DragDropTutorialController.NotifyStudentDragStarted();

        ghostInstance = new GameObject("ActionDragGhost", typeof(RectTransform), typeof(CanvasGroup), typeof(Image));
        ghostInstance.transform.SetParent(rootCanvas.transform, false);
        ghostInstance.transform.SetAsLastSibling();

        var canvasGroup = ghostInstance.GetComponent<CanvasGroup>();
        canvasGroup.blocksRaycasts = false;
        canvasGroup.interactable = false;

        var img = ghostInstance.GetComponent<Image>();
        img.sprite = ResolveSprite();
        img.raycastTarget = false;
        img.preserveAspect = true;
        img.color = new Color(1f, 1f, 1f, ghostAlpha);

        // If the ghost only lives under the palette canvas, a sibling Canvas (yellow strip /
        // queue panel) may draw on top — force an overlay canvas so drag is always visible.
        if (ghostUsesTopSortingLayer)
        {
            var overlay = ghostInstance.AddComponent<Canvas>();
            overlay.overrideSorting = true;
            overlay.sortingOrder = ComputeGhostCanvasSortingOrder(rootCanvas);
        }

        ghostRect = ghostInstance.GetComponent<RectTransform>();
        var sourceRect = (RectTransform)transform;
        ghostRect.sizeDelta = sourceRect.rect.size * ghostScale;

        UpdateGhostPosition(eventData);
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (!isDragging || ghostInstance == null) return;
        UpdateGhostPosition(eventData);
        UpdateDropZoneHover(eventData);
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        isDragging = false;

        ActionQueueDropZone zone = ResolveDropZone(eventData);
        if (zone != null)
            zone.TryAcceptPaletteDrop(eventData, this);

        if (lastHoveredZone != null)
        {
            lastHoveredZone.HideInsertionPreview();
            lastHoveredZone = null;
        }
        if (ghostInstance != null)
        {
            Destroy(ghostInstance);
            ghostInstance = null;
            ghostRect = null;
        }
    }

    private void UpdateDropZoneHover(PointerEventData eventData)
    {
        ActionQueueDropZone zone = ResolveDropZone(eventData);

        if (zone != lastHoveredZone)
        {
            if (lastHoveredZone != null) lastHoveredZone.HideInsertionPreview();
            lastHoveredZone = zone;
        }
        if (zone != null) zone.UpdateInsertionPreview(eventData, ResolveSprite());
    }

    private ActionQueueDropZone ResolveDropZone(PointerEventData eventData)
    {
        ActionQueueDropZone zone = FindDropZoneUnderPointer(eventData);
        if (zone == null && characterMove != null)
            zone = characterMove.FindDropZoneAtScreenPoint(eventData.position);
        return zone;
    }

    /// <summary>
    /// Highest active canvas sortingOrder in the loaded scene plus <see cref="ghostSortingOrderBump"/>,
    /// so the drag ghost renders above sibling canvases (e.g. yellow queue strip).
    /// </summary>
    private int ComputeGhostCanvasSortingOrder(Canvas fallback)
    {
        int maxSort = fallback != null ? fallback.sortingOrder : 0;
#if UNITY_2023_1_OR_NEWER
        var canvases = Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
#else
        var canvases = Object.FindObjectsOfType<Canvas>();
#endif
        for (int i = 0; i < canvases.Length; i++)
        {
            var c = canvases[i];
            if (c == null || !c.isActiveAndEnabled) continue;
            if (!c.gameObject.scene.IsValid()) continue;
            if (c.sortingOrder > maxSort)
                maxSort = c.sortingOrder;
        }
        int bump = Mathf.Clamp(ghostSortingOrderBump, 1, 4096);
        return maxSort + bump;
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

    private void UpdateGhostPosition(PointerEventData eventData)
    {
        if (ghostRect == null || rootCanvas == null) return;
        var canvasRect = (RectTransform)rootCanvas.transform;
        Camera cam = rootCanvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : rootCanvas.worldCamera;
        Vector2 localPoint;
        if (RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, eventData.position, cam, out localPoint))
        {
            ghostRect.localPosition = localPoint;
        }
    }
}
