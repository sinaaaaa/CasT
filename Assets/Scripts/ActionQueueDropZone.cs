using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

/// <summary>
/// Drop target for action blocks. While the user is dragging a block over this zone,
/// it inserts a transient "placeholder" block into <see cref="CharacterMove.actionQueueTransform"/>
/// at the cursor position. The placeholder's preferred width animates from 0 to the
/// target size, which causes the LayoutGroup on the queue to reflow each frame and
/// the existing blocks smoothly slide left/right to make room.
///
/// On drop, the placeholder is removed and a real block is inserted at the same index
/// via <see cref="CharacterMove.InsertActionFromDrag"/>.
/// </summary>
[RequireComponent(typeof(RectTransform))]
public class ActionQueueDropZone : MonoBehaviour, IDropHandler, IPointerEnterHandler, IPointerExitHandler
{
    [Header("References")]
    public CharacterMove characterMove;

    [Header("Optional Hover Highlight")]
    [Tooltip("Optional Image on this object whose color will tint while a block is hovering over the zone.")]
    public Image highlightTarget;
    public Color highlightColor = new Color(1f, 1f, 0.6f, 0.4f);

    [Header("Drop feel")]
    [Tooltip("Extra pixels left/right of the yellow strip (buttons are often beside the strip).")]
    public float dropHitPaddingHorizontal = 88f;
    [Tooltip("Extra pixels above/below the yellow strip.")]
    public float dropHitPaddingVertical = 44f;
    [Tooltip("Legacy single padding — used only if horizontal/vertical are zero.")]
    public float dropHitPaddingPixels = 0f;
    [Tooltip("After the last block, how soon 'append at end' starts (don't drag across empty yellow).")]
    public float appendGraceAfterLastBlockPixels = 8f;
    [Tooltip("Before the first block, how soon 'insert at start' starts.")]
    public float prependGraceBeforeFirstBlockPixels = 8f;
    [Tooltip("How quickly the gap preview appears (0 = instant full-width preview).")]
    [Range(0f, 0.25f)]
    public float placeholderGrowDuration = 0.06f;
    [Tooltip("Alpha of the dimmed placeholder block that previews where the dragged block will land.")]
    [Range(0f, 1f)]
    public float placeholderAlpha = 0.55f;
    [Tooltip("Optional override for the placeholder width. <= 0 means use the action block prefab width.")]
    public float placeholderTargetWidthOverride = 0f;

    private Color baseColor;
    private bool highlightCached;

    private GameObject placeholderInstance;
    private LayoutElement placeholderLayout;
    private RectTransform placeholderRect;
    private Coroutine placeholderTween;
    private int currentInsertionIndex = -1;
    private RectTransform dropHitRect;
    private int lastDropHandledFrame = -1;

    private static readonly Vector3[] s_corners = new Vector3[4];

    void Awake()
    {
        EnsureRaycastable();
        EnsureFullPanelHitArea();
    }

    public void EnsureFullPanelHitArea()
    {
        var root = transform as RectTransform;
        if (root == null) return;

        Transform existing = transform.Find("DropAreaHitTarget");
        RectTransform hitRt;
        if (existing != null)
        {
            hitRt = existing as RectTransform;
        }
        else
        {
            var go = new GameObject("DropAreaHitTarget", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(transform, false);
            go.transform.SetAsFirstSibling();
            hitRt = go.GetComponent<RectTransform>();
            hitRt.anchorMin = Vector2.zero;
            hitRt.anchorMax = Vector2.one;
            hitRt.pivot = new Vector2(0.5f, 0.5f);
            hitRt.offsetMin = Vector2.zero;
            hitRt.offsetMax = Vector2.zero;
            var img = go.GetComponent<Image>();
            img.color = new Color(1f, 1f, 1f, 0f);
            img.raycastTarget = true;
        }

        dropHitRect = hitRt;
        var hitImg = hitRt.GetComponent<Image>();
        if (hitImg != null) hitImg.raycastTarget = true;
    }

    public bool ContainsScreenPoint(Vector2 screenPosition, Camera eventCamera = null)
    {
        EnsureFullPanelHitArea();
        var rt = dropHitRect != null ? dropHitRect : transform as RectTransform;
        if (rt == null) return false;

        GetHitPadding(out float padH, out float padV);
        if (padH <= 0f && padV <= 0f)
            return RectTransformUtility.RectangleContainsScreenPoint(rt, screenPosition, eventCamera);

        rt.GetWorldCorners(s_corners);
        float minX = float.MaxValue, minY = float.MaxValue;
        float maxX = float.MinValue, maxY = float.MinValue;
        for (int i = 0; i < 4; i++)
        {
            Vector2 sp = RectTransformUtility.WorldToScreenPoint(eventCamera, s_corners[i]);
            if (sp.x < minX) minX = sp.x;
            if (sp.y < minY) minY = sp.y;
            if (sp.x > maxX) maxX = sp.x;
            if (sp.y > maxY) maxY = sp.y;
        }
        minX -= padH;
        minY -= padV;
        maxX += padH;
        maxY += padV;
        return screenPosition.x >= minX && screenPosition.x <= maxX &&
               screenPosition.y >= minY && screenPosition.y <= maxY;
    }

    private void GetHitPadding(out float padH, out float padV)
    {
        padH = dropHitPaddingHorizontal > 0f ? dropHitPaddingHorizontal : dropHitPaddingPixels;
        padV = dropHitPaddingVertical > 0f ? dropHitPaddingVertical : dropHitPaddingPixels;
        if (padH <= 0f) padH = 88f;
        if (padV <= 0f) padV = 44f;
    }

    public void TryAcceptPaletteDrop(PointerEventData eventData, DraggableActionBlock source)
    {
        if (source == null || characterMove == null) return;
        if (!characterMove.CanDragPaletteBlockToQueue(source.actionKind)) return;
        if (lastDropHandledFrame == Time.frameCount) return;

        int dropIndex = currentInsertionIndex >= 0 ? currentInsertionIndex : ComputeInsertionIndex(eventData);
        RemovePlaceholderImmediate();
        ResetHighlight();
        characterMove.InsertActionFromDrag(source.actionKind, dropIndex);
        lastDropHandledFrame = Time.frameCount;
    }

    void OnDisable()
    {
        HideInsertionPreview(animate: false);
    }

    private void EnsureRaycastable()
    {
        var graphic = GetComponent<Graphic>();
        if (graphic == null)
        {
            var img = gameObject.AddComponent<Image>();
            img.color = new Color(1f, 1f, 1f, 0f);
            img.raycastTarget = true;
        }
        else
        {
            graphic.raycastTarget = true;
        }
    }

    public void OnDrop(PointerEventData eventData)
    {
        if (eventData.pointerDrag == null)
        {
            ResetHighlight();
            HideInsertionPreview(animate: false);
            return;
        }

        int dropIndex = currentInsertionIndex >= 0 ? currentInsertionIndex : ComputeInsertionIndex(eventData);
        if (placeholderInstance != null && placeholderInstance.transform.parent != null)
            dropIndex = placeholderInstance.transform.GetSiblingIndex();

        var sourceBlock = eventData.pointerDrag.GetComponent<DraggableActionBlock>();
        var queuedBlock = eventData.pointerDrag.GetComponent<DraggableQueuedBlock>();

        RemovePlaceholderImmediate();
        ResetHighlight();
        lastDropHandledFrame = Time.frameCount;

        if (queuedBlock != null)
        {
            queuedBlock.AcceptReorderedDrop(dropIndex);
            return;
        }

        if (sourceBlock == null) return;

        var target = characterMove != null ? characterMove : sourceBlock.characterMove;
        if (target == null)
        {
            Debug.LogWarning("[ActionQueueDropZone] No CharacterMove reference available; drop ignored.");
            return;
        }
        target.InsertActionFromDrag(sourceBlock.actionKind, dropIndex);
    }

    public void OnPointerEnter(PointerEventData eventData)
    {
        if (eventData.pointerDrag == null) return;
        bool isDraggingActionInput =
            eventData.pointerDrag.GetComponent<DraggableActionBlock>() != null ||
            eventData.pointerDrag.GetComponent<DraggableQueuedBlock>() != null;
        if (!isDraggingActionInput) return;
        ApplyHighlight();
    }

    public void OnPointerExit(PointerEventData eventData)
    {
        ResetHighlight();
    }

    public void UpdateInsertionPreview(PointerEventData eventData, Sprite previewSprite)
    {
        if (characterMove == null || characterMove.actionQueueTransform == null) return;
        if (characterMove.actionImagePrefab == null) return;

        Canvas.ForceUpdateCanvases();

        int desiredIndex = ComputeInsertionIndex(eventData);
        if (desiredIndex != currentInsertionIndex)
            currentInsertionIndex = desiredIndex;

        EnsurePlaceholder(previewSprite);
        if (placeholderInstance == null) return;

        var queueTransform = characterMove.actionQueueTransform;
        int childCount = queueTransform.childCount;
        int targetSiblingIndex = Mathf.Clamp(desiredIndex, 0, Mathf.Max(0, childCount - 1));
        if (placeholderInstance.transform.GetSiblingIndex() != targetSiblingIndex)
            placeholderInstance.transform.SetSiblingIndex(targetSiblingIndex);

        LayoutRebuilder.ForceRebuildLayoutImmediate(queueTransform as RectTransform);
    }

    public void HideInsertionPreview()
    {
        HideInsertionPreview(true);
    }

    public void HideInsertionPreview(bool animate)
    {
        currentInsertionIndex = -1;
        if (placeholderInstance == null) return;

        if (placeholderTween != null) { StopCoroutine(placeholderTween); placeholderTween = null; }

        if (!animate || !isActiveAndEnabled || placeholderGrowDuration <= 0f)
        {
            RemovePlaceholderImmediate();
            return;
        }

        var ph = placeholderInstance;
        var phLayout = placeholderLayout;
        placeholderInstance = null;
        placeholderLayout = null;
        placeholderRect = null;

        placeholderTween = StartCoroutine(ShrinkAndDestroyCoroutine(ph, phLayout, placeholderGrowDuration));
    }

    private void RemovePlaceholderImmediate()
    {
        if (placeholderTween != null) { StopCoroutine(placeholderTween); placeholderTween = null; }
        if (placeholderInstance != null)
        {
            placeholderInstance.transform.SetParent(null, false);
            Destroy(placeholderInstance);
            placeholderInstance = null;
            placeholderLayout = null;
            placeholderRect = null;
        }
    }

    /// <summary>
    /// Insert index from pointer position: gaps between blocks, left/right of strip, matches Scratch-style queues.
    /// </summary>
    private int ComputeInsertionIndex(PointerEventData eventData)
    {
        var queueTransform = characterMove != null ? characterMove.actionQueueTransform : null;
        if (queueTransform == null) return 0;

        bool horizontal = IsQueueHorizontal(queueTransform);
        Camera cam = ResolveEventCamera(eventData);
        float pointer = horizontal ? eventData.position.x : eventData.position.y;

        var blocks = CollectQueueBlockRects(queueTransform);
        if (blocks.Count == 0) return 0;

        if (horizontal)
            blocks.Sort((a, b) => GetRectScreenMin(a, cam, true).CompareTo(GetRectScreenMin(b, cam, true)));
        else
            blocks.Sort((a, b) => GetRectScreenMin(a, cam, false).CompareTo(GetRectScreenMin(b, cam, false)));

        float stripMin = GetStripScreenMin(cam, horizontal);
        float stripMax = GetStripScreenMax(cam, horizontal);
        GetHitPadding(out float padH, out float padV);

        int n = blocks.Count;

        if (horizontal)
        {
            float lastMax = GetRectScreenMax(blocks[n - 1], cam, true);
            float firstMin = GetRectScreenMin(blocks[0], cam, true);

            // Append/prepend as soon as the cursor passes the last/first block — not halfway across empty yellow.
            if (pointer > lastMax + Mathf.Max(4f, appendGraceAfterLastBlockPixels))
                return n;
            if (pointer > stripMax && pointer <= stripMax + padH)
                return n;
            if (pointer <= firstMin - prependGraceBeforeFirstBlockPixels)
                return 0;
            if (pointer < stripMin && pointer >= stripMin - padH)
                return 0;
        }
        else
        {
            float lastMax = GetRectScreenMax(blocks[n - 1], cam, false);
            float firstMin = GetRectScreenMin(blocks[0], cam, false);
            if (pointer > lastMax + Mathf.Max(4f, appendGraceAfterLastBlockPixels))
                return n;
            if (pointer > stripMax && pointer <= stripMax + padV)
                return n;
            if (pointer <= firstMin - prependGraceBeforeFirstBlockPixels)
                return 0;
            if (pointer < stripMin && pointer >= stripMin - padV)
                return 0;
        }

        var boundaries = new float[n + 1];

        if (n == 1)
        {
            float c = GetRectScreenCenter(blocks[0], cam, horizontal);
            float half = horizontal
                ? GetRectScreenMax(blocks[0], cam, true) - GetRectScreenMin(blocks[0], cam, true)
                : GetRectScreenMax(blocks[0], cam, false) - GetRectScreenMin(blocks[0], cam, false);
            boundaries[0] = c - half * 0.5f - prependGraceBeforeFirstBlockPixels * 0.25f;
            boundaries[1] = c + half * 0.5f + appendGraceAfterLastBlockPixels;
        }
        else
        {
            float firstEdge = GetRectScreenMin(blocks[0], cam, horizontal);
            boundaries[0] = firstEdge - prependGraceBeforeFirstBlockPixels * 0.5f;

            for (int i = 0; i < n - 1; i++)
            {
                float gapMid = (GetRectScreenMax(blocks[i], cam, horizontal) + GetRectScreenMin(blocks[i + 1], cam, horizontal)) * 0.5f;
                boundaries[i + 1] = gapMid;
            }

            float lastEdge = GetRectScreenMax(blocks[n - 1], cam, horizontal);
            boundaries[n] = lastEdge + appendGraceAfterLastBlockPixels;
        }

        for (int slot = 0; slot < n; slot++)
        {
            if (pointer < boundaries[slot + 1])
                return slot;
        }
        return n;
    }

    private List<RectTransform> CollectQueueBlockRects(Transform queueTransform)
    {
        var list = new List<RectTransform>();
        for (int i = 0; i < queueTransform.childCount; i++)
        {
            var child = queueTransform.GetChild(i) as RectTransform;
            if (child == null) continue;
            if (child.GetComponent<QueueInsertionPlaceholder>() != null) continue;
            if (placeholderInstance != null && child.gameObject == placeholderInstance) continue;
            list.Add(child);
        }
        return list;
    }

    private float GetStripScreenMin(Camera cam, bool horizontal)
    {
        var rt = dropHitRect != null ? dropHitRect : transform as RectTransform;
        if (rt == null) return 0f;
        rt.GetWorldCorners(s_corners);
        float v = horizontal ? float.MaxValue : float.MaxValue;
        for (int i = 0; i < 4; i++)
        {
            float c = horizontal
                ? RectTransformUtility.WorldToScreenPoint(cam, s_corners[i]).x
                : RectTransformUtility.WorldToScreenPoint(cam, s_corners[i]).y;
            if (c < v) v = c;
        }
        return v;
    }

    private float GetStripScreenMax(Camera cam, bool horizontal)
    {
        var rt = dropHitRect != null ? dropHitRect : transform as RectTransform;
        if (rt == null) return Screen.width;
        rt.GetWorldCorners(s_corners);
        float v = horizontal ? float.MinValue : float.MinValue;
        for (int i = 0; i < 4; i++)
        {
            float c = horizontal
                ? RectTransformUtility.WorldToScreenPoint(cam, s_corners[i]).x
                : RectTransformUtility.WorldToScreenPoint(cam, s_corners[i]).y;
            if (c > v) v = c;
        }
        return v;
    }

    private static float GetRectScreenMin(RectTransform rt, Camera cam, bool horizontal)
    {
        rt.GetWorldCorners(s_corners);
        float v = horizontal ? float.MaxValue : float.MaxValue;
        for (int i = 0; i < 4; i++)
        {
            Vector2 sp = RectTransformUtility.WorldToScreenPoint(cam, s_corners[i]);
            float c = horizontal ? sp.x : sp.y;
            if (c < v) v = c;
        }
        return v;
    }

    private static float GetRectScreenMax(RectTransform rt, Camera cam, bool horizontal)
    {
        rt.GetWorldCorners(s_corners);
        float v = horizontal ? float.MinValue : float.MinValue;
        for (int i = 0; i < 4; i++)
        {
            Vector2 sp = RectTransformUtility.WorldToScreenPoint(cam, s_corners[i]);
            float c = horizontal ? sp.x : sp.y;
            if (c > v) v = c;
        }
        return v;
    }

    private static float GetRectScreenCenter(RectTransform rt, Camera cam, bool horizontal)
    {
        return (GetRectScreenMin(rt, cam, horizontal) + GetRectScreenMax(rt, cam, horizontal)) * 0.5f;
    }

    private static bool IsQueueHorizontal(Transform queueTransform)
    {
        if (queueTransform.GetComponent<HorizontalLayoutGroup>() != null) return true;
        if (queueTransform.GetComponent<VerticalLayoutGroup>() != null) return false;
        return true;
    }

    private Camera ResolveEventCamera(PointerEventData eventData)
    {
        if (eventData != null && eventData.pressEventCamera != null) return eventData.pressEventCamera;
        var canvas = GetComponentInParent<Canvas>();
        if (canvas == null) return null;
        return canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera;
    }

    private void EnsurePlaceholder(Sprite sprite)
    {
        if (placeholderInstance != null)
        {
            var img = placeholderInstance.GetComponent<Image>();
            if (img != null && sprite != null) img.sprite = sprite;
            return;
        }

        var prefab = characterMove.actionImagePrefab;
        if (prefab == null) return;

        placeholderInstance = Instantiate(prefab, characterMove.actionQueueTransform);
        placeholderInstance.name = "InsertionPlaceholder";
        placeholderInstance.AddComponent<QueueInsertionPlaceholder>();

        var img2 = placeholderInstance.GetComponent<Image>();
        if (img2 != null)
        {
            if (sprite != null) img2.sprite = sprite;
            img2.raycastTarget = false;
            img2.color = new Color(1f, 1f, 1f, placeholderAlpha);
        }
        var cg = placeholderInstance.GetComponent<CanvasGroup>();
        if (cg == null) cg = placeholderInstance.AddComponent<CanvasGroup>();
        cg.blocksRaycasts = false;
        cg.interactable = false;
        cg.alpha = Mathf.Clamp01(placeholderAlpha);

        placeholderLayout = placeholderInstance.GetComponent<LayoutElement>();
        if (placeholderLayout == null) placeholderLayout = placeholderInstance.AddComponent<LayoutElement>();
        placeholderLayout.minWidth = 0f;
        placeholderLayout.flexibleWidth = 0f;

        placeholderRect = (RectTransform)placeholderInstance.transform;
        float target = ResolvePlaceholderTargetWidth();
        placeholderLayout.preferredWidth = target;
        placeholderRect.sizeDelta = new Vector2(target, placeholderRect.sizeDelta.y);

        if (placeholderGrowDuration > 0.001f)
        {
            placeholderLayout.preferredWidth = target * 0.35f;
            placeholderRect.sizeDelta = new Vector2(target * 0.35f, placeholderRect.sizeDelta.y);
            if (placeholderTween != null) StopCoroutine(placeholderTween);
            placeholderTween = StartCoroutine(GrowCoroutine(target, placeholderGrowDuration));
        }
    }

    private float ResolvePlaceholderTargetWidth()
    {
        if (placeholderTargetWidthOverride > 0f) return placeholderTargetWidthOverride;
        if (characterMove != null && characterMove.actionImagePrefab != null)
        {
            var prefabRt = characterMove.actionImagePrefab.transform as RectTransform;
            if (prefabRt != null && prefabRt.rect.width > 0f) return prefabRt.rect.width;
        }
        if (characterMove != null && characterMove.actionQueueTransform != null)
        {
            for (int i = 0; i < characterMove.actionQueueTransform.childCount; i++)
            {
                var childRt = characterMove.actionQueueTransform.GetChild(i) as RectTransform;
                if (childRt == null) continue;
                if (placeholderInstance != null && childRt.gameObject == placeholderInstance) continue;
                if (childRt.rect.width > 0f) return childRt.rect.width;
            }
        }
        return 60f;
    }

    private IEnumerator GrowCoroutine(float targetWidth, float duration)
    {
        float startWidth = placeholderLayout != null ? placeholderLayout.preferredWidth : 0f;
        float elapsed = 0f;
        while (elapsed < duration)
        {
            elapsed += Time.unscaledDeltaTime;
            float t = Mathf.Clamp01(elapsed / duration);
            float eased = 1f - Mathf.Pow(1f - t, 3f);
            ApplyPlaceholderWidth(Mathf.Lerp(startWidth, targetWidth, eased));
            yield return null;
        }
        ApplyPlaceholderWidth(targetWidth);
        placeholderTween = null;
    }

    private IEnumerator ShrinkAndDestroyCoroutine(GameObject ph, LayoutElement layout, float duration)
    {
        if (ph == null) yield break;
        var rt = ph.transform as RectTransform;
        float startWidth = layout != null ? layout.preferredWidth : (rt != null ? rt.sizeDelta.x : 0f);
        float elapsed = 0f;
        while (elapsed < duration && ph != null)
        {
            elapsed += Time.unscaledDeltaTime;
            float t = Mathf.Clamp01(elapsed / duration);
            float eased = 1f - Mathf.Pow(1f - t, 3f);
            float w = Mathf.Lerp(startWidth, 0f, eased);
            if (layout != null) layout.preferredWidth = w;
            if (rt != null) rt.sizeDelta = new Vector2(w, rt.sizeDelta.y);
            yield return null;
        }
        if (ph != null) Destroy(ph);
        placeholderTween = null;
    }

    private void ApplyPlaceholderWidth(float w)
    {
        if (placeholderLayout != null) placeholderLayout.preferredWidth = w;
        if (placeholderRect != null) placeholderRect.sizeDelta = new Vector2(w, placeholderRect.sizeDelta.y);
    }

    private void ApplyHighlight()
    {
        if (highlightTarget == null) return;
        if (!highlightCached)
        {
            baseColor = highlightTarget.color;
            highlightCached = true;
        }
        highlightTarget.color = highlightColor;
    }

    private void ResetHighlight()
    {
        if (highlightTarget == null || !highlightCached) return;
        highlightTarget.color = baseColor;
    }
}
