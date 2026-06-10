using UnityEngine;

/// <summary>
/// Blinking flat square on one grid cell (start / end marker). Driven by CharacterMove.RefreshCellBlinkHighlights.
/// </summary>
[DisallowMultipleComponent]
public class GridCellBlinkMarker : MonoBehaviour
{
    public enum MarkerKind { Start, End }

    [Header("Look")]
    public MarkerKind kind = MarkerKind.End;
    public Color baseColor = new Color(0.2f, 0.95f, 0.35f, 0.85f);
    [Range(0.1f, 8f)] public float blinkSpeed = 2.5f;
    [Range(0f, 1f)] public float minAlpha = 0.25f;
    [Range(0f, 1f)] public float maxAlpha = 0.95f;

    private SpriteRenderer _sprite;
    private static Sprite _sharedWhiteSprite;

    public void Configure(MarkerKind markerKind, Color color, int sortingOrder, float speed)
    {
        kind = markerKind;
        baseColor = color;
        blinkSpeed = speed;
        EnsureRenderer(sortingOrder);
    }

    private void OnEnable()
    {
        if (_sprite == null) _sprite = GetComponent<SpriteRenderer>();
    }

    private void Update()
    {
        if (_sprite == null) return;
        float t = (Mathf.Sin(Time.time * blinkSpeed) + 1f) * 0.5f;
        float a = Mathf.Lerp(minAlpha, maxAlpha, t);
        Color c = baseColor;
        c.a = a * baseColor.a;
        _sprite.color = c;
    }

    private void EnsureRenderer(int sortingOrder)
    {
        _sprite = GetComponent<SpriteRenderer>();
        if (_sprite == null) _sprite = gameObject.AddComponent<SpriteRenderer>();
        if (_sharedWhiteSprite == null)
            _sharedWhiteSprite = CreateWhiteSprite();
        _sprite.sprite = _sharedWhiteSprite;
        _sprite.sortingLayerName = "Default";
        _sprite.sortingOrder = sortingOrder;
        _sprite.color = baseColor;
        _sprite.enabled = true;
        _sprite.receiveShadows = false;
        _sprite.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
    }

    private static Sprite CreateWhiteSprite()
    {
        var tex = new Texture2D(4, 4, TextureFormat.RGBA32, false);
        var fill = new Color[16];
        for (int i = 0; i < fill.Length; i++) fill[i] = Color.white;
        tex.SetPixels(fill);
        tex.Apply();
        tex.filterMode = FilterMode.Bilinear;
        return Sprite.Create(tex, new Rect(0, 0, 4, 4), new Vector2(0.5f, 0.5f), 4f);
    }
}
