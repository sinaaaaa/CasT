using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using TMPro;

/// <summary>
/// Source card in the BLUE Command Bag panel.
/// Drag creates a ghost; drop creates a NEW ProgramBagInstance in the yellow strip.
/// The source GameObject never leaves the blue panel.
/// </summary>
[RequireComponent(typeof(RectTransform))]
public class DraggableCommandBagBlock : MonoBehaviour,
    IBeginDragHandler, IDragHandler, IEndDragHandler, IPointerDownHandler, IPointerClickHandler
{
    public enum DragKind
    {
        Bag,
        Chunk
    }

    public DragKind dragKind = DragKind.Bag;
    public string bagId;
    public string chunkId;
    public string displayName;
    public Color accentColor = new Color(0.31f, 0.27f, 0.9f, 1f);
    /// <summary>Optional Inspector override for chunk puzzle sprite.</summary>
    public Sprite iconSprite;
    public string iconUrl;
    public CharacterMove characterMove;
    public Canvas rootCanvas;

    [Range(0.1f, 1f)] public float ghostAlpha = 0.92f;
    [Range(1.0f, 1.2f)] public float ghostScale = 1.06f;

    private GameObject ghostInstance;
    private RectTransform ghostRect;
    private CanvasGroup sourceCanvasGroup;
    private bool isDragging;
    private bool suppressClick;
    private ActionQueueDropZone lastHoveredZone;
    private Vector3 _sourceBaseScale = Vector3.one;
    private Coroutine _sourceScaleAnim;
    private static readonly List<RaycastResult> s_raycastBuffer = new List<RaycastResult>();

    void Awake()
    {
        if (rootCanvas == null)
        {
            rootCanvas = GetComponentInParent<Canvas>();
            if (rootCanvas != null) rootCanvas = rootCanvas.rootCanvas;
        }
        sourceCanvasGroup = GetComponent<CanvasGroup>();
        if (sourceCanvasGroup == null)
            sourceCanvasGroup = gameObject.AddComponent<CanvasGroup>();
        _sourceBaseScale = transform.localScale;
    }

    public string ResolveDropToken()
    {
        if (dragKind == DragKind.Bag)
            return CommandBagUtil.FormatBagToken(bagId);
        return CommandBagUtil.FormatChunkToken(chunkId);
    }

    public void OnPointerDown(PointerEventData eventData)
    {
        GameInteractionSounds.PlayActionTap();
    }

    public void OnPointerClick(PointerEventData eventData)
    {
        if (suppressClick || isDragging) return;
        if (dragKind != DragKind.Bag || characterMove == null) return;
        characterMove.ToggleCommandBagOpen(bagId);
    }

    public void OnBeginDrag(PointerEventData eventData)
    {
        if (characterMove == null) return;
        if (characterMove.IsActionQueueLocked()) return;
        suppressClick = true;
        isDragging = true;

        // Keep source visible in the blue panel (library stays put).
        if (sourceCanvasGroup != null)
        {
            sourceCanvasGroup.blocksRaycasts = false;
            sourceCanvasGroup.alpha = 0.78f;
        }

        _sourceBaseScale = transform.localScale;
        if (_sourceScaleAnim != null) StopCoroutine(_sourceScaleAnim);
        _sourceScaleAnim = StartCoroutine(ScaleTo(transform, _sourceBaseScale * 1.04f, 0.12f));

        CreateGhost(eventData);
    }

    public void OnDrag(PointerEventData eventData)
    {
        if (!isDragging || ghostRect == null) return;
        if (RectTransformUtility.ScreenPointToWorldPointInRectangle(
                rootCanvas.transform as RectTransform,
                eventData.position,
                eventData.pressEventCamera,
                out Vector3 world))
        {
            ghostRect.position = world;
        }

        var zone = RaycastDropZone(eventData);
        if (zone != lastHoveredZone)
        {
            if (lastHoveredZone != null)
            {
                lastHoveredZone.HideInsertionPreview();
                lastHoveredZone.SetDragHighlight(false);
            }
            lastHoveredZone = zone;
            if (zone != null)
                zone.SetDragHighlight(true);
        }
        if (zone != null)
            zone.UpdateInsertionPreview(eventData, characterMove != null ? characterMove.forwardSprite : null);
    }

    public void OnEndDrag(PointerEventData eventData)
    {
        isDragging = false;

        if (sourceCanvasGroup != null)
        {
            sourceCanvasGroup.blocksRaycasts = true;
            sourceCanvasGroup.alpha = 1f;
        }

        if (_sourceScaleAnim != null) StopCoroutine(_sourceScaleAnim);
        _sourceScaleAnim = StartCoroutine(ScaleTo(transform, _sourceBaseScale, 0.14f));

        bool droppedOk = false;
        var zone = RaycastDropZone(eventData) ?? lastHoveredZone;
        if (zone == null && characterMove != null)
            zone = FindDropZoneFallback();

        if (lastHoveredZone != null)
        {
            lastHoveredZone.SetDragHighlight(false);
            if (lastHoveredZone != zone)
                lastHoveredZone.HideInsertionPreview();
        }
        lastHoveredZone = null;

        if (ghostInstance != null)
        {
            Destroy(ghostInstance);
            ghostInstance = null;
            ghostRect = null;
        }

        if (zone != null && characterMove != null)
        {
            zone.TryAcceptCommandBagDrop(eventData, this);
            droppedOk = true;
        }
        else if (characterMove != null && IsPointerOverYellowStrip(eventData))
        {
            int endIndex = characterMove.actionQueueTransform != null
                ? characterMove.actionQueueTransform.childCount
                : 0;
            characterMove.InsertCommandBagMacroFromDrag(this, endIndex);
            droppedOk = true;
        }

        if (!droppedOk)
            StartCoroutine(InvalidDropShake());

        Invoke(nameof(ClearSuppressClick), 0.15f);
    }

    IEnumerator InvalidDropShake()
    {
        // Short snap-back cue — not aggressive.
        var rt = transform as RectTransform;
        if (rt == null) yield break;
        Vector2 origin = rt.anchoredPosition;
        float dur = 0.16f;
        float elapsed = 0f;
        while (elapsed < dur)
        {
            elapsed += Time.unscaledDeltaTime;
            float u = elapsed / dur;
            float shake = Mathf.Sin(u * Mathf.PI * 6f) * (1f - u) * 6f;
            rt.anchoredPosition = origin + new Vector2(shake, 0f);
            yield return null;
        }
        rt.anchoredPosition = origin;
    }

    static IEnumerator ScaleTo(Transform t, Vector3 target, float duration)
    {
        if (t == null) yield break;
        Vector3 start = t.localScale;
        float elapsed = 0f;
        duration = Mathf.Max(0.01f, duration);
        while (elapsed < duration && t != null)
        {
            elapsed += Time.unscaledDeltaTime;
            float u = Mathf.Clamp01(elapsed / duration);
            u = u * u * (3f - 2f * u);
            t.localScale = Vector3.LerpUnclamped(start, target, u);
            yield return null;
        }
        if (t != null) t.localScale = target;
    }

    bool IsPointerOverYellowStrip(PointerEventData eventData)
    {
        if (characterMove == null) return false;
        RectTransform strip = characterMove.dropZonePanel;
        if (strip == null && characterMove.actionQueueTransform != null)
            strip = characterMove.actionQueueTransform as RectTransform;
        if (strip == null) return false;

        Camera cam = eventData.pressEventCamera;
        if (strip.GetComponentInParent<Canvas>() is Canvas c && c.renderMode == RenderMode.ScreenSpaceOverlay)
            cam = null;

        return RectTransformUtility.RectangleContainsScreenPoint(strip, eventData.position, cam);
    }

    ActionQueueDropZone FindDropZoneFallback()
    {
        if (characterMove == null) return null;
        if (characterMove.dropZonePanel != null)
        {
            var z = characterMove.dropZonePanel.GetComponent<ActionQueueDropZone>();
            if (z != null) return z;
            z = characterMove.dropZonePanel.GetComponentInChildren<ActionQueueDropZone>(true);
            if (z != null) return z;
        }
        if (characterMove.actionQueueTransform != null)
        {
            var z = characterMove.actionQueueTransform.GetComponentInParent<ActionQueueDropZone>();
            if (z != null) return z;
        }
        return Object.FindObjectOfType<ActionQueueDropZone>();
    }

    void ClearSuppressClick() => suppressClick = false;

    ActionQueueDropZone RaycastDropZone(PointerEventData eventData)
    {
        if (EventSystem.current == null) return null;
        s_raycastBuffer.Clear();
        EventSystem.current.RaycastAll(eventData, s_raycastBuffer);
        for (int i = 0; i < s_raycastBuffer.Count; i++)
        {
            var z = s_raycastBuffer[i].gameObject.GetComponentInParent<ActionQueueDropZone>();
            if (z != null) return z;
        }
        return null;
    }

    void CreateGhost(PointerEventData eventData)
    {
        if (rootCanvas == null)
        {
            rootCanvas = GetComponentInParent<Canvas>();
            if (rootCanvas != null) rootCanvas = rootCanvas.rootCanvas;
        }
        if (rootCanvas == null) return;

        var srcRt = transform as RectTransform;
        float w = srcRt != null ? Mathf.Max(140f, srcRt.rect.width) : 180f;
        float h = srcRt != null ? Mathf.Max(64f, srcRt.rect.height) : 88f;

        ghostInstance = new GameObject(
            "CommandBagGhost",
            typeof(RectTransform),
            typeof(Canvas),
            typeof(CanvasGroup),
            typeof(Image),
            typeof(Outline),
            typeof(Shadow));
        ghostRect = ghostInstance.GetComponent<RectTransform>();
        ghostRect.SetParent(rootCanvas.transform, false);
        ghostRect.sizeDelta = new Vector2(w, h) * ghostScale;

        var canvas = ghostInstance.GetComponent<Canvas>();
        canvas.overrideSorting = true;
        canvas.sortingOrder = 5000;

        var cg = ghostInstance.GetComponent<CanvasGroup>();
        cg.blocksRaycasts = false;
        cg.interactable = false;
        cg.alpha = ghostAlpha;

        Color fill = dragKind == DragKind.Chunk
            ? CommandBagUiHelper.ChunkCardFillFromAccent(accentColor)
            : accentColor;
        var img = ghostInstance.GetComponent<Image>();
        img.color = fill;
        img.raycastTarget = false;

        var outline = ghostInstance.GetComponent<Outline>();
        outline.effectColor = CommandBagUiHelper.ChunkCardBorderFromAccent(accentColor);
        outline.effectDistance = new Vector2(2f, -2f);

        var shadow = ghostInstance.GetComponent<Shadow>();
        shadow.effectColor = new Color(0f, 0f, 0f, 0.28f);
        shadow.effectDistance = new Vector2(4f, -6f);

        if (dragKind == DragKind.Chunk)
        {
            var badge = CommandBagUiHelper.BuildPuzzleBadge(
                ghostRect, 0, accentColor, Mathf.Min(48f, h * 0.55f),
                iconSprite != null ? iconSprite : CommandBagUiHelper.ResolveChunkIconSprite(characterMove));
            var brt = badge.GetComponent<RectTransform>();
            brt.anchorMin = new Vector2(0f, 0.5f);
            brt.anchorMax = new Vector2(0f, 0.5f);
            brt.pivot = new Vector2(0f, 0.5f);
            brt.anchoredPosition = new Vector2(10f, 0f);
        }

        var labelGo = new GameObject("Label", typeof(RectTransform));
        labelGo.transform.SetParent(ghostRect, false);
        var tmp = labelGo.AddComponent<TextMeshProUGUI>();
        tmp.text = displayName ?? (dragKind == DragKind.Bag ? "Command Bag" : "Chunk");
        tmp.fontSize = 16f;
        tmp.fontStyle = FontStyles.Bold;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.color = new Color(0.12f, 0.16f, 0.28f);
        tmp.raycastTarget = false;
        var lrt = labelGo.GetComponent<RectTransform>();
        lrt.anchorMin = Vector2.zero;
        lrt.anchorMax = Vector2.one;
        lrt.offsetMin = new Vector2(dragKind == DragKind.Chunk ? 56f : 8f, 8f);
        lrt.offsetMax = new Vector2(-8f, -8f);

        if (RectTransformUtility.ScreenPointToWorldPointInRectangle(
                rootCanvas.transform as RectTransform,
                eventData.position,
                eventData.pressEventCamera,
                out Vector3 world))
            ghostRect.position = world;
    }
}
