using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Networking;
using TMPro;

/// <summary>
/// Top-right panel for level tips and intro step hints (text and/or image).
/// Auto-builds under the main UI canvas if references are not assigned.
/// Style: assign <see cref="defaultLayout"/> on this component, or per-level on <see cref="LevelCornerHint.layout"/>.
/// </summary>
[ExecuteAlways]
public class LevelCornerHintPanel : MonoBehaviour
{
    [Header("Optional — auto-created when empty")]
    public RectTransform panelRoot;
    public TextMeshProUGUI titleText;
    public TextMeshProUGUI bodyText;
    public Image hintImage;
    public Image panelBackground;
    public GameObject learningBadge;
    public Button skipButton;
    public Image skipButtonImage;
    public TextMeshProUGUI skipButtonLabel;
    public Button playAudioButton;
    public Image playAudioButtonImage;
    public TextMeshProUGUI playAudioButtonLabel;

    [Header("Audio")]
    public AudioSource hintAudioSource;

    [Header("Default panel style (Inspector)")]
    [Tooltip("Used for all hints unless LevelCornerHint.useCustomLayout is enabled.")]
    public CornerHintPanelLayout defaultLayout = new CornerHintPanelLayout();

    [Header("Editor preview")]
    [Tooltip("Show the panel in Scene/Game view while editing layout (updates when you change Inspector values).")]
    public bool showLayoutPreview = true;
    public string editorPreviewTitle = "Tip title";
    [TextArea(2, 4)]
    public string editorPreviewBody = "Preview text — change layout above to see updates live.";

    private Action _onSkip;
    private bool _built;
    private bool _manualLayout;
    private VerticalLayoutGroup _verticalLayout;
    private ContentSizeFitter _contentFitter;
    private LayoutElement _imageLayoutElement;
    private LayoutElement _listenLayoutElement;
    private LayoutElement _skipLayoutElement;
    private Coroutine _imageLoadRoutine;
    private Coroutine _audioLoadRoutine;
    private string _loadingImageUrl;
    private string _loadingAudioUrl;
    private LevelCornerHint _currentHint;
    private CornerHintPanelLayout _activeLayout;
    private TextMeshProUGUI _badgeLabelText;
    private TextMeshProUGUI _skipLabelText;
    private static readonly Dictionary<string, Sprite> UrlSpriteCache = new Dictionary<string, Sprite>();
    private static readonly Dictionary<string, AudioClip> UrlAudioClipCache = new Dictionary<string, AudioClip>();

    public void EnsureBuilt()
    {
        if (_built && panelRoot != null)
        {
            EnsureBackgroundLayer();
            return;
        }

        Canvas canvas = FindOverlayCanvas();
        if (canvas == null)
        {
            Debug.LogWarning("[LevelCornerHintPanel] No canvas found — hint panel not created.");
            return;
        }

        if (panelRoot == null)
            BuildPanel(canvas.transform);
        else
            EnsureBackgroundLayer();

        CacheLayoutComponents();
        _built = true;
        defaultLayout.ApplyResourcesFallback();

        if (!showLayoutPreview && !Application.isPlaying)
            Hide();
    }

    /// <summary>Re-applies layout and preview text (Editor + Play Mode).</summary>
    public void RefreshLayoutPreview()
    {
        EnsureBuilt();
        if (panelRoot == null) return;

        defaultLayout.ApplyResourcesFallback();
        var previewHint = new LevelCornerHint
        {
            enabled = true,
            title = editorPreviewTitle,
            body = editorPreviewBody,
        };

        if (!Application.isPlaying && !showLayoutPreview)
        {
            Hide();
            return;
        }

        Show(previewHint, introMode: false);

        if (learningBadge != null)
            learningBadge.SetActive(false);

        if (hintImage != null)
            hintImage.gameObject.SetActive(false);

        if (skipButton != null)
            skipButton.gameObject.SetActive(false);

        if (playAudioButton != null)
            playAudioButton.gameObject.SetActive(defaultLayout.listenButtonSprite != null);

        Canvas.ForceUpdateCanvases();
#if UNITY_EDITOR
        UnityEditor.EditorApplication.QueuePlayerLoopUpdate();
        UnityEditor.SceneView.RepaintAll();
#endif
    }

    public void Show(LevelCornerHint hint, bool introMode)
    {
        EnsureBuilt();
        if (panelRoot == null) return;

        if (hint == null || !hint.enabled)
        {
            Hide();
            return;
        }

        _activeLayout = ResolveLayout(hint);
        ApplyPanelLayout(_activeLayout, introMode);

        panelRoot.gameObject.SetActive(true);

        if (learningBadge != null)
            learningBadge.SetActive(introMode);

        if (titleText != null)
        {
            titleText.text = string.IsNullOrEmpty(hint.title) ? (introMode ? "Introduction" : "Tip") : hint.title;
            titleText.gameObject.SetActive(!string.IsNullOrEmpty(titleText.text));
        }

        if (bodyText != null)
        {
            bodyText.text = hint.body ?? "";
            bodyText.gameObject.SetActive(!string.IsNullOrEmpty(bodyText.text));
        }

        ApplyAllTypography(_activeLayout, introMode);

        if (_manualLayout)
            ApplyManualElementPositions(_activeLayout);

        _currentHint = hint;
        ApplyHintImage(hint);
        ApplyHintAudio(hint);
        ApplySkipButtonStyle(_activeLayout);
        ApplyListenButtonStyle(_activeLayout);
    }

    private CornerHintPanelLayout ResolveLayout(LevelCornerHint hint)
    {
        var merged = new CornerHintPanelLayout();
        merged.MergeFrom(defaultLayout);
        merged.ApplyResourcesFallback();
        if (hint != null && hint.useCustomLayout)
            merged.MergeFrom(hint.layout);
        return merged;
    }

    private void ApplyPanelLayout(CornerHintPanelLayout layout, bool introMode)
    {
        if (panelRoot == null || layout == null) return;

        _manualLayout = layout.useManualLayout;
        panelRoot.anchoredPosition = layout.panelOffset;
        panelRoot.sizeDelta = new Vector2(layout.panelWidth, layout.panelHeight);

        if (panelBackground != null)
        {
            layout.ApplyResourcesFallback();
            bool hasSprite = layout.panelBackground != null;
            if (hasSprite)
            {
                panelBackground.sprite = layout.panelBackground;
                panelBackground.type = Image.Type.Simple;
                panelBackground.preserveAspect = false;
                var c = layout.panelColorTint;
                c.a = layout.panelBackgroundAlpha;
                panelBackground.color = c;
                panelBackground.raycastTarget = true;
            }
            else if (layout.useSolidPanelFallback)
            {
                panelBackground.sprite = null;
                panelBackground.type = Image.Type.Simple;
                panelBackground.color = introMode ? layout.introPanelFillColor : layout.panelFillColor;
                panelBackground.raycastTarget = true;
            }
            else
            {
                panelBackground.sprite = null;
                panelBackground.color = Color.clear;
                panelBackground.raycastTarget = false;
            }
        }

        if (_verticalLayout != null)
        {
            _verticalLayout.enabled = !_manualLayout;
            if (!_manualLayout)
            {
                _verticalLayout.padding = new RectOffset(
                    Mathf.RoundToInt(layout.paddingLeft),
                    Mathf.RoundToInt(layout.paddingRight),
                    Mathf.RoundToInt(layout.paddingTop),
                    Mathf.RoundToInt(layout.paddingBottom));
                _verticalLayout.spacing = layout.elementSpacing;
            }
        }

        if (_contentFitter != null)
            _contentFitter.enabled = !_manualLayout && layout.panelHeight <= 0f;

        if (_imageLayoutElement != null && !_manualLayout)
        {
            _imageLayoutElement.preferredWidth = layout.imageWidth;
            _imageLayoutElement.preferredHeight = layout.imageHeight;
        }

        if (_skipLayoutElement != null && !_manualLayout)
            _skipLayoutElement.preferredHeight = layout.skipButtonHeight;
    }

    private void CacheTypographyRefs()
    {
        if (learningBadge != null && _badgeLabelText == null)
            _badgeLabelText = learningBadge.GetComponentInChildren<TextMeshProUGUI>(true);
        if (skipButtonLabel != null)
            _skipLabelText = skipButtonLabel;
        else if (skipButton != null && _skipLabelText == null)
            _skipLabelText = skipButton.GetComponentInChildren<TextMeshProUGUI>(true);
    }

    private void ApplyAllTypography(CornerHintPanelLayout layout, bool introMode)
    {
        if (layout == null) return;
        CacheTypographyRefs();

        TMP_FontAsset fallback = layout.defaultFont;
        Color? titleColor = introMode ? layout.introTitleColor : (Color?)null;
        CornerHintTypographyApplier.Apply(titleText, layout.titleTypography, fallback, titleColor);
        CornerHintTypographyApplier.Apply(bodyText, layout.bodyTypography, fallback);
        CornerHintTypographyApplier.Apply(_badgeLabelText, layout.badgeTypography, fallback);

        if (playAudioButtonLabel != null)
        {
            if (!string.IsNullOrEmpty(layout.listenButtonText))
                playAudioButtonLabel.text = layout.listenButtonText;
            CornerHintTypographyApplier.Apply(playAudioButtonLabel, layout.listenLabelTypography, fallback);
        }

        if (_skipLabelText != null)
        {
            if (!string.IsNullOrEmpty(layout.skipButtonText))
                _skipLabelText.text = layout.skipButtonText;
            CornerHintTypographyApplier.Apply(_skipLabelText, layout.skipLabelTypography, fallback);
        }
    }

    private void ApplySkipButtonStyle(CornerHintPanelLayout layout)
    {
        if (skipButton == null || layout == null) return;

        layout.ApplyResourcesFallback();

        EnsureSkipVisualChildren();

        // If a sprite is present, show image-only button.
        if (layout.skipButtonSprite != null && skipButtonImage != null)
        {
            if (layout.skipButtonAutoSizeFromSprite)
                layout.ApplySkipSizeFromSprite(100f);

            skipButtonImage.sprite = layout.skipButtonSprite;
            skipButtonImage.preserveAspect = layout.skipButtonSpritePreserveAspect;
            var c = layout.skipButtonSpriteTint;
            c.a = layout.skipButtonSpriteAlpha;
            skipButtonImage.color = c;
            skipButtonImage.gameObject.SetActive(true);

            if (skipButtonLabel != null)
                skipButtonLabel.gameObject.SetActive(false);

            var btnImg = skipButton.GetComponent<Image>();
            if (btnImg != null)
            {
                btnImg.color = Color.clear;
                btnImg.raycastTarget = true;
            }

            if (!_manualLayout && _skipLayoutElement != null)
            {
                _skipLayoutElement.preferredHeight =
                    layout.skipButtonSpriteHeight > 0f ? layout.skipButtonSpriteHeight : layout.skipButtonHeight;
                if (layout.skipButtonSpriteWidth > 0f)
                    _skipLayoutElement.preferredWidth = layout.skipButtonSpriteWidth;
            }
            else if (_manualLayout)
            {
                // Keep the manual layout size in sync when auto-sizing is enabled.
                if (layout.skipButtonAutoSizeFromSprite)
                    skipButton.GetComponent<RectTransform>().sizeDelta = new Vector2(
                        layout.skipButtonSpriteWidth,
                        layout.skipButtonSpriteHeight
                    );
            }
        }
        else
        {
            // Text fallback.
            if (skipButtonImage != null)
                skipButtonImage.gameObject.SetActive(false);
            if (skipButtonLabel != null)
                skipButtonLabel.gameObject.SetActive(true);

            var btnImg = skipButton.GetComponent<Image>();
            if (btnImg != null)
                btnImg.color = new Color(0.55f, 0.55f, 0.58f, 1f);

            if (!_manualLayout && _skipLayoutElement != null)
            {
                _skipLayoutElement.preferredHeight = layout.skipButtonHeight;
            }
        }
    }

    private void EnsureSkipVisualChildren()
    {
        if (skipButton == null) return;

        if (skipButtonImage == null)
        {
            var icon = skipButton.transform.Find("Icon");
            if (icon == null)
            {
                var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
                iconGo.transform.SetParent(skipButton.transform, false);
                var iconRt = iconGo.GetComponent<RectTransform>();
                iconRt.anchorMin = Vector2.zero;
                iconRt.anchorMax = Vector2.one;
                iconRt.offsetMin = Vector2.zero;
                iconRt.offsetMax = Vector2.zero;
                skipButtonImage = iconGo.GetComponent<Image>();
                skipButtonImage.preserveAspect = true;
                skipButtonImage.color = Color.white;
                iconGo.SetActive(false);
            }
            else
            {
                skipButtonImage = icon.GetComponent<Image>();
            }
        }

        if (skipButtonLabel == null)
        {
            var t = skipButton.transform.Find("Text");
            if (t != null) skipButtonLabel = t.GetComponent<TextMeshProUGUI>();
        }
    }

    private void ApplyManualElementPositions(CornerHintPanelLayout layout)
    {
        if (titleText != null)
            layout.titleLayout.ApplyTo(titleText.rectTransform);
        if (bodyText != null)
            layout.bodyLayout.ApplyTo(bodyText.rectTransform);
        if (hintImage != null)
        {
            var imgLayout = layout.imageLayout;
            if (layout.imageWidth > 0f || layout.imageHeight > 0f)
                imgLayout.sizeDelta = new Vector2(
                    layout.imageWidth > 0f ? layout.imageWidth : imgLayout.sizeDelta.x,
                    layout.imageHeight > 0f ? layout.imageHeight : imgLayout.sizeDelta.y);
            imgLayout.ApplyTo(hintImage.rectTransform);
        }
        if (playAudioButton != null)
        {
            var btnLayout = layout.listenButtonLayout;
            if (layout.listenButtonWidth > 0f || layout.listenButtonHeight > 0f)
                btnLayout.sizeDelta = new Vector2(
                    layout.listenButtonWidth > 0f ? layout.listenButtonWidth : btnLayout.sizeDelta.x,
                    layout.listenButtonHeight > 0f ? layout.listenButtonHeight : btnLayout.sizeDelta.y);
            btnLayout.ApplyTo(playAudioButton.GetComponent<RectTransform>());
        }
        if (skipButton != null)
            layout.skipButtonLayout.ApplyTo(skipButton.GetComponent<RectTransform>());
    }

    private void ApplyListenButtonStyle(CornerHintPanelLayout layout)
    {
        if (playAudioButton == null) return;

        var img = playAudioButtonImage != null
            ? playAudioButtonImage
            : playAudioButton.GetComponent<Image>();
        if (img == null) return;

        if (layout.listenButtonSprite != null)
        {
            img.sprite = layout.listenButtonSprite;
            img.color = Color.white;
            img.type = Image.Type.Simple;
            img.preserveAspect = true;
            if (playAudioButtonLabel != null)
                playAudioButtonLabel.gameObject.SetActive(false);
        }
        else
        {
            img.sprite = null;
            img.color = new Color(0.35f, 0.65f, 0.92f, 1f);
            if (playAudioButtonLabel != null)
            {
                playAudioButtonLabel.gameObject.SetActive(true);
                if (!string.IsNullOrEmpty(layout.listenButtonText))
                    playAudioButtonLabel.text = layout.listenButtonText;
                CornerHintTypographyApplier.Apply(
                    playAudioButtonLabel,
                    layout.listenLabelTypography,
                    layout.defaultFont);
            }
        }

        if (!_manualLayout && _listenLayoutElement != null)
        {
            _listenLayoutElement.preferredHeight = layout.listenButtonHeight > 0f
                ? layout.listenButtonHeight
                : 32f;
            if (layout.listenButtonWidth > 0f)
                _listenLayoutElement.preferredWidth = layout.listenButtonWidth;
        }
    }

    private void ApplyHintImage(LevelCornerHint hint)
    {
        if (hintImage == null) return;

        if (_imageLoadRoutine != null)
        {
            StopCoroutine(_imageLoadRoutine);
            _imageLoadRoutine = null;
        }

        if (hint.image != null)
        {
            _loadingImageUrl = null;
            SetHintSprite(hint.image);
            return;
        }

        if (!string.IsNullOrEmpty(hint.imageUrl))
        {
            string url = ResolveImageUrl(hint.imageUrl);
            if (UrlSpriteCache.TryGetValue(url, out Sprite cached))
            {
                SetHintSprite(cached);
                return;
            }
            _loadingImageUrl = url;
            _imageLoadRoutine = StartCoroutine(LoadImageFromUrl(url));
            return;
        }

        hintImage.gameObject.SetActive(false);
    }

    private IEnumerator LoadImageFromUrl(string url)
    {
        using (var req = UnityWebRequestTexture.GetTexture(url))
        {
            yield return req.SendWebRequest();

            if (_loadingImageUrl != url)
                yield break;

            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning("[LevelCornerHintPanel] Image load failed: " + url + " — " + req.error);
                if (hintImage != null)
                    hintImage.gameObject.SetActive(false);
                yield break;
            }

            var tex = DownloadHandlerTexture.GetContent(req);
            if (tex == null)
            {
                if (hintImage != null)
                    hintImage.gameObject.SetActive(false);
                yield break;
            }

            var sprite = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);
            UrlSpriteCache[url] = sprite;
            SetHintSprite(sprite);
        }

        _imageLoadRoutine = null;
    }

    private void ApplyHintAudio(LevelCornerHint hint)
    {
        if (playAudioButton != null)
            playAudioButton.gameObject.SetActive(!string.IsNullOrEmpty(hint?.audioUrl));

        if (_audioLoadRoutine != null)
        {
            StopCoroutine(_audioLoadRoutine);
            _audioLoadRoutine = null;
        }

        if (hintAudioSource != null && hintAudioSource.isPlaying)
            hintAudioSource.Stop();

        if (hint == null || string.IsNullOrEmpty(hint.audioUrl))
            return;

        string url = ResolvePlatformUrl(hint.audioUrl);
        if (UrlAudioClipCache.TryGetValue(url, out AudioClip cached))
        {
            OnTipAudioReady(hint, cached);
            return;
        }

        _loadingAudioUrl = url;
        _audioLoadRoutine = StartCoroutine(LoadAudioFromUrl(url, hint));
    }

    private IEnumerator LoadAudioFromUrl(string url, LevelCornerHint hint)
    {
        AudioType type = AudioTypeFromUrl(url);
        using (var req = UnityWebRequestMultimedia.GetAudioClip(url, type))
        {
            yield return req.SendWebRequest();

            if (_loadingAudioUrl != url)
                yield break;

            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning("[LevelCornerHintPanel] Audio load failed: " + url + " — " + req.error);
                yield break;
            }

            AudioClip clip = DownloadHandlerAudioClip.GetContent(req);
            if (clip == null)
                yield break;

            UrlAudioClipCache[url] = clip;
            OnTipAudioReady(hint, clip);
        }

        _audioLoadRoutine = null;
    }

    private void OnTipAudioReady(LevelCornerHint hint, AudioClip clip)
    {
        if (hint == null || clip == null || hintAudioSource == null) return;
        if (_currentHint == null || !string.Equals(_currentHint.audioUrl, hint.audioUrl, StringComparison.Ordinal))
            return;

        hintAudioSource.clip = clip;
        if (hint.playAudioAutomatically)
            hintAudioSource.Play();
    }

    public void PlayTipAudio()
    {
        if (hintAudioSource == null || hintAudioSource.clip == null) return;
        hintAudioSource.Play();
    }

    private static AudioType AudioTypeFromUrl(string url)
    {
        string u = url.ToLowerInvariant();
        if (u.EndsWith(".ogg")) return AudioType.OGGVORBIS;
        if (u.EndsWith(".wav")) return AudioType.WAV;
        return AudioType.MPEG;
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

    private static string ResolveImageUrl(string imageUrl) => ResolvePlatformUrl(imageUrl);

    private void SetHintSprite(Sprite sprite)
    {
        if (hintImage == null || sprite == null) return;
        hintImage.sprite = sprite;
        hintImage.gameObject.SetActive(true);
        hintImage.preserveAspect = true;

        float maxW = _activeLayout != null && _activeLayout.imageWidth > 0f
            ? _activeLayout.imageWidth
            : Mathf.Min(280f, Screen.width * 0.35f);
        float maxH = _activeLayout != null && _activeLayout.imageHeight > 0f
            ? _activeLayout.imageHeight
            : 0f;

        if (_manualLayout)
        {
            var rt = hintImage.rectTransform;
            if (maxW > 0f && maxH > 0f)
                rt.sizeDelta = new Vector2(maxW, maxH);
            return;
        }

        hintImage.SetNativeSize();
        var rtAuto = hintImage.rectTransform;
        if (rtAuto.sizeDelta.x > maxW)
            rtAuto.sizeDelta = new Vector2(maxW, rtAuto.sizeDelta.y * (maxW / rtAuto.sizeDelta.x));
        if (maxH > 0f && rtAuto.sizeDelta.y > maxH)
            rtAuto.sizeDelta = new Vector2(rtAuto.sizeDelta.x * (maxH / rtAuto.sizeDelta.y), maxH);
    }

    public void Hide()
    {
        if (_imageLoadRoutine != null)
        {
            StopCoroutine(_imageLoadRoutine);
            _imageLoadRoutine = null;
        }
        if (_audioLoadRoutine != null)
        {
            StopCoroutine(_audioLoadRoutine);
            _audioLoadRoutine = null;
        }
        _loadingImageUrl = null;
        _loadingAudioUrl = null;
        _currentHint = null;
        _activeLayout = null;

        if (hintAudioSource != null && hintAudioSource.isPlaying)
            hintAudioSource.Stop();

        if (panelRoot != null)
            panelRoot.gameObject.SetActive(false);
        SetSkipVisible(false, null);
    }

    public void SetSkipVisible(bool visible, Action onSkip, string labelOverride = null)
    {
        _onSkip = onSkip;
        if (skipButton == null) return;
        skipButton.gameObject.SetActive(visible);
        skipButton.onClick.RemoveAllListeners();
        if (visible && onSkip != null)
            skipButton.onClick.AddListener(() => onSkip());

        // Skip visibility can be toggled without calling Show() again (intro chrome).
        // Make sure the image/text mode + sizing is applied immediately.
        if (visible)
        {
            var layout = _activeLayout ?? defaultLayout;
            ApplySkipButtonStyle(layout);
            if (!string.IsNullOrEmpty(labelOverride) && _skipLabelText != null)
                _skipLabelText.text = labelOverride;
            if (_manualLayout)
                ApplyManualElementPositions(layout);
        }
    }

    private void BuildPanel(Transform canvasTransform)
    {
        var rootGo = new GameObject("LevelCornerHintPanel", typeof(RectTransform));
        panelRoot = rootGo.GetComponent<RectTransform>();
        panelRoot.SetParent(canvasTransform, false);
        panelRoot.anchorMin = new Vector2(1f, 1f);
        panelRoot.anchorMax = new Vector2(1f, 1f);
        panelRoot.pivot = new Vector2(1f, 1f);
        panelRoot.anchoredPosition = new Vector2(-16f, -16f);
        panelRoot.sizeDelta = new Vector2(320f, 0f);

        _contentFitter = rootGo.AddComponent<ContentSizeFitter>();
        _contentFitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
        _contentFitter.horizontalFit = ContentSizeFitter.FitMode.Unconstrained;

        _verticalLayout = rootGo.AddComponent<VerticalLayoutGroup>();
        _verticalLayout.childAlignment = TextAnchor.UpperLeft;
        _verticalLayout.childControlWidth = true;
        _verticalLayout.childControlHeight = true;
        _verticalLayout.childForceExpandWidth = true;
        _verticalLayout.childForceExpandHeight = false;

        learningBadge = CreateBadge(rootGo.transform, "LEARNING", out _badgeLabelText);
        titleText = CreateTmp(rootGo.transform);
        bodyText = CreateTmp(rootGo.transform);

        var imageRow = new GameObject("HintImageRow", typeof(RectTransform), typeof(LayoutElement));
        imageRow.transform.SetParent(rootGo.transform, false);
        _imageLayoutElement = imageRow.GetComponent<LayoutElement>();
        _imageLayoutElement.preferredHeight = 96f;
        _imageLayoutElement.flexibleWidth = 1f;
        hintImage = imageRow.AddComponent<Image>();
        hintImage.preserveAspect = true;
        hintImage.color = Color.white;
        hintImage.gameObject.SetActive(false);

        skipButton = CreateSkipButton(
            rootGo.transform,
            out _skipLayoutElement,
            out _skipLabelText,
            out skipButtonImage,
            out skipButtonLabel);
        playAudioButton = CreatePlayAudioButton(rootGo.transform, out _listenLayoutElement, out playAudioButtonImage, out playAudioButtonLabel);
        playAudioButton.onClick.AddListener(PlayTipAudio);

        if (hintAudioSource == null)
        {
            hintAudioSource = rootGo.AddComponent<AudioSource>();
            hintAudioSource.playOnAwake = false;
            hintAudioSource.spatialBlend = 0f;
        }

        panelBackground = CreateBackgroundLayer(rootGo.transform);
        ApplyAllTypography(defaultLayout, introMode: false);
        ApplySkipButtonStyle(defaultLayout);
    }

    private void CacheLayoutComponents()
    {
        if (panelRoot == null) return;
        if (_verticalLayout == null)
            _verticalLayout = panelRoot.GetComponent<VerticalLayoutGroup>();
        if (_contentFitter == null)
            _contentFitter = panelRoot.GetComponent<ContentSizeFitter>();

        if (panelBackground == null)
        {
            var bg = panelRoot.Find("PanelBackground");
            if (bg != null)
                panelBackground = bg.GetComponent<Image>();
        }

        if (hintImage != null && _imageLayoutElement == null)
            _imageLayoutElement = hintImage.GetComponent<LayoutElement>();

        CacheTypographyRefs();
    }

    private void EnsureBackgroundLayer()
    {
        if (panelRoot == null) return;
        CacheLayoutComponents();

        bool bgOnRoot = panelBackground != null && panelBackground.gameObject == panelRoot.gameObject;
        if (bgOnRoot)
        {
#if UNITY_EDITOR
            if (!Application.isPlaying)
                DestroyImmediate(panelBackground);
            else
#endif
                Destroy(panelBackground);

            panelBackground = null;
        }

        if (panelBackground == null)
            panelBackground = CreateBackgroundLayer(panelRoot);
    }

    private static Image CreateBackgroundLayer(Transform panelRootTransform)
    {
        var existing = panelRootTransform.Find("PanelBackground");
        if (existing != null)
        {
            var existingImg = existing.GetComponent<Image>();
            if (existingImg != null)
                return existingImg;
        }

        var bgGo = new GameObject("PanelBackground", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        bgGo.transform.SetParent(panelRootTransform, false);
        bgGo.transform.SetAsFirstSibling();
        StretchRectToParent(bgGo.GetComponent<RectTransform>());
        var le = bgGo.GetComponent<LayoutElement>();
        le.ignoreLayout = true;

        var bgImage = bgGo.GetComponent<Image>();
        bgImage.raycastTarget = true;
        bgImage.color = Color.white;
        return bgImage;
    }

    private static void StretchRectToParent(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = Vector2.zero;
        rt.sizeDelta = Vector2.zero;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    private Canvas FindOverlayCanvas()
    {
        var parentCanvas = GetComponentInParent<Canvas>();
        if (parentCanvas != null)
            return parentCanvas;

        Canvas canvas = null;
#if UNITY_2023_1_OR_NEWER
        var canvases = FindObjectsByType<Canvas>(FindObjectsInactive.Include, FindObjectsSortMode.None);
#else
        var canvases = Resources.FindObjectsOfTypeAll<Canvas>();
#endif
        for (int i = 0; i < canvases.Length; i++)
        {
            if (canvases[i].renderMode == RenderMode.ScreenSpaceOverlay ||
                canvases[i].renderMode == RenderMode.ScreenSpaceCamera)
            {
                canvas = canvases[i];
                break;
            }
        }
        return canvas;
    }

    private static GameObject CreateBadge(Transform parent, string label, out TextMeshProUGUI labelText)
    {
        var go = new GameObject("LearningBadge", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        go.transform.SetParent(parent, false);
        var img = go.GetComponent<Image>();
        img.color = new Color(0.2f, 0.75f, 0.45f, 1f);
        var le = go.GetComponent<LayoutElement>();
        le.preferredHeight = 28f;

        var textGo = new GameObject("Label", typeof(RectTransform));
        textGo.transform.SetParent(go.transform, false);
        var rt = textGo.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        labelText = textGo.AddComponent<TextMeshProUGUI>();
        labelText.text = label;
        return go;
    }

    private static TextMeshProUGUI CreateTmp(Transform parent)
    {
        var go = new GameObject("Text", typeof(RectTransform));
        go.transform.SetParent(parent, false);
        return go.AddComponent<TextMeshProUGUI>();
    }

    private static Button CreateSkipButton(
        Transform parent,
        out LayoutElement layoutElement,
        out TextMeshProUGUI labelText,
        out Image iconImage,
        out TextMeshProUGUI labelRef)
    {
        var go = new GameObject("SkipIntroButton", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
        go.transform.SetParent(parent, false);
        layoutElement = go.GetComponent<LayoutElement>();
        layoutElement.preferredHeight = 36f;
        var img = go.GetComponent<Image>();
        img.color = new Color(0.55f, 0.55f, 0.58f, 1f);
        var btn = go.GetComponent<Button>();

        var iconGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
        iconGo.transform.SetParent(go.transform, false);
        var iconRt = iconGo.GetComponent<RectTransform>();
        iconRt.anchorMin = Vector2.zero;
        iconRt.anchorMax = Vector2.one;
        iconRt.offsetMin = Vector2.zero;
        iconRt.offsetMax = Vector2.zero;
        iconImage = iconGo.GetComponent<Image>();
        iconImage.preserveAspect = true;
        iconImage.color = Color.white;
        iconGo.SetActive(false);

        var labelGo = new GameObject("Text", typeof(RectTransform));
        labelGo.transform.SetParent(go.transform, false);
        var rt = labelGo.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        labelText = labelGo.AddComponent<TextMeshProUGUI>();
        labelRef = labelText;

        go.SetActive(false);
        return btn;
    }

    private static Button CreatePlayAudioButton(
        Transform parent,
        out LayoutElement layoutElement,
        out Image buttonImage,
        out TextMeshProUGUI label)
    {
        var go = new GameObject("PlayTipAudioButton", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
        go.transform.SetParent(parent, false);
        layoutElement = go.GetComponent<LayoutElement>();
        layoutElement.preferredHeight = 40f;
        layoutElement.preferredWidth = 140f;
        buttonImage = go.GetComponent<Image>();
        buttonImage.color = Color.white;
        var btn = go.GetComponent<Button>();

        var labelGo = new GameObject("Text", typeof(RectTransform));
        labelGo.transform.SetParent(go.transform, false);
        var rt = labelGo.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        label = labelGo.AddComponent<TextMeshProUGUI>();

        go.SetActive(false);
        return btn;
    }

    private void Awake()
    {
        defaultLayout.ApplyResourcesFallback();
        if (playAudioButton != null)
            playAudioButton.onClick.AddListener(PlayTipAudio);
    }

    private void OnValidate()
    {
#if UNITY_EDITOR
        if (!Application.isPlaying)
            ScheduleEditorRefresh();
#endif
    }

    private void OnDestroy()
    {
        if (playAudioButton != null)
            playAudioButton.onClick.RemoveListener(PlayTipAudio);
    }

#if UNITY_EDITOR
    private void ScheduleEditorRefresh()
    {
        UnityEditor.EditorApplication.delayCall -= EditorDelayedRefresh;
        UnityEditor.EditorApplication.delayCall += EditorDelayedRefresh;
    }

    private void EditorDelayedRefresh()
    {
        UnityEditor.EditorApplication.delayCall -= EditorDelayedRefresh;
        if (this == null || Application.isPlaying) return;
        defaultLayout?.ApplyResourcesFallback();
        RefreshLayoutPreview();
    }

    [ContextMenu("Reload Corner Hint Resources")]
    private void EditorReloadResources()
    {
        defaultLayout.panelBackground = null;
        defaultLayout.listenButtonSprite = null;
        defaultLayout.ApplyResourcesFallback();
        RefreshLayoutPreview();
        UnityEditor.EditorUtility.SetDirty(this);
    }
#endif
}
