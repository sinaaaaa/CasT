using UnityEngine;

#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

/// <summary>
/// Short contact ticks for grabbing the robot. WebGL uses navigator.vibrate;
/// phones use the platform vibrator. Desktop editors stay silent.
/// </summary>
public static class GameHaptics
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    static extern void WebGLHapticPulse(int durationMs);
#endif

    public static void PlayGrab() => Pulse(18);
    public static void PlayDrop() => Pulse(10);
    public static void PlayTurn() => Pulse(14);

    static void Pulse(int durationMs)
    {
        durationMs = Mathf.Clamp(durationMs, 1, 80);
#if UNITY_WEBGL && !UNITY_EDITOR
        WebGLHapticPulse(durationMs);
#elif UNITY_ANDROID && !UNITY_EDITOR
        TryAndroidVibrate(durationMs);
#elif UNITY_IOS && !UNITY_EDITOR
        if (durationMs >= 14)
            Handheld.Vibrate();
#endif
    }

#if UNITY_ANDROID && !UNITY_EDITOR
    static void TryAndroidVibrate(int durationMs)
    {
        try
        {
            using (var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
            using (var activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity"))
            using (var vibrator = activity.Call<AndroidJavaObject>("getSystemService", "vibrator"))
            {
                if (vibrator == null) return;
                vibrator.Call("vibrate", (long)durationMs);
            }
        }
        catch (System.Exception)
        {
        }
    }
#endif
}
