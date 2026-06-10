using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Drop this on ANY empty GameObject in the scene (e.g. "BackgroundLayer").
///
/// It creates / re-configures a dedicated Canvas that always renders BEHIND
/// the 3D world (grid, robot, obstacles) AND behind every other UI Canvas.
///
/// Result:
///   1. Background Canvas (this one) - drawn first, far behind the camera.
///   2. 3D scene rendered by the main camera (grid, robot, objects).
///   3. Your normal UI Canvas (Commands panel, RUN button, ...) on top.
///
/// SETUP (one minute):
///   - Create empty GameObject "BackgroundLayer" at scene root.
///   - Add this component.
///   - Drop your background Sprite (or Texture) into the fields below.
///   - Press Play OR click the "Rebuild Background" context-menu item.
///
/// You do NOT need to change your existing UI Canvas at all.
/// </summary>
[ExecuteAlways]
public class BackgroundLayer : MonoBehaviour
{
    [Header("Camera")]
    [Tooltip("Camera that renders the 3D scene. Leave empty to auto-find Camera.main.")]
    public Camera worldCamera;

    [Header("Background Image")]
    public Sprite  backgroundSprite;
    public Texture backgroundTexture;
    public Color   tint = Color.white;
    public CanvasBackgroundImage.FitMode fitMode = CanvasBackgroundImage.FitMode.Cover;
    [Range(0.5f, 5f)] public float extraZoom = 1f;
    public Color backgroundFill = new Color(0.08f, 0.32f, 0.12f, 1f);

    [Header("Layering")]
    [Tooltip("Distance in front of the camera the background is placed at. " +
             "Should be larger than any 3D object's distance from camera. " +
             "Default 100 works for most top-down grid games.")]
    public float planeDistance = 100f;
    [Tooltip("Canvas sorting order. Negative so other canvases beat it.")]
    public int sortingOrder = -1000;

    private Canvas _canvas;
    private CanvasScaler _scaler;
    private CanvasBackgroundImage _bgImage;

    private void OnEnable() { Rebuild(); }

    private void LateUpdate()
    {
        // Keep simple property changes live without using OnValidate (which is
        // the source of the "Value cannot be null. Parameter name: _unity_self" error).
        if (_canvas != null)
        {
            if (worldCamera != null)
            {
                _canvas.renderMode    = RenderMode.ScreenSpaceCamera;
                _canvas.worldCamera   = worldCamera;
                _canvas.planeDistance = Mathf.Max(0.1f, planeDistance);
            }
            _canvas.sortingOrder = sortingOrder;
        }
        if (_bgImage != null)
        {
            _bgImage.image          = backgroundSprite;
            _bgImage.texture        = backgroundTexture;
            _bgImage.tint           = tint;
            _bgImage.fitMode        = fitMode;
            _bgImage.extraZoom      = extraZoom;
            _bgImage.backgroundFill = backgroundFill;
        }
    }

    [ContextMenu("Rebuild Background")]
    public void Rebuild()
    {
        // 1. Ensure / find the Canvas on this GameObject.
        _canvas = GetComponent<Canvas>();
        if (_canvas == null) _canvas = gameObject.AddComponent<Canvas>();
        _scaler = GetComponent<CanvasScaler>();
        if (_scaler == null) _scaler = gameObject.AddComponent<CanvasScaler>();
        if (GetComponent<GraphicRaycaster>() == null) gameObject.AddComponent<GraphicRaycaster>();

        // 2. Pick the camera.
        if (worldCamera == null) worldCamera = Camera.main;
        if (worldCamera == null)
        {
            Debug.LogWarning("[BackgroundLayer] No camera assigned and Camera.main is null. " +
                             "Falling back to Screen Space - Overlay (the background will sit on top of 3D).");
            _canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        }
        else
        {
            _canvas.renderMode    = RenderMode.ScreenSpaceCamera;
            _canvas.worldCamera   = worldCamera;
            _canvas.planeDistance = Mathf.Max(0.1f, planeDistance);
        }
        _canvas.sortingOrder = sortingOrder;

        // 3. Scaler — same defaults as ResponsiveCanvasScaler.
        _scaler.uiScaleMode         = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        _scaler.referenceResolution = new Vector2(1920f, 1080f);
        _scaler.screenMatchMode     = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
        _scaler.matchWidthOrHeight  = 0.5f;

        // 4. Ensure a CanvasBackgroundImage child exists and is configured.
        Transform childTf = transform.Find("BackgroundImage");
        GameObject child = childTf != null ? childTf.gameObject : null;
        if (child == null)
        {
            child = new GameObject("BackgroundImage", typeof(RectTransform));
            child.transform.SetParent(transform, false);
        }
        _bgImage = child.GetComponent<CanvasBackgroundImage>();
        if (_bgImage == null) _bgImage = child.AddComponent<CanvasBackgroundImage>();

        _bgImage.image          = backgroundSprite;
        _bgImage.texture        = backgroundTexture;
        _bgImage.tint           = tint;
        _bgImage.fitMode        = fitMode;
        _bgImage.extraZoom      = extraZoom;
        _bgImage.backgroundFill = backgroundFill;
        _bgImage.raycastTarget  = false; // never block clicks
        _bgImage.keepInBack     = true;

        // Make sure the GraphicRaycaster on the background canvas never blocks
        // raycasts to the main UI canvas in front of it.
        var raycaster = GetComponent<GraphicRaycaster>();
        if (raycaster != null) raycaster.enabled = false;

        _bgImage.Apply();
    }
}
