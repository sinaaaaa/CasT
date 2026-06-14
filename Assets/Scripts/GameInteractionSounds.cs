using UnityEngine;

/// <summary>
/// Short UI feedback sounds for taps, drags, and robot touches.
/// Clips load from Resources/GameInteraction/ when present; otherwise LeanAudio generates tones.
/// </summary>
public static class GameInteractionSounds
{
    private static AudioSource _source;
    private static AudioClip _actionTap;
    private static AudioClip _actionDrag;
    private static AudioClip _robotTouch;
    private static bool _initialized;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void Install()
    {
        EnsureReady();
    }

    private static void EnsureReady()
    {
        if (_initialized) return;
        _initialized = true;

        var go = new GameObject("GameInteractionSounds");
        Object.DontDestroyOnLoad(go);
        _source = go.AddComponent<AudioSource>();
        _source.playOnAwake = false;
        _source.spatialBlend = 0f;
        _source.volume = 0.55f;

        _actionTap = Resources.Load<AudioClip>("GameInteraction/action-tap");
        _actionDrag = Resources.Load<AudioClip>("GameInteraction/action-drag");
        _robotTouch = Resources.Load<AudioClip>("GameInteraction/robot-touch");

        if (_actionTap == null) _actionTap = CreateToneClip(0.0028f, 0.06f, 0.22f);
        if (_actionDrag == null) _actionDrag = CreateToneClip(0.0034f, 0.08f, 0.18f);
        if (_robotTouch == null) _robotTouch = CreateToneClip(0.0042f, 0.1f, 0.24f);
    }

    public static void PlayActionTap()
    {
        EnsureReady();
        Play(_actionTap, 0.5f);
    }

    public static void PlayActionDrag()
    {
        EnsureReady();
        Play(_actionDrag, 0.55f);
    }

    public static void PlayRobotTouch()
    {
        EnsureReady();
        Play(_robotTouch, 0.6f);
    }

    private static void Play(AudioClip clip, float volumeScale)
    {
        if (_source == null || clip == null) return;
        _source.PlayOneShot(clip, Mathf.Clamp01(volumeScale));
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
}
