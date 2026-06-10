using UnityEngine;
using TMPro;

/// <summary>TextMeshPro settings for corner hint UI (font, size, alignment, spacing).</summary>
[System.Serializable]
public class CornerHintTextStyle
{
    [Tooltip("Leave empty to use Default Font on the panel layout.")]
    public TMP_FontAsset font;
    [Min(1f)]
    public float fontSize = 18f;
    public FontStyles fontStyle = FontStyles.Normal;
    public Color color = Color.black;
    public TextAlignmentOptions alignment = TextAlignmentOptions.TopLeft;
    [Range(-50f, 50f)]
    public float characterSpacing;
    [Range(-50f, 100f)]
    public float lineSpacing;
    [Tooltip("Extra space between words (TMP word spacing).")]
    [Range(-50f, 50f)]
    public float wordSpacing;
    public bool enableWordWrapping = true;
    public bool enableAutoSize;
    [Min(1f)]
    public float fontSizeMin = 12f;
    [Min(1f)]
    public float fontSizeMax = 72f;

    public static CornerHintTextStyle DefaultTitle() => new CornerHintTextStyle
    {
        fontSize = 22f,
        fontStyle = FontStyles.Bold,
        color = Color.black,
        alignment = TextAlignmentOptions.TopLeft,
    };

    public static CornerHintTextStyle DefaultBody() => new CornerHintTextStyle
    {
        fontSize = 18f,
        fontStyle = FontStyles.Normal,
        color = new Color(0.15f, 0.15f, 0.18f, 1f),
        alignment = TextAlignmentOptions.TopLeft,
        lineSpacing = 0f,
    };

    public static CornerHintTextStyle DefaultBadge() => new CornerHintTextStyle
    {
        fontSize = 14f,
        fontStyle = FontStyles.Bold,
        color = Color.white,
        alignment = TextAlignmentOptions.Center,
        enableWordWrapping = false,
    };

    public static CornerHintTextStyle DefaultButtonLabel() => new CornerHintTextStyle
    {
        fontSize = 15f,
        fontStyle = FontStyles.Bold,
        color = Color.white,
        alignment = TextAlignmentOptions.Center,
        enableWordWrapping = false,
    };
}

public static class CornerHintTypographyApplier
{
    public static void Apply(
        TextMeshProUGUI tmp,
        CornerHintTextStyle style,
        TMP_FontAsset fallbackFont,
        Color? colorOverride = null)
    {
        if (tmp == null || style == null) return;

        TMP_FontAsset font = style.font != null ? style.font : fallbackFont;
        if (font != null)
            tmp.font = font;

        if (style.enableAutoSize)
        {
            tmp.enableAutoSizing = true;
            tmp.fontSizeMin = Mathf.Min(style.fontSizeMin, style.fontSizeMax);
            tmp.fontSizeMax = Mathf.Max(style.fontSizeMin, style.fontSizeMax);
            tmp.fontSize = style.fontSizeMax;
        }
        else
        {
            tmp.enableAutoSizing = false;
            tmp.fontSize = style.fontSize;
        }

        tmp.fontStyle = style.fontStyle;
        tmp.color = colorOverride ?? style.color;
        tmp.alignment = style.alignment;
        tmp.characterSpacing = style.characterSpacing;
        tmp.lineSpacing = style.lineSpacing;
        tmp.wordSpacing = style.wordSpacing;
        tmp.enableWordWrapping = style.enableWordWrapping;
    }
}

