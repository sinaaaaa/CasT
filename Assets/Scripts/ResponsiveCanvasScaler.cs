using UnityEngine;
using UnityEngine.UI;

/// <summary>
/// Drop this on the root Canvas (next to the CanvasScaler).
/// It keeps a "Scale With Screen Size" canvas looking correct on
/// phones (wide aspect), tablets (4:3), and PC monitors (16:9, 21:9)
/// by switching the CanvasScaler.matchWidthOrHeight value automatically.
///
/// How it works:
///  - "matchWidthOrHeight = 0"  -> scale by WIDTH  (best for very wide screens)
///  - "matchWidthOrHeight = 1"  -> scale by HEIGHT (best for tall/portrait or square screens)
///  - We pick a value in between based on the current aspect ratio vs the reference,
///    so UI elements never get cropped or stretched off-screen.
/// </summary>
[RequireComponent(typeof(CanvasScaler))]
[ExecuteAlways]
public class ResponsiveCanvasScaler : MonoBehaviour
{
    [Header("Reference Resolution (landscape)")]
    public Vector2 referenceResolution = new Vector2(1920f, 1080f);

    [Header("Match Range")]
    [Tooltip("Used when screen is much wider than the reference (e.g. ultrawide PC).")]
    [Range(0f, 1f)] public float matchAtWideAspect = 0f;
    [Tooltip("Used when screen aspect equals the reference aspect.")]
    [Range(0f, 1f)] public float matchAtReferenceAspect = 0.5f;
    [Tooltip("Used when screen is much taller than the reference (e.g. phone in portrait or square iPad).")]
    [Range(0f, 1f)] public float matchAtTallAspect = 1f;

    [Header("How aggressively the match value reacts to aspect change")]
    [Range(0.1f, 4f)] public float aspectSensitivity = 1.5f;

    [Header("Update")]
    public bool runEveryFrame = true;

    private CanvasScaler _scaler;
    private Vector2 _lastScreen;

    private void OnEnable()
    {
        _scaler = GetComponent<CanvasScaler>();
        if (_scaler != null)
        {
            _scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            _scaler.referenceResolution = referenceResolution;
            _scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
        }
        Apply();
    }

    private void Update()
    {
        if (!runEveryFrame) return;
        Vector2 s = new Vector2(Screen.width, Screen.height);
        if (s != _lastScreen) Apply();
    }

    // No OnValidate — Update() picks up Inspector edits live without the disposal race.

    public void Apply()
    {
        if (_scaler == null) _scaler = GetComponent<CanvasScaler>();
        if (_scaler == null) return;

        int sw = Mathf.Max(1, Screen.width);
        int sh = Mathf.Max(1, Screen.height);
        _lastScreen = new Vector2(sw, sh);

        float refAspect    = referenceResolution.x / Mathf.Max(1f, referenceResolution.y);
        float screenAspect = (float)sw / sh;

        // ratio < 1 -> screen narrower/taller than reference (phone-ish)
        // ratio > 1 -> screen wider than reference (ultrawide)
        float ratio = screenAspect / refAspect;

        // Convert ratio to a -1..0..1 "tallness" axis (-1 ultrawide, 0 reference, 1 tall).
        float t = Mathf.Clamp(Mathf.Log(ratio, 2f) * aspectSensitivity, -1f, 1f);

        float match;
        if (t >= 0f) match = Mathf.Lerp(matchAtReferenceAspect, matchAtTallAspect, t);
        else         match = Mathf.Lerp(matchAtReferenceAspect, matchAtWideAspect, -t);

        // Reverse the sign convention: when the screen is taller we want HEIGHT match (1).
        // When wider we want WIDTH match (0). The lerps above already produce that.
        _scaler.matchWidthOrHeight = match;
        _scaler.referenceResolution = referenceResolution;
    }
}
