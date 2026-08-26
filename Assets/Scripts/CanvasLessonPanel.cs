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
    public Sprite repeatStartSprite;
    public Sprite repeatEndSprite;
    public Sprite repeatCountBoxSprite;
    public Sprite repeatBodySprite;
    public Sprite repeatMinusSprite;
    public Sprite repeatPlusSprite;
    public Sprite blankSprite;

    [Header("Pattern Repeat layout (bound from CharacterMove — canvas board only)")]
    [Range(0.3f, 2.5f)] public float patternRepeatStartScale = 1f;
    [Range(0.3f, 2.5f)] public float patternRepeatEndScale = 1f;
    [Range(0.2f, 1.5f)] public float patternRepeatCounterScale = 0.45f;
    [Range(0.05f, 0.9f)] public float patternRepeatCounterAnchorY = 0.22f;
    [Range(-80f, 80f)] public float patternRepeatCounterXOffset = 0f;
    [Range(-80f, 80f)] public float patternRepeatCounterYOffset = 0f;
    [Range(1f, 3f)] public float patternRepeatEndWidthMult = 1.35f;

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
    private float _appliedCounterScale = float.NaN;
    private float _appliedCounterAnchorY = float.NaN;
    private float _appliedCounterXOffset = float.NaN;
    private float _appliedCounterYOffset = float.NaN;
    private float _appliedEndWidthMult = float.NaN;
    private float _appliedStartScale = float.NaN;
    private float _appliedEndScale = float.NaN;

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
            // Let TipTap → TMP tags control weight/color (don't force Bold on the whole field).
            promptText.fontStyle = FontStyles.Normal;
            promptText.richText = true;
            promptText.text = HtmlToTmpRichText.Convert(lesson.prompt ?? "");
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

        RebuildPatternPreview();
        CenterLessonCard();
    }

    /// <summary>Rebuilds the pattern row from <see cref="_current"/> (live Inspector tweaks + Show).</summary>
    public void RebuildPatternPreview()
    {
        var lesson = _current;
        if (lesson == null || panelRoot == null) return;

        bool hasPattern = lesson.patternPreview != null && lesson.patternPreview.Count > 0;
        EnsurePatternShelf();
        if (_patternShelf != null)
            _patternShelf.gameObject.SetActive(hasPattern);
        if (_patternLabel != null)
        {
            string patternText = ResolveSectionLabel(lesson.patternLabel, null);
            bool showPatternLabel = hasPattern && !string.IsNullOrEmpty(patternText);
            _patternLabel.gameObject.SetActive(showPatternLabel);
            if (showPatternLabel) _patternLabel.text = patternText;
        }

        var emphasis = lesson.patternEmphasis ?? new CanvasPatternEmphasisData();
        float cardW = ResolveLessonCardWidth();
        float shelfW = Mathf.Max(640f, cardW - 96f);
        float rowAvail = Mathf.Max(520f, shelfW - 72f);
        float patternPx = 56f;

        if (hasPattern && patternRow != null)
        {
            float basePx = ResolvePatternTokenPx(emphasis.scale);
            var highlightUnit = ResolveEmphasisHighlightChunk(emphasis, lesson.exampleChunk);
            var highlighted = ResolveHighlightedPatternIndices(lesson.patternPreview, highlightUnit, emphasis);
            patternPx = FitPatternTokenPx(lesson.patternPreview, basePx, rowAvail, emphasis, highlighted);
            StopBlink();
            PopulateTokenRow(patternRow, lesson.patternPreview, patternPx, highlighted, emphasis);

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
                hlg.childForceExpandHeight = false;
                hlg.childControlWidth = true;
                hlg.childControlHeight = true;
            }
            var rowFitter = patternRow.GetComponent<ContentSizeFitter>();
            if (rowFitter != null)
            {
                rowFitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
                rowFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            }
        }
        else if (patternRow != null)
        {
            PopulateTokenRow(patternRow, null, 40f, null, null);
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

            LayoutRebuilder.ForceRebuildLayoutImmediate(panelRoot);
        }

        MarkPatternLayoutApplied();
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

            if (TryParseRepeatStart(tokens[i], out _) )
            {
                int endIdx = -1;
                for (int j = i + 1; j < tokens.Count; j++)
                {
                    if (IsRepeatEndToken(tokens[j]))
                    {
                        endIdx = j;
                        break;
                    }
                    if (TryParseRepeatStart(tokens[j], out _))
                        break;
                }

                if (endIdx > i)
                {
                    float sleevePx = tokenPx;
                    if (applyEmphasis)
                    {
                        for (int k = i; k <= endIdx; k++)
                        {
                            if (highlighted.Contains(k))
                            {
                                sleevePx = hotPx;
                                break;
                            }
                        }
                    }

                    float startW = sleevePx * 1.1f * Mathf.Clamp(patternRepeatStartScale, 0.3f, 2.5f);
                    float endW = sleevePx * patternRepeatEndWidthMult * Mathf.Clamp(patternRepeatEndScale, 0.3f, 2.5f);
                    float bodyW = 0f;
                    int bodyVisible = 0;
                    for (int k = i + 1; k < endIdx; k++)
                    {
                        if (string.IsNullOrWhiteSpace(tokens[k])) continue;
                        if (bodyVisible > 0) bodyW += 2f;
                        bodyW += TokenSlotWidth(tokens[k], sleevePx);
                        bodyVisible++;
                    }
                    total += 8f + startW + bodyW + endW;
                    pieces++;
                    i = endIdx + 1;
                    continue;
                }
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
        // Same footprint as arrow tokens so blanks scale and sit in the row evenly.
        return tokenPx;
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

    public void BindActionSprites(
        Sprite forward,
        Sprite backward,
        Sprite left,
        Sprite right,
        Sprite repeat,
        Sprite blank,
        Sprite repeatStart = null,
        Sprite repeatEnd = null,
        Sprite repeatCountBox = null,
        Sprite repeatBody = null,
        Sprite repeatMinus = null,
        Sprite repeatPlus = null)
    {
        forwardSprite = forward;
        backwardSprite = backward;
        turnLeftSprite = left;
        turnRightSprite = right;
        repeatSprite = repeat;
        blankSprite = blank;
        repeatStartSprite = repeatStart != null ? repeatStart : repeat;
        repeatEndSprite = repeatEnd != null ? repeatEnd : repeat;
        repeatCountBoxSprite = repeatCountBox;
        repeatBodySprite = repeatBody;
        repeatMinusSprite = repeatMinus;
        repeatPlusSprite = repeatPlus;
    }

    public void BindPatternRepeatCounterLayout(
        float startScale,
        float endScale,
        float counterScale,
        float anchorY,
        float xOffset,
        float yOffset,
        float endWidthMult)
    {
        patternRepeatStartScale = Mathf.Clamp(startScale, 0.3f, 2.5f);
        patternRepeatEndScale = Mathf.Clamp(endScale, 0.3f, 2.5f);
        patternRepeatCounterScale = Mathf.Clamp(counterScale, 0.2f, 1.5f);
        patternRepeatCounterAnchorY = Mathf.Clamp(anchorY, 0.05f, 0.9f);
        patternRepeatCounterXOffset = Mathf.Clamp(xOffset, -80f, 80f);
        patternRepeatCounterYOffset = Mathf.Clamp(yOffset, -80f, 80f);
        patternRepeatEndWidthMult = Mathf.Clamp(endWidthMult, 1f, 3f);
    }

    /// <summary>
    /// Called every frame / OnValidate while playing so Inspector sliders update the board live.
    /// </summary>
    public void SyncLivePatternCounterLayout(
        float startScale,
        float endScale,
        float counterScale,
        float anchorY,
        float xOffset,
        float yOffset,
        float endWidthMult)
    {
        if (!isActiveAndEnabled || panelRoot == null || !panelRoot.gameObject.activeInHierarchy)
            return;
        if (_current == null)
            return;

        bool changed =
            !Mathf.Approximately(_appliedStartScale, startScale) ||
            !Mathf.Approximately(_appliedEndScale, endScale) ||
            !Mathf.Approximately(_appliedCounterScale, counterScale) ||
            !Mathf.Approximately(_appliedCounterAnchorY, anchorY) ||
            !Mathf.Approximately(_appliedCounterXOffset, xOffset) ||
            !Mathf.Approximately(_appliedCounterYOffset, yOffset) ||
            !Mathf.Approximately(_appliedEndWidthMult, endWidthMult);

        BindPatternRepeatCounterLayout(startScale, endScale, counterScale, anchorY, xOffset, yOffset, endWidthMult);
        if (!changed) return;

        MarkPatternLayoutApplied();
        RebuildPatternPreview();
    }

    private void MarkPatternLayoutApplied()
    {
        _appliedStartScale = patternRepeatStartScale;
        _appliedEndScale = patternRepeatEndScale;
        _appliedCounterScale = patternRepeatCounterScale;
        _appliedCounterAnchorY = patternRepeatCounterAnchorY;
        _appliedCounterXOffset = patternRepeatCounterXOffset;
        _appliedCounterYOffset = patternRepeatCounterYOffset;
        _appliedEndWidthMult = patternRepeatEndWidthMult;
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

        promptText = CreateTmp("Prompt", panelRoot, 42, FontStyles.Normal, new Color(0.12f, 0.14f, 0.22f));
        promptText.richText = true;
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

            // Group repeat:N … body … repeat-end into a yellow sleeve (start / counter / end).
            if (TryParseRepeatStart(tokens[i], out int repeatCount))
            {
                int endIdx = -1;
                for (int j = i + 1; j < tokens.Count; j++)
                {
                    if (IsRepeatEndToken(tokens[j]))
                    {
                        endIdx = j;
                        break;
                    }
                    if (TryParseRepeatStart(tokens[j], out _))
                        break; // nested not supported — fall through as plain tokens
                }

                if (endIdx > i)
                {
                    var body = new List<string>();
                    for (int k = i + 1; k < endIdx; k++)
                    {
                        if (!string.IsNullOrWhiteSpace(tokens[k]))
                            body.Add(tokens[k]);
                    }
                    float sleevePx = basePx;
                    if (applyEmphasis)
                    {
                        for (int k = i; k <= endIdx; k++)
                        {
                            if (highlighted.Contains(k))
                            {
                                sleevePx = hotPx;
                                break;
                            }
                        }
                    }
                    CreatePatternRepeatGroup(row, repeatCount, body, sleevePx, applyEmphasis ? 0.9f : 1f);
                    i = endIdx + 1;
                    continue;
                }
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

    /// <summary>
    /// Pattern Repeat matching the yellow strip: green Start, body arrows, red End
    /// with the same yellow [-] [N] [+] counter overlay (not a separate xN badge).
    /// </summary>
    private void CreatePatternRepeatGroup(
        Transform parent,
        int count,
        List<string> body,
        float px,
        float alpha)
    {
        count = ProgramSequenceUtil.ClampRepeatCount(count);

        var go = new GameObject(
            "RepeatGroup",
            typeof(RectTransform),
            typeof(Image),
            typeof(HorizontalLayoutGroup),
            typeof(LayoutElement),
            typeof(CanvasGroup));
        go.transform.SetParent(parent, false);
        go.GetComponent<CanvasGroup>().alpha = alpha;

        var bg = go.GetComponent<Image>();
        if (repeatBodySprite != null)
        {
            bg.sprite = repeatBodySprite;
            bg.type = Image.Type.Sliced;
            bg.color = Color.white;
        }
        else
        {
            bg.sprite = GetRoundedSprite();
            bg.type = Image.Type.Sliced;
            bg.color = new Color(1f, 0.93f, 0.45f, 0.98f);
        }
        bg.raycastTarget = false;

        var hlg = go.GetComponent<HorizontalLayoutGroup>();
        hlg.padding = new RectOffset(4, 4, 4, 4);
        hlg.spacing = 2f;
        hlg.childAlignment = TextAnchor.MiddleCenter;
        hlg.childForceExpandWidth = false;
        hlg.childForceExpandHeight = false;
        hlg.childControlWidth = true;
        hlg.childControlHeight = true;

        // Start / End sized independently (canvas board only).
        float startScale = Mathf.Clamp(patternRepeatStartScale, 0.3f, 2.5f);
        float endScale = Mathf.Clamp(patternRepeatEndScale, 0.3f, 2.5f);
        float startW = px * 1.1f * startScale;
        float startH = px * 1.35f * startScale;
        float endW = px * patternRepeatEndWidthMult * endScale;
        float endH = px * 1.35f * endScale;
        float capH = Mathf.Max(startH, endH);
        float bodyW = 0f;
        if (body != null)
        {
            for (int b = 0; b < body.Count; b++)
            {
                if (b > 0) bodyW += 2f;
                bodyW += TokenSlotWidth(body[b], px);
            }
        }
        float totalW = 8f + startW + bodyW + endW;

        var le = go.GetComponent<LayoutElement>();
        le.preferredWidth = totalW;
        le.minWidth = totalW;
        le.preferredHeight = capH;
        le.minHeight = capH;

        CreatePatternRepeatCap(go.transform, isStart: true, count, startW, startH);
        if (body != null)
        {
            for (int b = 0; b < body.Count; b++)
                CreatePatternToken(go.transform, body[b], px, 1f);
        }
        CreatePatternRepeatCap(go.transform, isStart: false, count, endW, endH);
    }

    private void CreatePatternRepeatCap(Transform parent, bool isStart, int count, float width, float height)
    {
        var go = new GameObject(
            isStart ? "RepeatStart" : "RepeatEnd",
            typeof(RectTransform),
            typeof(Image),
            typeof(LayoutElement));
        go.transform.SetParent(parent, false);

        var img = go.GetComponent<Image>();
        Sprite sp = isStart
            ? (repeatStartSprite != null ? repeatStartSprite : repeatSprite)
            : (repeatEndSprite != null ? repeatEndSprite : repeatSprite);
        img.sprite = sp;
        img.preserveAspect = false;
        img.type = Image.Type.Simple;
        img.color = Color.white;
        img.raycastTarget = false;

        var le = go.GetComponent<LayoutElement>();
        le.preferredWidth = width;
        le.minWidth = width * 0.9f;
        le.preferredHeight = height;
        le.minHeight = height * 0.9f;

        // End shows count number only (no − / + on the canvas board).
        if (!isStart)
            CreatePatternCountBadge(go.transform, count);
    }

    /// <summary>
    /// Count badge only on pattern Repeat End (no minus/plus). Canvas board only.
    /// </summary>
    private void CreatePatternCountBadge(Transform endCap, int count)
    {
        count = ProgramSequenceUtil.ClampRepeatCount(count);

        float s = Mathf.Clamp(patternRepeatCounterScale, 0.2f, 1.5f);
        float countBox = 30f * s;

        var root = new GameObject("RepeatEndContent", typeof(RectTransform));
        root.transform.SetParent(endCap, false);
        var rt = root.GetComponent<RectTransform>();
        float ay = Mathf.Clamp(patternRepeatCounterAnchorY, 0.05f, 0.9f);
        rt.anchorMin = new Vector2(0.55f, ay);
        rt.anchorMax = new Vector2(0.55f, ay);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = new Vector2(patternRepeatCounterXOffset, patternRepeatCounterYOffset);
        rt.sizeDelta = new Vector2(countBox + 4f, countBox + 4f);

        CreatePatternCountBox(
            root.transform, Vector2.zero, new Vector2(0.5f, 0.5f), countBox, countBox, count);
    }

    private void CreatePatternCountBox(
        Transform parent, Vector2 pos, Vector2 anchor, float w, float h, int value)
    {
        var countBox = new GameObject("CountBox", typeof(RectTransform), typeof(Image));
        countBox.transform.SetParent(parent, false);
        var cbrt = countBox.GetComponent<RectTransform>();
        cbrt.anchorMin = cbrt.anchorMax = anchor;
        cbrt.pivot = new Vector2(0.5f, 0.5f);
        cbrt.anchoredPosition = pos;
        cbrt.sizeDelta = new Vector2(w, h);
        var cbImg = countBox.GetComponent<Image>();
        if (repeatCountBoxSprite != null)
        {
            cbImg.sprite = repeatCountBoxSprite;
            cbImg.type = Image.Type.Simple;
            cbImg.preserveAspect = false;
            cbImg.color = Color.white;
        }
        else
        {
            cbImg.sprite = GetRoundedSprite();
            cbImg.type = Image.Type.Sliced;
            cbImg.color = Color.white;
        }
        cbImg.raycastTarget = false;

        var tmp = CreateTmp(
            "Count",
            countBox.transform,
            Mathf.Clamp(h * 0.55f, 14f, 28f),
            FontStyles.Bold,
            new Color(0.12f, 0.12f, 0.16f, 1f));
        tmp.text = value.ToString();
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.enableWordWrapping = false;
        tmp.enableAutoSizing = true;
        tmp.fontSizeMin = 12f;
        tmp.fontSizeMax = Mathf.Clamp(h * 0.62f, 16f, 30f);
        tmp.raycastTarget = false;
        var labelLe = tmp.GetComponent<LayoutElement>();
        if (labelLe != null)
        {
            labelLe.flexibleWidth = 0f;
            labelLe.ignoreLayout = true;
        }
        var trt = tmp.GetComponent<RectTransform>();
        trt.anchorMin = Vector2.zero;
        trt.anchorMax = Vector2.one;
        trt.offsetMin = new Vector2(2f, 2f);
        trt.offsetMax = new Vector2(-2f, -2f);
    }

    private static bool TryParseRepeatStart(string raw, out int count)
    {
        return ProgramSequenceUtil.IsRepeatStartToken(raw, out count);
    }

    private static bool IsRepeatEndToken(string raw)
    {
        return ProgramSequenceUtil.IsRepeatEndToken(raw);
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
            // Keep blanks fully opaque so they read as strong as arrow underlines.
            CreatePatternBlankDash(parent, px, 1f);
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
    /// Pattern blank — same cell as an arrow; thick base bar matching the arrow underline.
    /// </summary>
    private void CreatePatternBlankDash(Transform parent, float px, float alpha)
    {
        float slot = Mathf.Max(40f, px);
        var go = new GameObject("BlankLine", typeof(RectTransform), typeof(LayoutElement), typeof(CanvasGroup));
        go.transform.SetParent(parent, false);
        go.GetComponent<CanvasGroup>().alpha = alpha;

        var le = go.GetComponent<LayoutElement>();
        le.preferredWidth = slot;
        le.preferredHeight = slot;
        le.minWidth = slot;
        le.minHeight = slot;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;

        var lineGo = new GameObject("Line", typeof(RectTransform), typeof(Image));
        lineGo.transform.SetParent(go.transform, false);
        var lineRt = lineGo.GetComponent<RectTransform>();
        // Same baseline as the dark bar under action-arrow sprites.
        lineRt.anchorMin = new Vector2(0.5f, 0f);
        lineRt.anchorMax = new Vector2(0.5f, 0f);
        lineRt.pivot = new Vector2(0.5f, 0.5f);
        lineRt.anchoredPosition = new Vector2(0f, slot * 0.16f);

        // Match underline weight under the arrow icons (wide + thick — ~2× prior height).
        float lineW = slot * 0.92f;
        float lineH = Mathf.Clamp(slot * 0.4f, 24f, 44f);

        var img = lineGo.GetComponent<Image>();
        img.raycastTarget = false;
        if (blankLineSprite != null)
        {
            img.sprite = blankLineSprite;
            img.preserveAspect = true;
            img.color = Color.white;
            lineH = Mathf.Max(lineH, slot * 0.44f);
            lineW = slot * 0.94f;
        }
        else
        {
            img.sprite = GetRoundedSprite();
            img.type = Image.Type.Sliced;
            img.preserveAspect = false;
            // Near-black bar like the underlines baked into the arrow art.
            img.color = new Color(0.18f, 0.2f, 0.24f, 0.98f);
        }

        lineRt.sizeDelta = new Vector2(lineW, lineH);
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
        if (IsRepeatEndToken(raw))
            return repeatEndSprite != null ? repeatEndSprite : (repeatSprite != null ? repeatSprite : forwardSprite);
        if (TryParseRepeatStart(raw, out _))
            return repeatStartSprite != null ? repeatStartSprite : (repeatSprite != null ? repeatSprite : forwardSprite);
        if (t.StartsWith("repeat"))
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
