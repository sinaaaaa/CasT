using UnityEngine;

/// <summary>
/// Single place for student touch / UI feedback sounds (palette, robot, flag, tutorials).
/// Assign clips here. Other scripts call <see cref="GameInteractionSounds"/> — not their own AudioSource.
/// </summary>
[DisallowMultipleComponent]
[AddComponentMenu("SPARC/Game Interaction Sounds Settings")]
public class GameInteractionSoundsSettings : MonoBehaviour
{
    public static GameInteractionSoundsSettings Instance { get; private set; }

    [Header("Action palette & queue")]
    [Tooltip("Tap on an action button or queued block.")]
    public AudioClip actionTapClip;
    [Tooltip("Start dragging an action block.")]
    public AudioClip actionDragClip;

    [Header("Robot")]
    [Tooltip("Touch the robot to move or rotate it.")]
    public AudioClip robotTouchClip;

    [Header("Flag placement")]
    [Tooltip("Student places or moves the goal flag.")]
    public AudioClip flagPlaceClip;
    [Tooltip("Optional tutorial hand-tap animation. Leave empty to reuse Action Tap.")]
    public AudioClip flagTutorialTapClip;

    [Header("Drag / drop tutorials")]
    [Tooltip("Block snaps into the yellow queue strip.")]
    public AudioClip queueSnapPopClip;

    [Header("Guided blanks")]
    [Tooltip("Prompt when the student must pick turn left / turn right for a blank.")]
    public AudioClip guidedBlankPromptClip;

    [Header("Result popups")]
    [Tooltip("Level passed — success popup shown.")]
    public AudioClip successPopupClip;
    [Tooltip("Wrong answer retry popup or final failure popup.")]
    public AudioClip failPopupClip;

    [Header("Volume")]
    [Range(0f, 1f)] public float masterVolume = 0.55f;
    [Range(0f, 1f)] public float actionTapVolume = 0.5f;
    [Range(0f, 1f)] public float actionDragVolume = 0.55f;
    [Range(0f, 1f)] public float robotTouchVolume = 0.6f;
    [Range(0f, 1f)] public float flagPlaceVolume = 0.65f;
    [Range(0f, 1f)] public float flagTutorialTapVolume = 0.35f;
    [Range(0f, 1f)] public float queueSnapPopVolume = 0.7f;
    [Range(0f, 1f)] public float guidedBlankPromptVolume = 0.75f;
    [Range(0f, 1f)] public float successPopupVolume = 0.7f;
    [Range(0f, 1f)] public float failPopupVolume = 0.65f;

    [Header("Enable")]
    public bool playActionTap = true;
    public bool playActionDrag = true;
    public bool playRobotTouch = true;
    public bool playFlagPlace = true;
    public bool playFlagTutorialTap = true;
    public bool playQueueSnapPop = true;
    public bool playGuidedBlankPrompt = true;
    public bool playSuccessPopup = true;
    public bool playFailPopup = true;

    private AudioSource _source;
    private bool _legacyMigrated;

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(this);
            return;
        }

        Instance = this;
        DontDestroyOnLoad(gameObject);
        EnsureAudioSource();
    }

    private void Start()
    {
        MigrateLegacySceneClipsOnce();
    }

    private void OnDestroy()
    {
        if (Instance == this) Instance = null;
    }

    public void PlayActionTap() => PlayResolved(actionTapClip, "GameInteraction/action-tap", playActionTap, actionTapVolume, 0.0028f, 0.06f, 0.22f);
    public void PlayActionDrag() => PlayResolved(actionDragClip, "GameInteraction/action-drag", playActionDrag, actionDragVolume, 0.0034f, 0.08f, 0.18f);
    public void PlayRobotTouch() => PlayResolved(robotTouchClip, "GameInteraction/robot-touch", playRobotTouch, robotTouchVolume, 0.0042f, 0.1f, 0.24f);
    public void PlayFlagPlace() => PlayResolved(flagPlaceClip, "GameInteraction/flag-place", playFlagPlace, flagPlaceVolume, 0.0038f, 0.09f, 0.24f);
    public void PlayFlagTutorialTap()
    {
        if (!playFlagTutorialTap) return;
        AudioClip clip = flagTutorialTapClip != null ? flagTutorialTapClip : actionTapClip;
        if (clip == null) clip = Resources.Load<AudioClip>("GameInteraction/action-tap");
        PlayClip(clip, flagTutorialTapVolume);
    }
    public void PlayQueueSnapPop(float volumeScale = 1f)
    {
        if (!playQueueSnapPop) return;
        AudioClip clip = ResolveClip(queueSnapPopClip, "GameInteraction/queue-snap-pop", 0.0032f, 0.07f, 0.2f);
        PlayClip(clip, queueSnapPopVolume * volumeScale);
    }
    public void PlayGuidedBlankPrompt() => PlayResolved(guidedBlankPromptClip, "GameInteraction/guided-blank-prompt", playGuidedBlankPrompt, guidedBlankPromptVolume, 0.0045f, 0.12f, 0.22f);
    public void PlaySuccessPopup() => PlayPopup(successPopupClip, "GameInteraction/success-popup", playSuccessPopup, successPopupVolume, 0.0036f, 0.14f, 0.28f);
    public void PlayFailPopup() => PlayPopup(failPopupClip, "GameInteraction/fail-popup", playFailPopup, failPopupVolume, 0.0052f, 0.11f, 0.24f);

    private void EnsureAudioSource()
    {
        _source = GetComponent<AudioSource>();
        if (_source == null) _source = gameObject.AddComponent<AudioSource>();
        _source.playOnAwake = false;
        _source.spatialBlend = 0f;
        _source.volume = masterVolume;
    }

    private void PlayResolved(
        AudioClip clip,
        string resourcePath,
        bool enabled,
        float volumeScale,
        float tonePeriod,
        float toneDuration,
        float toneVolume)
    {
        if (!enabled) return;
        PlayClip(ResolveClip(clip, resourcePath, tonePeriod, toneDuration, toneVolume), volumeScale);
    }

    private void PlayPopup(
        AudioClip clip,
        string resourcePath,
        bool enabled,
        float volumeScale,
        float tonePeriod,
        float toneDuration,
        float toneVolume)
    {
        if (!enabled) return;
        AudioInitializer.EnsureAudioUnlocked();
        PlayClip(ResolveClip(clip, resourcePath, tonePeriod, toneDuration, toneVolume), volumeScale);
    }

    private void PlayClip(AudioClip clip, float volumeScale)
    {
        if (clip == null || _source == null) return;
        _source.PlayOneShot(clip, Mathf.Clamp01(masterVolume * volumeScale));
    }

    private static AudioClip ResolveClip(AudioClip assigned, string resourcePath, float wavePeriod, float duration, float volume)
    {
        if (assigned != null) return assigned;
        var resourceClip = Resources.Load<AudioClip>(resourcePath);
        if (resourceClip != null) return resourceClip;
        return CreateToneClip(wavePeriod, duration, volume);
    }

    private static AudioClip CreateToneClip(float wavePeriod, float duration, float volume)
    {
        int sampleRate = 22050;
        var volumeCurve = new AnimationCurve(
            new Keyframe(0f, volume),
            new Keyframe(duration * 0.35f, volume * 0.85f),
            new Keyframe(duration, 0f));
        var frequencyCurve = new AnimationCurve(
            new Keyframe(0f, wavePeriod),
            new Keyframe(duration, wavePeriod * 1.08f));
        return LeanAudio.createAudio(volumeCurve, frequencyCurve, LeanAudio.options().setFrequency(sampleRate));
    }

    /// <summary>
    /// Copies clips that were still assigned on older scene components (one-time migration).
    /// </summary>
    private void MigrateLegacySceneClipsOnce()
    {
        if (_legacyMigrated) return;
        _legacyMigrated = true;

        var flagTutorial = FindObjectOfType<FlagTaskTutorialController>(true);
        if (flagTutorial != null)
            flagTutorial.MigrateSoundClipsTo(this);

        var dragTutorial = FindObjectOfType<DragDropTutorialController>(true);
        if (dragTutorial != null)
            dragTutorial.MigrateSoundClipsTo(this);

        var characterMove = FindObjectOfType<CharacterMove>(true);
        if (characterMove != null)
            characterMove.MigrateInteractionSoundClipsTo(this);

        var tutorialManager = FindObjectOfType<TutorialManager>(true);
        if (tutorialManager != null)
            tutorialManager.MigrateSoundClipsTo(this);
    }
}
