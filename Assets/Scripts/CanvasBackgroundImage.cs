using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// One-click responsive background image for any Screen Space Canvas.
///
/// USAGE
///  1. Add a child GameObject to your root Canvas, name it "Background".
///  2. Add this component. Drop a Sprite or Texture into "image" or "texture".
///  3. The component will:
///       - Stretch itself to fill the entire canvas (anchors 0,0 -> 1,1).
///       - Sit as the FIRST sibling (so it renders BEHIND every other UI).
///       - Scale the image with the chosen "fitMode" so it never stretches awkwardly.
///
/// MODES
///  - Stretch : exact fill, may distort
///  - Cover   : fills the screen, may crop edges (recommended for photos)
///  - Contain : entire image visible, may leave letter-/pillar-boxing (use a tint to mask)
/// </summary>
[ExecuteAlways]
[RequireComponent(typeof(RectTransform))]
public class CanvasBackgroundImage : MonoBehaviour
{
    public enum FitMode { Stretch, Cover, Contain }

    [Header("Source (use one)")]
    public Sprite image;
    public Texture texture;

    [Header("Look")]
    public Color tint = Color.white;
    public FitMode fitMode = FitMode.Cover;
    [Range(0f, 5f)] public float extraZoom = 1f;
    [Tooltip("Color shown around a 'Contain' image / behind transparency.")]
    public Color backgroundFill = new Color(0f, 0f, 0f, 1f);

    [Header("Behaviour")]
    [Tooltip("Send this object to the back of the canvas every frame (recommended).")]
    public bool keepInBack = true;
    [Tooltip("Block raycasts behind UI buttons? Usually OFF for a background.")]
    public bool raycastTarget = false;

    private RawImage   _raw;
    private Image      _img;
    private RectTransform _rt;
    private RectTransform _imageHolder;
    private Image      _fill;

    private void OnEnable()
    {
        _rt = GetComponent<RectTransform>();
        BuildHierarchyIfNeeded();
        Apply();
    }

    // No OnValidate — Update / OnRectTransformDimensionsChange below keeps the look live.
    private void OnRectTransformDimensionsChange() { Apply(); }
    private void Update() { Apply(); }

    private void BuildHierarchyIfNeeded()
    {
        // Stretch self to full parent
        _rt.anchorMin = Vector2.zero;
        _rt.anchorMax = Vector2.one;
        _rt.pivot     = new Vector2(0.5f, 0.5f);
        _rt.offsetMin = Vector2.zero;
        _rt.offsetMax = Vector2.zero;

        // Fill (background color)
        if (_fill == null)
        {
            Transform existing = transform.Find("_Fill");
            GameObject go = existing != null ? existing.gameObject : new GameObject("_Fill", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(transform, false);
            go.transform.SetAsFirstSibling();
            _fill = go.GetComponent<Image>();
            RectTransform fr = go.GetComponent<RectTransform>();
            fr.anchorMin = Vector2.zero; fr.anchorMax = Vector2.one;
            fr.offsetMin = Vector2.zero; fr.offsetMax = Vector2.zero;
        }

        // Image holder
        if (_imageHolder == null)
        {
            Transform existing = transform.Find("_Image");
            GameObject go = existing != null ? existing.gameObject : new GameObject("_Image", typeof(RectTransform));
            go.transform.SetParent(transform, false);
            _imageHolder = go.GetComponent<RectTransform>();
            _imageHolder.anchorMin = new Vector2(0.5f, 0.5f);
            _imageHolder.anchorMax = new Vector2(0.5f, 0.5f);
            _imageHolder.pivot     = new Vector2(0.5f, 0.5f);
            _imageHolder.anchoredPosition = Vector2.zero;
        }

        // Pick UI graphic based on what the user dropped in.
        bool useSprite = image != null;
        if (useSprite)
        {
            if (_raw != null) DestroyImmediateSafe(_raw); _raw = null;
            if (_img == null) _img = _imageHolder.gameObject.GetComponent<Image>() ?? _imageHolder.gameObject.AddComponent<Image>();
            _img.preserveAspect = false; // we handle aspect manually
        }
        else
        {
            if (_img != null) DestroyImmediateSafe(_img); _img = null;
            if (_raw == null) _raw = _imageHolder.gameObject.GetComponent<RawImage>() ?? _imageHolder.gameObject.AddComponent<RawImage>();
        }
    }

    public void Apply()
    {
        if (_rt == null) _rt = GetComponent<RectTransform>();
        if (_fill == null || _imageHolder == null)
        {
#if UNITY_EDITOR
            // Never call BuildHierarchyIfNeeded() while the editor is binding / compiling.
            if (UnityEditor.EditorApplication.isCompiling) return;
            if (UnityEditor.EditorApplication.isUpdating)  return;
#endif
            BuildHierarchyIfNeeded();
        }

        if (keepInBack && transform.parent != null && transform.GetSiblingIndex() != 0)
            transform.SetAsFirstSibling();

        if (_fill != null)
        {
            _fill.color = backgroundFill;
            _fill.raycastTarget = raycastTarget;
        }

        Rect parentRect = _rt.rect;
        float availW = parentRect.width;
        float availH = parentRect.height;

        float srcW = 1f, srcH = 1f;
        if (image != null) { srcW = image.rect.width;  srcH = image.rect.height; }
        else if (texture != null) { srcW = texture.width; srcH = texture.height; }

        Vector2 size;
        if (srcW <= 0f || srcH <= 0f || fitMode == FitMode.Stretch)
        {
            size = new Vector2(availW, availH);
        }
        else
        {
            float srcAspect = srcW / srcH;
            float screenAspect = availW / Mathf.Max(1f, availH);
            bool widerThanScreen = srcAspect > screenAspect;
            bool useWidth = (fitMode == FitMode.Cover) ? !widerThanScreen : widerThanScreen;
            if (useWidth) { size.x = availW; size.y = availW / srcAspect; }
            else          { size.y = availH; size.x = availH * srcAspect; }
        }
        size *= Mathf.Max(0.01f, extraZoom);
        _imageHolder.sizeDelta = size;

        if (image != null && _img != null)
        {
            _img.sprite = image;
            _img.color  = tint;
            _img.raycastTarget = raycastTarget;
            _img.type   = Image.Type.Simple;
            _img.preserveAspect = false;
        }
        else if (_raw != null)
        {
            _raw.texture = texture;
            _raw.color   = tint;
            _raw.raycastTarget = raycastTarget;
        }
    }

    private static void DestroyImmediateSafe(Object o)
    {
        if (o == null) return;
        if (Application.isPlaying) Destroy(o);
        else DestroyImmediate(o);
    }
}
