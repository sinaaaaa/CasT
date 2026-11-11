using UnityEngine;

/// <summary>
/// Keeps Unity WebGL alive on phones and older iPads.
/// Safari often kills the tab when the page uses more than ~300–500 MB total.
/// </summary>
[DefaultExecutionOrder(-1000)]
public static class WebGLDeviceGuard
{
    public static bool IsConstrainedWebDevice { get; private set; }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void ApplyBeforeSceneLoad()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        IsConstrainedWebDevice = DetectConstrainedWebDevice();
        if (!IsConstrainedWebDevice) return;

        // Prefer the cheapest quality tier before scenes spawn heavy assets.
        try
        {
            int lowest = 0;
            QualitySettings.SetQualityLevel(lowest, true);
            QualitySettings.shadows = ShadowQuality.Disable;
            QualitySettings.antiAliasing = 0;
            QualitySettings.softParticles = false;
            QualitySettings.realtimeReflectionProbes = false;
            QualitySettings.particleRaycastBudget = 16;
            QualitySettings.skinWeights = SkinWeights.TwoBones;
        }
        catch
        {
            // Quality tiers vary by project; ignore if a setting is unavailable.
        }

        Application.targetFrameRate = 30;
        Application.backgroundLoadingPriority = ThreadPriority.BelowNormal;
        Debug.Log("[WebGLDeviceGuard] Low-memory / mobile WebGL profile enabled.");
#endif
    }

    static bool DetectConstrainedWebDevice()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        // systemMemorySize is often 0 or rough on WebGL; treat any mobile-class GPU as constrained.
        string gpu = (SystemInfo.graphicsDeviceName ?? "").ToLowerInvariant();
        string device = (SystemInfo.deviceModel ?? "").ToLowerInvariant();
        bool appleGpu = gpu.Contains("apple") || gpu.Contains("powervr") || gpu.Contains("mali");
        bool namedMobile = device.Contains("ipad") || device.Contains("iphone") || device.Contains("android");
        bool lowReportedRam = SystemInfo.systemMemorySize > 0 && SystemInfo.systemMemorySize <= 4096;
        bool lowGpuMem = SystemInfo.graphicsMemorySize > 0 && SystemInfo.graphicsMemorySize <= 1024;
        return appleGpu || namedMobile || lowReportedRam || lowGpuMem;
#else
        return false;
#endif
    }

    /// <summary>Call after heavy level setup to give Safari room to breathe.</summary>
    public static System.Collections.IEnumerator SoftReclaim()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        if (!IsConstrainedWebDevice) yield break;
        yield return null;
        var unload = Resources.UnloadUnusedAssets();
        while (unload != null && !unload.isDone)
            yield return null;
        System.GC.Collect();
        yield return null;
#else
        yield break;
#endif
    }
}
