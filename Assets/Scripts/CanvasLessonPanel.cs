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

    private bool _built;
    private Coroutine _imageLoadRoutine;
    private Coroutine _audioLoadRoutine;
    private string _loadingImageUrl;
    private string _loadingAudioUrl;
    private CanvasLessonData _current;
    private RectTransform _chunkCardRoot;
    private TextMeshProUGUI _patternLabel;
    private static readonly Dictionary<string, Sprite> UrlSpriteCache = new Dictionary<string, Sprite>();
    private static readonly Dictionary<string, AudioClip> UrlAudioClipCache = new Dictionary<string, AudioClip>();

    public void EnsureBuilt()
    {
        if (_built && panelRoot != null) return;

        Canvas canvas = FindOverlayCanvas();
        if (canvas == null)
        {
            Debug.LogWarning("[CanvasLessonPanel] No canvas found — panel not created.");
            return;
        }

        if (panelRoot == null)
            BuildPanel(canvas.transform);

        _built = panelRoot != null;
    }

    public void Show(CanvasLessonData lesson)
    {
        EnsureBuilt();
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
        PopulateTokenRow(exampleChunkRow, lesson.exampleChunk);

        bool hasPattern = lesson.patternPreview != null && lesson.patternPreview.Count > 0;
        if (_patternLabel != null)
        {
            // Default: hide "PATTERN" — only show when teacher sets a non-empty label.
            string patternText = ResolveSectionLabel(lesson.patternLabel, null);
            bool showPatternLabel = hasPattern && !string.IsNullOrEmpty(patternText);
            _patternLabel.gameObject.SetActive(showPatternLabel);
            if (showPatternLabel) _patternLabel.text = patternText;
        }
        PopulateTokenRow(patternRow, lesson.patternPreview);
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
        // Upper playfield — keep clear of the center RUN button.
        panelRoot.anchorMin = new Vector2(0.5f, 0.74f);
        panelRoot.anchorMax = new Vector2(0.5f, 0.74f);
        panelRoot.pivot = new Vector2(0.5f, 0.5f);
        panelRoot.sizeDelta = new Vector2(640f, 280f);
        panelRoot.anchoredPosition = Vector2.zero;

        var bg = rootGo.GetComponent<Image>();
        bg.color = new Color(1f, 1f, 1f, 0.98f);
        bg.raycastTarget = false;

        // Behind palette / RUN / strip / result popups on the same overlay canvas.
        // (Green playfield is world geometry, so this stays visible above it.)
        rootGo.transform.SetAsFirstSibling();

        // Soft outline card feel
        var outline = rootGo.AddComponent<Outline>();
        outline.effectColor = new Color(0.78f, 0.82f, 0.92f, 0.9f);
        outline.effectDistance = new Vector2(2f, -2f);

        var vlg = rootGo.GetComponent<VerticalLayoutGroup>();
        vlg.padding = new RectOffset(36, 36, 28, 28);
        vlg.spacing = 18f;
        vlg.childAlignment = TextAnchor.UpperCenter;
        vlg.childControlHeight = true;
        vlg.childControlWidth = true;
        vlg.childForceExpandHeight = false;
        vlg.childForceExpandWidth = true;

        var fitter = rootGo.GetComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        promptText = CreateTmp("Prompt", panelRoot, 32, FontStyles.Bold, new Color(0.12f, 0.14f, 0.22f));
        promptText.alignment = TextAlignmentOptions.Center;
        promptText.lineSpacing = -8f;
        var promptLe = promptText.GetComponent<LayoutElement>();
        if (promptLe != null) promptLe.preferredWidth = 640f;

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

        patternRow = CreateTokenRow("PatternPreviewRow", panelRoot);

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

    private void PopulateTokenRow(RectTransform row, List<string> tokens)
    {
        if (row == null) return;
        for (int i = row.childCount - 1; i >= 0; i--)
            Destroy(row.GetChild(i).gameObject);

        bool has = tokens != null && tokens.Count > 0;
        row.gameObject.SetActive(has);
        if (!has) return;

        foreach (var raw in tokens)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var go = new GameObject("Token", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
            go.transform.SetParent(row, false);
            var img = go.GetComponent<Image>();
            img.sprite = SpriteForToken(raw);
            img.preserveAspect = true;
            img.color = Color.white;
            var le = go.GetComponent<LayoutElement>();
            le.preferredWidth = 64f;
            le.preferredHeight = 64f;
            le.minWidth = 64f;
            le.minHeight = 64f;

            // Soft chip background when using a sprite
            if (img.sprite != null)
            {
                // Keep sprite; add subtle rounded plate behind via color tint
                img.color = Color.white;
            }
            else
            {
                var label = CreateTmp("TokLabel", go.transform, 12, FontStyles.Bold, new Color(0.2f, 0.2f, 0.3f));
                label.text = ShortLabel(raw);
                label.alignment = TextAlignmentOptions.Center;
                img.color = new Color(0.93f, 0.95f, 1f, 1f);
            }
        }
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
        foreach (var c in canvases)
        {
            if (c == null || !c.isActiveAndEnabled) continue;
            if (c.renderMode == RenderMode.ScreenSpaceOverlay)
                return c;
            if (best == null) best = c;
        }
        return best;
    }
}
