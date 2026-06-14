using System.Runtime.InteropServices;
using UnityEngine;

/// <summary>
/// Keeps the game in landscape on phones/tablets (native + WebGL).
/// </summary>
[DefaultExecutionOrder(-200)]
public class LandscapeOrientationLock : MonoBehaviour
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    private static extern void SparcLockLandscapeOrientation();
#endif

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void InstallBeforeFirstScene()
    {
        ApplyLandscapeOnly();
    }

    private void Awake()
    {
        ApplyLandscapeOnly();
        RequestBrowserLandscapeLock();
    }

    public static void ApplyLandscapeOnly()
    {
        Screen.autorotateToPortrait = false;
        Screen.autorotateToPortraitUpsideDown = false;
        Screen.autorotateToLandscapeLeft = true;
        Screen.autorotateToLandscapeRight = true;

        if (Screen.orientation == ScreenOrientation.Portrait ||
            Screen.orientation == ScreenOrientation.PortraitUpsideDown)
        {
            Screen.orientation = ScreenOrientation.LandscapeLeft;
        }
    }

    public static void RequestBrowserLandscapeLock()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        try
        {
            SparcLockLandscapeOrientation();
        }
        catch
        {
            // Optional browser API — ignore when unavailable (desktop, iOS Safari, etc.).
        }
#endif
    }
}
