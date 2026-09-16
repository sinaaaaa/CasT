using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Layout helpers for CommandBagCard (blue library) and ProgramBagInstance (yellow strip).
/// Source and dropped visuals are intentionally different hierarchies.
/// </summary>
public static class CommandBagUiHelper
{
    // Source card (blue panel) — commands lead; icon is supporting identity
    public const float SourcePreviewIconSize = 52f;
    public const float SourceBagIconSize = 28f;
    public const float SourceTitleRowHeight = 24f;
    public const float SourceCardMinHeight = 84f;
    public const float SourceCardHeight = 108f;
    public const float SourceCardSpacing = 8f;
    public const float SourceInnerPad = 10f;
    public const float SourceBodySpacing = 6f;
    public const float SourceDragHandleSize = 18f;

    // Dropped chip (yellow strip) — compact color identity + expand only
    public const float ProgramPreviewIconSize = 42f;
    public const float ProgramCardHeight = 84f;
    public const float ProgramChunkChipSize = 64f;
    public const float ProgramChunkBadgeSize = 36f;
    public const float ProgramChunkExpandSize = 26f;
    public const float ProgramCardGap = 6f;
    public const float ProgramCloseReserve = 24f;
    public const float ProgramInnerPadX = 6f;
    public const float ProgramInnerPadY = 4f;

    /// <summary>Blue sidebar card fill — matches Action Chunks panel (not white).</summary>
    public static readonly Color SourceChunkCardBlue = new Color(0.62f, 0.78f, 0.94f, 1f);
    public static readonly Color PeekPanelFill = new Color(0.96f, 0.98f, 1f, 0.98f);
    public static readonly Color PeekPanelBorder = new Color(0.22f, 0.45f, 0.78f, 1f);

    /// <summary>
    /// Soft card fill for peeks — never solid neon (keeps collapse chrome readable).
    /// </summary>
    public static Color PeekFillFromAccent(Color accent)
    {
        Color baseAccent = accent.a > 0.05f ? PuzzleFillFromCard(accent) : PuzzleColor(0);
        Color fill = Color.Lerp(baseAccent, Color.white, 0.82f);
        fill.a = 0.985f;
        return fill;
    }

    /// <summary>Border / collapse accents derived from the chunk color.</summary>
    public static Color PeekBorderFromAccent(Color accent)
    {
        Color baseAccent = accent.a > 0.05f ? PuzzleFillFromCard(accent) : PuzzleColor(0);
        return Color.Lerp(baseAccent, new Color(0.14f, 0.16f, 0.22f), 0.32f);
    }

    /// <summary>High-contrast icon tint for collapse on soft peek cards.</summary>
    public static Color PeekCollapseIconTint(Color accent)
    {
        Color baseAccent = accent.a > 0.05f ? PuzzleFillFromCard(accent) : PuzzleColor(0);
        Color.RGBToHSV(baseAccent, out float h, out float s, out float v);
        s = Mathf.Clamp01(Mathf.Max(s, 0.70f));
        v = Mathf.Clamp01(Mathf.Min(v, 0.52f));
        Color c = Color.HSVToRGB(h, s, v);
        c.a = 1f;
        return c;
    }

    /// <summary>Show every token in a bag preview (do not clip Repeat End).</summary>
    public const int MaxPreviewTokens = 24;

    public static readonly Color Clear = new Color(1f, 1f, 1f, 0f);

    public static readonly Color[] DefaultBagPastels =
    {
        new Color(0.93f, 0.82f, 0.90f),
        new Color(0.78f, 0.90f, 0.96f),
        new Color(0.80f, 0.93f, 0.82f),
        new Color(0.98f, 0.85f, 0.85f),
        new Color(0.90f, 0.86f, 0.98f),
        new Color(0.86f, 0.94f, 0.90f),
    };

    /// <summary>
    /// Fixed kid-friendly chunk palette (1=purple, 2=blue, 3=green, 4=orange…).
    /// </summary>
    public static readonly Color[] PuzzleAccents =
    {
        new Color(0.62f, 0.40f, 0.92f), // purple — Chunk 1
        new Color(0.28f, 0.58f, 0.96f), // blue — Chunk 2
        new Color(0.28f, 0.78f, 0.48f), // green — Chunk 3
        new Color(0.98f, 0.55f, 0.18f), // orange — Chunk 4
        new Color(0.92f, 0.38f, 0.55f), // pink
        new Color(0.20f, 0.72f, 0.78f), // teal
    };

    public static Color SoftPastel(string hex, int index)
    {
        if (!string.IsNullOrWhiteSpace(hex) && ColorUtility.TryParseHtmlString(hex.Trim(), out Color c))
        {
            float max = Mathf.Max(c.r, Mathf.Max(c.g, c.b));
            float min = Mathf.Min(c.r, Mathf.Min(c.g, c.b));
            bool alreadyPastel = max > 0.82f && (max - min) < 0.45f;
            return alreadyPastel ? c : Color.Lerp(c, Color.white, 0.55f);
        }
        return DefaultBagPastels[Mathf.Abs(index) % DefaultBagPastels.Length];
    }

    public static Color BorderFromPastel(Color pastel) =>
        Color.Lerp(pastel, new Color(0.22f, 0.24f, 0.30f), 0.32f);

    public static Color PuzzleColor(int index) =>
        PuzzleAccents[Mathf.Abs(index) % PuzzleAccents.Length];

    /// <summary>
    /// Resolve chunk identity color: platform chunk.color → else palette by display index.
    /// </summary>
    public static Color ResolveChunkIdentityColor(CommandChunkData chunk, int displayIndex)
    {
        if (chunk != null && !string.IsNullOrWhiteSpace(chunk.color) &&
            ColorUtility.TryParseHtmlString(chunk.color.Trim(), out Color parsed))
        {
            return PuzzleFillFromCard(parsed);
        }
        return PuzzleColor(Mathf.Max(0, displayIndex - 1));
    }

    /// <summary>Soft card fill derived from a chunk’s identity color.</summary>
    public static Color ChunkCardFillFromAccent(Color accent) =>
        Color.Lerp(accent, Color.white, 0.78f);

    /// <summary>Subtle card border from chunk accent (one clean stroke).</summary>
    public static Color ChunkCardBorderFromAccent(Color accent) =>
        Color.Lerp(accent, new Color(0.18f, 0.20f, 0.28f), 0.40f);

    /// <summary>
    /// Built-in puzzle-piece silhouette for chunks (never platform bag uploads).
    /// White transparent PNG from Resources; Image.color multiplies for card tint.
    /// </summary>
    const string BuiltInChunkPuzzleResourcePath = "UI/chunk-puzzle-icon";
    static Sprite _builtInChunkPuzzleSprite;

    public static Sprite GetBuiltInChunkPuzzleSprite(CharacterMove cm = null)
    {
        if (cm != null && cm.commandChunkIconSprite != null)
            return cm.commandChunkIconSprite;
        // Always resolve from Resources so PNG reimports pick up without stale static ref issues.
        if (_builtInChunkPuzzleSprite == null)
            _builtInChunkPuzzleSprite = Resources.Load<Sprite>(BuiltInChunkPuzzleResourcePath);
        return _builtInChunkPuzzleSprite;
    }

    /// <summary>
    /// Always the built-in puzzle icon — platform bag.icon uploads are ignored for chunks.
    /// </summary>
    public static Sprite ResolveChunkIconSprite(CharacterMove cm, Sprite overrideSprite = null)
    {
        return GetBuiltInChunkPuzzleSprite(cm);
    }

    /// <summary>Fill — clear chunk color (identity by color, not number).</summary>
    public static Color PuzzleFillFromCard(Color card)
    {
        if (card.a < 0.01f)
            return PuzzleColor(0);
        Color.RGBToHSV(card, out float h, out float s, out float v);
        s = Mathf.Clamp01(Mathf.Max(s, 0.68f));
        v = Mathf.Clamp01(Mathf.Clamp(v, 0.58f, 0.90f));
        Color c = Color.HSVToRGB(h, s, v);
        c.a = 1f;
        return c;
    }

    /// <summary>
    /// Thin outline — darker shade of the chunk color (never heavy black frames).
    /// </summary>
    public static Color PuzzleBorderFromCard(Color card)
    {
        Color.RGBToHSV(card, out float h, out float s, out float v);
        s = Mathf.Clamp01(Mathf.Max(s * 0.85f, 0.45f));
        v = Mathf.Clamp01(v * 0.55f);
        Color c = Color.HSVToRGB(h, s, v);
        c.a = 1f;
        return c;
    }

    const float ChunkIconSizeMin = 16f;
    const float ChunkIconSizeMax = 280f;
    const float ChunkRectSizeMin = 48f;

    public static float ChunkIconSizeBlue(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.chunkIconSizeBluePanel, ChunkIconSizeMin, ChunkIconSizeMax) : 36f;

    public static float ChunkIconSizeYellow(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.chunkIconSizeYellowStrip, ChunkIconSizeMin, ChunkIconSizeMax) : 40f;

    public static float ChunkIconSizePeek(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.chunkIconSizePeekPanel, ChunkIconSizeMin, ChunkIconSizeMax) : 32f;

    public static float ChunkRectWidthYellow(CharacterMove cm) =>
        cm != null
            ? Mathf.Clamp(cm.chunkRectWidthYellowStrip, ChunkRectSizeMin, 320f)
            : 72f;

    public static float ChunkRectHeightYellow(CharacterMove cm) =>
        cm != null
            ? Mathf.Clamp(cm.chunkRectHeightYellowStrip, ChunkRectSizeMin, 280f)
            : 64f;

    public static float ChunkRectHeightBlue(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.chunkRectHeightBluePanel, 72f, 320f) : 120f;

    public static float ChunkRectMinWidthBlue(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.chunkRectMinWidthBluePanel, 120f, 520f) : 260f;

    public static float ChunkPeekMinWidth(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.chunkPeekPanelMinWidth, 160f, 900f) : 320f;

    public static float ChunkPeekMinHeight(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.chunkPeekPanelMinHeight, 56f, 280f) : 96f;

    /// <summary>Yellow chip rectangle — ONLY from rect knobs (icon size never grows the chip).</summary>
    public static float ProgramChunkChipHeight(CharacterMove cm) =>
        ChunkRectHeightYellow(cm);

    public static float PreferredProgramChunkChipWidth(CharacterMove cm = null)
    {
        float icon = FittedYellowChunkIconSize(cm);
        float hug = icon + ProgramChunkExpandSize * 0.55f + 12f;
        float knob = ChunkRectWidthYellow(cm);
        return Mathf.Clamp(Mathf.Max(hug, Mathf.Min(knob, hug + 16f)), 64f, 200f);
    }

    /// <summary>
    /// Yellow icon size from the icon knob. Clamped only to the rectangle so the
    /// sprite grows inside a fixed chip (2px inset — no padding balloon).
    /// </summary>
    public static float FittedYellowChunkIconSize(CharacterMove cm)
    {
        float wanted = ChunkIconSizeYellow(cm);
        float maxFit = Mathf.Max(16f, Mathf.Min(ChunkRectWidthYellow(cm), ChunkRectHeightYellow(cm)) - 2f);
        return Mathf.Min(wanted, maxFit);
    }

    /// <summary>Blue card icon — slightly smaller than before; 4px inset.</summary>
    public static float FittedBlueChunkIconSize(CharacterMove cm)
    {
        float wanted = ChunkIconSizeBlue(cm);
        float maxFit = Mathf.Max(16f, ChunkRectHeightBlue(cm) - 8f);
        return Mathf.Min(wanted, maxFit);
    }

    /// <summary>Peek icon — knob only; clamped to peek height so it never forces padding.</summary>
    public static float FittedPeekChunkIconSize(CharacterMove cm)
    {
        float wanted = ChunkIconSizePeek(cm);
        float maxFit = Mathf.Max(16f, ChunkPeekMinHeight(cm) - 4f);
        return Mathf.Min(wanted, maxFit);
    }

    /// <summary>
    /// Tint for expand/collapse PNGs — keeps the chunk hue (not muddy grey).
    /// </summary>
    public static Color ChunkChromeTint(Color rectAccent)
    {
        if (rectAccent.a < 0.01f)
            return new Color(0.35f, 0.55f, 0.9f, 1f);

        Color.RGBToHSV(rectAccent, out float h, out float s, out float v);
        s = Mathf.Clamp01(Mathf.Max(s, 0.65f));
        v = Mathf.Clamp01(Mathf.Lerp(0.55f, 0.85f, v));
        Color c = Color.HSVToRGB(h, s, v);
        c.a = 1f;
        return c;
    }

    public static GameObject BuildPuzzleBadge(
        Transform parent,
        int number,
        Color accent,
        float size = 28f,
        Sprite iconSprite = null)
    {
        var go = new GameObject("Puzzle", typeof(RectTransform), typeof(LayoutElement));
        go.transform.SetParent(parent, false);

        Sprite spr = iconSprite != null ? iconSprite : GetBuiltInChunkPuzzleSprite();
        // Identity is COLOR only — numbers are never drawn on the icon.
        Color fill = accent.a > 0.05f
            ? PuzzleFillFromCard(accent)
            : (number > 0 ? PuzzleColor(number - 1) : PuzzleColor(0));
        // Thin darker-of-same-hue outline (not a black frame).
        Color border = PuzzleBorderFromCard(fill);

        if (spr != null)
        {
            // Soft game-asset look: one silhouette, thin rim, subtle shadow.
            float body = Mathf.Max(12f, size * 0.96f);
            const float rim = 0.94f; // thin stroke — avoids heavy double-frame look

            var borderGo = new GameObject("Border", typeof(RectTransform), typeof(Image), typeof(Shadow));
            borderGo.transform.SetParent(go.transform, false);
            var brt = borderGo.GetComponent<RectTransform>();
            brt.anchorMin = brt.anchorMax = brt.pivot = new Vector2(0.5f, 0.5f);
            brt.sizeDelta = new Vector2(body, body);
            var bImg = borderGo.GetComponent<Image>();
            bImg.sprite = spr;
            bImg.color = border;
            bImg.preserveAspect = true;
            bImg.raycastTarget = false;
            var shadow = borderGo.GetComponent<Shadow>();
            shadow.effectColor = new Color(0f, 0f, 0f, 0.16f);
            shadow.effectDistance = new Vector2(1.5f, -2f);
            shadow.useGraphicAlpha = true;

            var fillGo = new GameObject("Fill", typeof(RectTransform), typeof(Image));
            fillGo.transform.SetParent(go.transform, false);
            var frt = fillGo.GetComponent<RectTransform>();
            frt.anchorMin = frt.anchorMax = frt.pivot = new Vector2(0.5f, 0.5f);
            frt.sizeDelta = new Vector2(body * rim, body * rim);
            var fImg = fillGo.GetComponent<Image>();
            fImg.sprite = spr;
            fImg.color = fill;
            fImg.preserveAspect = true;
            fImg.raycastTarget = false;
        }
        else
        {
            var img = go.AddComponent<Image>();
            img.raycastTarget = false;
            img.color = fill;
            var shadow = go.AddComponent<Shadow>();
            shadow.effectColor = new Color(0f, 0f, 0f, 0.16f);
            shadow.effectDistance = new Vector2(1.5f, -2f);
        }

        // Numbers removed — color is the only identity on the icon.

        var le = go.GetComponent<LayoutElement>();
        le.preferredWidth = size;
        le.preferredHeight = size;
        le.minWidth = size;
        le.minHeight = size;
        go.GetComponent<RectTransform>().sizeDelta = new Vector2(size, size);
        return go;
    }

    /// <summary>Legacy API — retints the built-in puzzle (ignores uploaded sprites).</summary>
    public static void ApplyPuzzleBadgeIcon(Transform puzzleRoot, Sprite iconSprite, Color accentFallback, int number = 0)
    {
        ApplyPuzzleBadgeTint(puzzleRoot, accentFallback);
    }

    /// <summary>Update fill + border when the host card/chip color changes.</summary>
    public static void ApplyPuzzleBadgeTint(Transform puzzleRoot, Color cardAccent)
    {
        if (puzzleRoot == null) return;
        Color fill = PuzzleFillFromCard(cardAccent);
        Color border = PuzzleBorderFromCard(fill);

        // Strip any leftover number labels from older builds.
        var num = puzzleRoot.Find("N");
        if (num != null)
            UnityEngine.Object.DestroyImmediate(num.gameObject);

        var borderTr = puzzleRoot.Find("Border");
        var fillTr = puzzleRoot.Find("Fill");
        if (borderTr != null)
        {
            var bImg = borderTr.GetComponent<Image>();
            if (bImg != null) bImg.color = border;
        }
        if (fillTr != null)
        {
            var fImg = fillTr.GetComponent<Image>();
            if (fImg != null) fImg.color = fill;
            return;
        }

        var img = puzzleRoot.GetComponent<Image>();
        if (img != null)
            img.color = fill;
    }

    public static List<string> FlattenBagTokens(CommandBagData bag)
    {
        var list = new List<string>();
        if (bag?.chunks == null) return list;
        for (int i = 0; i < bag.chunks.Count; i++)
        {
            var chunk = bag.chunks[i];
            if (chunk?.tokens == null) continue;
            list.AddRange(chunk.tokens);
        }
        return list;
    }

    public static Sprite SpriteForToken(CharacterMove cm, string token)
    {
        if (cm == null || string.IsNullOrEmpty(token)) return null;
        if (ProgramSequenceUtil.IsRepeatStartToken(token, out _))
        {
            if (cm.repeatStartSprite != null) return cm.repeatStartSprite;
            if (cm.repeatSprite != null) return cm.repeatSprite;
            return cm.forwardSprite;
        }
        if (ProgramSequenceUtil.IsRepeatEndToken(token))
            return cm.repeatEndSprite != null ? cm.repeatEndSprite :
                (cm.repeatSprite != null ? cm.repeatSprite : cm.forwardSprite);

        switch (ProgramSequenceUtil.NormalizeMotion(token))
        {
            case "forward": return cm.forwardSprite;
            case "backward": return cm.backwardSprite;
            case "left": return cm.rotateLeftSprite;
            case "right": return cm.rotateRightSprite;
            default: return null;
        }
    }

    /// <summary>Make Image fully transparent but keep it for raycasts/mask if needed.</summary>
    public static void MakeTransparent(Image img, bool keepRaycast = true)
    {
        if (img == null) return;
        img.color = Clear;
        img.raycastTarget = keepRaycast;
    }

    /// <summary>
    /// Preferred width of one preview chip. Repeat Start/End use CharacterMove
    /// bagRepeatStartScale / bagRepeatEndScale (live Inspector knobs).
    /// </summary>
    public static float MeasureTokenChipWidth(string token, float iconSize, CharacterMove cm = null)
    {
        if (ProgramSequenceUtil.IsRepeatStartToken(token, out _))
            return iconSize * BagRepeatStartScale(cm);
        if (ProgramSequenceUtil.IsRepeatEndToken(token))
            return iconSize * BagRepeatEndScale(cm);
        return iconSize;
    }

    public static float MeasureTokenChipHeight(string token, float iconSize, CharacterMove cm = null)
    {
        if (ProgramSequenceUtil.IsRepeatStartToken(token, out _))
            return iconSize * BagRepeatStartScale(cm);
        if (ProgramSequenceUtil.IsRepeatEndToken(token))
            return iconSize * BagRepeatEndScale(cm);
        return iconSize;
    }

    public static float BagRepeatStartScale(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.bagRepeatStartScale, 0.4f, 3f) : 1.65f;

    public static float BagRepeatEndScale(CharacterMove cm) =>
        cm != null ? Mathf.Clamp(cm.bagRepeatEndScale, 0.4f, 3f) : 1.65f;

    /// <summary>
    /// Horizontal preview of bag/chunk tokens. Repeat count overlays Repeat End
    /// (canvas style). Start/End size from CharacterMove.bagRepeatStartScale / EndScale.
    /// </summary>
    public static RectTransform BuildIconPreviewRow(
        Transform parent,
        CharacterMove cm,
        IList<string> tokens,
        float iconSize = 28f,
        float spacing = 6f,
        int maxIcons = -1,
        Color? wellColor = null)
    {
        if (maxIcons <= 0) maxIcons = MaxPreviewTokens;

        var well = new GameObject(
            "PreviewWell",
            typeof(RectTransform),
            typeof(Image),
            typeof(HorizontalLayoutGroup),
            typeof(ContentSizeFitter),
            typeof(LayoutElement));
        well.transform.SetParent(parent, false);

        var wellRt = well.GetComponent<RectTransform>();
        wellRt.anchorMin = new Vector2(0f, 0.5f);
        wellRt.anchorMax = new Vector2(0f, 0.5f);
        wellRt.pivot = new Vector2(0f, 0.5f);

        var wellImg = well.GetComponent<Image>();
        wellImg.color = wellColor ?? new Color(1f, 1f, 1f, 0.35f);
        wellImg.raycastTarget = false;

        var hlg = well.GetComponent<HorizontalLayoutGroup>();
        hlg.padding = new RectOffset(6, 6, 3, 3);
        hlg.spacing = spacing;
        hlg.childAlignment = TextAnchor.MiddleLeft;
        hlg.childControlWidth = true;
        hlg.childControlHeight = true;
        hlg.childForceExpandWidth = false;
        hlg.childForceExpandHeight = false;

        float contentW = 0f;
        float contentH = iconSize;
        int shown = 0;
        int total = tokens != null ? tokens.Count : 0;
        int limit = Mathf.Min(total, maxIcons);
        int pendingRepeatCount = 0;

        for (int i = 0; i < limit; i++)
        {
            string tok = tokens[i];
            float chipW = MeasureTokenChipWidth(tok, iconSize, cm);
            float chipH = MeasureTokenChipHeight(tok, iconSize, cm);

            if (ProgramSequenceUtil.IsRepeatStartToken(tok, out int startCount))
            {
                pendingRepeatCount = ProgramSequenceUtil.ClampRepeatCount(startCount);
                CreateRepeatStartChip(well.transform, cm, chipW, chipH);
            }
            else if (ProgramSequenceUtil.IsRepeatEndToken(tok))
            {
                int endCount = pendingRepeatCount > 0 ? pendingRepeatCount : 1;
                CreateRepeatEndChip(well.transform, cm, chipW, chipH, endCount);
                pendingRepeatCount = 0;
            }
            else
            {
                CreateFixedIcon(well.transform, SpriteForToken(cm, tok), iconSize);
            }

            contentW += chipW;
            if (i > 0) contentW += spacing;
            contentH = Mathf.Max(contentH, chipH);
            shown++;
        }

        if (total > maxIcons)
        {
            var more = new GameObject("More", typeof(RectTransform), typeof(TextMeshProUGUI), typeof(LayoutElement));
            more.transform.SetParent(well.transform, false);
            var tmp = more.GetComponent<TextMeshProUGUI>();
            tmp.text = "…";
            tmp.fontSize = Mathf.Max(11f, iconSize * 0.55f);
            tmp.color = new Color(0.35f, 0.38f, 0.45f);
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.raycastTarget = false;
            float moreW = iconSize * 0.55f;
            var mle = more.GetComponent<LayoutElement>();
            mle.preferredWidth = moreW;
            mle.preferredHeight = iconSize;
            mle.minWidth = moreW;
            mle.minHeight = iconSize;
            contentW += spacing + moreW;
            shown++;
        }

        if (shown == 0)
            contentW = iconSize;

        float wellW = 12f + contentW;
        float wellH = contentH + 6f;

        var fitter = well.GetComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        var le = well.GetComponent<LayoutElement>();
        le.preferredWidth = wellW;
        le.preferredHeight = wellH;
        le.minWidth = wellW;
        le.minHeight = wellH;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;
        wellRt.sizeDelta = new Vector2(wellW, wellH);

        return wellRt;
    }

    /// <summary>Green Repeat Start — sized by bagRepeatStartScale.</summary>
    static void CreateRepeatStartChip(Transform parent, CharacterMove cm, float chipWidth, float chipHeight)
    {
        CreateFixedIcon(
            parent,
            SpriteForToken(cm, ProgramSequenceUtil.FormatRepeatStart(1)),
            chipHeight,
            chipWidth,
            preserveAspect: false);
    }

    /// <summary>
    /// Red Repeat End with canvas-style count badge overlaid.
    /// Size from bagRepeatEndScale; counter from bagRepeatCounter*.
    /// </summary>
    static void CreateRepeatEndChip(
        Transform parent, CharacterMove cm, float chipWidth, float chipHeight, int count)
    {
        count = ProgramSequenceUtil.ClampRepeatCount(count);

        var chip = new GameObject("RepeatEnd", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        chip.transform.SetParent(parent, false);

        var img = chip.GetComponent<Image>();
        img.sprite = SpriteForToken(cm, "repeat-end");
        img.preserveAspect = false;
        img.raycastTarget = false;
        img.color = img.sprite != null ? Color.white : new Color(0.95f, 0.55f, 0.25f, 1f);

        var le = chip.GetComponent<LayoutElement>();
        le.preferredWidth = chipWidth;
        le.preferredHeight = chipHeight;
        le.minWidth = chipWidth;
        le.minHeight = chipHeight;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;

        AttachCountBadgeOverlay(chip.transform, cm, count, chipHeight);

        if (img.sprite == null)
        {
            var labelGo = new GameObject("EndLabel", typeof(RectTransform));
            labelGo.transform.SetParent(chip.transform, false);
            var tmp = labelGo.AddComponent<TextMeshProUGUI>();
            tmp.text = "End";
            tmp.fontSize = Mathf.Clamp(chipHeight * 0.28f, 10f, 14f);
            tmp.fontStyle = FontStyles.Bold;
            tmp.color = Color.white;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.raycastTarget = false;
            var lrt = labelGo.GetComponent<RectTransform>();
            lrt.anchorMin = Vector2.zero;
            lrt.anchorMax = Vector2.one;
            lrt.offsetMin = Vector2.zero;
            lrt.offsetMax = Vector2.zero;
        }
    }

    /// <summary>
    /// Canvas-style count overlay on Repeat End. Uses bagRepeatCounterScale / AnchorY / XOffset / YOffset.
    /// </summary>
    static void AttachCountBadgeOverlay(Transform endCap, CharacterMove cm, int count, float iconSize)
    {
        count = ProgramSequenceUtil.ClampRepeatCount(count);

        float scale = cm != null ? Mathf.Clamp(cm.bagRepeatCounterScale, 0.2f, 1.5f) : 0.45f;
        float anchorY = cm != null ? Mathf.Clamp(cm.bagRepeatCounterAnchorY, 0.05f, 0.9f) : 0.22f;
        float xOff = cm != null ? Mathf.Clamp(cm.bagRepeatCounterXOffset, -80f, 80f) : 0f;
        float yOff = cm != null ? Mathf.Clamp(cm.bagRepeatCounterYOffset, -80f, 80f) : 0f;

        // Base size tracks icon; scale matches canvas patternRepeatCounterScale behavior.
        float countBox = Mathf.Clamp(30f * scale * (iconSize / 50f), 14f, iconSize * 0.7f);

        var root = new GameObject("RepeatEndContent", typeof(RectTransform));
        root.transform.SetParent(endCap, false);
        var rt = root.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0.55f, anchorY);
        rt.anchorMax = new Vector2(0.55f, anchorY);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = new Vector2(xOff, yOff);
        rt.sizeDelta = new Vector2(countBox + 4f, countBox + 4f);

        var badge = new GameObject("CountBox", typeof(RectTransform), typeof(Image));
        badge.transform.SetParent(root.transform, false);
        var cbrt = badge.GetComponent<RectTransform>();
        cbrt.anchorMin = cbrt.anchorMax = new Vector2(0.5f, 0.5f);
        cbrt.pivot = new Vector2(0.5f, 0.5f);
        cbrt.anchoredPosition = Vector2.zero;
        cbrt.sizeDelta = new Vector2(countBox, countBox);

        var badgeImg = badge.GetComponent<Image>();
        badgeImg.raycastTarget = false;
        if (cm != null && cm.repeatCountBoxSprite != null)
        {
            badgeImg.sprite = cm.repeatCountBoxSprite;
            badgeImg.color = Color.white;
            badgeImg.type = Image.Type.Simple;
            badgeImg.preserveAspect = false;
        }
        else
        {
            badgeImg.sprite = null;
            badgeImg.color = Color.white;
        }

        var labelGo = new GameObject("Count", typeof(RectTransform));
        labelGo.transform.SetParent(badge.transform, false);
        var tmp = labelGo.AddComponent<TextMeshProUGUI>();
        tmp.text = count.ToString();
        tmp.fontStyle = FontStyles.Bold;
        tmp.color = new Color(0.12f, 0.12f, 0.16f, 1f);
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.raycastTarget = false;
        tmp.enableWordWrapping = false;
        tmp.overflowMode = TextOverflowModes.Overflow;
        tmp.enableAutoSizing = true;
        tmp.fontSizeMin = 8f;
        tmp.fontSizeMax = Mathf.Clamp(countBox * 0.7f, 12f, 28f);
        var lrt = labelGo.GetComponent<RectTransform>();
        lrt.anchorMin = Vector2.zero;
        lrt.anchorMax = Vector2.one;
        lrt.offsetMin = new Vector2(2f, 2f);
        lrt.offsetMax = new Vector2(-2f, -2f);
        tmp.ForceMeshUpdate();
    }

    static void CreateFixedIcon(
        Transform parent, Sprite sprite, float iconSize, float width = -1f, bool preserveAspect = true)
    {
        if (width < 0f) width = iconSize;
        var iconGo = new GameObject("Tok", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        iconGo.transform.SetParent(parent, false);

        var rt = iconGo.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0.5f, 0.5f);
        rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(width, iconSize);

        var img = iconGo.GetComponent<Image>();
        img.sprite = sprite;
        img.preserveAspect = preserveAspect;
        img.raycastTarget = false;
        img.color = sprite != null ? Color.white : new Color(0.75f, 0.75f, 0.78f, 1f);

        var le = iconGo.GetComponent<LayoutElement>();
        le.preferredWidth = width;
        le.preferredHeight = iconSize;
        le.minWidth = width;
        le.minHeight = iconSize;
        le.flexibleWidth = 0f;
        le.flexibleHeight = 0f;
    }

    public static TextMeshProUGUI AddLabel(Transform parent, string text, float fontSize, Color color, FontStyles style = FontStyles.Bold)
    {
        var go = new GameObject("Label", typeof(RectTransform), typeof(LayoutElement));
        go.transform.SetParent(parent, false);
        var tmp = go.AddComponent<TextMeshProUGUI>();
        tmp.text = text ?? "";
        tmp.fontSize = fontSize;
        tmp.fontStyle = style;
        tmp.color = color;
        tmp.alignment = TextAlignmentOptions.MidlineLeft;
        tmp.raycastTarget = false;
        tmp.enableWordWrapping = false;
        tmp.overflowMode = TextOverflowModes.Ellipsis;
        var le = go.GetComponent<LayoutElement>();
        le.flexibleWidth = 1f;
        le.minHeight = fontSize + 4f;
        le.preferredHeight = fontSize + 6f;
        return tmp;
    }

    /// <summary>
    /// Card height from title + preview row (no empty filler). Bags only — not chunks.
    /// </summary>
    public static float PreferredSourceCardHeight(IList<string> tokens, CharacterMove cm, float availableWidth = 280f)
    {
        float fitIcon = FitSourceIconSize(tokens, SourcePreviewIconSize, availableWidth, cm);
        float rowH = MeasurePreviewRowHeight(tokens, fitIcon, cm);
        float h = SourceInnerPad * 2f
            + SourceTitleRowHeight
            + SourceBodySpacing
            + rowH
            + 6f;
        return Mathf.Max(SourceCardMinHeight, h);
    }

    /// <summary>
    /// Chunk source card height — ONLY from the blue rectangle knob (icon size does not grow the card).
    /// </summary>
    public static float PreferredSourceChunkCardHeight(
        IList<string> tokens, CharacterMove cm, float availableWidth = 280f)
    {
        return ChunkRectHeightBlue(cm);
    }

    /// <summary>
    /// Blue-panel Action Chunk card — senior layout:
    /// [ BigChunkIcon ]  Title                    [DragHandle]
    ///                   [cmd] [cmd] [cmd]
    /// Icon stays left; arrows sit beside it (never pushed below a tall badge).
    /// Does not affect Command Bag cards.
    /// </summary>
    public static void PopulateSourceChunkCardContent(
        Transform body,
        CharacterMove cm,
        string title,
        int chunkNumber,
        Color accent,
        IList<string> tokens,
        Sprite chunkIconSprite,
        Sprite dragHandleSprite)
    {
        if (body == null) return;

        float badgeSize = FittedBlueChunkIconSize(cm);

        var row = new GameObject(
            "ChunkRow",
            typeof(RectTransform),
            typeof(HorizontalLayoutGroup),
            typeof(LayoutElement));
        row.transform.SetParent(body, false);
        var rowLe = row.GetComponent<LayoutElement>();
        rowLe.flexibleWidth = 1f;
        rowLe.flexibleHeight = 1f;
        rowLe.minHeight = badgeSize;
        // Row fills the fixed card — no extra padding that grows with icon.
        rowLe.preferredHeight = -1f;

        var rowHlg = row.GetComponent<HorizontalLayoutGroup>();
        rowHlg.padding = new RectOffset(0, 0, 0, 0);
        rowHlg.spacing = 10f;
        rowHlg.childAlignment = TextAnchor.MiddleLeft;
        rowHlg.childControlWidth = true;
        rowHlg.childControlHeight = true;
        rowHlg.childForceExpandWidth = false;
        rowHlg.childForceExpandHeight = false;

        // Supporting identity — color only (no numbers); commands are the visual focus.
        BuildPuzzleBadge(row.transform, chunkNumber, accent, badgeSize, ResolveChunkIconSprite(cm, chunkIconSprite));

        // Right column: prominent title + handle, then larger command arrows.
        var col = new GameObject(
            "ContentCol",
            typeof(RectTransform),
            typeof(VerticalLayoutGroup),
            typeof(LayoutElement));
        col.transform.SetParent(row.transform, false);
        var colLe = col.GetComponent<LayoutElement>();
        colLe.flexibleWidth = 1f;
        colLe.flexibleHeight = 0f;
        colLe.minWidth = 110f;

        var colVlg = col.GetComponent<VerticalLayoutGroup>();
        colVlg.padding = new RectOffset(0, 0, 0, 0);
        colVlg.spacing = 5f;
        colVlg.childAlignment = TextAnchor.UpperLeft;
        colVlg.childControlWidth = true;
        colVlg.childControlHeight = true;
        colVlg.childForceExpandWidth = true;
        colVlg.childForceExpandHeight = false;

        var titleRow = new GameObject(
            "TitleRow",
            typeof(RectTransform),
            typeof(HorizontalLayoutGroup),
            typeof(LayoutElement));
        titleRow.transform.SetParent(col.transform, false);
        var titleLe = titleRow.GetComponent<LayoutElement>();
        titleLe.preferredHeight = SourceTitleRowHeight;
        titleLe.minHeight = SourceTitleRowHeight;
        titleLe.flexibleWidth = 1f;

        var titleHlg = titleRow.GetComponent<HorizontalLayoutGroup>();
        titleHlg.spacing = 6f;
        titleHlg.childAlignment = TextAnchor.MiddleLeft;
        titleHlg.childControlWidth = true;
        titleHlg.childControlHeight = true;
        titleHlg.childForceExpandWidth = false;
        titleHlg.childForceExpandHeight = false;

        string displayTitle = string.IsNullOrWhiteSpace(title) ? "Chunk" : title;
        var titleTmp = AddLabel(titleRow.transform, displayTitle, 15f, new Color(0.14f, 0.16f, 0.26f));
        titleTmp.fontStyle = FontStyles.Bold;
        var titleFlex = titleTmp.gameObject.GetComponent<LayoutElement>();
        if (titleFlex == null) titleFlex = titleTmp.gameObject.AddComponent<LayoutElement>();
        titleFlex.flexibleWidth = 1f;

        var handleGo = new GameObject("DragHandle", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        handleGo.transform.SetParent(titleRow.transform, false);
        var himg = handleGo.GetComponent<Image>();
        himg.raycastTarget = false;
        himg.preserveAspect = true;
        if (dragHandleSprite != null)
        {
            himg.sprite = dragHandleSprite;
            himg.color = new Color(1f, 1f, 1f, 0.85f);
        }
        else
        {
            himg.color = new Color(0.35f, 0.38f, 0.48f, 0.40f);
        }
        var hle = handleGo.GetComponent<LayoutElement>();
        hle.preferredWidth = SourceDragHandleSize;
        hle.preferredHeight = SourceDragHandleSize;
        hle.minWidth = SourceDragHandleSize;
        hle.minHeight = SourceDragHandleSize;

        float available = Mathf.Max(120f, EstimateSourcePreviewWidth(body) - badgeSize - 20f);
        float preferredArrow = SourcePreviewIconSize;
        float fitIcon = FitSourceIconSize(tokens, preferredArrow, available, cm);
        float spacing = Mathf.Max(5f, 8f * (fitIcon / preferredArrow));
        float rowH = MeasurePreviewRowHeight(tokens, fitIcon, cm);

        var previewWrap = new GameObject("PreviewWrap", typeof(RectTransform), typeof(LayoutElement));
        previewWrap.transform.SetParent(col.transform, false);
        var wle = previewWrap.GetComponent<LayoutElement>();
        wle.preferredHeight = rowH + 2f;
        wle.minHeight = rowH + 2f;
        wle.flexibleWidth = 1f;
        wle.flexibleHeight = 0f;

        // Soft tint only — no nested white box.
        Color wellTint = Color.Lerp(accent, Color.white, 0.72f);
        wellTint.a = 0.28f;
        var previewRt = BuildIconPreviewRow(
            previewWrap.transform, cm, tokens,
            iconSize: fitIcon, spacing: spacing,
            maxIcons: MaxPreviewTokens, wellColor: wellTint);
        previewRt.anchorMin = new Vector2(0f, 0.5f);
        previewRt.anchorMax = new Vector2(0f, 0.5f);
        previewRt.pivot = new Vector2(0f, 0.5f);
        previewRt.anchoredPosition = Vector2.zero;
        DisableRaycastsDeep(previewRt);
        // Card height comes only from chunkRectHeightBluePanel — do not grow row with icon.
    }

    /// <summary>
    /// Blue-panel CommandBagCard content — tight vertical stack:
    /// [BagIcon] Title                    [DragHandle]
    /// [cmd] [cmd] [cmd]
    /// Bags only — never uses chunk icon size knobs.
    /// </summary>
    public static void PopulateSourceCardContent(
        Transform body,
        CharacterMove cm,
        string title,
        IList<string> tokens,
        Sprite bagIconSprite,
        Sprite dragHandleSprite,
        Color fallbackIconColor,
        Color cardAccent)
    {
        if (body == null) return;

        var titleRow = new GameObject(
            "TitleRow",
            typeof(RectTransform),
            typeof(HorizontalLayoutGroup),
            typeof(LayoutElement));
        titleRow.transform.SetParent(body, false);
        var titleLe = titleRow.GetComponent<LayoutElement>();
        titleLe.preferredHeight = SourceTitleRowHeight;
        titleLe.minHeight = SourceTitleRowHeight;
        titleLe.flexibleWidth = 1f;
        titleLe.flexibleHeight = 0f;

        var titleHlg = titleRow.GetComponent<HorizontalLayoutGroup>();
        titleHlg.spacing = 6f;
        titleHlg.childAlignment = TextAnchor.MiddleLeft;
        titleHlg.childControlWidth = true;
        titleHlg.childControlHeight = true;
        titleHlg.childForceExpandWidth = false;
        titleHlg.childForceExpandHeight = false;
        titleHlg.padding = new RectOffset(0, 0, 0, 0);

        var badge = new GameObject("BagIcon", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        badge.transform.SetParent(titleRow.transform, false);
        var bimg = badge.GetComponent<Image>();
        bimg.raycastTarget = false;
        bimg.preserveAspect = true;
        if (bagIconSprite != null)
        {
            bimg.sprite = bagIconSprite;
            bimg.color = Color.white;
        }
        else
        {
            bimg.sprite = null;
            bimg.color = fallbackIconColor;
        }
        var ble = badge.GetComponent<LayoutElement>();
        ble.preferredWidth = SourceBagIconSize;
        ble.preferredHeight = SourceBagIconSize;
        ble.minWidth = SourceBagIconSize;
        ble.minHeight = SourceBagIconSize;

        AddLabel(titleRow.transform, title, 14f, new Color(0.12f, 0.16f, 0.28f));

        var handleGo = new GameObject("DragHandle", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        handleGo.transform.SetParent(titleRow.transform, false);
        var himg = handleGo.GetComponent<Image>();
        himg.raycastTarget = false;
        himg.preserveAspect = true;
        if (dragHandleSprite != null)
        {
            himg.sprite = dragHandleSprite;
            himg.color = Color.white;
        }
        else
        {
            himg.sprite = null;
            himg.color = new Color(0.35f, 0.38f, 0.48f, 0.35f);
        }
        var hle = handleGo.GetComponent<LayoutElement>();
        hle.preferredWidth = SourceDragHandleSize;
        hle.preferredHeight = SourceDragHandleSize;
        hle.minWidth = SourceDragHandleSize;
        hle.minHeight = SourceDragHandleSize;
        hle.flexibleWidth = 0f;

        float available = EstimateSourcePreviewWidth(body);
        float fitIcon = FitSourceIconSize(tokens, SourcePreviewIconSize, available, cm);
        float spacing = Mathf.Max(3f, 6f * (fitIcon / SourcePreviewIconSize));
        float rowH = MeasurePreviewRowHeight(tokens, fitIcon, cm);

        var previewWrap = new GameObject(
            "PreviewWrap",
            typeof(RectTransform),
            typeof(LayoutElement));
        previewWrap.transform.SetParent(body, false);
        var wle = previewWrap.GetComponent<LayoutElement>();
        wle.preferredHeight = rowH + 4f;
        wle.minHeight = rowH + 4f;
        wle.flexibleWidth = 1f;
        wle.flexibleHeight = 0f;

        Color wellTint = Color.Lerp(cardAccent, Color.white, 0.55f);
        wellTint.a = 0.55f;
        var previewRt = BuildIconPreviewRow(
            previewWrap.transform, cm, tokens,
            iconSize: fitIcon, spacing: spacing,
            maxIcons: MaxPreviewTokens, wellColor: wellTint);

        previewRt.anchorMin = new Vector2(0f, 0.5f);
        previewRt.anchorMax = new Vector2(0f, 0.5f);
        previewRt.pivot = new Vector2(0f, 0.5f);
        previewRt.anchoredPosition = Vector2.zero;

        float rowW = previewRt.sizeDelta.x;
        if (rowW > available + 1f)
        {
            previewWrap.AddComponent<RectMask2D>();
            var scroll = previewWrap.AddComponent<ScrollRect>();
            scroll.content = previewRt;
            scroll.horizontal = true;
            scroll.vertical = false;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 32f;
            scroll.viewport = previewWrap.GetComponent<RectTransform>();
            scroll.inertia = true;
        }

        DisableRaycastsDeep(previewRt);
    }

    /// <summary>Approximate inner width of a blue-panel card body.</summary>
    static float EstimateSourcePreviewWidth(Transform body)
    {
        const float fallback = 360f;
        if (body == null) return fallback;
        var rt = body as RectTransform;
        if (rt != null && rt.rect.width > 40f)
            return Mathf.Max(200f, rt.rect.width - 4f);
        var panel = body.GetComponentInParent<ScrollRect>();
        if (panel != null && panel.viewport != null && panel.viewport.rect.width > 40f)
            return Mathf.Max(200f, panel.viewport.rect.width - SourceInnerPad * 2f - 16f);
        return fallback;
    }

    /// <summary>
    /// Shrink source preview icons only when needed so long bags still fit.
    /// Keeps arrows large in the blue panel for short bags.
    /// </summary>
    public static float FitSourceIconSize(
        IList<string> tokens, float preferred, float availableWidth, CharacterMove cm = null)
    {
        if (tokens == null || tokens.Count == 0) return preferred;
        float icon = preferred;
        // Don't shrink short bags (≤3 tokens) — kids need big arrows in the library.
        if (tokens.Count <= 3) return preferred;

        for (int pass = 0; pass < 6; pass++)
        {
            float spacing = Mathf.Max(4f, 6f * (icon / preferred));
            float content = 0f;
            int n = Mathf.Min(tokens.Count, MaxPreviewTokens);
            for (int i = 0; i < n; i++)
            {
                content += MeasureTokenChipWidth(tokens[i], icon, cm);
                if (i > 0) content += spacing;
            }
            float needed = 12f + content;
            if (needed <= availableWidth || icon <= preferred * 0.62f)
                return icon;
            icon = Mathf.Max(preferred * 0.62f, icon * (availableWidth / needed));
        }
        return icon;
    }

    public static float MeasurePreviewRowHeight(IList<string> tokens, float iconSize, CharacterMove cm = null)
    {
        float h = iconSize;
        if (tokens == null) return h;
        int n = Mathf.Min(tokens.Count, MaxPreviewTokens);
        for (int i = 0; i < n; i++)
            h = Mathf.Max(h, MeasureTokenChipHeight(tokens[i], iconSize, cm));
        return h;
    }

    /// <summary>
    /// Yellow-strip ProgramBagInstance — icons only, no title text.
    /// Visual: [Repeat] [↶] [↑] [↑] [End+count]  (+ close button attached by CharacterMove)
    /// </summary>
    public static void PopulateProgramInstanceContent(
        Transform blockRoot,
        CharacterMove cm,
        string title, // ignored for display — kept for API compatibility
        Color accent,
        IList<string> previewTokens,
        Sprite bagIconSprite = null)
    {
        if (blockRoot == null) return;

        var row = new GameObject("Body", typeof(RectTransform), typeof(HorizontalLayoutGroup));
        row.transform.SetParent(blockRoot, false);
        var rowRt = row.GetComponent<RectTransform>();
        rowRt.anchorMin = Vector2.zero;
        rowRt.anchorMax = Vector2.one;
        rowRt.offsetMin = new Vector2(ProgramInnerPadX, ProgramInnerPadY);
        rowRt.offsetMax = new Vector2(-(ProgramCloseReserve + 4f), -ProgramInnerPadY);

        var hlg = row.GetComponent<HorizontalLayoutGroup>();
        hlg.padding = new RectOffset(2, 2, 0, 0);
        hlg.spacing = 0f;
        hlg.childAlignment = TextAnchor.MiddleLeft;
        hlg.childControlWidth = true;
        hlg.childControlHeight = true;
        hlg.childForceExpandWidth = false;
        hlg.childForceExpandHeight = false;

        Color wellTint = Color.Lerp(accent, Color.white, 0.45f);
        wellTint.a = 0.4f;
        var previewRt = BuildIconPreviewRow(
            row.transform, cm, previewTokens,
            iconSize: ProgramPreviewIconSize, spacing: 6f, maxIcons: MaxPreviewTokens, wellColor: wellTint);

        DisableRaycastsDeep(previewRt);
    }

    /// <summary>
    /// Yellow-strip chip: rectangle from rect knobs only; icon from icon knob only.
    /// Icon is left-aligned (no empty “padding” to the left of the puzzle).
    /// </summary>
    public static void PopulateProgramChunkChip(
        Transform blockRoot,
        CharacterMove cm,
        int chunkNumber,
        Color accent,
        bool peekOpen = false,
        Sprite iconSprite = null)
    {
        if (blockRoot == null) return;

        Sprite icon = ResolveChunkIconSprite(cm, iconSprite);
        float iconSize = FittedYellowChunkIconSize(cm);

        var body = new GameObject("Body", typeof(RectTransform));
        body.transform.SetParent(blockRoot, false);
        var bodyRt = body.GetComponent<RectTransform>();
        bodyRt.anchorMin = Vector2.zero;
        bodyRt.anchorMax = Vector2.one;
        bodyRt.offsetMin = new Vector2(2f, 2f);
        // Reserve right chrome for expand + close — keep left flush.
        bodyRt.offsetMax = new Vector2(-(ProgramChunkExpandSize * 0.55f + 2f), -2f);

        var badge = BuildPuzzleBadge(body.transform, chunkNumber, accent, iconSize, icon);
        var ble = badge.GetComponent<LayoutElement>();
        if (ble != null) UnityEngine.Object.DestroyImmediate(ble);

        var brt = badge.GetComponent<RectTransform>();
        brt.anchorMin = new Vector2(0f, 0.5f);
        brt.anchorMax = new Vector2(0f, 0.5f);
        brt.pivot = new Vector2(0f, 0.5f);
        brt.anchoredPosition = Vector2.zero;
        brt.sizeDelta = new Vector2(iconSize, iconSize);

        AttachChunkExpandIcon(blockRoot, cm, peekOpen, accent);
    }

    /// <summary>Expand control as a layout sibling of the chunk icon (roomy, mockup-like).</summary>
    public static void AttachChunkExpandIconInRow(
        Transform rowParent, Transform blockRoot, CharacterMove cm, bool peekOpen)
    {
        if (rowParent == null || blockRoot == null) return;

        // Remove any prior root-level expand icon.
        Transform existingRoot = blockRoot.Find("ExpandIcon");
        if (existingRoot != null)
            UnityEngine.Object.DestroyImmediate(existingRoot.gameObject);
        Transform existingRow = rowParent.Find("ExpandIcon");
        if (existingRow != null)
            UnityEngine.Object.DestroyImmediate(existingRow.gameObject);

        var go = new GameObject("ExpandIcon", typeof(RectTransform), typeof(Image), typeof(Button), typeof(LayoutElement));
        go.transform.SetParent(rowParent, false);

        var le = go.GetComponent<LayoutElement>();
        le.preferredWidth = ProgramChunkExpandSize;
        le.preferredHeight = ProgramChunkExpandSize;
        le.minWidth = ProgramChunkExpandSize;
        le.minHeight = ProgramChunkExpandSize;
        le.flexibleWidth = 0f;

        var img = go.GetComponent<Image>();
        img.raycastTarget = true;
        Sprite spr = null;
        if (cm != null)
            spr = peekOpen ? cm.chunkCollapseIconSprite : cm.chunkExpandIconSprite;
        if (spr == null && cm != null)
            spr = peekOpen ? cm.chunkExpandIconSprite : cm.chunkCollapseIconSprite;
        if (spr != null)
        {
            img.sprite = spr;
            img.color = ChunkChromeTint(rowParent.GetComponentInParent<Image>() != null
                ? rowParent.GetComponentInParent<Image>().color
                : new Color(0.25f, 0.45f, 0.85f));
            img.preserveAspect = true;
        }
        else
        {
            img.sprite = null;
            img.color = new Color(0.25f, 0.45f, 0.85f, 0.95f);
            var labelGo = new GameObject("L", typeof(RectTransform));
            labelGo.transform.SetParent(go.transform, false);
            var tmp = labelGo.AddComponent<TextMeshProUGUI>();
            tmp.text = peekOpen ? "▼" : "▲";
            tmp.fontSize = 18f;
            tmp.fontStyle = FontStyles.Bold;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color = Color.white;
            tmp.raycastTarget = false;
            var lrt = labelGo.GetComponent<RectTransform>();
            lrt.anchorMin = Vector2.zero;
            lrt.anchorMax = Vector2.one;
            lrt.offsetMin = Vector2.zero;
            lrt.offsetMax = Vector2.zero;
        }

        var btn = go.GetComponent<Button>();
        btn.transition = Selectable.Transition.None;
        btn.targetGraphic = img;
        btn.onClick.RemoveAllListeners();
        var tap = blockRoot.GetComponent<QueuedChunkTapExpand>();
        if (tap != null)
            btn.onClick.AddListener(tap.OnExpandIconClicked);
        else if (cm != null)
        {
            var cmRef = cm;
            var root = blockRoot.gameObject;
            btn.onClick.AddListener(() => cmRef.ToggleChunkPeekPanel(root));
        }
    }

    /// <summary>
    /// Expand / collapse on the chip chrome. PNG art is tinted to match the chunk rectangle.
    /// </summary>
    public static void AttachChunkExpandIcon(
        Transform blockRoot, CharacterMove cm, bool peekOpen, Color rectAccent = default)
    {
        if (blockRoot == null) return;

        Transform existing = blockRoot.Find("ExpandIcon");
        if (existing != null)
            UnityEngine.Object.DestroyImmediate(existing.gameObject);
        var body = blockRoot.Find("Body");
        if (body != null)
        {
            var underBody = body.Find("ExpandIcon");
            if (underBody != null)
                UnityEngine.Object.DestroyImmediate(underBody.gameObject);
        }

        if (rectAccent.a < 0.01f)
        {
            var chipImg = blockRoot.GetComponent<Image>();
            if (chipImg != null) rectAccent = chipImg.color;
            else rectAccent = new Color(0.25f, 0.45f, 0.85f, 1f);
        }
        Color tint = ChunkChromeTint(rectAccent);

        var go = new GameObject("ExpandIcon", typeof(RectTransform), typeof(Image), typeof(Button));
        go.transform.SetParent(blockRoot, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(1f, 0f);
        rt.anchorMax = new Vector2(1f, 0f);
        rt.pivot = new Vector2(1f, 0f);
        rt.sizeDelta = new Vector2(ProgramChunkExpandSize, ProgramChunkExpandSize);
        rt.anchoredPosition = new Vector2(-2f, 2f);

        var img = go.GetComponent<Image>();
        img.raycastTarget = true;
        Sprite spr = null;
        if (cm != null)
            spr = peekOpen ? cm.chunkCollapseIconSprite : cm.chunkExpandIconSprite;
        if (spr == null && cm != null)
            spr = peekOpen ? cm.chunkExpandIconSprite : cm.chunkCollapseIconSprite;
        if (spr != null)
        {
            img.sprite = spr;
            img.color = tint;
            img.preserveAspect = true;
        }
        else
        {
            // Invisible hit target — chevron only (no solid color square).
            img.sprite = null;
            img.color = new Color(1f, 1f, 1f, 0.001f);
            var labelGo = new GameObject("L", typeof(RectTransform));
            labelGo.transform.SetParent(go.transform, false);
            var tmp = labelGo.AddComponent<TextMeshProUGUI>();
            tmp.text = peekOpen ? "▼" : "▲";
            tmp.fontSize = 18f;
            tmp.fontStyle = FontStyles.Bold;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.color = tint;
            tmp.raycastTarget = false;
            var lrt = labelGo.GetComponent<RectTransform>();
            lrt.anchorMin = Vector2.zero;
            lrt.anchorMax = Vector2.one;
            lrt.offsetMin = Vector2.zero;
            lrt.offsetMax = Vector2.zero;
        }

        var btn = go.GetComponent<Button>();
        btn.transition = Selectable.Transition.None;
        btn.targetGraphic = img;
        btn.onClick.RemoveAllListeners();
        var tap = blockRoot.GetComponent<QueuedChunkTapExpand>();
        if (tap != null)
            btn.onClick.AddListener(tap.OnExpandIconClicked);
        else if (cm != null)
        {
            var cmRef = cm;
            var root = blockRoot.gameObject;
            btn.onClick.AddListener(() => cmRef.ToggleChunkPeekPanel(root));
        }

        go.transform.SetAsLastSibling();
    }

    public static void SetChunkExpandIconState(Transform blockRoot, CharacterMove cm, bool peekOpen)
    {
        if (blockRoot == null) return;
        var icon = FindChunkExpandIcon(blockRoot);
        Color accent = default;
        var chipImg = blockRoot.GetComponent<Image>();
        if (chipImg != null) accent = chipImg.color;

        if (icon == null)
        {
            AttachChunkExpandIcon(blockRoot, cm, peekOpen, accent);
            return;
        }

        Color tint = ChunkChromeTint(accent.a > 0.01f ? accent : new Color(0.25f, 0.45f, 0.85f));
        var img = icon.GetComponent<Image>();
        Sprite spr = null;
        if (cm != null)
            spr = peekOpen ? cm.chunkCollapseIconSprite : cm.chunkExpandIconSprite;
        if (spr == null && cm != null)
            spr = cm.chunkExpandIconSprite != null ? cm.chunkExpandIconSprite : cm.chunkCollapseIconSprite;

        if (img != null)
        {
            if (spr != null)
            {
                img.sprite = spr;
                img.color = tint;
                img.preserveAspect = true;
            }
            else
            {
                img.sprite = null;
                img.color = tint;
            }
            img.raycastTarget = true;
        }

        var label = icon.Find("L");
        var tmp = label != null ? label.GetComponent<TextMeshProUGUI>() : null;
        if (tmp != null)
            tmp.text = peekOpen ? "▼" : "▲";
    }

    public static Transform FindChunkExpandIcon(Transform blockRoot)
    {
        if (blockRoot == null) return null;
        var direct = blockRoot.Find("ExpandIcon");
        if (direct != null) return direct;
        var body = blockRoot.Find("Body");
        return body != null ? body.Find("ExpandIcon") : null;
    }

    /// <summary>
    /// Peek panel: soft color-tinted card · puzzle · command well · always-visible collapse.
    /// </summary>
    public static void PopulateChunkPeekPanel(
        Transform panelRoot,
        CharacterMove cm,
        string title,
        int chunkNumber,
        Color accent,
        IList<string> tokens,
        Action onCollapse,
        Sprite iconSprite = null)
    {
        if (panelRoot == null) return;

        for (int i = panelRoot.childCount - 1; i >= 0; i--)
            UnityEngine.Object.DestroyImmediate(panelRoot.GetChild(i).gameObject);

        Color identity = accent.a > 0.05f ? PuzzleFillFromCard(accent) : PuzzleColor(Mathf.Max(0, chunkNumber - 1));
        Color fill = PeekFillFromAccent(identity);
        Color borderCol = PeekBorderFromAccent(identity);
        Color collapseTint = PeekCollapseIconTint(identity);

        var border = panelRoot.GetComponent<Outline>();
        if (border != null)
        {
            border.effectColor = borderCol;
            border.effectDistance = new Vector2(3f, -3f);
        }

        // Soft drop shadow under the card (game-UI depth).
        var shadows = panelRoot.GetComponents<Shadow>();
        Shadow dropShadow = null;
        for (int i = 0; i < shadows.Length; i++)
        {
            if (!(shadows[i] is Outline))
            {
                dropShadow = shadows[i];
                break;
            }
        }
        if (dropShadow == null) dropShadow = panelRoot.gameObject.AddComponent<Shadow>();
        dropShadow.effectColor = new Color(0.05f, 0.08f, 0.14f, 0.28f);
        dropShadow.effectDistance = new Vector2(0f, -6f);
        dropShadow.useGraphicAlpha = true;

        var panelImg = panelRoot.GetComponent<Image>();
        if (panelImg != null)
            panelImg.color = fill;

        // Left accent bar — ties peek to the chunk chip color without flooding the card.
        var accentBar = new GameObject("AccentBar", typeof(RectTransform), typeof(Image));
        accentBar.transform.SetParent(panelRoot, false);
        var abrt = accentBar.GetComponent<RectTransform>();
        abrt.anchorMin = new Vector2(0f, 0f);
        abrt.anchorMax = new Vector2(0f, 1f);
        abrt.pivot = new Vector2(0f, 0.5f);
        abrt.sizeDelta = new Vector2(8f, -12f);
        abrt.anchoredPosition = new Vector2(6f, 0f);
        var abImg = accentBar.GetComponent<Image>();
        abImg.color = identity;
        abImg.raycastTarget = false;

        var row = new GameObject(
            "PeekRow",
            typeof(RectTransform),
            typeof(HorizontalLayoutGroup),
            typeof(ContentSizeFitter));
        row.transform.SetParent(panelRoot, false);
        var rowRt = row.GetComponent<RectTransform>();
        rowRt.anchorMin = new Vector2(0.5f, 0.5f);
        rowRt.anchorMax = new Vector2(0.5f, 0.5f);
        rowRt.pivot = new Vector2(0.5f, 0.5f);

        var hlg = row.GetComponent<HorizontalLayoutGroup>();
        hlg.padding = new RectOffset(18, 12, 10, 10);
        hlg.spacing = 12f;
        hlg.childAlignment = TextAnchor.MiddleCenter;
        hlg.childControlWidth = true;
        hlg.childControlHeight = true;
        hlg.childForceExpandWidth = false;
        hlg.childForceExpandHeight = false;

        var fitter = row.GetComponent<ContentSizeFitter>();
        fitter.horizontalFit = ContentSizeFitter.FitMode.PreferredSize;
        fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

        Sprite icon = ResolveChunkIconSprite(cm, iconSprite);
        float peekIconSize = FittedPeekChunkIconSize(cm);
        BuildPuzzleBadge(row.transform, chunkNumber, identity, peekIconSize, icon);

        // Frosted command well — readable arrows on any chunk hue.
        Color wellTint = new Color(1f, 1f, 1f, 0.72f);
        var preview = BuildIconPreviewRow(
            row.transform, cm, tokens,
            iconSize: 48f, spacing: 8f, maxIcons: MaxPreviewTokens, wellColor: wellTint);
        DisableRaycastsDeep(preview);

        // Collapse — white plate + dark accent icon so it NEVER disappears on green/purple fills.
        const float collapseSize = 44f;
        var collapseGo = new GameObject(
            "Collapse",
            typeof(RectTransform),
            typeof(Image),
            typeof(Button),
            typeof(LayoutElement),
            typeof(Outline));
        collapseGo.transform.SetParent(row.transform, false);

        var cImg = collapseGo.GetComponent<Image>();
        cImg.color = new Color(1f, 1f, 1f, 0.98f);
        cImg.raycastTarget = true;

        var cOutline = collapseGo.GetComponent<Outline>();
        cOutline.effectColor = Color.Lerp(identity, borderCol, 0.35f);
        cOutline.effectDistance = new Vector2(2.25f, -2.25f);
        cOutline.useGraphicAlpha = true;

        var cle = collapseGo.GetComponent<LayoutElement>();
        cle.preferredWidth = collapseSize;
        cle.preferredHeight = collapseSize;
        cle.minWidth = collapseSize;
        cle.minHeight = collapseSize;
        cle.flexibleWidth = 0f;

        Sprite collapseSpr = cm != null ? cm.chunkCollapseIconSprite : null;
        if (collapseSpr == null && cm != null)
            collapseSpr = cm.chunkExpandIconSprite;

        if (collapseSpr != null)
        {
            var vImgGo = new GameObject("Icon", typeof(RectTransform), typeof(Image));
            vImgGo.transform.SetParent(collapseGo.transform, false);
            var vrt = vImgGo.GetComponent<RectTransform>();
            vrt.anchorMin = Vector2.zero;
            vrt.anchorMax = Vector2.one;
            vrt.offsetMin = new Vector2(8f, 8f);
            vrt.offsetMax = new Vector2(-8f, -8f);
            var vImg = vImgGo.GetComponent<Image>();
            vImg.sprite = collapseSpr;
            vImg.color = collapseTint;
            vImg.preserveAspect = true;
            vImg.raycastTarget = false;
        }
        else
        {
            var vTmpGo = new GameObject("V", typeof(RectTransform));
            vTmpGo.transform.SetParent(collapseGo.transform, false);
            var vTmp = vTmpGo.AddComponent<TextMeshProUGUI>();
            vTmp.text = "▼";
            vTmp.fontSize = 20f;
            vTmp.fontStyle = FontStyles.Bold;
            vTmp.alignment = TextAlignmentOptions.Center;
            vTmp.color = collapseTint;
            vTmp.raycastTarget = false;
            var lrt = vTmpGo.GetComponent<RectTransform>();
            lrt.anchorMin = Vector2.zero;
            lrt.anchorMax = Vector2.one;
            lrt.offsetMin = Vector2.zero;
            lrt.offsetMax = Vector2.zero;
        }

        var btn = collapseGo.GetComponent<Button>();
        btn.transition = Selectable.Transition.ColorTint;
        btn.targetGraphic = cImg;
        var colors = btn.colors;
        colors.normalColor = Color.white;
        colors.highlightedColor = new Color(0.96f, 0.97f, 1f, 1f);
        colors.pressedColor = new Color(0.88f, 0.90f, 0.94f, 1f);
        colors.selectedColor = Color.white;
        colors.fadeDuration = 0.08f;
        btn.colors = colors;
        btn.onClick.RemoveAllListeners();
        if (onCollapse != null)
            btn.onClick.AddListener(() => onCollapse());

        LayoutRebuilder.ForceRebuildLayoutImmediate(rowRt);
        rowRt.anchoredPosition = Vector2.zero;
    }

    /// <summary>Legacy helper — prefer <see cref="PreferredProgramInstanceWidth(IList{string}, CharacterMove)"/>.</summary>
    public static float PreferredProgramInstanceWidth(int tokenCount)
    {
        int n = Mathf.Max(1, Mathf.Min(tokenCount, MaxPreviewTokens));
        return Mathf.Clamp(
            ProgramInnerPadX * 2f + 16f + n * (ProgramPreviewIconSize + 8f) + ProgramCloseReserve,
            120f,
            720f);
    }

    /// <summary>
    /// Yellow-strip bag width from actual chip sizes (Repeat Start/End use bagRepeat*Scale).
    /// </summary>
    public static float PreferredProgramInstanceWidth(IList<string> tokens, CharacterMove cm = null)
    {
        if (tokens == null || tokens.Count == 0)
            return PreferredProgramInstanceWidth(1);

        const float spacing = 6f;
        float content = 0f;
        int n = Mathf.Min(tokens.Count, MaxPreviewTokens);
        for (int i = 0; i < n; i++)
        {
            content += MeasureTokenChipWidth(tokens[i], ProgramPreviewIconSize, cm);
            if (i > 0) content += spacing;
        }
        if (tokens.Count > MaxPreviewTokens)
            content += spacing + ProgramPreviewIconSize * 0.55f;

        float width = ProgramInnerPadX * 2f + 12f + content + ProgramCloseReserve + 6f;
        return Mathf.Clamp(width, 100f, 560f);
    }

    static void DisableRaycastsDeep(Transform root)
    {
        if (root == null) return;
        var imgs = root.GetComponentsInChildren<Image>(true);
        for (int i = 0; i < imgs.Length; i++)
            imgs[i].raycastTarget = false;
        var tmps = root.GetComponentsInChildren<TextMeshProUGUI>(true);
        for (int i = 0; i < tmps.Length; i++)
            tmps[i].raycastTarget = false;
    }
}
