using UnityEngine;

/// <summary>
/// Forces a UI RectTransform to keep a fixed aspect ratio inside its parent,
/// shrinking to fit so the grid (or any element) is never cropped or stretched.
///
/// Put this on the "GameAreaFrame" RectTransform that hosts your grid background.
/// Width and height anchors should both be stretched (anchorMin=0, anchorMax=1).
/// Set "aspect" to 1 for a square grid, 16/9 for widescreen, etc.
/// </summary>
[RequireComponent(typeof(RectTransform))]
[ExecuteAlways]
public class AspectRatioLockedFitter : MonoBehaviour
{
    [Tooltip("Width / Height. 1 = square, 16/9 = widescreen, 4/3 = tablet, etc.")]
    public float aspect = 1f;

    [Tooltip("Maximum fraction of the parent's smaller dimension to use (0-1).")]
    [Range(0.1f, 1f)] public float maxFillRatio = 1f;

    [Tooltip("Recenter inside the parent.")]
    public bool centerInParent = true;

    private RectTransform _rt;

    private void OnEnable()  { _rt = GetComponent<RectTransform>(); Apply(); }
    private void OnRectTransformDimensionsChange() { Apply(); }

    // No OnValidate — LateUpdate + OnRectTransformDimensionsChange keep this live.

    private void LateUpdate() { Apply(); }

    public void Apply()
    {
        if (_rt == null) _rt = GetComponent<RectTransform>();
        if (_rt == null) return;
        RectTransform parent = _rt.parent as RectTransform;
        if (parent == null) return;

        Rect pRect = parent.rect;
        float availW = pRect.width;
        float availH = pRect.height;
        if (availW <= 0f || availH <= 0f) return;

        float a = Mathf.Max(0.01f, aspect);
        float fitW, fitH;
        if (availW / a <= availH) { fitW = availW; fitH = availW / a; }
        else                      { fitH = availH; fitW = availH * a; }

        fitW *= Mathf.Clamp01(maxFillRatio);
        fitH *= Mathf.Clamp01(maxFillRatio);

        if (centerInParent)
        {
            _rt.anchorMin = new Vector2(0.5f, 0.5f);
            _rt.anchorMax = new Vector2(0.5f, 0.5f);
            _rt.pivot     = new Vector2(0.5f, 0.5f);
            _rt.anchoredPosition = Vector2.zero;
        }
        _rt.sizeDelta = new Vector2(fitW, fitH);
    }
}
