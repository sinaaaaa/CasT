/// <summary>
/// Static entry point — all playback is handled by <see cref="GameInteractionSoundsSettings"/>.
/// </summary>
public static class GameInteractionSounds
{
    private static GameInteractionSoundsSettings Resolve()
    {
        if (GameInteractionSoundsSettings.Instance != null)
            return GameInteractionSoundsSettings.Instance;
        return UnityEngine.Object.FindObjectOfType<GameInteractionSoundsSettings>();
    }

    public static void PlayActionTap() => Resolve()?.PlayActionTap();
    public static void PlayActionDrag() => Resolve()?.PlayActionDrag();
    public static void PlayRobotTouch() => Resolve()?.PlayRobotTouch();
    public static void PlayFlagPlace() => Resolve()?.PlayFlagPlace();
    public static void PlayFlagTutorialTap() => Resolve()?.PlayFlagTutorialTap();
    public static void PlayQueueSnapPop(float volumeScale = 1f) => Resolve()?.PlayQueueSnapPop(volumeScale);
    public static void PlayGuidedBlankPrompt() => Resolve()?.PlayGuidedBlankPrompt();
    public static void PlaySuccessPopup() => Resolve()?.PlaySuccessPopup();
    public static void PlayFailPopup() => Resolve()?.PlayFailPopup();

    public static void RefreshFromSettings(GameInteractionSoundsSettings settings)
    {
        // Settings owns clip resolution; kept for callers that refresh after inspector edits.
        if (settings == null) return;
    }
}
