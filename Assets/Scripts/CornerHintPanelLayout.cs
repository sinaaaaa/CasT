using UnityEngine;
using TMPro;

/// <summary>
/// Designer-tunable layout for the top-right corner hint panel (Unity Inspector).
/// Assign on <see cref="LevelCornerHintPanel"/> as defaults, or per <see cref="LevelCornerHint"/> when useCustomLayout is on.
/// </summary>
[System.Serializable]
public class CornerHintPanelLayout
{
    [Tooltip("Use anchored positions below instead of automatic vertical stacking.")]
    public bool useManualLayout;

    [Header("Panel")]
    [Tooltip("Panel background image (e.g. Resources/CornerHint/PanelBackground).")]
    public Sprite panelBackground;
    [Range(0f, 1f)]
    public float panelBackgroundAlpha = 1f;
    public Color panelColorTint = Color.white;
    [Tooltip("Only used when no Panel Background sprite is assigned (or Use Solid Fallback is on).")]
    public bool useSolidPanelFallback;
    public Color panelFillColor = new Color(1f, 1f, 1f, 0f);
    public Color introPanelFillColor = new Color(0.78f, 0.93f, 1f, 0.96f);
    [Min(120f)]
    public float panelWidth = 320f;
    [Tooltip("0 = auto height from content.")]
    public float panelHeight;
    public Vector2 panelOffset = new Vector2(-16f, -16f);

    [Header("Padding (auto layout)")]
    public float paddingLeft = 14f;
    public float paddingRight = 14f;
    public float paddingTop = 12f;
    public float paddingBottom = 12f;
    public float elementSpacing = 8f;

    [Header("Typography")]
    [Tooltip("Font for all text when a specific slot (title/body/etc.) has no font assigned.")]
    public TMP_FontAsset defaultFont;

    [Header("Title text")]
    public CornerHintTextStyle titleTypography = CornerHintTextStyle.DefaultTitle();
    public Color introTitleColor = new Color(0.12f, 0.45f, 0.55f, 1f);
    public CornerHintElementLayout titleLayout = CornerHintElementLayout.TitleDefault();

    [Header("Body text")]
    public CornerHintTextStyle bodyTypography = CornerHintTextStyle.DefaultBody();
    public CornerHintElementLayout bodyLayout = CornerHintElementLayout.BodyDefault();

    [Header("Learning badge")]
    public CornerHintTextStyle badgeTypography = CornerHintTextStyle.DefaultBadge();

    [Header("Listen button label")]
    [Tooltip("Shown when no Listen Button Sprite is set.")]
    public CornerHintTextStyle listenLabelTypography = CornerHintTextStyle.DefaultButtonLabel();
    public string listenButtonText = "Listen";

    [Header("Skip button label")]
    public CornerHintTextStyle skipLabelTypography = CornerHintTextStyle.DefaultButtonLabel();
    public string skipButtonText = "Skip introduction";

    [Header("Skip button image (intro)")]
    [Tooltip("When set, the Skip button shows this sprite instead of text.")]
    public Sprite skipButtonSprite;
    [Range(0f, 1f)]
    public float skipButtonSpriteAlpha = 1f;
    public Color skipButtonSpriteTint = Color.white;
    [Tooltip("When true, keeps sprite aspect ratio (may look smaller if sprite has padding). When false, fills the button rect.")]
    public bool skipButtonSpritePreserveAspect = true;
    [Min(0f)]
    public float skipButtonSpriteWidth = 180f;
    [Min(0f)]
    public float skipButtonSpriteHeight = 36f;
    [Tooltip("Helper: one-click size based on the sprite pixel size (assumes 100 pixels-per-unit UI scale).")]
    public bool skipButtonAutoSizeFromSprite;

    public void ApplySkipSizeFromSprite(float pixelsPerUnit = 100f)
    {
        if (skipButtonSprite == null) return;
        if (pixelsPerUnit <= 0f) pixelsPerUnit = 100f;
        var r = skipButtonSprite.rect;
        skipButtonSpriteWidth = Mathf.Max(0f, r.width / skipButtonSprite.pixelsPerUnit * pixelsPerUnit);
        skipButtonSpriteHeight = Mathf.Max(0f, r.height / skipButtonSprite.pixelsPerUnit * pixelsPerUnit);
    }

    [Header("Hint image")]
    [Min(0f)]
    public float imageWidth = 280f;
    [Min(0f)]
    public float imageHeight = 96f;
    public CornerHintElementLayout imageLayout = CornerHintElementLayout.ImageDefault();

    [Header("Listen button")]
    public Sprite listenButtonSprite;
    [Min(0f)]
    public float listenButtonWidth = 140f;
    [Min(0f)]
    public float listenButtonHeight = 40f;
    public CornerHintElementLayout listenButtonLayout = CornerHintElementLayout.ListenButtonDefault();

    [Header("Skip button (intro)")]
    [Min(0f)]
    public float skipButtonHeight = 36f;
    [Tooltip("Manual layout anchor/position for the Skip button (only used when Use Manual Layout is enabled).")]
    public CornerHintElementLayout skipButtonLayout = CornerHintElementLayout.SkipButtonDefault();

    public void ApplyResourcesFallback()
    {
        if (panelBackground == null)
            panelBackground = Resources.Load<Sprite>("CornerHint/PanelBackground");
        if (listenButtonSprite == null)
            listenButtonSprite = Resources.Load<Sprite>("CornerHint/ListenButton");
        if (skipButtonSprite == null)
            skipButtonSprite = Resources.Load<Sprite>("CornerHint/SkipButton");
    }

    public void MergeFrom(CornerHintPanelLayout other)
    {
        if (other == null) return;
        useManualLayout = other.useManualLayout;
        if (other.panelBackground != null) panelBackground = other.panelBackground;
        panelBackgroundAlpha = other.panelBackgroundAlpha;
        panelColorTint = other.panelColorTint;
        useSolidPanelFallback = other.useSolidPanelFallback;
        panelFillColor = other.panelFillColor;
        introPanelFillColor = other.introPanelFillColor;
        if (other.panelWidth > 0f) panelWidth = other.panelWidth;
        panelHeight = other.panelHeight;
        panelOffset = other.panelOffset;
        paddingLeft = other.paddingLeft;
        paddingRight = other.paddingRight;
        paddingTop = other.paddingTop;
        paddingBottom = other.paddingBottom;
        elementSpacing = other.elementSpacing;
        if (other.defaultFont != null) defaultFont = other.defaultFont;
        titleTypography = other.titleTypography;
        introTitleColor = other.introTitleColor;
        titleLayout = other.titleLayout;
        bodyTypography = other.bodyTypography;
        bodyLayout = other.bodyLayout;
        badgeTypography = other.badgeTypography;
        listenLabelTypography = other.listenLabelTypography;
        if (!string.IsNullOrEmpty(other.listenButtonText)) listenButtonText = other.listenButtonText;
        skipLabelTypography = other.skipLabelTypography;
        if (!string.IsNullOrEmpty(other.skipButtonText)) skipButtonText = other.skipButtonText;
        if (other.skipButtonSprite != null) skipButtonSprite = other.skipButtonSprite;
        skipButtonSpriteAlpha = other.skipButtonSpriteAlpha;
        skipButtonSpriteTint = other.skipButtonSpriteTint;
        skipButtonSpritePreserveAspect = other.skipButtonSpritePreserveAspect;
        if (other.skipButtonSpriteWidth > 0f) skipButtonSpriteWidth = other.skipButtonSpriteWidth;
        if (other.skipButtonSpriteHeight > 0f) skipButtonSpriteHeight = other.skipButtonSpriteHeight;
        if (other.imageWidth > 0f) imageWidth = other.imageWidth;
        if (other.imageHeight > 0f) imageHeight = other.imageHeight;
        imageLayout = other.imageLayout;
        if (other.listenButtonSprite != null) listenButtonSprite = other.listenButtonSprite;
        if (other.listenButtonWidth > 0f) listenButtonWidth = other.listenButtonWidth;
        if (other.listenButtonHeight > 0f) listenButtonHeight = other.listenButtonHeight;
        listenButtonLayout = other.listenButtonLayout;
        if (other.skipButtonHeight > 0f) skipButtonHeight = other.skipButtonHeight;
        skipButtonLayout = other.skipButtonLayout;
    }
}

/// <summary>Anchor + position for one panel child (manual layout mode).</summary>
[System.Serializable]
public struct CornerHintElementLayout
{
    public Vector2 anchorMin;
    public Vector2 anchorMax;
    public Vector2 pivot;
    public Vector2 anchoredPosition;
    public Vector2 sizeDelta;

    public static CornerHintElementLayout TitleDefault() => new CornerHintElementLayout
    {
        anchorMin = new Vector2(0f, 1f),
        anchorMax = new Vector2(1f, 1f),
        pivot = new Vector2(0.5f, 1f),
        anchoredPosition = new Vector2(0f, -36f),
        sizeDelta = new Vector2(-28f, 32f),
    };

    public static CornerHintElementLayout BodyDefault() => new CornerHintElementLayout
    {
        anchorMin = new Vector2(0f, 1f),
        anchorMax = new Vector2(1f, 1f),
        pivot = new Vector2(0.5f, 1f),
        anchoredPosition = new Vector2(0f, -72f),
        sizeDelta = new Vector2(-28f, 80f),
    };

    public static CornerHintElementLayout ImageDefault() => new CornerHintElementLayout
    {
        anchorMin = new Vector2(0.5f, 1f),
        anchorMax = new Vector2(0.5f, 1f),
        pivot = new Vector2(0.5f, 1f),
        anchoredPosition = new Vector2(0f, -160f),
        sizeDelta = new Vector2(280f, 96f),
    };

    public static CornerHintElementLayout ListenButtonDefault() => new CornerHintElementLayout
    {
        anchorMin = new Vector2(0.5f, 0f),
        anchorMax = new Vector2(0.5f, 0f),
        pivot = new Vector2(0.5f, 0f),
        anchoredPosition = new Vector2(0f, 14f),
        sizeDelta = new Vector2(140f, 40f),
    };

    public static CornerHintElementLayout SkipButtonDefault() => new CornerHintElementLayout
    {
        anchorMin = new Vector2(1f, 1f),
        anchorMax = new Vector2(1f, 1f),
        pivot = new Vector2(1f, 1f),
        anchoredPosition = new Vector2(-14f, -10f),
        sizeDelta = new Vector2(180f, 36f),
    };

    public void ApplyTo(RectTransform rt)
    {
        if (rt == null) return;
        rt.anchorMin = anchorMin;
        rt.anchorMax = anchorMax;
        rt.pivot = pivot;
        rt.anchoredPosition = anchoredPosition;
        rt.sizeDelta = sizeDelta;
    }
}
