using System.Collections.Generic;
using UnityEngine;
using TMPro;

/// <summary>
/// Draws the number-line axis for NUMBER_LINE levels. Style comes from
/// <see cref="LevelData.numberLine"/> (teacher dashboard) with Inspector fallbacks.
/// </summary>
public class NumberLineVisual : MonoBehaviour
{
    [HideInInspector] public CharacterMove characterMove;

    [Header("Fallbacks when level config omits style")]
    [Tooltip("Not used for tinting — only as optional shader template. Leave empty.")]
    public Material lineMaterial;
    public Color lineColor = new Color(0.18f, 0.18f, 0.21f, 1f);
    public Color tickColor = new Color(0.12f, 0.12f, 0.14f, 1f);
    public Color labelColor = new Color(0.2f, 0.2f, 0.25f, 1f);
    [Range(0.01f, 0.2f)] public float axisThicknessRatio = 0.045f;
    [Range(0.05f, 0.6f)] public float tickHeightRatio = 0.28f;
    [Range(0.01f, 0.15f)] public float tickWidthRatio = 0.05f;
    [Range(0.08f, 0.5f)] public float labelSizeRatio = 0.22f;

    private readonly List<GameObject> _spawned = new List<GameObject>();
    private static Sprite _whiteSprite;

    private Transform VisualRoot()
    {
        if (characterMove != null && characterMove.gridOriginTransform != null)
            return characterMove.gridOriginTransform;
        return transform;
    }

    private float Cell
    {
        get
        {
            if (characterMove == null) return 1f;
            var ld = characterMove.PlayfieldLevelData();
            float spacing = characterMove.GetCellSpacingForLayout(ld);
            return Mathf.Max(spacing, 0.5f);
        }
    }

    public void BuildForLevel(LevelData levelData)
    {
        Clear();
        if (characterMove == null || levelData == null || !CharacterMove.UsesNumberLine(levelData))
            return;

        var style = levelData.numberLine ?? new NumberLineConfig();
        int tickCount = style.tickCount > 0 ? style.tickCount : 9;
        int lineRow = CharacterMove.GetNumberLineRow(levelData);
        bool showLabels = style.showTickLabels;
        bool showArrows = style.showArrows;

        Color axisFallback = characterMove != null ? characterMove.numberLineAxisColor : lineColor;
        Color tickFallback = characterMove != null ? characterMove.numberLineTickColor : tickColor;
        Color axisColor = ParseColor(style.lineColor, axisFallback);
        Color tickCol = ParseColor(style.tickColor, tickFallback);
        Color lblCol = ParseColor(style.labelColor, labelColor);

        float axisThick = Cell * EffectiveRatio(style.axisThicknessRatio, axisThicknessRatio);
        float tickH = Cell * EffectiveRatio(style.tickHeightRatio, tickHeightRatio);
        float tickW = Cell * EffectiveRatio(style.tickWidthRatio, tickWidthRatio);
        float lblRatio = EffectiveRatio(style.labelSizeRatio, labelSizeRatio);

        Vector3 left = characterMove.GridCellToWorld(0, lineRow);
        Vector3 right = characterMove.GridCellToWorld(tickCount - 1, lineRow);
        float floorY = left.y + Cell * 0.02f;
        left.y = floorY;
        right.y = floorY;

        float span = Mathf.Max(Mathf.Abs(right.x - left.x), Cell * 0.05f);
        Vector3 center = Vector3.Lerp(left, right, 0.5f);

        CreateAxisQuad(center, span, axisThick, floorY, axisColor);
        if (showArrows)
        {
            float arrowLen = Cell * 0.2f;
            CreateArrowhead(left, true, axisThick, arrowLen, axisColor);
            CreateArrowhead(right, false, axisThick, arrowLen, axisColor);
        }

        for (int t = 0; t < tickCount; t++)
        {
            Vector3 tickBase = characterMove.GridCellToWorld(t, lineRow);
            tickBase.y = floorY;
            CreateTickQuad(tickBase, tickW, tickH, floorY, tickCol);
            if (showLabels)
                CreateTickLabel(t, tickBase, Cell, floorY, lblCol, lblRatio);
        }

        Debug.Log($"[NumberLineVisual] Built {tickCount} ticks, color={ColorToHex(axisColor)} (from '{style.lineColor}')");
    }

    public void Clear()
    {
        foreach (var go in _spawned)
        {
            if (go != null)
            {
                if (Application.isPlaying) Destroy(go);
                else DestroyImmediate(go);
            }
        }
        _spawned.Clear();
    }

    private static string ColorToHex(Color c) =>
        $"#{ColorUtility.ToHtmlStringRGB(c)}";

    private static float EffectiveRatio(float fromLevel, float inspectorFallback) =>
        fromLevel > 0f ? fromLevel : inspectorFallback;

    private static Color ParseColor(string hex, Color fallback)
    {
        if (string.IsNullOrWhiteSpace(hex)) return fallback;
        string h = hex.Trim();
        if (!h.StartsWith("#")) h = "#" + h;
        if (ColorUtility.TryParseHtmlString(h, out Color c)) return c;
        return fallback;
    }

    private Quaternion FlatRotation()
    {
        if (characterMove != null && characterMove.IsPresentation3DAngled())
            return Quaternion.Euler(58f, characterMove.Presentation3DObjectYaw, 0f);
        return Quaternion.Euler(90f, 0f, 0f);
    }

    private static Shader ResolveUnlitShader()
    {
        Shader s = Shader.Find("Sprites/Default");
        if (s != null) return s;
        s = Shader.Find("Unlit/Color");
        if (s != null) return s;
        s = Shader.Find("Universal Render Pipeline/Unlit");
        if (s != null) return s;
        return Shader.Find("Standard");
    }

    private static Sprite WhiteSprite()
    {
        if (_whiteSprite != null) return _whiteSprite;
        var tex = new Texture2D(4, 4, TextureFormat.RGBA32, false);
        var pixels = new Color[16];
        for (int i = 0; i < pixels.Length; i++) pixels[i] = Color.white;
        tex.SetPixels(pixels);
        tex.Apply();
        tex.filterMode = FilterMode.Bilinear;
        _whiteSprite = Sprite.Create(tex, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f), 4f);
        return _whiteSprite;
    }

    private void CreateAxisQuad(Vector3 center, float span, float thickness, float floorY, Color color)
    {
        var go = new GameObject("NumberLineAxis");
        go.transform.SetParent(VisualRoot(), true);
        go.transform.position = new Vector3(center.x, floorY + thickness * 0.5f, center.z);
        go.transform.rotation = FlatRotation();
        go.transform.localScale = new Vector3(span, thickness, 1f);
        ApplyColoredQuad(go, color);
        _spawned.Add(go);
    }

    private void CreateTickQuad(Vector3 pos, float width, float height, float floorY, Color color)
    {
        var go = new GameObject("NumberLineTick");
        go.transform.SetParent(VisualRoot(), true);
        go.transform.position = new Vector3(pos.x, floorY + height * 0.5f, pos.z);
        go.transform.rotation = FlatRotation();
        go.transform.localScale = new Vector3(width, height, 1f);
        ApplyColoredQuad(go, color);
        _spawned.Add(go);
    }

    private void CreateArrowhead(Vector3 tip, bool pointsLeft, float thickness, float armLength, Color color)
    {
        Vector3 outward = pointsLeft ? Vector3.left : Vector3.right;
        Vector3 wingA = tip + outward * armLength + Vector3.forward * armLength * 0.65f;
        Vector3 wingB = tip + outward * armLength + Vector3.back * armLength * 0.65f;
        CreateArrowSegment(wingA, tip, thickness, color);
        CreateArrowSegment(wingB, tip, thickness, color);
    }

    private void CreateArrowSegment(Vector3 from, Vector3 to, float thickness, Color color)
    {
        float len = Vector3.Distance(from, to);
        if (len < 0.001f) return;

        var go = new GameObject("NumberLineArrow");
        go.transform.SetParent(VisualRoot(), true);
        Vector3 mid = (from + to) * 0.5f;
        go.transform.position = mid + Vector3.up * thickness * 0.5f;
        Vector3 dir = (to - from).normalized;
        float yaw = Mathf.Atan2(dir.x, dir.z) * Mathf.Rad2Deg;
        if (characterMove != null && characterMove.IsPresentation3DAngled())
            go.transform.rotation = Quaternion.Euler(58f, yaw, 0f);
        else
            go.transform.rotation = Quaternion.Euler(90f, yaw, 0f);
        go.transform.localScale = new Vector3(len, thickness * 1.35f, 1f);
        ApplyColoredQuad(go, color);
        _spawned.Add(go);
    }

    private void CreateTickLabel(int tick, Vector3 basePos, float cell, float floorY, Color color, float sizeRatio)
    {
        var go = new GameObject($"TickLabel_{tick}");
        go.transform.SetParent(VisualRoot(), true);
        go.transform.position = basePos + new Vector3(0f, cell * 0.02f, -cell * 0.42f);
        go.transform.rotation = FlatRotation();

        var tmp = go.AddComponent<TextMeshPro>();
        tmp.text = tick.ToString();
        tmp.fontSize = Mathf.Clamp(cell * sizeRatio, 4f, 64f);
        tmp.fontStyle = FontStyles.Bold;
        tmp.alignment = TextAlignmentOptions.Center;
        tmp.color = color;
        tmp.rectTransform.sizeDelta = new Vector2(cell * 0.5f, cell * 0.35f);
        _spawned.Add(go);
    }

    /// <summary>SpriteRenderer quads — reliable tint on all pipelines (avoids pink missing-shader quads).</summary>
    private void ApplyColoredQuad(GameObject go, Color color)
    {
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = WhiteSprite();
        sr.color = color;
        sr.drawMode = SpriteDrawMode.Simple;
        sr.sortingLayerName = characterMove != null
            ? characterMove.numberLineSortingLayerName
            : "Default";
        sr.sortingOrder = characterMove != null ? characterMove.numberLineSortingOrder : 20;

        int queue = characterMove != null
            ? Mathf.Clamp(characterMove.numberLineRenderQueue, 1001, 4000)
            : 2100;
        if (sr.material != null)
            sr.material.renderQueue = queue;
    }
}
