using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Networking;
using TMPro;

/// <summary>
/// White-board content for Canvas layout levels: prompt, image, audio, pattern preview, example chunk.
/// Auto-builds under the overlay canvas when references are empty.
/// </summary>
public class CanvasLessonPanel : MonoBehaviour
{
    [Header("Optional — auto-created when empty")]
    public RectTransform panelRoot;
    public TextMeshProUGUI promptText;
    public Image lessonImage;
    public Button playAudioButton;
    public TextMeshProUGUI playAudioButtonLabel;
    public RectTransform patternRow;
    public RectTransform exampleChunkRow;
    public TextMeshProUGUI exampleChunkLabel;
    public AudioSource lessonAudioSource;

    [Header("Pattern / chunk icons (from CharacterMove)")]
    public Sprite forwardSprite;
    public Sprite backwardSprite;
    public Sprite turnLeftSprite;
    public Sprite turnRightSprite;
    public Sprite repeatSprite;
    public Sprite blankSprite;

    [Header("Blank line (same as yellow-strip blank slots)")]
    public Sprite blankLineSprite;
    public bool useBlankLineStyle = true;
    public float blankLineWidth = 52f;
    public float blankLineHeight = 7f;
    public Color blankLineColor = new Color(0.42f, 0.42f, 0.48f, 0.9f);

    private bool _built;
    private Coroutine _imageLoadRoutine;
    private Coroutine _audioLoadRoutine;
    private string _loadingImageUrl;
    private string _loadingAudioUrl;
    private CanvasLessonData _current;
    private RectTransform _chunkCardRoot;
    private RectTransform _patternShelf;
    private TextMeshProUGUI _patternLabel;
    private Coroutine _blinkRoutine;
    private readonly List<CanvasGroup> _blinkTargets = new List<CanvasGroup>();
    private readonly List<RectTransform> _pulseTargets = new List<RectTransform>();
    private readonly List<Image> _pulseBorderImages = new List<Image>();
    private static Sprite _roundedSprite;
    private static readonly Dictionary<string, Sprite> UrlSpriteCache = new Dictionary<string, Sprite>();
    private static readonly Dictionary<string, AudioClip> UrlAudioClipCache = new Dictionary<string, AudioClip>();

    private RectTransform _alignWith;

    public void EnsureBuilt(Canvas preferredHost = null)
    {
        Canvas canvas = preferredHost != null ? preferredHost.rootCanvas : FindOverlayCanvas();
        if (canvas == null)
        {
            Debug.LogWarning("[CanvasLessonPanel] No canvas found — panel not created.");
            return;
        }

        if (panelRoot == null)
            BuildPanel(canvas.transform);
        else if (panelRoot.parent != canvas.transform)
            panelRoot.SetParent(canvas.transform, false);

        _built = panelRoot != null;
    }

    public void Show(CanvasLessonData lesson, RectTransform alignWith = null)
    {
        _alignWith = alignWith;
        Canvas host = alignWith != null ? alignWith.GetComponentInParent<Canvas>() : null;
        EnsureBuilt(host);
        if (panelRoot == null) return;

        _current = lesson;
        bool hasContent = lesson != null && HasAnyContent(lesson);
        panelRoot.gameObject.SetActive(hasContent);
        EnsureBehindGameplayChrome();
        if (!hasContent)
        {
            StopAudio();
            return;
        }

        if (promptText != null)
        {
            promptText.text = lesson.prompt ?? "";
            promptText.gameObject.SetActive(!string.IsNullOrWhiteSpace(lesson.prompt));
        }

        ApplyImage(lesson);
        ApplyAudio(lesson);
        bool hasChunk = lesson.exampleChunk != null && lesson.exampleChunk.Count > 0;
        if (_chunkCardRoot != null)
            _chunkCardRoot.gameObject.SetActive(hasChunk);
        if (exampleChunkLabel != null)
        {
            string chunkText = ResolveSectionLabel(lesson.chunkLabel, "CHUNK");
            bool showChunkLabel = hasChunk && !string.IsNullOrEmpty(chunkText);
            exampleChunkLabel.gameObject.SetActive(showChunkLabel);
            if (showChunkLabel) exampleChunkLabel.text = chunkText;
        }
        PopulateTokenRow(exampleChunkRow, lesson.exampleChunk, 56f, null, null);

        bool hasPattern = lesson.patternPreview != null && lesson.patternPreview.Count > 0;
        EnsurePatternShelf();
        if (_patternShelf != null)
            _patternShelf.gameObject.SetActive(hasPattern);
        if (_patternLabel != null)
        {
            // Default: hide "PATTERN" — only show when teacher sets a non-empty label.
            string patternText = ResolveSectionLabel(lesson.patternLabel, null);
            bool showPatternLabel = hasPattern && !string.IsNullOrEmpty(patternText);
            _patternLabel.gameObject.SetActive(showPatternLabel);
            if (showPatternLabel) _patternLabel.text = patternText;
        }

        var emphasis = lesson.patternEmphasis ?? new CanvasPatternEmphasisData();
        float cardW = ResolveLessonCardWidth();
        float shelfW = Mathf.Max(640f, cardW - 96f);
        float rowAvail = Mathf.Max(520f, shelfW - 72f);

        float basePx = ResolvePatternTokenPx(emphasis.scale);
        var highlightUnit = ResolveEmphasisHighlightChunk(emphasis, lesson.exampleChunk);
        var highlighted = ResolveHighlightedPatternIndices(lesson.patternPreview, highlightUnit, emphasis);
        float patternPx = FitPatternTokenPx(lesson.patternPreview, basePx, rowAvail, emphasis, highlighted);
        StopBlink();
        PopulateTokenRow(patternRow, lesson.patternPreview, patternPx, highlighted, emphasis);

        if (patternRow != null)
        {
            var rowLe = patternRow.GetComponent<LayoutElement>();
            if (rowLe != null)
            {
                rowLe.minHeight = Mathf.Max(56f, patternPx * (emphasis.bigger && highlighted.Count > 0 ? 1.45f : 1.15f));
                rowLe.preferredWidth = -1f;
                rowLe.flexibleWidth = 1f;
            }
            var hlg = patternRow.GetComponent<HorizontalLayoutGroup>();
            if (hlg != null)
            {
                hlg.spacing = Mathf.Clamp(patternPx * 0.12f, 6f, 10f);
                hlg.childAlignment = TextAnchor.MiddleCenter;
                hlg.padding = new RectOffset(2, 2, 2, 2);
                hlg.childForceExpandWidth = false;
            }
            var rowFitter = patternRow.GetComponent<ContentSizeFitter>();
            if (rowFitter != null)
            {
                // Prefer shrink-to-fit inside the shelf instead of growing the white card.
                rowFitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
                rowFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            }
        }

        if (_patternShelf != null)
        {
            EnsureShelfClip();
            var shelfLe = _patternShelf.GetComponent<LayoutElement>();
            if (shelfLe != null)
            {
                float h = Mathf.Max(132f, patternPx + 64f);
                shelfLe.minHeight = h;
                shelfLe.preferredHeight = h;
                shelfLe.minWidth = shelfW;
                shelfLe.preferredWidth = shelfW;
                shelfLe.flexibleWidth = 0f;
            }
        }

        if (panelRoot != null)
        {
            var panelLe = panelRoot.GetComponent<LayoutElement>();
            if (panelLe != null)
            {
                panelLe.minWidth = cardW;
                panelLe.preferredWidth = cardW;
                panelLe.flexibleWidth = 0f;
            }
            var fitter = panelRoot.GetComponent<ContentSizeFitter>();
            if (fitter != null)
            {
                fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
                fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            }
            panelRoot.SetSizeWithCurrentAnchors(RectTransform.Axis.Horizontal, cardW);

            if (promptText != null)
            {
                promptText.fontSize = 42f;
                var promptLe = promptText.GetComponent<LayoutElement>();
                if (promptLe != null) promptLe.preferredWidth = cardW - 100f;
            }
        }

        CenterLessonCard();
    }

    private void CenterLessonCard()
    {
        if (panelRoot == null) return;

        panelRoot.localScale = Vector3.one;
        panelRoot.localRotation = Quaternion.identity;
        panelRoot.pivot = new Vector2(0.5f, 0.5f);
        panelRoot.anchorMin = new Vector2(0.5f, 0.5f);
        panelRoot.anchorMax = new Vector2(0.5f, 0.5f);

        Vector2 pos = new Vector2(0f, 48f);
        RectTransform parentRt = panelRoot.parent as RectTransform;
        RectTransform strip = _alignWith;

        if (parentRt != null && strip != null)
        {
            Canvas canvas = panelRoot.GetComponentInParent<Canvas>();
            Camera cam = canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay
                ? canvas.worldCamera
                : null;

            Vector3 stripCenterWorld = strip.TransformPoint(strip.rect.center);
            Vector2 stripScreen = RectTransformUtility.WorldToScreenPoint(cam, stripCenterWorld);
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(parentRt, stripScreen, cam, out Vector2 stripLocal))
                pos.x = stripLocal.x;

            Vector3 stripTopWorld = strip.TransformPoint(new Vector3(strip.rect.center.x, strip.rect.yMax, 0f));
            Vector2 stripTopScreen = RectTransformUtility.WorldToScreenPoint(cam, stripTopWorld);
            if (RectTransformUtility.ScreenPointToLocalPointInRectangle(parentRt, stripTopScreen, cam, out Vector2 stripTopLocal))
            {
                float playfieldTop = parentRt.rect.yMax;
                pos.y = (playfieldTop + stripTopLocal.y) * 0.5f;
            }
        }

        panelRoot.anchoredPosition = pos;
    }

    private float ResolveLessonCardWidth()
    {
        const float preferred = 1120f;
        float maxW = preferred;
        RectTransform parentRt = panelRoot != null ? panelRoot.parent as RectTransform : null;
        if (parentRt != null && parentRt.rect.width > 80f)
            maxW = Mathf.Min(maxW, Mathf.Max(760f, parentRt.rect.width * 0.82f));
        if (_alignWith != null && _alignWith.rect.width > 80f)
            maxW = Mathf.Min(maxW, Mathf.Max(780f, _alignWith.rect.width * 0.98f));
        // Hard cap against the real pixel viewport so the board never spills past the screen.
        float screenCap = Mathf.Max(640f, Screen.width * 0.88f);
        maxW = Mathf.Min(maxW, screenCap);
        return Mathf.Clamp(maxW, 720f, 1280f);
    }

    /// <summary>
    /// Shrink icon size until the whole pattern (highlight capsules + blank lines) fits the shelf.
    /// </summary>
    private float FitPatternTokenPx(
        List<string> tokens,
        float desiredPx,
        float maxRowWidth,
        CanvasPatternEmphasisData emphasis,
        HashSet<int> highlighted)
    {
        if (tokens == null || tokens.Count == 0) return desiredPx;
        float lo = 34f;
        float hi = desiredPx;
        float best = lo;
        for (int i = 0; i < 14; i++)
        {
            float mid = (lo + hi) * 0.5f;
            float width = MeasurePatternRowWidth(tokens, mid, emphasis, highlighted);
            if (width <= maxRowWidth)
            {
                best = mid;
                lo = mid;
            }
            else
            {
                hi = mid;
            }
        }
        return Mathf.Clamp(best, 34f, desiredPx);
    }

    private float MeasurePatternRowWidth(
        List<string> tokens,
        float tokenPx,
        CanvasPatternEmphasisData emphasis,
        HashSet<int> highlighted)
    {
        bool applyEmphasis = highlighted != null && emphasis != null && highlighted.Count > 0;
        float hotPx = applyEmphasis && emphasis.bigger ? tokenPx * 1.22f : tokenPx;
        float rowSpacing = Mathf.Clamp(tokenPx * 0.12f, 6f, 10f);
        float total = 4f; // row padding
        int pieces = 0;
        int i = 0;
        while (i < tokens.Count)
        {
            if (string.IsNullOrWhiteSpace(tokens[i]))
            {
                i++;
                continue;
            }

            bool hot = applyEmphasis && highlighted.Contains(i);
            if (!hot)
            {
                total += TokenSlotWidth(tokens[i], tokenPx);
                pieces++;
                i++;
                continue;
            }

            int end = i + 1;
            while (end < tokens.Count && highlighted.Contains(end))
                end++;

            float unit = 28f; // highlight horizontal padding
            int visible = 0;
            for (int k = i; k < end; k++)
            {
                if (string.IsNullOrWhiteSpace(tokens[k])) continue;
                if (visible > 0) unit += 6f;
                unit += TokenSlotWidth(tokens[k], hotPx);
                visible++;
            }
            total += Mathf.Max(unit, hotPx + 28f);
            pieces++;
            i = end;
        }

        if (pieces > 1)
            total += (pieces - 1) * rowSpacing;
        return total;
    }

    private float TokenSlotWidth(string raw, float tokenPx)
    {
        if (NormalizePatternToken(raw) == "blank")
            return BlankSlotWidth(tokenPx);
        return tokenPx;
    }

    private float BlankSlotWidth(float tokenPx)
    {
        if (blankLineSprite != null)
            return Mathf.Max(blankLineWidth, tokenPx * 0.9f);
        if (useBlankLineStyle)
            return Mathf.Clamp(blankLineWidth, 36f, Mathf.Max(48f, tokenPx * 1.05f));
        return Mathf.Max(tokenPx * 1.05f, 48f);
    }

    /// <summary>
    /// Null/omitted → <paramref name="fallbackWhenOmitted"/> (null = hide).
    /// Empty/whitespace → hide. Otherwise trimmed custom text.
    /// </summary>
    private static string ResolveSectionLabel(string configured, string fallbackWhenOmitted)
    {
        if (configured == null) return fallbackWhenOmitted;
        string t = configured.Trim();
        return t.Length > 0 ? t : null;
    }

    public void Hide()
    {
        StopAudio();
        StopBlink();
        if (_imageLoadRoutine != null)
        {
            StopCoroutine(_imageLoadRoutine);
            _imageLoadRoutine = null;
        }
        if (panelRoot != null)
            panelRoot.gameObject.SetActive(false);
        _current = null;
    }

    public void BindActionSprites(Sprite forward, Sprite backward, Sprite left, Sprite right, Sprite repeat, Sprite blank)
    {
        forwardSprite = forward;
        backwardSprite = backward;
        turnLeftSprite = left;
        turnRightSprite = right;
        repeatSprite = repeat;
        blankSprite = blank;
    }

    public void BindBlankLineStyle(Sprite lineSprite, bool useLine, float width, float height, Color color)
    {
        blankLineSprite = lineSprite;
        useBlankLineStyle = useLine;
        blankLineWidth = Mathf.Clamp(width, 24f, 120f);
        blankLineHeight = Mathf.Clamp(height, 3f, 24f);
        blankLineColor = color;
    }

    /// <summary>
    /// Keep the lesson card under RUN / strip / result popups on the overlay canvas.
    /// </summary>
    public void EnsureBehindGameplayChrome()
    {
        if (panelRoot == null) return;
        // Remove accidental override canvas from older builds so sorting matches siblings.
        var panelCanvas = panelRoot.GetComponent<Canvas>();
        if (panelCanvas != null && panelRoot.GetComponent<GraphicRaycaster>() == null)
            Destroy(panelCanvas);
        panelRoot.SetAsFirstSibling();
    }

    private static bool HasAnyContent(CanvasLessonData lesson)
    {
        if (!string.IsNullOrWhiteSpace(lesson.prompt)) return true;
        if (!string.IsNullOrWhiteSpace(lesson.imageUrl)) return true;
        if (!string.IsNullOrWhiteSpace(lesson.audioUrl)) return true;
        if (lesson.patternPreview != null && lesson.patternPreview.Count > 0) return true;
        if (lesson.exampleChunk != null && lesson.exampleChunk.Count > 0) return true;
        return false;
    }

    private void BuildPanel(Transform canvasParent)
    {
        var rootGo = new GameObject("CanvasLessonPanel", typeof(RectTransform), typeof(Image), typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
        rootGo.transform.SetParent(canvasParent, false);
        panelRoot = rootGo.GetComponent<RectTransform>();
        // Center of the playfield; Show() realigns to the yellow strip.
        panelRoot.anchorMin = new Vector2(0.5f, 0.5f);
        panelRoot.anchorMax = new Vector2(0.5f, 0.5f);
        panelRoot.pivot = new Vector2(0.5f, 0.5f);
        panelRoot.sizeDelta = new Vector2(1120f, 420f);
        panelRoot.anchoredPosition = new Vector2(0f, 48f);

        var bg = rootGo.GetComponent<Image>();
        bg.sprite = GetRoundedSprite();
        bg.type = Image.Type.Sliced;
        bg.color = new Color(1f, 1f, 1f, 0.98f);
        bg.raycastTarget = false;

        // Behind palette / RUN / strip / result popups on the same overlay canvas.
        // (Green playfield is world geometry, so this stays visible above it.)
        rootGo.transform.SetAsFirstSibling();

        // Soft outline card feel
        var outline = rootGo.AddComponent<Outline>();
        outline.effectColor = new Color(0.78f, 0.82f, 0.92f, 0.9f);
        outline.effectDistance = new Vector2(3f, -3f);

        // Clip children to the rounded white board so icons never spill past the edge.
        rootGo.AddComponent<RectMask2D>();

        var vlg = rootGo.GetComponent<VerticalLayoutGroup>();
        vlg.padding = new RectOffset(48, 48, 40, 40);
        vlg.spacing = 24f;
        vlg.childAlignment = TextAnchor.UpperCenter;
        vlg.childControlHeight = true;
        vlg.childControlWidth = true;
        vlg.childForceExpandHeight = false;
        vlg.childForceExpandWidth = true;

        var fitter = rootGo.GetComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        var panelLe = rootGo.AddComponent<LayoutElement>();
        panelLe.minWidth = 1120f;
        panelLe.preferredWidth = 1120f;

        promptText = CreateTmp("Prompt", panelRoot, 42, FontStyles.Bold, new Color(0.12f, 0.14f, 0.22f));
        promptText.alignment = TextAlignmentOptions.Center;
        promptText.lineSpacing = -6f;
        var promptLe = promptText.GetComponent<LayoutElement>();
        if (promptLe != null) promptLe.preferredWidth = 1020f;

        var imgGo = new GameObject("LessonImage", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        imgGo.transform.SetParent(panelRoot, false);
        lessonImage = imgGo.GetComponent<Image>();
        lessonImage.preserveAspect = true;
        lessonImage.raycastTarget = false;
        var imgLe = imgGo.GetComponent<LayoutElement>();
        imgLe.preferredWidth = 420f;
        imgLe.preferredHeight = 200f;
        imgGo.SetActive(false);

        var listenGo = new GameObject("PlayAudio", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
        listenGo.transform.SetParent(panelRoot, false);
        playAudioButton = listenGo.GetComponent<Button>();
        var listenImg = listenGo.GetComponent<Image>();
        listenImg.color = new Color(0.28f, 0.48f, 0.95f, 1f);
        var listenLe = listenGo.GetComponent<LayoutElement>();
        listenLe.preferredHeight = 40f;
        listenLe.preferredWidth = 152f;
        playAudioButtonLabel = CreateTmp("Label", listenGo.transform, 17, FontStyles.Bold, Color.white);
        playAudioButtonLabel.text = "Listen";
        playAudioButtonLabel.alignment = TextAlignmentOptions.Center;
        playAudioButton.onClick.AddListener(PlayCurrentAudio);
        listenGo.SetActive(false);

        // Chunk card container
        var chunkCard = new GameObject("ChunkCard", typeof(RectTransform), typeof(Image), typeof(VerticalLayoutGroup), typeof(LayoutElement));
        chunkCard.transform.SetParent(panelRoot, false);
        var chunkBg = chunkCard.GetComponent<Image>();
        chunkBg.color = new Color(0.93f, 0.98f, 0.96f, 1f);
        chunkBg.raycastTarget = false;
        var chunkV = chunkCard.GetComponent<VerticalLayoutGroup>();
        chunkV.padding = new RectOffset(14, 14, 10, 12);
        chunkV.spacing = 6f;
        chunkV.childAlignment = TextAnchor.MiddleCenter;
        chunkV.childControlWidth = true;
        chunkV.childForceExpandWidth = true;
        exampleChunkLabel = CreateTmp("ChunkLabel", chunkCard.transform, 13, FontStyles.Bold, new Color(0.12f, 0.45f, 0.4f));
        exampleChunkLabel.text = "CHUNK";
        exampleChunkLabel.alignment = TextAlignmentOptions.Center;
        exampleChunkRow = CreateTokenRow("ExampleChunkRow", chunkCard.transform);
        chunkCard.SetActive(false);
        _chunkCardRoot = chunkCard.GetComponent<RectTransform>();

        var patternLabel = CreateTmp("PatternLabel", panelRoot, 13, FontStyles.Bold, new Color(0.42f, 0.32f, 0.72f));
        patternLabel.text = "PATTERN";
        patternLabel.alignment = TextAlignmentOptions.Center;
        patternLabel.gameObject.SetActive(false);
        _patternLabel = patternLabel;

        EnsurePatternShelf();

        lessonAudioSource = gameObject.GetComponent<AudioSource>();
        if (lessonAudioSource == null)
            lessonAudioSource = gameObject.AddComponent<AudioSource>();
        lessonAudioSource.playOnAwake = false;
        lessonAudioSource.spatialBlend = 0f;
    }

    private static RectTransform CreateTokenRow(string name, Transform parent)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(HorizontalLayoutGroup), typeof(ContentSizeFitter), typeof(LayoutElement));
        go.transform.SetParent(parent, false);
        var hlg = go.GetComponent<HorizontalLayoutGroup>();
        hlg.spacing = 8f;
        hlg.childAlignment = TextAnchor.MiddleCenter;
        hlg.childForceExpandWidth = false;
        hlg.childForceExpandHeight = false;
        var fitter = go.GetComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        var le = go.GetComponent<LayoutElement>();
        le.minHeight = 48f;
        go.SetActive(false);
        return go.GetComponent<RectTransform>();
    }

    /// <summary>
    /// Rounded plate behind the pattern icons so they don't float over the prompt.
    /// </summary>
    private void EnsurePatternShelf()
    {
        if (panelRoot == null) return;

        if (_patternShelf != null)
        {
            if (patternRow != null && patternRow.parent != _patternShelf)
                patternRow.SetParent(_patternShelf, false);
            EnsureShelfClip();
            return;
        }

        var shelfGo = new GameObject(
            "PatternShelf",
            typeof(RectTransform),
            typeof(Image),
            typeof(VerticalLayoutGroup),
            typeof(LayoutElement),
            typeof(RectMask2D));
        shelfGo.transform.SetParent(panelRoot, false);
        if (_patternLabel != null)
            shelfGo.transform.SetSiblingIndex(_patternLabel.transform.GetSiblingIndex() + 1);

        var border = shelfGo.GetComponent<Image>();
        border.sprite = GetRoundedSprite();
        border.type = Image.Type.Sliced;
        border.color = new Color(0.55f, 0.62f, 0.82f, 1f);
        border.raycastTarget = false;

        var fill = new GameObject("ShelfFill", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        fill.transform.SetParent(shelfGo.transform, false);
        var fillLe = fill.GetComponent<LayoutElement>();
        fillLe.ignoreLayout = true;
        var fillRt = fill.GetComponent<RectTransform>();
        fillRt.anchorMin = Vector2.zero;
        fillRt.anchorMax = Vector2.one;
        fillRt.offsetMin = new Vector2(3f, 3f);
        fillRt.offsetMax = new Vector2(-3f, -3f);
        var fillImg = fill.GetComponent<Image>();
        fillImg.sprite = GetRoundedSprite();
        fillImg.type = Image.Type.Sliced;
        fillImg.color = new Color(0.965f, 0.972f, 1f, 1f);
        fillImg.raycastTarget = false;
        fill.transform.SetAsFirstSibling();

        var vlg = shelfGo.GetComponent<VerticalLayoutGroup>();
        vlg.padding = new RectOffset(32, 32, 22, 22);
        vlg.spacing = 0f;
        vlg.childAlignment = TextAnchor.MiddleCenter;
        vlg.childControlWidth = true;
        vlg.childControlHeight = true;
        vlg.childForceExpandWidth = true;
        vlg.childForceExpandHeight = false;

        var le = shelfGo.GetComponent<LayoutElement>();
        le.minWidth = 1000f;
        le.preferredWidth = 1024f;
        le.minHeight = 132f;
        le.preferredHeight = 132f;
        le.flexibleWidth = 0f;

        _patternShelf = shelfGo.GetComponent<RectTransform>();

        if (patternRow == null)
            patternRow = CreateTokenRow("PatternPreviewRow", _patternShelf);
        else
            patternRow.SetParent(_patternShelf, false);
    }

    private void EnsureShelfClip()
    {
        if (_patternShelf == null) return;
        if (_patternShelf.GetComponent<RectMask2D>() == null)
            _patternShelf.gameObject.AddComponent<RectMask2D>();
        if (panelRoot != null && panelRoot.GetComponent<RectMask2D>() == null)
            panelRoot.gameObject.AddComponent<RectMask2D>();

        var bg = panelRoot != null ? panelRoot.GetComponent<Image>() : null;
        if (bg != null && bg.sprite == null)
        {
            bg.sprite = GetRoundedSprite();
            bg.type = Image.Type.Sliced;
        }
    }

    private static TextMeshProUGUI CreateTmp(string name, Transform parent, float size, FontStyles style, Color color)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI), typeof(LayoutElement));
        go.transform.SetParent(parent, false);
        var tmp = go.GetComponent<TextMeshProUGUI>();
        tmp.fontSize = size;
        tmp.fontStyle = style;
        tmp.color = color;
        tmp.enableWordWrapping = true;
        tmp.overflowMode = TextOverflowModes.Overflow;
        var le = go.GetComponent<LayoutElement>();
        le.flexibleWidth = 1f;
        return tmp;
    }

    private static readonly Color EmphasisCoral = new Color(0.886f, 0.294f, 0.227f, 1f);
    private static readonly Color EmphasisCream = new Color(1f, 0.969f, 0.941f, 1f);
    private static readonly Color EmphasisAmber = new Color(0.910f, 0.722f, 0.290f, 1f);
    private static readonly Color EmphasisAmberFill = new Color(1f, 0.976f, 0.929f, 1f);

    private void PopulateTokenRow(
        RectTransform row,
        List<string> tokens,
        float basePx,
        HashSet<int> highlighted,
        CanvasPatternEmphasisData emphasis)
    {
        if (row == null) return;
        for (int c = row.childCount - 1; c >= 0; c--)
            Destroy(row.GetChild(c).gameObject);

        bool has = tokens != null && tokens.Count > 0;
        row.gameObject.SetActive(has);
        if (!has) return;

        bool applyEmphasis = highlighted != null && emphasis != null && highlighted.Count > 0;
        float hotPx = applyEmphasis && emphasis.bigger ? basePx * 1.22f : basePx;

        int i = 0;
        while (i < tokens.Count)
        {
            if (string.IsNullOrWhiteSpace(tokens[i]))
            {
                i++;
                continue;
            }

            bool hot = applyEmphasis && highlighted.Contains(i);
            if (!hot)
            {
                CreatePatternToken(row, tokens[i], basePx, applyEmphasis ? 0.72f : 1f);
                i++;
                continue;
            }

            int end = i + 1;
            while (end < tokens.Count && highlighted.Contains(end))
                end++;

            var unitTokens = new List<string>();
            for (int k = i; k < end; k++)
            {
                if (string.IsNullOrWhiteSpace(tokens[k])) continue;
                unitTokens.Add(tokens[k]);
            }

            Transform group = CreateHighlightUnit(row, emphasis, unitTokens, hotPx);
            for (int k = 0; k < unitTokens.Count; k++)
                CreatePatternToken(group, unitTokens[k], hotPx, 1f);
            i = end;
        }

        if (applyEmphasis && emphasis.blink && _blinkTargets.Count > 0)
            RestartBlink();
    }

    private Transform CreateHighlightUnit(
        Transform parent,
        CanvasPatternEmphasisData emphasis,
        List<string> unitTokens,
        float tokenPx)
    {
        bool red = emphasis.redBorder;
        var go = new GameObject(
            "HighlightUnit",
            typeof(RectTransform),
            typeof(Image),
            typeof(HorizontalLayoutGroup),
            typeof(LayoutElement),
            typeof(CanvasGroup));
        go.transform.SetParent(parent, false);

        var border = go.GetComponent<Image>();
        border.sprite = GetRoundedSprite();
        border.type = Image.Type.Sliced;
        border.color = red ? EmphasisCoral : EmphasisAmber;
        border.raycastTarget = false;

        var fill = new GameObject("Fill", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        fill.transform.SetParent(go.transform, false);
        var fillLe = fill.GetComponent<LayoutElement>();
        fillLe.ignoreLayout = true;
        var fillRt = fill.GetComponent<RectTransform>();
        fillRt.anchorMin = Vector2.zero;
        fillRt.anchorMax = Vector2.one;
        float inset = red ? 3.5f : 2.5f;
        fillRt.offsetMin = new Vector2(inset, inset);
        fillRt.offsetMax = new Vector2(-inset, -inset);
        var fillImg = fill.GetComponent<Image>();
        fillImg.sprite = GetRoundedSprite();
        fillImg.type = Image.Type.Sliced;
        fillImg.color = red ? EmphasisCream : EmphasisAmberFill;
        fillImg.raycastTarget = false;
        fill.transform.SetAsFirstSibling();

        var hlg = go.GetComponent<HorizontalLayoutGroup>();
        hlg.padding = new RectOffset(14, 14, 10, 10);
        hlg.spacing = 6f;
        hlg.childAlignment = TextAnchor.MiddleCenter;
        hlg.childForceExpandWidth = false;
        hlg.childForceExpandHeight = false;
        hlg.childControlWidth = true;
        hlg.childControlHeight = true;

        int n = unitTokens != null ? unitTokens.Count : 0;
        float contentW = 0f;
        for (int i = 0; i < n; i++)
        {
            if (i > 0) contentW += hlg.spacing;
            contentW += TokenSlotWidth(unitTokens[i], tokenPx);
        }
        float w = hlg.padding.left + hlg.padding.right + Mathf.Max(contentW, tokenPx);
        float h = hlg.padding.top + hlg.padding.bottom + tokenPx;
        var le = go.GetComponent<LayoutElement>();
        le.minWidth = le.preferredWidth = w;
        le.minHeight = le.preferredHeight = h;

        if (emphasis.blink)
        {
            _blinkTargets.Add(go.GetComponent<CanvasGroup>());
            _pulseTargets.Add(go.GetComponent<RectTransform>());
            _pulseBorderImages.Add(border);
        }

        return go.transform;
    }

    private void CreatePatternToken(Transform parent, string raw, float px, float alpha)
    {
        string normalized = NormalizePatternToken(raw);
        if (normalized == "blank")
        {
            CreatePatternBlankDash(parent, px, alpha);
            return;
        }

        var go = new GameObject("Token", typeof(RectTransform), typeof(Image), typeof(LayoutElement), typeof(CanvasGroup));
        go.transform.SetParent(parent, false);
        var img = go.GetComponent<Image>();
        img.sprite = SpriteForToken(raw);
        img.preserveAspect = true;
        img.color = Color.white;
        img.raycastTarget = false;
        go.GetComponent<CanvasGroup>().alpha = alpha;

        var le = go.GetComponent<LayoutElement>();
        le.preferredWidth = px;
        le.preferredHeight = px;
        le.minWidth = px;
        le.minHeight = px;

        if (img.sprite == null)
        {
            var label = CreateTmp("TokLabel", go.transform, Mathf.Max(11f, px * 0.18f), FontStyles.Bold, new Color(0.2f, 0.2f, 0.3f));
            label.text = ShortLabel(raw);
            label.alignment = TextAlignmentOptions.Center;
            img.color = new Color(0.93f, 0.95f, 1f, 1f);
        }
    }

    /// <summary>
    /// Pattern blank — same thin gray line (or custom line sprite) as yellow-strip blank slots.
    /// </summary>
    private void CreatePatternBlankDash(Transform parent, float px, float alpha)
    {
        float w = BlankSlotWidth(px);
        var go = new GameObject("BlankLine", typeof(RectTransform), typeof(LayoutElement), typeof(CanvasGroup));
        go.transform.SetParent(parent, false);
        go.GetComponent<CanvasGroup>().alpha = alpha;

        var le = go.GetComponent<LayoutElement>();
        le.preferredWidth = w;
        le.preferredHeight = px;
        le.minWidth = w;
        le.minHeight = px;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;

        var lineGo = new GameObject("Line", typeof(RectTransform), typeof(Image));
        lineGo.transform.SetParent(go.transform, false);
        var lineRt = lineGo.GetComponent<RectTransform>();
        lineRt.anchorMin = new Vector2(0.5f, 0.5f);
        lineRt.anchorMax = new Vector2(0.5f, 0.5f);
        lineRt.pivot = new Vector2(0.5f, 0.5f);

        var img = lineGo.GetComponent<Image>();
        img.raycastTarget = false;
        if (blankLineSprite != null)
        {
            img.sprite = blankLineSprite;
            img.preserveAspect = true;
            img.color = Color.white;
            float h = Mathf.Max(blankLineHeight * 4f, px * 0.42f);
            lineRt.sizeDelta = new Vector2(w, h);
        }
        else if (useBlankLineStyle || blankSprite == null)
        {
            img.sprite = null;
            img.color = blankLineColor;
            float h = Mathf.Clamp(blankLineHeight, 4f, 12f);
            lineRt.sizeDelta = new Vector2(Mathf.Max(28f, w * 0.92f), h);
        }
        else
        {
            img.sprite = blankSprite;
            img.preserveAspect = true;
            img.color = Color.white;
            lineRt.sizeDelta = new Vector2(w * 0.9f, px * 0.5f);
        }
    }

    private static Sprite GetRoundedSprite()
    {
        if (_roundedSprite != null) return _roundedSprite;
        const int size = 64;
        const int radius = 18;
        var tex = new Texture2D(size, size, TextureFormat.ARGB32, false);
        tex.wrapMode = TextureWrapMode.Clamp;
        tex.filterMode = FilterMode.Bilinear;
        tex.hideFlags = HideFlags.HideAndDontSave;
        var opaque = new Color32(255, 255, 255, 255);
        var clear = new Color32(0, 0, 0, 0);
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float dx = 0f, dy = 0f;
                bool corner = false;
                if (x < radius && y < radius)
                {
                    dx = radius - x - 0.5f;
                    dy = radius - y - 0.5f;
                    corner = true;
                }
                else if (x >= size - radius && y < radius)
                {
                    dx = x - (size - radius - 0.5f);
                    dy = radius - y - 0.5f;
                    corner = true;
                }
                else if (x < radius && y >= size - radius)
                {
                    dx = radius - x - 0.5f;
                    dy = y - (size - radius - 0.5f);
                    corner = true;
                }
                else if (x >= size - radius && y >= size - radius)
                {
                    dx = x - (size - radius - 0.5f);
                    dy = y - (size - radius - 0.5f);
                    corner = true;
                }

                if (!corner)
                {
                    tex.SetPixel(x, y, opaque);
                    continue;
                }
                float d = Mathf.Sqrt(dx * dx + dy * dy);
                tex.SetPixel(x, y, d <= radius ? (Color)opaque : clear);
            }
        }
        tex.Apply(false, false);
        _roundedSprite = Sprite.Create(
            tex,
            new Rect(0, 0, size, size),
            new Vector2(0.5f, 0.5f),
            100f,
            0,
            SpriteMeshType.FullRect,
            new Vector4(radius, radius, radius, radius));
        _roundedSprite.name = "CanvasRoundedRect";
        return _roundedSprite;
    }

    private void StopBlink()
    {
        if (_blinkRoutine != null)
        {
            StopCoroutine(_blinkRoutine);
            _blinkRoutine = null;
        }
        for (int i = 0; i < _pulseTargets.Count; i++)
        {
            if (_pulseTargets[i] != null)
                _pulseTargets[i].localScale = Vector3.one;
        }
        _blinkTargets.Clear();
        _pulseTargets.Clear();
        _pulseBorderImages.Clear();
    }

    private void RestartBlink()
    {
        if (_blinkRoutine != null)
            StopCoroutine(_blinkRoutine);
        _blinkRoutine = StartCoroutine(BlinkHighlightedTokens());
    }

    private IEnumerator BlinkHighlightedTokens()
    {
        const float period = 1.8f;
        float elapsed = 0f;
        while (_pulseTargets.Count > 0)
        {
            _pulseTargets.RemoveAll(rt => rt == null);
            _pulseBorderImages.RemoveAll(img => img == null);
            if (_pulseTargets.Count == 0) yield break;

            elapsed += Time.unscaledDeltaTime;
            float wave = 0.5f + 0.5f * Mathf.Sin((elapsed / period) * Mathf.PI * 2f);
            float scale = Mathf.Lerp(1f, 1.045f, wave);

            for (int i = 0; i < _pulseTargets.Count; i++)
            {
                if (_pulseTargets[i] != null)
                    _pulseTargets[i].localScale = new Vector3(scale, scale, 1f);
            }
            for (int i = 0; i < _pulseBorderImages.Count; i++)
            {
                if (_pulseBorderImages[i] == null) continue;
                Color c = _pulseBorderImages[i].color;
                c.a = Mathf.Lerp(0.82f, 1f, wave);
                _pulseBorderImages[i].color = c;
            }
            yield return null;
        }
        _blinkRoutine = null;
    }

    private static float ResolvePatternTokenPx(string scale)
    {
        if (string.Equals(scale, "xlarge", StringComparison.OrdinalIgnoreCase)) return 110f;
        if (string.Equals(scale, "large", StringComparison.OrdinalIgnoreCase)) return 92f;
        return 72f;
    }

    private static string NormalizePatternToken(string t)
    {
        if (string.IsNullOrEmpty(t)) return "";
        return t.Trim().ToLowerInvariant().Replace('_', ' ');
    }

    /// <summary>
    /// Prefers patternEmphasis.highlightChunk; falls back to exampleChunk for older levels.
    /// </summary>
    private static List<string> ResolveEmphasisHighlightChunk(
        CanvasPatternEmphasisData emphasis,
        List<string> fallbackExampleChunk)
    {
        if (emphasis != null && emphasis.highlightChunk != null && emphasis.highlightChunk.Count > 0)
            return emphasis.highlightChunk;
        if (fallbackExampleChunk != null && fallbackExampleChunk.Count > 0)
            return fallbackExampleChunk;
        return null;
    }

    /// <summary>Indices inside pattern that match the highlight unit (first or all occurrences).</summary>
    private static HashSet<int> ResolveHighlightedPatternIndices(
        List<string> pattern,
        List<string> chunk,
        CanvasPatternEmphasisData emphasis)
    {
        var outSet = new HashSet<int>();
        if (emphasis == null) return outSet;
        string scope = string.IsNullOrEmpty(emphasis.highlightScope) ? "first" : emphasis.highlightScope.ToLowerInvariant();
        if (scope == "none") return outSet;
        if (pattern == null || chunk == null || chunk.Count == 0 || chunk.Count > pattern.Count)
            return outSet;

        var p = new List<string>(pattern.Count);
        for (int i = 0; i < pattern.Count; i++)
            p.Add(NormalizePatternToken(pattern[i]));
        var c = new List<string>(chunk.Count);
        for (int i = 0; i < chunk.Count; i++)
            c.Add(NormalizePatternToken(chunk[i]));

        var ranges = new List<Vector2Int>();
        for (int i = 0; i <= p.Count - c.Count; i++)
        {
            bool ok = true;
            for (int j = 0; j < c.Count; j++)
            {
                if (p[i + j] != c[j])
                {
                    ok = false;
                    break;
                }
            }
            if (ok) ranges.Add(new Vector2Int(i, i + c.Count));
        }

        if (ranges.Count == 0) return outSet;
        if (scope == "all")
        {
            for (int r = 0; r < ranges.Count; r++)
            {
                for (int i = ranges[r].x; i < ranges[r].y; i++)
                    outSet.Add(i);
            }
        }
        else
        {
            for (int i = ranges[0].x; i < ranges[0].y; i++)
                outSet.Add(i);
        }
        return outSet;
    }

    private Sprite SpriteForToken(string raw)
    {
        string t = raw.Trim().ToLowerInvariant().Replace('_', ' ');
        if (t == "forward") return forwardSprite;
        if (t == "backward") return backwardSprite;
        if (t == "turn left" || t == "left") return turnLeftSprite;
        if (t == "turn right" || t == "right") return turnRightSprite;
        if (t == "blank") return blankSprite;
        if (t.StartsWith("repeat") || t == "repeat-end" || t == "end-repeat")
            return repeatSprite != null ? repeatSprite : forwardSprite;
        return null;
    }

    private static string ShortLabel(string raw)
    {
        string t = raw.Trim().ToLowerInvariant();
        if (t.StartsWith("repeat:") || t.StartsWith("repeat-start:"))
            return "×" + t.Split(':')[1];
        if (t == "repeat-end" || t == "end-repeat") return "end";
        return raw.Length > 8 ? raw.Substring(0, 8) : raw;
    }

    private void ApplyImage(CanvasLessonData lesson)
    {
        if (lessonImage == null) return;
        if (_imageLoadRoutine != null)
        {
            StopCoroutine(_imageLoadRoutine);
            _imageLoadRoutine = null;
        }

        if (string.IsNullOrEmpty(lesson.imageUrl))
        {
            lessonImage.gameObject.SetActive(false);
            return;
        }

        string url = ResolvePlatformUrl(lesson.imageUrl);
        if (UrlSpriteCache.TryGetValue(url, out Sprite cached))
        {
            lessonImage.sprite = cached;
            lessonImage.gameObject.SetActive(true);
            return;
        }

        _loadingImageUrl = url;
        _imageLoadRoutine = StartCoroutine(LoadImageFromUrl(url));
    }

    private IEnumerator LoadImageFromUrl(string url)
    {
        using (var req = UnityWebRequestTexture.GetTexture(url))
        {
            yield return req.SendWebRequest();
            if (_loadingImageUrl != url) yield break;
            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning("[CanvasLessonPanel] Image load failed: " + url + " — " + req.error);
                if (lessonImage != null) lessonImage.gameObject.SetActive(false);
                yield break;
            }
            var tex = DownloadHandlerTexture.GetContent(req);
            if (tex == null)
            {
                if (lessonImage != null) lessonImage.gameObject.SetActive(false);
                yield break;
            }
            var sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);
            UrlSpriteCache[url] = sprite;
            if (lessonImage != null)
            {
                lessonImage.sprite = sprite;
                lessonImage.gameObject.SetActive(true);
            }
        }
        _imageLoadRoutine = null;
    }

    private void ApplyAudio(CanvasLessonData lesson)
    {
        if (playAudioButton != null)
            playAudioButton.gameObject.SetActive(!string.IsNullOrEmpty(lesson.audioUrl));

        if (string.IsNullOrEmpty(lesson.audioUrl))
        {
            StopAudio();
            return;
        }

        if (lesson.playAudioAutomatically)
            PlayCurrentAudio();
    }

    private void PlayCurrentAudio()
    {
        if (_current == null || string.IsNullOrEmpty(_current.audioUrl)) return;
        if (lessonAudioSource == null)
        {
            lessonAudioSource = gameObject.AddComponent<AudioSource>();
            lessonAudioSource.playOnAwake = false;
        }

        string url = ResolvePlatformUrl(_current.audioUrl);
        if (UrlAudioClipCache.TryGetValue(url, out AudioClip cached))
        {
            lessonAudioSource.clip = cached;
            lessonAudioSource.Play();
            return;
        }

        if (_audioLoadRoutine != null)
            StopCoroutine(_audioLoadRoutine);
        _loadingAudioUrl = url;
        _audioLoadRoutine = StartCoroutine(LoadAudioFromUrl(url));
    }

    private IEnumerator LoadAudioFromUrl(string url)
    {
        AudioType type = AudioType.MPEG;
        string lower = url.ToLowerInvariant();
        if (lower.EndsWith(".wav")) type = AudioType.WAV;
        else if (lower.EndsWith(".ogg")) type = AudioType.OGGVORBIS;

        using (var req = UnityWebRequestMultimedia.GetAudioClip(url, type))
        {
            yield return req.SendWebRequest();
            if (_loadingAudioUrl != url) yield break;
            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning("[CanvasLessonPanel] Audio load failed: " + url + " — " + req.error);
                yield break;
            }
            AudioClip clip = DownloadHandlerAudioClip.GetContent(req);
            if (clip == null) yield break;
            UrlAudioClipCache[url] = clip;
            if (lessonAudioSource != null)
            {
                lessonAudioSource.clip = clip;
                lessonAudioSource.Play();
            }
        }
        _audioLoadRoutine = null;
    }

    private void StopAudio()
    {
        if (_audioLoadRoutine != null)
        {
            StopCoroutine(_audioLoadRoutine);
            _audioLoadRoutine = null;
        }
        if (lessonAudioSource != null && lessonAudioSource.isPlaying)
            lessonAudioSource.Stop();
    }

    private static string ResolvePlatformUrl(string path)
    {
        if (string.IsNullOrEmpty(path)) return path;
        if (path.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return path;

        string baseUrl = PlatformCommunication.Instance != null
            ? PlatformCommunication.Instance.PlatformUrl.TrimEnd('/')
            : "";
        return string.IsNullOrEmpty(baseUrl) ? path : baseUrl + (path.StartsWith("/") ? path : "/" + path);
    }

    private static Canvas FindOverlayCanvas()
    {
        var canvases = FindObjectsByType<Canvas>(FindObjectsInactive.Include, FindObjectsSortMode.None);
        Canvas best = null;
        float bestArea = -1f;
        foreach (var c in canvases)
        {
            if (c == null || !c.isActiveAndEnabled) continue;
            if (c.renderMode != RenderMode.ScreenSpaceOverlay) continue;
            // Skip nested override canvases — they are often tiny chrome strips.
            if (c.transform.parent != null && c.transform.parent.GetComponentInParent<Canvas>() != null)
                continue;
            float area = c.pixelRect.width * c.pixelRect.height;
            if (area > bestArea)
            {
                bestArea = area;
                best = c;
            }
        }
        if (best != null) return best;

        foreach (var c in canvases)
        {
            if (c == null || !c.isActiveAndEnabled) continue;
            if (c.renderMode == RenderMode.ScreenSpaceOverlay)
                return c;
        }
        foreach (var c in canvases)
        {
            if (c != null && c.isActiveAndEnabled)
                return c;
        }
        return null;
    }
}
