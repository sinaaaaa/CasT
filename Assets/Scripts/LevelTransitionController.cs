using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Modern cinematic transitions for game boot, intro → item 1, and item → item.
/// Soft cover + title card + accent bar (no hard cut / previous-level flash).
/// </summary>
public class LevelTransitionController : MonoBehaviour
{
    public enum TransitionKind
    {
        Boot,
        IntroToFirstItem,
        ItemToItem,
        IntroStep
    }

    [Header("Look")]
    public Color coverColor = new Color(0.04f, 0.07f, 0.12f, 1f);
    public Color accentColor = new Color(0.35f, 0.78f, 1f, 1f);
    public Color titleColor = new Color(0.95f, 0.97f, 1f, 1f);
    public Color subtitleColor = new Color(0.72f, 0.8f, 0.9f, 0.92f);
    public int canvasSortingOrder = 480;

    [Header("Boot")]
    public string bootTitle = "SPARC";
    public string bootSubtitleLoading = "Loading your items…";
    public string bootSubtitleReady = "Ready";
    [Range(0.2f, 2f)] public float bootMinCoverSeconds = 0.85f;
    [Range(0.2f, 1.5f)] public float bootRevealSeconds = 0.7f;

    [Header("Item → item")]
    [Range(0.15f, 1.2f)] public float fadeOutSeconds = 0.42f;
    [Range(0.1f, 1.2f)] public float holdCoveredSeconds = 0.35f;
    [Range(0.2f, 1.5f)] public float fadeInSeconds = 0.55f;
    [Range(0f, 0.8f)] public float postRevealSettleSeconds = 0.12f;
    [Range(0.2f, 1.5f)] public float titleCardHoldSeconds = 0.55f;

    [Header("Intro → first item")]
    [Range(0.25f, 1.5f)] public float introExitFadeSeconds = 0.5f;
    [Range(0.4f, 2.5f)] public float introToItemTitleHoldSeconds = 1.05f;
    [Range(0.25f, 1.5f)] public float introToItemRevealSeconds = 0.65f;
    public string introCompleteHeadline = "Great job!";
    public string introCompleteSubline = "Time for Item 1";

    [Header("Intro step")]
    [Range(0.05f, 1f)] public float introStepFadeOutSeconds = 0.28f;
    [Range(0f, 0.8f)] public float introStepHoldSeconds = 0.15f;
    [Range(0.05f, 1f)] public float introStepFadeInSeconds = 0.32f;
    [Range(0.1f, 2f)] public float delayBetweenIntroStepsSeconds = 0.7f;
    [Range(0f, 1.5f)] public float delayAfterWelcomeSeconds = 0.35f;

    public bool IsCovering => _rootGroup != null && _rootGroup.gameObject.activeInHierarchy && _rootGroup.alpha > 0.02f;
    public bool IsBusy { get; private set; }

    /// <summary>True while a fade/cover is active — gameplay SFX / tip audio should wait.</summary>
    public static bool ShouldMuteGameplayAudio()
    {
        var all = FindObjectsOfType<LevelTransitionController>();
        for (int i = 0; i < all.Length; i++)
        {
            var t = all[i];
            if (t != null && (t.IsBusy || t.IsCovering))
                return true;
        }
        return false;
    }

    private Canvas _canvas;
    private CanvasGroup _rootGroup;
    private CanvasGroup _cardGroup;
    private Image _coverImage;
    private Image _vignetteImage;
    private Image _glowImage;
    private Image _accentBar;
    private RectTransform _accentBarRt;
    private TextMeshProUGUI _titleText;
    private TextMeshProUGUI _subtitleText;
    private Coroutine _shimmerRoutine;
    private bool _built;

    public void EnsureBuilt()
    {
        if (_built && _rootGroup != null) return;
        BuildOverlay();
    }

    /// <summary>Call as early as possible so the first frames never show an unfinished playfield.</summary>
    public IEnumerator FadeOutForItemChange()
    {
        EnsureBuilt();
        NotifyTransitionStarting();
        SetCardVisible(false);
        yield return FadeRootTo(1f, fadeOutSeconds, blockInput: true);
    }

    public IEnumerator PlayIntroToFirstItemCover()
    {
        EnsureBuilt();
        NotifyTransitionStarting();
        SetCardVisible(true);
        SetTitle(introCompleteHeadline, introCompleteSubline);
        _accentBarRt.localScale = new Vector3(0.08f, 1f, 1f);
        yield return FadeRootTo(1f, introExitFadeSeconds, blockInput: true);
        yield return AnimateAccentTo(1f, 0.45f);
    }

    public void BeginBootCoverImmediate()
    {
        EnsureBuilt();
        EnsureOverlayActiveForCover();
        NotifyTransitionStarting();
        StopShimmer();
        SetCardVisible(true);
        SetTitle(bootTitle, bootSubtitleLoading);
        _accentBarRt.localScale = new Vector3(0.15f, 1f, 1f);
        SnapCover(1f, blockInput: true);
        _shimmerRoutine = StartCoroutine(AccentShimmerLoop());
    }

    public IEnumerator FinishBootAndReveal(string readyTitle, string readySubtitle)
    {
        EnsureBuilt();
        EnsureOverlayActiveForCover();
        SetCardVisible(true);
        if (!string.IsNullOrEmpty(readyTitle))
            SetTitle(readyTitle, string.IsNullOrEmpty(readySubtitle) ? bootSubtitleReady : readySubtitle);
        else
            SetTitle(bootTitle, bootSubtitleReady);

        yield return AnimateAccentTo(1f, 0.35f);
        yield return new WaitForSecondsRealtime(0.2f);
        yield return RevealFromCover(bootRevealSeconds, hideCard: true);
    }

    public IEnumerator HoldThenFadeInForItemChange()
    {
        if (holdCoveredSeconds > 0f)
            yield return new WaitForSecondsRealtime(holdCoveredSeconds);
        yield return RevealFromCover(fadeInSeconds, hideCard: true);
    }

    /// <summary>Modern item switch: cover → title card → reveal.</summary>
    public IEnumerator PlayItemTransitionReveal(string itemTitle, string itemSubtitle = null)
    {
        EnsureBuilt();
        EnsureOverlayActiveForCover();
        SetCardVisible(true);
        SetTitle(
            string.IsNullOrEmpty(itemTitle) ? "Next item" : itemTitle,
            string.IsNullOrEmpty(itemSubtitle) ? "Get ready" : itemSubtitle);
        _accentBarRt.localScale = new Vector3(0.12f, 1f, 1f);
        yield return AnimateAccentTo(1f, 0.4f);
        if (titleCardHoldSeconds > 0f)
            yield return new WaitForSecondsRealtime(titleCardHoldSeconds);
        yield return RevealFromCover(fadeInSeconds, hideCard: true);
    }

    public IEnumerator PlayIntroToFirstItemReveal(string itemTitle, string itemSubtitle = "Let's play")
    {
        EnsureBuilt();
        EnsureOverlayActiveForCover();
        SetCardVisible(true);
        SetTitle(
            string.IsNullOrEmpty(itemTitle) ? "Item 1" : itemTitle,
            string.IsNullOrEmpty(itemSubtitle) ? "Let's play" : itemSubtitle);
        _accentBarRt.localScale = new Vector3(0.2f, 1f, 1f);
        yield return AnimateAccentTo(1f, 0.35f);
        if (introToItemTitleHoldSeconds > 0f)
            yield return new WaitForSecondsRealtime(introToItemTitleHoldSeconds);
        yield return RevealFromCover(introToItemRevealSeconds, hideCard: true);
    }

    public IEnumerator CoverBrieflyForIntroStep(System.Action midSwap)
    {
        EnsureBuilt();
        NotifyTransitionStarting();
        SetCardVisible(false);
        yield return FadeRootTo(1f, introStepFadeOutSeconds, blockInput: true);
        midSwap?.Invoke();
        if (introStepHoldSeconds > 0f)
            yield return new WaitForSecondsRealtime(introStepHoldSeconds);
        yield return RevealFromCover(introStepFadeInSeconds, hideCard: true);
    }

    public IEnumerator FadeTo(float targetAlpha, float duration, bool blockInput)
    {
        yield return FadeRootTo(targetAlpha, duration, blockInput);
    }

    public void SnapCover(float alpha, bool blockInput)
    {
        EnsureBuilt();
        float a = Mathf.Clamp01(alpha);
        bool covered = a > 0.01f;
        if (covered || blockInput)
            EnsureOverlayActiveForCover();
        _rootGroup.alpha = a;
        _rootGroup.blocksRaycasts = blockInput || covered;
        _rootGroup.interactable = false;
        IsBusy = blockInput || covered;
        if (_canvas != null)
            _canvas.enabled = covered || blockInput;
        if (_coverImage != null)
            _coverImage.raycastTarget = covered || blockInput;
        if (!covered && !blockInput)
            ForceHide();
    }

    /// <summary>
    /// Fully disables the transition overlay so it cannot wash out / steal clicks from popups (e.g. Welcome START).
    /// </summary>
    public void ForceHide()
    {
        EnsureBuilt();
        StopShimmer();
        if (_cardGroup != null)
            _cardGroup.alpha = 0f;
        _rootGroup.alpha = 0f;
        _rootGroup.blocksRaycasts = false;
        _rootGroup.interactable = false;
        IsBusy = false;
        if (_coverImage != null)
            _coverImage.raycastTarget = false;
        if (_vignetteImage != null)
            _vignetteImage.raycastTarget = false;
        if (_canvas != null)
            _canvas.enabled = false;
        if (_rootGroup != null)
            _rootGroup.gameObject.SetActive(false);
    }

    /// <summary>Begin a cover: mute tip audio so it cannot play under an unfinished fade.</summary>
    public void NotifyTransitionStarting()
    {
        IsBusy = true;
        var hints = FindObjectsOfType<LevelCornerHintPanel>();
        for (int i = 0; i < hints.Length; i++)
        {
            if (hints[i] != null)
                hints[i].StopHintAudio();
        }
    }

    public void EnsureOverlayActiveForCover()
    {
        EnsureBuilt();
        if (_rootGroup != null && !_rootGroup.gameObject.activeSelf)
            _rootGroup.gameObject.SetActive(true);
        if (_canvas != null)
            _canvas.enabled = true;
    }

    public void SetStatus(string title, string subtitle)
    {
        EnsureBuilt();
        SetTitle(title, subtitle);
    }

    private IEnumerator RevealFromCover(float duration, bool hideCard)
    {
        EnsureOverlayActiveForCover();
        if (hideCard)
            yield return FadeCardTo(0f, Mathf.Min(0.28f, duration * 0.45f));
        yield return FadeRootTo(0f, duration, blockInput: false);
        if (postRevealSettleSeconds > 0f)
            yield return new WaitForSecondsRealtime(postRevealSettleSeconds);
        SetCardVisible(false);
        StopShimmer();
        // Critical: fully disable overlay so Welcome START is not washed out / blocked.
        ForceHide();
    }

    private IEnumerator FadeRootTo(float target, float duration, bool blockInput)
    {
        EnsureBuilt();
        EnsureOverlayActiveForCover();
        IsBusy = true;
        _rootGroup.blocksRaycasts = true;
        _rootGroup.interactable = false;
        if (_coverImage != null)
            _coverImage.raycastTarget = true;

        float start = _rootGroup.alpha;
        if (duration <= 0.001f)
        {
            _rootGroup.alpha = target;
        }
        else
        {
            float t = 0f;
            while (t < duration)
            {
                t += Time.unscaledDeltaTime;
                float u = EaseInOutCubic(Mathf.Clamp01(t / duration));
                _rootGroup.alpha = Mathf.Lerp(start, target, u);
                yield return null;
            }
            _rootGroup.alpha = target;
        }

        bool covered = target > 0.01f;
        _rootGroup.blocksRaycasts = blockInput || covered;
        IsBusy = blockInput || covered;
        if (_coverImage != null)
            _coverImage.raycastTarget = blockInput || covered;
        if (!covered && !blockInput)
            ForceHide();
        else if (!covered && !blockInput)
            IsBusy = false;
    }

    private void BuildOverlay()
    {
        var root = new GameObject(
            "LevelTransitionOverlay",
            typeof(RectTransform),
            typeof(Canvas),
            typeof(CanvasScaler),
            typeof(GraphicRaycaster),
            typeof(CanvasGroup));
        root.transform.SetParent(transform, false);

        _canvas = root.GetComponent<Canvas>();
        _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        _canvas.sortingOrder = canvasSortingOrder;
        _canvas.overrideSorting = true;

        var scaler = root.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1920, 1080);
        scaler.matchWidthOrHeight = 0.5f;

        _rootGroup = root.GetComponent<CanvasGroup>();
        _rootGroup.alpha = 0f;
        _rootGroup.blocksRaycasts = false;
        _rootGroup.interactable = false;

        _coverImage = CreateFullBleedImage(root.transform, "Cover", coverColor, 0);
        _vignetteImage = CreateFullBleedImage(root.transform, "Vignette", new Color(0f, 0f, 0f, 0.45f), 1);
        _vignetteImage.sprite = CreateRadialSprite(128, softEdge: true);
        _vignetteImage.type = Image.Type.Simple;
        _vignetteImage.preserveAspect = false;

        _glowImage = CreateCenteredImage(root.transform, "Glow", new Vector2(720, 720), new Color(accentColor.r, accentColor.g, accentColor.b, 0.14f), 2);
        _glowImage.sprite = CreateRadialSprite(96, softEdge: true);

        var card = new GameObject("TitleCard", typeof(RectTransform), typeof(CanvasGroup));
        card.transform.SetParent(root.transform, false);
        var cardRt = card.GetComponent<RectTransform>();
        cardRt.anchorMin = new Vector2(0.5f, 0.5f);
        cardRt.anchorMax = new Vector2(0.5f, 0.5f);
        cardRt.pivot = new Vector2(0.5f, 0.5f);
        cardRt.sizeDelta = new Vector2(760, 220);
        cardRt.anchoredPosition = Vector2.zero;
        _cardGroup = card.GetComponent<CanvasGroup>();
        _cardGroup.alpha = 0f;

        _titleText = CreateTmp(card.transform, "Title", 54f, titleColor, FontStyles.Bold, new Vector2(0.05f, 0.42f), new Vector2(0.95f, 0.92f));
        _subtitleText = CreateTmp(card.transform, "Subtitle", 26f, subtitleColor, FontStyles.Normal, new Vector2(0.08f, 0.12f), new Vector2(0.92f, 0.42f));

        var accentGo = new GameObject("AccentBar", typeof(RectTransform), typeof(Image));
        accentGo.transform.SetParent(card.transform, false);
        _accentBarRt = accentGo.GetComponent<RectTransform>();
        _accentBarRt.anchorMin = new Vector2(0.5f, 0.08f);
        _accentBarRt.anchorMax = new Vector2(0.5f, 0.08f);
        _accentBarRt.pivot = new Vector2(0.5f, 0.5f);
        _accentBarRt.sizeDelta = new Vector2(180, 4);
        _accentBar = accentGo.GetComponent<Image>();
        _accentBar.color = accentColor;
        _accentBar.raycastTarget = false;

        _built = true;
    }

    private static Image CreateFullBleedImage(Transform parent, string name, Color color, int sibling)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(Image));
        go.transform.SetParent(parent, false);
        go.transform.SetSiblingIndex(sibling);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        var img = go.GetComponent<Image>();
        img.color = color;
        img.raycastTarget = true;
        return img;
    }

    private static Image CreateCenteredImage(Transform parent, string name, Vector2 size, Color color, int sibling)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(Image));
        go.transform.SetParent(parent, false);
        go.transform.SetSiblingIndex(sibling);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = rt.anchorMax = rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = size;
        var img = go.GetComponent<Image>();
        img.color = color;
        img.raycastTarget = false;
        return img;
    }

    private static TextMeshProUGUI CreateTmp(
        Transform parent,
        string name,
        float size,
        Color color,
        FontStyles style,
        Vector2 anchorMin,
        Vector2 anchorMax)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(TextMeshProUGUI));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        var tmp = go.GetComponent<TextMeshProUGUI>();
        tmp.text = "";
        tmp.fontSize = size;
        tmp.color = color;
        tmp.fontStyle = style;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.enableWordWrapping = true;
        tmp.raycastTarget = false;
        return tmp;
    }

    private static Sprite CreateRadialSprite(int size, bool softEdge)
    {
        size = Mathf.Clamp(size, 32, 256);
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.wrapMode = TextureWrapMode.Clamp;
        tex.filterMode = FilterMode.Bilinear;
        float half = (size - 1) * 0.5f;
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float dx = (x - half) / half;
                float dy = (y - half) / half;
                float d = Mathf.Sqrt(dx * dx + dy * dy);
                float a = softEdge ? Mathf.Clamp01(1f - d) : (d <= 1f ? 1f : 0f);
                a = a * a;
                tex.SetPixel(x, y, new Color(1f, 1f, 1f, a));
            }
        }
        tex.Apply(false, true);
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
    }

    private void SetTitle(string title, string subtitle)
    {
        if (_titleText != null) _titleText.text = title ?? "";
        if (_subtitleText != null) _subtitleText.text = subtitle ?? "";
    }

    private void SetCardVisible(bool on)
    {
        if (_cardGroup == null) return;
        _cardGroup.alpha = on ? 1f : 0f;
        if (on && _accentBar != null)
            _accentBar.color = accentColor;
        if (on && _glowImage != null)
            _glowImage.color = new Color(accentColor.r, accentColor.g, accentColor.b, 0.14f);
        if (on && _coverImage != null)
            _coverImage.color = coverColor;
    }

    private IEnumerator FadeCardTo(float target, float duration)
    {
        if (_cardGroup == null) yield break;
        float start = _cardGroup.alpha;
        if (duration <= 0.001f)
        {
            _cardGroup.alpha = target;
            yield break;
        }
        float t = 0f;
        while (t < duration)
        {
            t += Time.unscaledDeltaTime;
            float u = EaseInOutCubic(Mathf.Clamp01(t / duration));
            _cardGroup.alpha = Mathf.Lerp(start, target, u);
            yield return null;
        }
        _cardGroup.alpha = target;
    }

    private IEnumerator AnimateAccentTo(float scaleX, float duration)
    {
        if (_accentBarRt == null) yield break;
        Vector3 start = _accentBarRt.localScale;
        Vector3 end = new Vector3(Mathf.Max(0.05f, scaleX), 1f, 1f);
        float t = 0f;
        while (t < duration)
        {
            t += Time.unscaledDeltaTime;
            float u = EaseOutCubic(Mathf.Clamp01(t / duration));
            _accentBarRt.localScale = Vector3.LerpUnclamped(start, end, u);
            yield return null;
        }
        _accentBarRt.localScale = end;
    }

    private IEnumerator AccentShimmerLoop()
    {
        while (true)
        {
            yield return AnimateAccentTo(0.85f, 0.7f);
            yield return AnimateAccentTo(0.25f, 0.7f);
        }
    }

    private void StopShimmer()
    {
        if (_shimmerRoutine != null)
        {
            StopCoroutine(_shimmerRoutine);
            _shimmerRoutine = null;
        }
    }

    private static float EaseInOutCubic(float x)
    {
        return x < 0.5f ? 4f * x * x * x : 1f - Mathf.Pow(-2f * x + 2f, 3f) / 2f;
    }

    private static float EaseOutCubic(float x)
    {
        return 1f - Mathf.Pow(1f - x, 3f);
    }
}
