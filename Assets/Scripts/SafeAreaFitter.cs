using UnityEngine;

/// <summary>
/// Put this on any RectTransform whose children should respect the safe area
/// (e.g. avoid iPhone notches, Android cutouts, browser chrome on mobile WebGL).
///
/// Recommended usage:
///  - Add an empty "SafeArea" RectTransform under your root Canvas, stretch to full parent.
///  - Add this script to it. Set "applyOn" to the sides you want clipped (usually All).
///  - Put your gameplay UI (Goal panel, Commands panel, RUN, ...) inside this SafeArea.
/// </summary>
[RequireComponent(typeof(RectTransform))]
[ExecuteAlways]
public class SafeAreaFitter : MonoBehaviour
{
    [System.Flags]
    public enum Sides
    {
        None   = 0,
        Left   = 1,
        Right  = 2,
        Top    = 4,
        Bottom = 8,
        All    = Left | Right | Top | Bottom,
    }

    [Tooltip("Which sides should respect the device safe area.")]
    public Sides applyOn = Sides.All;

    [Tooltip("Extra padding (px in screen space) added on top of the system safe area.")]
    public Vector4 extraPaddingLRTB = Vector4.zero;

    [Tooltip("Recompute every frame (cheap; handles browser resize, rotation, devtools open).")]
    public bool runEveryFrame = true;

    private RectTransform _rt;
    private Rect _lastSafeArea;
    private Vector2Int _lastScreen;
    private ScreenOrientation _lastOrient;

    private void OnEnable()
    {
        _rt = GetComponent<RectTransform>();
        Apply();
    }

    private void Update()
    {
        if (!runEveryFrame) return;
        if (Screen.safeArea != _lastSafeArea ||
            Screen.width  != _lastScreen.x ||
            Screen.height != _lastScreen.y ||
            Screen.orientation != _lastOrient)
        {
            Apply();
        }
    }

    public void Apply()
    {
        if (_rt == null) _rt = GetComponent<RectTransform>();
        if (_rt == null) return;

        Rect sa = Screen.safeArea;
        _lastSafeArea = sa;
        _lastScreen = new Vector2Int(Screen.width, Screen.height);
        _lastOrient = Screen.orientation;

        Vector2 anchorMin = sa.position;
        Vector2 anchorMax = sa.position + sa.size;

        anchorMin.x /= Screen.width;
        anchorMin.y /= Screen.height;
        anchorMax.x /= Screen.width;
        anchorMax.y /= Screen.height;

        if ((applyOn & Sides.Left)   == 0) anchorMin.x = 0f;
        if ((applyOn & Sides.Bottom) == 0) anchorMin.y = 0f;
        if ((applyOn & Sides.Right)  == 0) anchorMax.x = 1f;
        if ((applyOn & Sides.Top)    == 0) anchorMax.y = 1f;

        _rt.anchorMin = anchorMin;
        _rt.anchorMax = anchorMax;
        _rt.offsetMin = new Vector2( extraPaddingLRTB.x,  extraPaddingLRTB.w);
        _rt.offsetMax = new Vector2(-extraPaddingLRTB.y, -extraPaddingLRTB.z);
    }
}
