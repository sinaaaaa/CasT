using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Command Bag library (BLUE left panel). Source cards stay here forever;
/// drops create separate ProgramBagInstance objects in the yellow strip.
/// </summary>
public class CommandBagPaletteController : MonoBehaviour
{
    public const string BagCanvasName = "Canvas-CommandBag";
    public const string BagPanelName = "CommandBagPanel";

    public CharacterMove characterMove;
    public RectTransform paletteParent;
    public float bagCardHeight = CommandBagUiHelper.SourceCardHeight;
    public float chunkCardHeight = CommandBagUiHelper.SourceCardHeight;

    [Header("Left blue sidebar size (synced from CharacterMove when Auto Layout is ON)")]
    [Tooltip("Left edge of the Command Bag panel (0 = screen left). Prefer editing on CharacterMove.")]
    [Range(0f, 0.2f)] public float panelAnchorLeft = 0.01f;
    [Tooltip("Right edge of the Command Bag panel. Raise this to widen the blue sidebar.")]
    [Range(0.15f, 0.4f)] public float panelAnchorRight = 0.265f;
    [Tooltip("Bottom edge (keep above yellow strip).")]
    [Range(0.05f, 0.4f)] public float panelAnchorBottom = 0.16f;
    [Tooltip("Top edge.")]
    [Range(0.5f, 1f)] public float panelAnchorTop = 0.96f;

    /// <summary>Copy panel size knobs from CharacterMove (source of truth in the Inspector).</summary>
    public void SyncPanelSizeFromCharacterMove()
    {
        if (characterMove == null) return;
        panelAnchorLeft = characterMove.commandBagPanelLeft;
        panelAnchorRight = characterMove.commandBagPanelRight;
        panelAnchorBottom = characterMove.commandBagPanelBottom;
        panelAnchorTop = characterMove.commandBagPanelTop;
    }

    /// <summary>Apply current size knobs to the blue panel immediately (Auto Layout only).</summary>
    public void ApplyPanelSizeNow()
    {
        SyncPanelSizeFromCharacterMove();
        if (!ShouldAutoLayout() || paletteParent == null) return;
        ApplyLeftColumnLayout(paletteParent);
        FitListRoot();
        if (_contentRoot != null)
            LayoutRebuilder.ForceRebuildLayoutImmediate(_contentRoot);
        if (paletteParent != null)
            LayoutRebuilder.ForceRebuildLayoutImmediate(paletteParent);
    }

    static readonly Color PanelBlue = new Color(0.55f, 0.72f, 0.92f, 1f);
    static readonly Color PanelBlueDark = new Color(0.35f, 0.52f, 0.78f, 1f);

    readonly List<GameObject> _spawned = new List<GameObject>();
    string _openBagId;
    LevelData _level;
    RectTransform _listRoot;
    RectTransform _contentRoot;

    public string OpenBagId => _openBagId;

    /// <summary>True when the blue Command Bag panel is showing bags.</summary>
    public bool IsPanelVisible =>
        paletteParent != null &&
        paletteParent.gameObject.activeInHierarchy &&
        _level != null &&
        _level.commandBags != null &&
        _level.commandBags.Count > 0;

    /// <summary>
    /// Actual screen-width fraction used by the blue sidebar (measured from the panel rect).
    /// Falls back to anchor settings when the rect is not laid out yet.
    /// </summary>
    public float ReservedLeftScreenFraction
    {
        get
        {
            if (paletteParent != null)
            {
                var canvas = paletteParent.GetComponentInParent<Canvas>();
                Camera eventCam = null;
                if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
                    eventCam = canvas.worldCamera != null ? canvas.worldCamera : Camera.main;

                Vector3[] corners = new Vector3[4];
                paletteParent.GetWorldCorners(corners);
                // 0=bottom-left, 2=top-right in screen space
                Vector2 bl = RectTransformUtility.WorldToScreenPoint(eventCam, corners[0]);
                Vector2 tr = RectTransformUtility.WorldToScreenPoint(eventCam, corners[2]);
                float screenW = Mathf.Max(1f, Screen.width);
                float rightEdge = Mathf.Max(bl.x, tr.x) / screenW;
                if (rightEdge > 0.05f && rightEdge < 0.5f)
                    return Mathf.Clamp(rightEdge + 0.008f, 0.08f, 0.28f);
            }

            float left = Mathf.Clamp(panelAnchorLeft, 0f, 0.2f);
            float right = Mathf.Clamp(panelAnchorRight, left + 0.12f, 0.35f);
            return Mathf.Clamp(right + 0.008f, 0.08f, 0.28f);
        }
    }

    public void Clear()
    {
        ClearSpawnedOnly();
        _openBagId = null;
        _level = null;

        if (_listRoot != null)
            _listRoot.gameObject.SetActive(false);

        if (paletteParent != null && paletteParent.name == BagPanelName)
            paletteParent.gameObject.SetActive(false);

        SetBagCanvasActive(false);
        ShowLegacyArrowHost(true);
        RestoreLegacyArrowButtons();
    }

    void ClearSpawnedOnly()
    {
        for (int i = 0; i < _spawned.Count; i++)
        {
            if (_spawned[i] != null)
                DestroyImmediate(_spawned[i]);
        }
        _spawned.Clear();

        if (_contentRoot != null)
        {
            for (int i = _contentRoot.childCount - 1; i >= 0; i--)
                DestroyImmediate(_contentRoot.GetChild(i).gameObject);
        }
    }

    public void Rebuild(LevelData level)
    {
        SyncPanelSizeFromCharacterMove();

        // Card height hugs content (title + preview) — no empty filler.
        bagCardHeight = CommandBagUiHelper.SourceCardHeight;
        chunkCardHeight = CommandBagUiHelper.SourceCardHeight;

        // Do not deactivate the canvas mid-rebuild — only clear cards.
        ClearSpawnedOnly();
        _openBagId = null;
        _level = level;

        if (level == null || level.commandBags == null || level.commandBags.Count == 0)
        {
            Clear();
            return;
        }

        EnsureDedicatedPanel();
        EnsureScrollList();
        if (_contentRoot == null || _listRoot == null || paletteParent == null)
        {
            Debug.LogError("[CommandBagPalette] Failed to build left Command Bag panel.");
            return;
        }

        SetBagCanvasActive(true);
        paletteParent.gameObject.SetActive(true);
        SnapshotLiveKnobs();
        _listRoot.gameObject.SetActive(true);

        // Hide the old arrow column so only the blue bag panel is on the left.
        ShowLegacyArrowHost(false);
        HideLegacyArrowButtons();

        // Never leave source cards inside the yellow program strip.
        PurgeSourceCardsFromYellowStrip();

        string mode = (level.commandBagMode ?? "BAG").Trim().ToUpperInvariant();
        bool chunkMode = mode == "CHUNK";
        SpawnHeader(chunkMode ? "Action Chunks" : "Command Bag");

        if (chunkMode)
        {
            int index = 0;
            for (int b = 0; b < level.commandBags.Count; b++)
            {
                var bag = level.commandBags[b];
                if (bag?.chunks == null) continue;
                for (int c = 0; c < bag.chunks.Count; c++)
                {
                    index++;
                    SpawnChunkCard(bag, bag.chunks[c], index);
                }
            }
        }
        else
        {
            for (int b = 0; b < level.commandBags.Count; b++)
                SpawnBagCard(level.commandBags[b], b);

            if (mode == "MIXED" && !string.IsNullOrEmpty(_openBagId))
                SpawnOpenBagChunks(_openBagId);
        }

        Canvas.ForceUpdateCanvases();
        LayoutRebuilder.ForceRebuildLayoutImmediate(_contentRoot);
        LayoutRebuilder.ForceRebuildLayoutImmediate(paletteParent);
        FitPanelToBagCount();

        // Final safety: if any source card escaped into the yellow strip, pull them back.
        PurgeSourceCardsFromYellowStrip();
        Debug.Log($"[CommandBagPalette] Built {_spawned.Count} source cards under '{GetBagCanvasPath()}'.");
    }

    /// <summary>
    /// Designer layout:
    /// • Few bags → blue panel hugs content (no empty blue void at the bottom).
    /// • Many bags / short screens → panel uses max safe height and scrolls.
    /// Always stays above the yellow strip and inside the visible canvas.
    /// </summary>
    void FitPanelToBagCount()
    {
        if (paletteParent == null || _contentRoot == null || _listRoot == null) return;

        int bagCount = 0;
        for (int i = 0; i < _spawned.Count; i++)
        {
            if (_spawned[i] == null) continue;
            string n = _spawned[i].name ?? "";
            if (n.StartsWith("Bag_") || n.StartsWith("Chunk_"))
                bagCount++;
        }

        ConfigureListSpacing(bagCount);

        Canvas.ForceUpdateCanvases();
        LayoutRebuilder.ForceRebuildLayoutImmediate(_contentRoot);

        float contentH = MeasureContentHeight();
        var scroll = _listRoot.GetComponent<ScrollRect>();

        if (!ShouldAutoLayout())
        {
            FitListRoot();
            Canvas.ForceUpdateCanvases();
            float viewportH = (_listRoot.rect.height > 1f) ? _listRoot.rect.height : contentH;
            bool overflow = contentH > viewportH + 4f;
            if (scroll != null)
            {
                scroll.vertical = overflow;
                scroll.movementType = overflow
                    ? ScrollRect.MovementType.Elastic
                    : ScrollRect.MovementType.Clamped;
                scroll.verticalNormalizedPosition = 1f;
            }
            return;
        }

        float canvasH = ResolveCanvasHeight();
        float left = Mathf.Clamp(panelAnchorLeft, 0f, 0.2f);
        float right = Mathf.Clamp(panelAnchorRight, left + 0.12f, 0.42f);
        float top = Mathf.Clamp(panelAnchorTop, 0.55f, 0.98f);
        float minBottom = ResolveSafeBottomNormalized(canvasH, top);

        float maxPanelH = Mathf.Max(140f, (top - minBottom) * canvasH);

        // If a few cards barely overflow, densify spacing once so more fit without scroll.
        if (bagCount > 0 && bagCount <= 5 && contentH > maxPanelH + 2f && contentH < maxPanelH * 1.4f)
        {
            ConfigureListSpacing(bagCount + 3); // denser tier
            Canvas.ForceUpdateCanvases();
            LayoutRebuilder.ForceRebuildLayoutImmediate(_contentRoot);
            contentH = MeasureContentHeight();
        }

        bool needsScroll = contentH > maxPanelH - 2f;
        float useH = needsScroll ? maxPanelH : Mathf.Min(maxPanelH, contentH + 18f);

        float bottom = top - (useH / Mathf.Max(1f, canvasH));
        bottom = Mathf.Clamp(bottom, minBottom, top - 0.12f);

        // Never let the panel sit below the canvas / screen.
        bottom = Mathf.Max(bottom, 0.02f);
        top = Mathf.Min(top, 0.98f);
        if (top - bottom < 0.15f)
            bottom = top - 0.15f;

        paletteParent.anchorMin = new Vector2(left, bottom);
        paletteParent.anchorMax = new Vector2(right, top);
        paletteParent.pivot = new Vector2(0.5f, 1f);
        paletteParent.offsetMin = Vector2.zero;
        paletteParent.offsetMax = Vector2.zero;
        paletteParent.anchoredPosition = Vector2.zero;

        FitListRoot();
        Canvas.ForceUpdateCanvases();
        LayoutRebuilder.ForceRebuildLayoutImmediate(paletteParent);
        LayoutRebuilder.ForceRebuildLayoutImmediate(_contentRoot);

        // Re-check against the real viewport after anchors applied.
        float realViewport = (_listRoot.rect.height > 1f) ? _listRoot.rect.height : useH;
        float finalContent = MeasureContentHeight();
        needsScroll = finalContent > realViewport + 6f;

        if (scroll != null)
        {
            scroll.vertical = needsScroll;
            scroll.inertia = true;
            scroll.decelerationRate = 0.135f;
            scroll.scrollSensitivity = 40f;
            scroll.movementType = needsScroll
                ? ScrollRect.MovementType.Elastic
                : ScrollRect.MovementType.Clamped;
            scroll.verticalNormalizedPosition = 1f;
        }
    }

    float MeasureContentHeight()
    {
        if (_contentRoot == null) return 80f;

        float preferred = LayoutUtility.GetPreferredHeight(_contentRoot);
        float rectH = Mathf.Abs(_contentRoot.rect.height);

        float sum = 0f;
        int visible = 0;
        var vlg = _contentRoot.GetComponent<VerticalLayoutGroup>();
        float spacing = vlg != null ? vlg.spacing : 0f;
        for (int i = 0; i < _contentRoot.childCount; i++)
        {
            var child = _contentRoot.GetChild(i) as RectTransform;
            if (child == null || !child.gameObject.activeInHierarchy) continue;
            var le = child.GetComponent<LayoutElement>();
            float h = 0f;
            if (le != null && le.preferredHeight > 1f) h = le.preferredHeight;
            else if (child.rect.height > 1f) h = child.rect.height;
            else h = LayoutUtility.GetPreferredHeight(child);
            sum += Mathf.Max(1f, h);
            visible++;
        }
        if (vlg != null && visible > 0)
            sum += spacing * Mathf.Max(0, visible - 1) + vlg.padding.top + vlg.padding.bottom;

        // + list chrome (viewport margins inside the blue panel)
        return Mathf.Max(80f, preferred, rectH, sum) + 28f;
    }

    /// <summary>
    /// Lowest safe panel edge: CharacterMove knob, plus measured yellow-strip top when available.
    /// </summary>
    float ResolveSafeBottomNormalized(float canvasH, float top)
    {
        float minBottom = Mathf.Clamp(panelAnchorBottom, 0.05f, top - 0.15f);
        float stripTop = MeasureYellowStripTopNormalized();
        if (stripTop > 0.02f)
            minBottom = Mathf.Max(minBottom, stripTop + 0.025f);
        // Keep a little air above the absolute screen bottom in short free-aspect views.
        minBottom = Mathf.Max(minBottom, 0.06f);
        return Mathf.Clamp(minBottom, 0.05f, top - 0.15f);
    }

    float MeasureYellowStripTopNormalized()
    {
        if (characterMove == null) return 0f;
        RectTransform strip = characterMove.dropZonePanel;
        if (strip == null && characterMove.actionQueueTransform != null)
            strip = characterMove.actionQueueTransform as RectTransform;
        if (strip == null) return 0f;

        var canvas = paletteParent != null
            ? paletteParent.GetComponentInParent<Canvas>()
            : null;
        Camera eventCam = null;
        if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
            eventCam = canvas.worldCamera != null ? canvas.worldCamera : Camera.main;

        Vector3[] corners = new Vector3[4];
        strip.GetWorldCorners(corners);
        // 1 = top-left, 2 = top-right
        Vector2 tl = RectTransformUtility.WorldToScreenPoint(eventCam, corners[1]);
        float screenH = Mathf.Max(1f, Screen.height);
        return Mathf.Clamp01(tl.y / screenH);
    }

    void ConfigureListSpacing(int bagCount)
    {
        if (_contentRoot == null) return;
        var vlg = _contentRoot.GetComponent<VerticalLayoutGroup>();
        if (vlg == null) return;

        // Few bags: airy. Many bags / tight height: denser so more fit before scrolling.
        if (bagCount <= 3)
        {
            vlg.spacing = 12f;
            vlg.padding = new RectOffset(12, 12, 10, 14);
        }
        else if (bagCount <= 5)
        {
            vlg.spacing = 9f;
            vlg.padding = new RectOffset(10, 10, 8, 12);
        }
        else
        {
            vlg.spacing = 6f;
            vlg.padding = new RectOffset(8, 8, 6, 10);
        }
        vlg.childAlignment = TextAnchor.UpperCenter;
    }

    float ResolveCanvasHeight()
    {
        if (paletteParent != null)
        {
            var parentRt = paletteParent.parent as RectTransform;
            if (parentRt != null && parentRt.rect.height > 10f)
                return parentRt.rect.height;
            var canvas = paletteParent.GetComponentInParent<Canvas>();
            if (canvas != null)
            {
                var crt = canvas.GetComponent<RectTransform>();
                if (crt != null && crt.rect.height > 10f)
                    return crt.rect.height;
            }
        }
        return Mathf.Max(600f, Screen.height);
    }

    int _lastScreenW = -1;
    int _lastScreenH = -1;

    void LateUpdate()
    {
        if (!Application.isPlaying || _level == null || paletteParent == null) return;
        if (Screen.width == _lastScreenW && Screen.height == _lastScreenH) return;
        _lastScreenW = Screen.width;
        _lastScreenH = Screen.height;
        // Free Aspect / maximize / window resize — reclamp the blue panel.
        FitPanelToBagCount();
    }

    void OnRectTransformDimensionsChange()
    {
        if (!Application.isPlaying || _level == null || paletteParent == null) return;
        FitPanelToBagCount();
    }

    public void ToggleBagOpen(string bagId)
    {
        if (string.IsNullOrEmpty(bagId)) return;
        string mode = (_level?.commandBagMode ?? "BAG").Trim().ToUpperInvariant();
        if (mode == "BAG") return;
        _openBagId = _openBagId == bagId ? null : bagId;
        Rebuild(_level);
    }

    void HideLegacyArrowButtons()
    {
        if (characterMove == null) return;
        string mode = (_level?.commandBagMode ?? "BAG").Trim().ToUpperInvariant();
        if (mode == "MIXED") return;
        void Hide(Button b)
        {
            if (b != null) b.gameObject.SetActive(false);
        }
        Hide(characterMove.moveForwardButton);
        Hide(characterMove.moveDownButton);
        Hide(characterMove.rotateLeftButton);
        Hide(characterMove.rotateRightButton);
        Hide(characterMove.repeatButton);
    }

    void RestoreLegacyArrowButtons()
    {
        if (characterMove == null) return;
        void Show(Button b)
        {
            if (b != null) b.gameObject.SetActive(true);
        }
        Show(characterMove.moveForwardButton);
        Show(characterMove.moveDownButton);
        Show(characterMove.rotateLeftButton);
        Show(characterMove.rotateRightButton);
        Show(characterMove.repeatButton);
    }

    void ShowLegacyArrowHost(bool visible)
    {
        if (characterMove == null) return;
        // Scene "Panel" that holds Forward/Left/Right — hide whole host in bag modes.
        Transform host = null;
        if (characterMove.moveForwardButton != null)
            host = characterMove.moveForwardButton.transform.parent;
        else if (characterMove.rotateLeftButton != null)
            host = characterMove.rotateLeftButton.transform.parent;
        if (host == null) return;

        // Never hide our own bag panel.
        if (host.name == BagPanelName) return;
        if (host.GetComponentInParent<Canvas>() != null &&
            host.GetComponentInParent<Canvas>().name == BagCanvasName)
            return;

        host.gameObject.SetActive(visible);
    }

    void EnsureDedicatedPanel()
    {
        DestroyMisplacedBagPanelsImmediate();

        bool assignedPanel = paletteParent != null && IsUsableBagPanel(paletteParent);
        if (assignedPanel)
        {
            // Teacher/designer assigned CommandBagPanel — keep it, optionally auto-layout.
            EnsureAssignedPanelActive(paletteParent);
            if (ShouldAutoLayout())
                ApplyLeftColumnLayout(paletteParent);
            EnsurePanelChrome(paletteParent, forceDefaultBlue: false);
            paletteParent.SetAsLastSibling();
            if (characterMove != null)
                characterMove.commandBagPanel = paletteParent;
            return;
        }

        Canvas canvas = ResolveCommandBagCanvas();
        if (canvas == null) return;
        canvas.gameObject.SetActive(true);

        Transform existing = canvas.transform.Find(BagPanelName);
        if (existing != null)
        {
            paletteParent = existing as RectTransform;
        }
        else
        {
            var go = new GameObject(BagPanelName, typeof(RectTransform), typeof(Image), typeof(Outline));
            go.transform.SetParent(canvas.transform, false);
            paletteParent = go.GetComponent<RectTransform>();
        }

        if (ShouldAutoLayout())
            ApplyLeftColumnLayout(paletteParent);
        EnsurePanelChrome(paletteParent, forceDefaultBlue: true);
        paletteParent.SetAsLastSibling();

        if (characterMove != null)
            characterMove.commandBagPanel = paletteParent;
    }

    bool ShouldAutoLayout()
    {
        return characterMove == null || characterMove.autoLayoutCommandBagPanel;
    }

    static bool IsUsableBagPanel(RectTransform panel)
    {
        if (panel == null) return false;
        if (IsUnderYellowStripCanvas(panel)) return false;
        return true;
    }

    void EnsureAssignedPanelActive(RectTransform panel)
    {
        if (panel == null) return;
        panel.gameObject.SetActive(true);
        var canvas = panel.GetComponentInParent<Canvas>();
        if (canvas != null)
            canvas.gameObject.SetActive(true);
        else if (characterMove != null && characterMove.commandBagCanvas != null)
        {
            // Panel not under a canvas yet — parent under the assigned canvas.
            characterMove.commandBagCanvas.gameObject.SetActive(true);
            if (panel.parent != characterMove.commandBagCanvas.transform)
                panel.SetParent(characterMove.commandBagCanvas.transform, false);
        }
    }

    Canvas ResolveCommandBagCanvas()
    {
        if (characterMove != null && characterMove.commandBagCanvas != null)
        {
            var assigned = characterMove.commandBagCanvas;
            if (IsUnderYellowStripCanvas(assigned.transform))
            {
                Debug.LogWarning("[CommandBagPalette] Assigned commandBagCanvas is under Yellow Strip — ignoring.");
            }
            else
            {
                return assigned;
            }
        }
        return FindOrCreateCommandBagCanvas();
    }

    void EnsurePanelChrome(RectTransform panel, bool forceDefaultBlue)
    {
        if (panel == null) return;
        var img = panel.GetComponent<Image>();
        if (img == null) img = panel.gameObject.AddComponent<Image>();
        // Auto panel always gets default blue; assigned panels keep custom sprite/color.
        if (forceDefaultBlue)
            img.color = PanelBlue;
        img.raycastTarget = true;

        var outline = panel.GetComponent<Outline>();
        if (outline == null) outline = panel.gameObject.AddComponent<Outline>();
        if (forceDefaultBlue)
        {
            outline.effectColor = PanelBlueDark;
            outline.effectDistance = new Vector2(3f, -3f);
        }
    }

    static Canvas FindOrCreateCommandBagCanvas()
    {
        var all = Object.FindObjectsByType<Canvas>(FindObjectsInactive.Include, FindObjectsSortMode.None);
        for (int i = 0; i < all.Length; i++)
        {
            var c = all[i];
            if (c == null) continue;
            if (c.name != BagCanvasName) continue;
            // Must be a root overlay — never nested under Yellow Strip.
            if (IsUnderYellowStripCanvas(c.transform))
            {
                Object.DestroyImmediate(c.gameObject);
                continue;
            }
            ApplyBagCanvasScaler(c);
            return c;
        }

        var go = new GameObject(
            BagCanvasName,
            typeof(RectTransform),
            typeof(Canvas),
            typeof(CanvasScaler),
            typeof(GraphicRaycaster));
        // Scene root — sibling of Canvas-Yellow Strip, not a child of it.
        go.transform.SetParent(null, false);

        var canvas = go.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.sortingOrder = 25;

        ApplyBagCanvasScaler(canvas);

        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        return canvas;
    }

    static void ApplyBagCanvasScaler(Canvas canvas)
    {
        if (canvas == null) return;
        var scaler = canvas.GetComponent<CanvasScaler>();
        if (scaler == null) scaler = canvas.gameObject.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920f, 1080f);
        scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
        // Prefer height so Free Aspect / tall-short windows keep the blue column fully usable.
        scaler.matchWidthOrHeight = 0.75f;
    }

    void SetBagCanvasActive(bool active)
    {
        if (characterMove != null && characterMove.commandBagCanvas != null)
            characterMove.commandBagCanvas.gameObject.SetActive(active);
        SetBagCanvasActiveByName(active);
    }

    static void SetBagCanvasActiveByName(bool active)
    {
        var all = Object.FindObjectsByType<Canvas>(FindObjectsInactive.Include, FindObjectsSortMode.None);
        for (int i = 0; i < all.Length; i++)
        {
            if (all[i] != null && all[i].name == BagCanvasName)
                all[i].gameObject.SetActive(active);
        }
    }

    static bool IsYellowStripCanvas(Canvas c)
    {
        if (c == null) return false;
        string n = c.name ?? "";
        return n.IndexOf("Yellow", System.StringComparison.OrdinalIgnoreCase) >= 0;
    }

    static bool IsUnderYellowStripCanvas(Transform t)
    {
        if (t == null) return false;
        var c = t.GetComponentInParent<Canvas>();
        return IsYellowStripCanvas(c);
    }

    void DestroyMisplacedBagPanelsImmediate()
    {
        if (characterMove != null &&
            characterMove.commandBagPanel != null &&
            (IsUnderYellowStripCanvas(characterMove.commandBagPanel) ||
             IsInsideActionQueue(characterMove.commandBagPanel)))
        {
            characterMove.commandBagPanel = null;
        }

        if (paletteParent != null &&
            (IsUnderYellowStripCanvas(paletteParent) || IsInsideActionQueue(paletteParent)))
            paletteParent = null;

        var all = Object.FindObjectsByType<RectTransform>(FindObjectsInactive.Include, FindObjectsSortMode.None);
        for (int i = 0; i < all.Length; i++)
        {
            var rt = all[i];
            if (rt == null || rt.name != BagPanelName) continue;
            if (!IsUnderYellowStripCanvas(rt) && !IsInsideActionQueue(rt)) continue;
            Object.DestroyImmediate(rt.gameObject);
        }
    }

    bool IsInsideActionQueue(Transform t)
    {
        if (t == null || characterMove == null) return false;
        if (characterMove.actionQueueTransform != null && t.IsChildOf(characterMove.actionQueueTransform))
            return true;
        if (characterMove.dropZonePanel != null && t.IsChildOf(characterMove.dropZonePanel) &&
            t.name != "Yellow Strip")
        {
            // Source bag UI must never live under the yellow strip.
            if (t.name == BagPanelName || t.name == "CommandBagList" ||
                t.name.StartsWith("Bag_") || t.name.StartsWith("Chunk_"))
                return true;
        }
        return false;
    }

    void PurgeSourceCardsFromYellowStrip()
    {
        if (characterMove == null) return;

        // Any DraggableCommandBagBlock under yellow strip / action queue is a misplaced SOURCE card.
        var blocks = Object.FindObjectsByType<DraggableCommandBagBlock>(FindObjectsInactive.Include, FindObjectsSortMode.None);
        for (int i = 0; i < blocks.Length; i++)
        {
            var b = blocks[i];
            if (b == null) continue;
            if (!IsUnderYellowStripCanvas(b.transform) && !IsInsideActionQueue(b.transform))
                continue;
            // Program instances use QueuedActionRef, not DraggableCommandBagBlock — safe to destroy.
            Object.DestroyImmediate(b.gameObject);
        }

        // Also remove orphaned CommandBagList / header under yellow.
        if (characterMove.actionQueueTransform != null)
        {
            for (int i = characterMove.actionQueueTransform.childCount - 1; i >= 0; i--)
            {
                var child = characterMove.actionQueueTransform.GetChild(i);
                if (child == null) continue;
                string n = child.name ?? "";
                if (n == "CommandBagList" || n == "BagHeader" || n == BagPanelName ||
                    n.StartsWith("Bag_") || n.StartsWith("Chunk_"))
                    Object.DestroyImmediate(child.gameObject);
            }
        }
    }

    void ApplyLeftColumnLayout(RectTransform panel)
    {
        if (panel == null) return;
        panel.localScale = Vector3.one;
        panel.localRotation = Quaternion.identity;
        // Wider left column so bag previews (Repeat + arrows + End) fit without shrinking.
        float left = Mathf.Clamp(panelAnchorLeft, 0f, 0.2f);
        float right = Mathf.Clamp(panelAnchorRight, left + 0.12f, 0.42f);
        float bottom = Mathf.Clamp(panelAnchorBottom, 0.05f, 0.45f);
        float top = Mathf.Clamp(panelAnchorTop, bottom + 0.2f, 0.98f);
        panel.anchorMin = new Vector2(left, bottom);
        panel.anchorMax = new Vector2(right, top);
        panel.pivot = new Vector2(0.5f, 0.5f);
        panel.offsetMin = Vector2.zero;
        panel.offsetMax = Vector2.zero;
        panel.anchoredPosition = Vector2.zero;
    }

    // --- Live Play Mode refresh for Repeat size / counter / panel size knobs ---
    float _liveStartScale = float.NaN;
    float _liveEndScale = float.NaN;
    float _liveCounterScale = float.NaN;
    float _liveCounterAy = float.NaN;
    float _liveCounterX = float.NaN;
    float _liveCounterY = float.NaN;
    float _liveChunkIconBlue = float.NaN;
    float _liveChunkIconYellow = float.NaN;
    float _liveChunkIconPeek = float.NaN;
    float _liveChunkRectW = float.NaN;
    float _liveChunkRectH = float.NaN;
    float _liveChunkRectBlueH = float.NaN;
    float _liveChunkRectBlueW = float.NaN;
    float _liveChunkPeekW = float.NaN;
    float _liveChunkPeekH = float.NaN;
    float _livePanelLeft = float.NaN;
    float _livePanelRight = float.NaN;
    float _livePanelBottom = float.NaN;
    float _livePanelTop = float.NaN;
    bool _liveAutoLayout;

    void Update()
    {
        if (!Application.isPlaying || characterMove == null || _level == null) return;
        if (_contentRoot == null || _spawned.Count == 0) return;

        var cm = characterMove;
        SyncPanelSizeFromCharacterMove();

        bool panelDirty =
            !Mathf.Approximately(_livePanelLeft, panelAnchorLeft) ||
            !Mathf.Approximately(_livePanelRight, panelAnchorRight) ||
            !Mathf.Approximately(_livePanelBottom, panelAnchorBottom) ||
            !Mathf.Approximately(_livePanelTop, panelAnchorTop) ||
            _liveAutoLayout != cm.autoLayoutCommandBagPanel;

        bool bagPreviewDirty =
            !Mathf.Approximately(_liveStartScale, cm.bagRepeatStartScale) ||
            !Mathf.Approximately(_liveEndScale, cm.bagRepeatEndScale) ||
            !Mathf.Approximately(_liveCounterScale, cm.bagRepeatCounterScale) ||
            !Mathf.Approximately(_liveCounterAy, cm.bagRepeatCounterAnchorY) ||
            !Mathf.Approximately(_liveCounterX, cm.bagRepeatCounterXOffset) ||
            !Mathf.Approximately(_liveCounterY, cm.bagRepeatCounterYOffset);

        bool chunkBlueDirty =
            !Mathf.Approximately(_liveChunkIconBlue, cm.chunkIconSizeBluePanel) ||
            !Mathf.Approximately(_liveChunkRectBlueH, cm.chunkRectHeightBluePanel) ||
            !Mathf.Approximately(_liveChunkRectBlueW, cm.chunkRectMinWidthBluePanel);
        bool chunkYellowDirty =
            !Mathf.Approximately(_liveChunkIconYellow, cm.chunkIconSizeYellowStrip) ||
            !Mathf.Approximately(_liveChunkRectW, cm.chunkRectWidthYellowStrip) ||
            !Mathf.Approximately(_liveChunkRectH, cm.chunkRectHeightYellowStrip);
        bool chunkPeekDirty =
            !Mathf.Approximately(_liveChunkIconPeek, cm.chunkIconSizePeekPanel) ||
            !Mathf.Approximately(_liveChunkPeekW, cm.chunkPeekPanelMinWidth) ||
            !Mathf.Approximately(_liveChunkPeekH, cm.chunkPeekPanelMinHeight);

        if (!panelDirty && !bagPreviewDirty && !chunkBlueDirty && !chunkYellowDirty && !chunkPeekDirty)
            return;

        SnapshotLiveKnobs();

        if (panelDirty)
        {
            ApplyPanelSizeNow();
            FitPanelToBagCount();
        }

        // Bags only — never driven by chunk icon knobs.
        if (bagPreviewDirty)
        {
            Rebuild(_level);
            cm.RefreshDroppedCommandBagPreviews();
        }
        else
        {
            // Chunk knobs are independent of each other and of Command Bags.
            if (chunkBlueDirty)
                RebuildChunkCardsOnly();
            if (chunkYellowDirty)
                cm.RefreshDroppedChunkPreviewsOnly();
            if (chunkPeekDirty)
                cm.RefreshOpenChunkPeekPanel();
        }
    }

    void SnapshotLiveKnobs()
    {
        if (characterMove == null) return;
        _liveStartScale = characterMove.bagRepeatStartScale;
        _liveEndScale = characterMove.bagRepeatEndScale;
        _liveCounterScale = characterMove.bagRepeatCounterScale;
        _liveCounterAy = characterMove.bagRepeatCounterAnchorY;
        _liveCounterX = characterMove.bagRepeatCounterXOffset;
        _liveCounterY = characterMove.bagRepeatCounterYOffset;
        _liveChunkIconBlue = characterMove.chunkIconSizeBluePanel;
        _liveChunkIconYellow = characterMove.chunkIconSizeYellowStrip;
        _liveChunkIconPeek = characterMove.chunkIconSizePeekPanel;
        _liveChunkRectW = characterMove.chunkRectWidthYellowStrip;
        _liveChunkRectH = characterMove.chunkRectHeightYellowStrip;
        _liveChunkRectBlueH = characterMove.chunkRectHeightBluePanel;
        _liveChunkRectBlueW = characterMove.chunkRectMinWidthBluePanel;
        _liveChunkPeekW = characterMove.chunkPeekPanelMinWidth;
        _liveChunkPeekH = characterMove.chunkPeekPanelMinHeight;
        _livePanelLeft = panelAnchorLeft;
        _livePanelRight = panelAnchorRight;
        _livePanelBottom = panelAnchorBottom;
        _livePanelTop = panelAnchorTop;
        _liveAutoLayout = characterMove.autoLayoutCommandBagPanel;
    }

    /// <summary>
    /// Rebuild only Action Chunk source cards — Command Bag cards stay untouched.
    /// </summary>
    void RebuildChunkCardsOnly()
    {
        if (_level == null || _contentRoot == null) return;

        for (int i = _spawned.Count - 1; i >= 0; i--)
        {
            var go = _spawned[i];
            if (go == null)
            {
                _spawned.RemoveAt(i);
                continue;
            }
            string n = go.name ?? "";
            if (!n.StartsWith("Chunk_", System.StringComparison.Ordinal)) continue;
            UnityEngine.Object.Destroy(go);
            _spawned.RemoveAt(i);
        }

        string mode = (_level.commandBagMode ?? "BAG").Trim().ToUpperInvariant();
        if (mode == "CHUNK")
        {
            int index = 0;
            if (_level.commandBags != null)
            {
                for (int b = 0; b < _level.commandBags.Count; b++)
                {
                    var bag = _level.commandBags[b];
                    if (bag?.chunks == null) continue;
                    for (int c = 0; c < bag.chunks.Count; c++)
                    {
                        index++;
                        SpawnChunkCard(bag, bag.chunks[c], index);
                    }
                }
            }
        }
        else if (mode == "MIXED" && !string.IsNullOrEmpty(_openBagId))
        {
            SpawnOpenBagChunks(_openBagId);
        }

        Canvas.ForceUpdateCanvases();
        if (_contentRoot != null)
            LayoutRebuilder.ForceRebuildLayoutImmediate(_contentRoot);
        FitPanelToBagCount();
    }

    void EnsureScrollList()
    {
        if (paletteParent == null) return;

        Transform existing = paletteParent.Find("CommandBagList");
        if (existing != null)
        {
            var sr = existing.GetComponent<ScrollRect>();
            if (sr != null && sr.content != null)
            {
                _listRoot = existing as RectTransform;
                _contentRoot = sr.content;
                MakeScrollChromeTransparent(_listRoot, sr);
                FitListRoot();
                _listRoot.gameObject.SetActive(true);
                return;
            }
            DestroyImmediate(existing.gameObject);
        }

        var rootGo = new GameObject("CommandBagList", typeof(RectTransform), typeof(Image), typeof(ScrollRect));
        rootGo.transform.SetParent(paletteParent, false);
        _listRoot = rootGo.GetComponent<RectTransform>();
        var rootImg = rootGo.GetComponent<Image>();
        // Transparent — blue panel must stay visible behind cards.
        CommandBagUiHelper.MakeTransparent(rootImg, keepRaycast: true);

        var viewportGo = new GameObject("Viewport", typeof(RectTransform), typeof(RectMask2D), typeof(Image));
        viewportGo.transform.SetParent(_listRoot, false);
        var vpRt = viewportGo.GetComponent<RectTransform>();
        vpRt.anchorMin = Vector2.zero;
        vpRt.anchorMax = Vector2.one;
        vpRt.offsetMin = new Vector2(8f, 8f);
        vpRt.offsetMax = new Vector2(-8f, -8f);
        var vpImg = viewportGo.GetComponent<Image>();
        // Mask needs an Image, but it must not paint white over the blue panel.
        CommandBagUiHelper.MakeTransparent(vpImg, keepRaycast: true);

        var contentGo = new GameObject(
            "Content",
            typeof(RectTransform),
            typeof(VerticalLayoutGroup),
            typeof(ContentSizeFitter));
        contentGo.transform.SetParent(viewportGo.transform, false);
        _contentRoot = contentGo.GetComponent<RectTransform>();
        _contentRoot.anchorMin = new Vector2(0f, 1f);
        _contentRoot.anchorMax = new Vector2(1f, 1f);
        _contentRoot.pivot = new Vector2(0.5f, 1f);
        _contentRoot.anchoredPosition = Vector2.zero;
        _contentRoot.sizeDelta = new Vector2(0f, 0f);

        var vlg = contentGo.GetComponent<VerticalLayoutGroup>();
        vlg.padding = new RectOffset(12, 12, 12, 12);
        vlg.spacing = CommandBagUiHelper.SourceCardSpacing;
        vlg.childAlignment = TextAnchor.UpperCenter;
        vlg.childControlWidth = true;
        vlg.childControlHeight = true;
        vlg.childForceExpandWidth = true;
        vlg.childForceExpandHeight = false;

        var fitter = contentGo.GetComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        var scrollRect = rootGo.GetComponent<ScrollRect>();
        scrollRect.viewport = vpRt;
        scrollRect.content = _contentRoot;
        scrollRect.horizontal = false;
        scrollRect.vertical = true;
        scrollRect.movementType = ScrollRect.MovementType.Clamped;
        scrollRect.scrollSensitivity = 35f;

        FitListRoot();
    }

    static void MakeScrollChromeTransparent(RectTransform listRoot, ScrollRect sr)
    {
        if (listRoot == null) return;
        var rootImg = listRoot.GetComponent<Image>();
        CommandBagUiHelper.MakeTransparent(rootImg, keepRaycast: true);
        if (sr != null && sr.viewport != null)
        {
            var vpImg = sr.viewport.GetComponent<Image>();
            CommandBagUiHelper.MakeTransparent(vpImg, keepRaycast: true);
        }
    }

    void FitListRoot()
    {
        if (_listRoot == null) return;
        _listRoot.anchorMin = Vector2.zero;
        _listRoot.anchorMax = Vector2.one;
        _listRoot.offsetMin = new Vector2(4f, 4f);
        _listRoot.offsetMax = new Vector2(-4f, -4f);
        _listRoot.localScale = Vector3.one;
    }

    void SpawnHeader(string title)
    {
        var header = new GameObject("BagHeader", typeof(RectTransform), typeof(HorizontalLayoutGroup), typeof(LayoutElement));
        header.transform.SetParent(_contentRoot, false);
        var le = header.GetComponent<LayoutElement>();
        le.preferredHeight = 34f;
        le.minHeight = 34f;

        var hlg = header.GetComponent<HorizontalLayoutGroup>();
        hlg.spacing = 8f;
        hlg.childAlignment = TextAnchor.MiddleLeft;
        hlg.padding = new RectOffset(2, 2, 0, 0);
        hlg.childForceExpandWidth = false;

        var iconGo = new GameObject("BagIcon", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        iconGo.transform.SetParent(header.transform, false);
        var iconImg = iconGo.GetComponent<Image>();
        iconImg.raycastTarget = false;
        if (characterMove != null && characterMove.commandBagIconSprite != null)
        {
            iconImg.sprite = characterMove.commandBagIconSprite;
            iconImg.color = Color.white;
            iconImg.preserveAspect = true;
        }
        else
        {
            iconImg.color = PanelBlueDark;
        }
        var ile = iconGo.GetComponent<LayoutElement>();
        ile.preferredWidth = 26f;
        ile.preferredHeight = 26f;

        var tmp = CommandBagUiHelper.AddLabel(header.transform, title, 17f, new Color(0.1f, 0.15f, 0.32f));
        tmp.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1f;
        _spawned.Add(header);
    }

    void SpawnBagCard(CommandBagData bag, int index)
    {
        if (bag == null || _contentRoot == null) return;
        Color pastel = CommandBagUiHelper.SoftPastel(bag.color, index);
        Color border = CommandBagUiHelper.BorderFromPastel(pastel);
        var tokens = CommandBagUiHelper.FlattenBagTokens(bag);
        string title = string.IsNullOrWhiteSpace(bag.name) ? $"Command Bag {index + 1}" : bag.name;

        float cardH = CommandBagUiHelper.PreferredSourceCardHeight(tokens, characterMove);
        var go = CreateBaseCard($"Bag_{bag.id}", cardH, pastel, border);
        go.transform.SetParent(_contentRoot, false);

        var body = EnsureCardBody(go.transform);
        Sprite bagSprite = characterMove != null ? characterMove.commandBagIconSprite : null;
        Sprite handleSprite = characterMove != null ? characterMove.commandBagDragHandleSprite : null;
        CommandBagUiHelper.PopulateSourceCardContent(
            body, characterMove, title, tokens, bagSprite, handleSprite, PanelBlueDark, pastel);

        // Re-measure after layout so Repeat scale / fitted icons size the card tightly.
        float finalH = CommandBagUiHelper.PreferredSourceCardHeight(
            tokens, characterMove, EstimateCardBodyWidth(body));
        ApplyCardHeight(go, finalH);

        if (!string.IsNullOrEmpty(bag.icon))
            StartCoroutine(LoadBagImage(go.transform, bag.icon));

        var drag = go.AddComponent<DraggableCommandBagBlock>();
        drag.dragKind = DraggableCommandBagBlock.DragKind.Bag;
        drag.bagId = bag.id;
        drag.displayName = title;
        drag.accentColor = pastel;
        drag.characterMove = characterMove;
        _spawned.Add(go);
    }

    void SpawnOpenBagChunks(string bagId)
    {
        var bag = CommandBagUtil.FindBag(_level, bagId);
        if (bag?.chunks == null) return;
        for (int i = 0; i < bag.chunks.Count; i++)
            SpawnChunkCard(bag, bag.chunks[i], i + 1);
    }

    void SpawnChunkCard(CommandBagData bag, CommandChunkData chunk, int displayIndex)
    {
        if (chunk == null || _contentRoot == null) return;
        // Prefer teacher-assigned chunk.color from platform; else palette by index.
        Color chunkAccent = CommandBagUiHelper.ResolveChunkIdentityColor(chunk, displayIndex);
        Color pastel = CommandBagUiHelper.ChunkCardFillFromAccent(chunkAccent);
        Color border = CommandBagUiHelper.ChunkCardBorderFromAccent(chunkAccent);
        string title = string.IsNullOrWhiteSpace(chunk.name) ? $"Chunk {displayIndex}" : chunk.name;

        var tokens = chunk.tokens ?? new List<string>();
        float cardH = CommandBagUiHelper.PreferredSourceChunkCardHeight(tokens, characterMove);
        var go = CreateBaseCard($"Chunk_{chunk.id}", cardH, pastel, border);
        go.transform.SetParent(_contentRoot, false);

        float minW = CommandBagUiHelper.ChunkRectMinWidthBlue(characterMove);
        var cardLe = go.GetComponent<LayoutElement>();
        if (cardLe != null)
        {
            cardLe.minWidth = minW;
            cardLe.preferredWidth = minW;
        }

        Sprite chunkIcon = CommandBagUiHelper.ResolveChunkIconSprite(characterMove);
        Sprite handleSprite = characterMove != null ? characterMove.commandBagDragHandleSprite : null;

        var body = EnsureCardBody(go.transform);
        CommandBagUiHelper.PopulateSourceChunkCardContent(
            body, characterMove, title, displayIndex, chunkAccent, tokens, chunkIcon, handleSprite);

        float available = EstimateCardBodyWidth(body);
        ApplyCardHeight(go, CommandBagUiHelper.PreferredSourceChunkCardHeight(tokens, characterMove, available), enforceMin: false);

        var drag = go.AddComponent<DraggableCommandBagBlock>();
        drag.dragKind = DraggableCommandBagBlock.DragKind.Chunk;
        drag.bagId = bag != null ? bag.id : null;
        drag.chunkId = chunk.id;
        drag.displayName = title;
        drag.accentColor = chunkAccent;
        drag.iconSprite = chunkIcon;
        drag.iconUrl = null;
        drag.characterMove = characterMove;
        _spawned.Add(go);
    }

    static float EstimateCardBodyWidth(Transform body)
    {
        if (body is RectTransform bodyRt && bodyRt.rect.width > 40f)
            return Mathf.Max(120f, bodyRt.rect.width - 4f);
        return 280f;
    }

    static void ApplyCardHeight(GameObject card, float height, bool enforceMin = true)
    {
        if (card == null) return;
        if (enforceMin)
            height = Mathf.Max(CommandBagUiHelper.SourceCardMinHeight, height);
        var le = card.GetComponent<LayoutElement>();
        if (le != null)
        {
            le.preferredHeight = height;
            le.minHeight = height;
            le.flexibleHeight = 0f;
        }
        var rt = card.GetComponent<RectTransform>();
        if (rt != null)
            rt.SetSizeWithCurrentAnchors(RectTransform.Axis.Vertical, height);
    }

    GameObject CreateBaseCard(string name, float height, Color fill, Color border)
    {
        var go = new GameObject(
            name,
            typeof(RectTransform),
            typeof(Image),
            typeof(LayoutElement),
            typeof(Outline),
            typeof(CanvasGroup),
            typeof(VerticalLayoutGroup));
        var img = go.GetComponent<Image>();
        img.color = fill;
        img.raycastTarget = true;

        var outline = go.GetComponent<Outline>();
        // 1–2px feel — colored border, not heavy black.
        outline.effectColor = new Color(border.r, border.g, border.b, 0.65f);
        outline.effectDistance = new Vector2(1.25f, -1.25f);

        var shadow = go.GetComponent<Shadow>();
        if (shadow == null) shadow = go.AddComponent<Shadow>();
        shadow.effectColor = new Color(0f, 0f, 0f, 0.12f);
        shadow.effectDistance = new Vector2(2f, -2f);
        shadow.useGraphicAlpha = true;

        height = Mathf.Max(CommandBagUiHelper.SourceCardMinHeight, height);
        var le = go.GetComponent<LayoutElement>();
        le.preferredHeight = height;
        le.minHeight = height;
        le.flexibleWidth = 1f;
        le.flexibleHeight = 0f;
        le.minWidth = 100f;
        le.preferredWidth = -1f;

        // Card itself stacks title + preview tightly (no stretch filler).
        var vlg = go.GetComponent<VerticalLayoutGroup>();
        float pad = CommandBagUiHelper.SourceInnerPad;
        vlg.padding = new RectOffset((int)pad, (int)pad, (int)pad, (int)pad);
        vlg.spacing = CommandBagUiHelper.SourceBodySpacing;
        vlg.childAlignment = TextAnchor.UpperLeft;
        vlg.childControlWidth = true;
        vlg.childControlHeight = true;
        vlg.childForceExpandWidth = true;
        vlg.childForceExpandHeight = false;

        var cg = go.GetComponent<CanvasGroup>();
        cg.blocksRaycasts = true;
        cg.interactable = true;
        return go;
    }

    /// <summary>
    /// Body is a pass-through parent under the card VLG so existing populate paths keep working.
    /// </summary>
    static Transform EnsureCardBody(Transform card)
    {
        var body = new GameObject(
            "Body",
            typeof(RectTransform),
            typeof(VerticalLayoutGroup),
            typeof(LayoutElement));
        body.transform.SetParent(card, false);

        var le = body.GetComponent<LayoutElement>();
        le.flexibleWidth = 1f;
        le.flexibleHeight = 0f;
        le.minHeight = 0f;

        var vlg = body.GetComponent<VerticalLayoutGroup>();
        vlg.padding = new RectOffset(0, 0, 0, 0);
        vlg.spacing = CommandBagUiHelper.SourceBodySpacing;
        vlg.childAlignment = TextAnchor.UpperLeft;
        vlg.childControlWidth = true;
        vlg.childControlHeight = true;
        vlg.childForceExpandWidth = true;
        vlg.childForceExpandHeight = false;
        return body.transform;
    }

    void AddTitleRow(Transform body, string title, bool showBagIcon)
    {
        var row = new GameObject("TitleRow", typeof(RectTransform), typeof(HorizontalLayoutGroup), typeof(LayoutElement));
        row.transform.SetParent(body, false);
        row.GetComponent<LayoutElement>().preferredHeight = 24f;
        row.GetComponent<LayoutElement>().minHeight = 24f;

        var hlg = row.GetComponent<HorizontalLayoutGroup>();
        hlg.spacing = 6f;
        hlg.childAlignment = TextAnchor.MiddleLeft;
        hlg.childForceExpandWidth = false;
        hlg.childControlWidth = false;

        if (showBagIcon)
        {
            var badge = new GameObject("Icon", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
            badge.transform.SetParent(row.transform, false);
            var bimg = badge.GetComponent<Image>();
            bimg.raycastTarget = false;
            if (characterMove != null && characterMove.commandBagIconSprite != null)
            {
                bimg.sprite = characterMove.commandBagIconSprite;
                bimg.color = Color.white;
                bimg.preserveAspect = true;
            }
            else
            {
                bimg.color = PanelBlueDark;
            }
            var ble = badge.GetComponent<LayoutElement>();
            ble.preferredWidth = 20f;
            ble.preferredHeight = 20f;
        }

        var tmp = CommandBagUiHelper.AddLabel(row.transform, title, 14f, new Color(0.12f, 0.16f, 0.28f));
        tmp.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1f;
    }

    System.Collections.IEnumerator LoadChunkBadgeImage(Transform card, string url, int number, Color accent)
    {
        if (string.IsNullOrEmpty(url) || card == null) yield break;
        string resolved = ResolvePlatformUrl(url.Trim());
        if (string.IsNullOrEmpty(resolved)) yield break;

        using (var req = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(resolved))
        {
            yield return req.SendWebRequest();
            if (req.result != UnityEngine.Networking.UnityWebRequest.Result.Success) yield break;
            var tex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(req);
            if (tex == null || card == null) yield break;

            Sprite spr = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);

            Transform puzzle = card.Find("Body/ChunkRow/Puzzle");
            if (puzzle == null)
                puzzle = card.Find("Body/TitleRow/Puzzle");
            if (puzzle != null)
                CommandBagUiHelper.ApplyPuzzleBadgeIcon(puzzle, spr, accent, number);

            var drag = card.GetComponent<DraggableCommandBagBlock>();
            if (drag != null)
            {
                drag.iconSprite = spr;
                drag.iconUrl = url;
            }

            if (characterMove != null)
                characterMove.CachePlatformIconSprite(url, spr);
        }
    }

    void AddPreviewRow(Transform body, IList<string> tokens, float iconSize)
    {
        var wrap = new GameObject("PreviewWrap", typeof(RectTransform), typeof(LayoutElement));
        wrap.transform.SetParent(body, false);
        var wle = wrap.GetComponent<LayoutElement>();
        wle.preferredHeight = iconSize + 18f;
        wle.minHeight = iconSize + 18f;
        wle.flexibleWidth = 1f;
        wle.flexibleHeight = 0f;

        var previewRt = CommandBagUiHelper.BuildIconPreviewRow(
            wrap.transform, characterMove, tokens, iconSize: iconSize, spacing: 4f,
            maxIcons: CommandBagUiHelper.MaxPreviewTokens);
        previewRt.anchorMin = Vector2.zero;
        previewRt.anchorMax = Vector2.one;
        previewRt.offsetMin = Vector2.zero;
        previewRt.offsetMax = Vector2.zero;

        // Preview icons are display-only — never receive drags.
        var images = previewRt.GetComponentsInChildren<Image>(true);
        for (int i = 0; i < images.Length; i++)
            images[i].raycastTarget = false;
    }

    System.Collections.IEnumerator LoadBagImage(Transform card, string url)
    {
        if (string.IsNullOrEmpty(url) || card == null) yield break;
        string resolved = ResolvePlatformUrl(url.Trim());
        if (string.IsNullOrEmpty(resolved)) yield break;

        using (var req = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(resolved))
        {
            yield return req.SendWebRequest();
            if (req.result != UnityEngine.Networking.UnityWebRequest.Result.Success) yield break;
            var tex = UnityEngine.Networking.DownloadHandlerTexture.GetContent(req);
            if (tex == null || card == null) yield break;

            Sprite spr = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);

            if (characterMove != null)
                characterMove.CachePlatformIconSprite(url, spr);

            // Prefer replacing the dedicated BagIcon Image on the card.
            Transform iconTf = card.Find("Body/TitleRow/BagIcon");
            if (iconTf != null)
            {
                var iconImg = iconTf.GetComponent<Image>();
                if (iconImg != null)
                {
                    iconImg.sprite = spr;
                    iconImg.color = Color.white;
                    iconImg.preserveAspect = true;
                    yield break;
                }
            }
        }
    }

    static string ResolvePlatformUrl(string path)
    {
        if (string.IsNullOrEmpty(path)) return path;
        if (path.StartsWith("http://", System.StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("https://", System.StringComparison.OrdinalIgnoreCase))
            return path;

        string baseUrl = PlatformCommunication.Instance != null
            ? PlatformCommunication.Instance.PlatformUrl.TrimEnd('/')
            : "";
        return string.IsNullOrEmpty(baseUrl) ? path : baseUrl + (path.StartsWith("/") ? path : "/" + path);
    }

    string GetBagCanvasPath()
    {
        if (paletteParent == null) return "(null)";
        return paletteParent.parent != null
            ? paletteParent.parent.name + "/" + paletteParent.name
            : paletteParent.name;
    }
}
