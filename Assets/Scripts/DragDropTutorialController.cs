using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Beginner-friendly overlay for the INTRODUCTION level only — teaches dragging blocks into the yellow strip.
/// Does not run on path-building (DRAG_ACTIONS) or edit-program levels. Ghost visuals only (no assessment).
/// </summary>
[DisallowMultipleComponent]
public class DragDropTutorialController : MonoBehaviour
{
    public enum TutorialMode
    {
        None,
        DragToProgramStrip,
        FixStarterProgram,
        ReorderProgram,
        RemoveCommand
    }

    public static DragDropTutorialController Active { get; private set; }

    [Header("References")]
    public CharacterMove characterMove;

    [Header("UI targets (assign in Inspector or leave empty to auto-wire from CharacterMove)")]
    [Tooltip("Optional parent around the four palette buttons.")]
    public RectTransform commandSourceArea;
    public RectTransform forwardCommandButton;
    public RectTransform turnLeftCommandButton;
    public RectTransform turnRightCommandButton;
    public RectTransform yellowStripDropZone;
    public RectTransform runButton;

    [Header("Tutorial visuals")]
    public GameObject handIcon;
    [Tooltip("Optional prefab for the demo block. If empty, a runtime Image is created from the Forward sprite.")]
    public GameObject ghostCommandPrefab;
    [Tooltip("CanvasGroup on the instruction bubble root.")]
    public CanvasGroup instructionPanel;
    public TMP_Text instructionText;

    [Header("Audio (legacy — clip migrates to GameInteractionSoundsSettings)")]
    [Tooltip("Deprecated: assign on GameInteractionSoundsSettings as Queue Snap Pop Clip.")]
    public AudioClip popSound;

    [Header("Timing")]
    public float startDelaySeconds = 0.5f;
    [Range(2, 4)] public int dragDemoRepeatCount = 3;
    [Range(2, 4)] public int runTapDemoRepeatCount = 2;
    public float pauseBetweenDragRepeatsSeconds = 0.35f;
    public float pauseBeforeRunDemoSeconds = 0.5f;
    [Range(3f, 8f)] public float tutorialVisibleSeconds = 3f;
    public float fadeOutSeconds = 0.65f;
    public float dragAnimationSeconds = 1.2f;
    public float snapPopSeconds = 0.22f;
    public float runTapAnimationSeconds = 0.55f;
    public float pauseBetweenRunTapsSeconds = 0.4f;

    [Header("Style")]
    public Color stripGlowColor = new Color(1f, 0.92f, 0.35f, 0.45f);
    public Color pulseHighlightColor = new Color(1f, 1f, 1f, 0.35f);
    [Range(0f, 0.35f)] public float buttonPulseScale = 0.08f;
    public float pulseSpeed = 2.2f;

    [Header("Layering")]
    [Tooltip("Tutorial hand/ghost draw above the yellow strip (separate overlay canvas sorting order).")]
    public int overlaySortingOrderBump = 300;
    [Tooltip("Hand scale during Play-button tap demo (intro steps).")]
    public float runTapHandScale = 1.35f;

    [Header("Behavior")]
    public bool debugLogs = true;
    [Tooltip("Remember completion per level key so the tutorial only auto-plays once on intro.")]
    public bool rememberSeenPerLevel = true;
    public Sprite handSprite;
    [Tooltip("Optional sparkle image; a soft generated dot is used if empty.")]
    public Sprite sparkleSprite;

    private TutorialMode _mode = TutorialMode.None;
    private Coroutine _routine;
    private Coroutine _sparkleFadeRoutine;
    private Coroutine _introStepDemoRoutine;

    /// <summary>True while a per-step intro demo (drag / run tap) is playing.</summary>
    public bool IsStepDemoPlaying { get; private set; }
    private int _lastPlaySlot = -1;
    private bool _studentHasDragged;
    private bool _stepDemoCancelled;
    private bool _tutorialRunning;
    private GameObject _runtimeHand;
    private GameObject _runtimeGhost;
    private GameObject _runtimeSparkle;
    private Image _stripGlowImage;
    private readonly List<Image> _starterHighlights = new List<Image>();
    private Canvas _rootCanvas;
    private RectTransform _dragVisualsLayer;
    private System.Action _onOpeningSequenceComplete;

    /// <summary>Fired when the full opening sequence (drag repeats + run tap) finishes or is skipped.</summary>
    public event System.Action OpeningSequenceCompleted;

    private void Awake()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        RemoveLegacyShowMeHowButton();
    }

    /// <summary>One-time copy from scene fields into <see cref="GameInteractionSoundsSettings"/>.</summary>
    public void MigrateSoundClipsTo(GameInteractionSoundsSettings target)
    {
        if (target == null) return;
        if (target.queueSnapPopClip == null && popSound != null)
            target.queueSnapPopClip = popSound;
    }

    private void OnEnable()
    {
        Active = this;
        HideTutorial();
        _studentHasDragged = false;
    }

    private void OnDisable()
    {
        if (Active == this) Active = null;
        StopTutorialRoutine();
        StopIntroStepDemo();
        StopSparkleFadeRoutine();
        HideTutorial();
    }

    private void Update()
    {
        if (characterMove == null) return;

        int slot = characterMove.CurrentPlaySlot;
        if (slot != _lastPlaySlot)
        {
            _lastPlaySlot = slot;
            _studentHasDragged = false;
            StopTutorialRoutine();
            HideTutorial();
        }
    }

    /// <summary>Called from <see cref="DraggableActionBlock"/> / <see cref="DraggableQueuedBlock"/> when the student starts a real drag.</summary>
    public static void NotifyStudentDragStarted()
    {
        if (Active == null) return;
        if (Active.IsStepDemoPlaying)
        {
            // Student is trying the real command — end the ghost demo and let them interact.
            Active._stepDemoCancelled = true;
            Active.StopIntroStepDemo();
            return;
        }
        Active.OnStudentStartedDragging();
    }

    /// <summary>Plays drag + run tap ghost animation for one action-block intro step (dashboard-driven).</summary>
    public void PlayIntroStepDemo(ActionBlockIntroStepData step)
    {
        StopIntroStepDemo();
        if (step == null || characterMove == null) return;
        bool showDrag = step.tutorial == null || step.tutorial.showDragAnimation;
        bool showRun = step.tutorial == null || step.tutorial.showRunTapAnimation;
        if (!showDrag && !showRun) return;
        // Per-step demos must not inherit "student dragged" from the opening sequence or a prior step.
        _stepDemoCancelled = false;
        _studentHasDragged = false;
        _introStepDemoRoutine = StartCoroutine(IntroStepDemoRoutine(step));
    }

    public void StopIntroStepDemo()
    {
        if (_introStepDemoRoutine != null)
        {
            StopCoroutine(_introStepDemoRoutine);
            _introStepDemoRoutine = null;
        }
        IsStepDemoPlaying = false;
        CleanupDragVisualsOnly();
        if (_stripGlowImage != null)
        {
            Destroy(_stripGlowImage.gameObject);
            _stripGlowImage = null;
        }
    }

    public void OnStudentStartedDragging()
    {
        _studentHasDragged = true;
        HideTutorial();
    }

    /// <summary>Optional hook when a real command is dropped (does not affect tutorial ghosts).</summary>
    public void OnCommandDropped()
    {
        HideTutorial();
    }

    /// <summary>True when the intro level should show the opening drag + run demo (before step-by-step intro).</summary>
    public bool ShouldPlayOpeningSequence()
    {
        if (!UsesDragBlocksOnCurrentLevel()) return false;
        if (_studentHasDragged) return false;
        if (rememberSeenPerLevel && HasSeenCurrentLevel()) return false;
        return true;
    }

    /// <summary>Play opening tutorial; invokes <paramref name="onComplete"/> when done (or skipped immediately).</summary>
    public void PlayOpeningSequence(System.Action onComplete = null)
    {
        _onOpeningSequenceComplete = onComplete;
        if (!ShouldPlayOpeningSequence())
        {
            InvokeOpeningComplete();
            return;
        }
        PlayTutorial();
    }

    public void PlayTutorial()
    {
        StopTutorialRoutine();
        _routine = StartCoroutine(TutorialRoutine());
    }

    private void InvokeOpeningComplete()
    {
        var cb = _onOpeningSequenceComplete;
        _onOpeningSequenceComplete = null;
        cb?.Invoke();
        OpeningSequenceCompleted?.Invoke();
    }

    public void HideTutorial()
    {
        bool hadDeferredIntro = _onOpeningSequenceComplete != null;
        StopTutorialRoutine();
        StopIntroStepDemo();
        _tutorialRunning = false;
        InvalidateDestroyedUiRefs();
        CleanupVisuals();
        if (hadDeferredIntro)
            InvokeOpeningComplete();
        if (instructionPanel != null)
        {
            instructionPanel.alpha = 0f;
            instructionPanel.gameObject.SetActive(false);
        }
        if (instructionText != null) instructionText.gameObject.SetActive(false);
    }

    private void RemoveLegacyShowMeHowButton()
    {
        var legacy = GameObject.Find("ShowMeHow");
        if (legacy != null)
            Destroy(legacy);
    }

    private bool ShouldRunForCurrentLevel(bool autoPlay)
    {
        if (characterMove == null) return false;
        if (_studentHasDragged) return false;
        if (_tutorialRunning) return false;
        if (!UsesDragBlocksOnCurrentLevel()) return false;

        if (autoPlay && rememberSeenPerLevel && HasSeenCurrentLevel())
            return false;

        return true;
    }

    private bool UsesDragBlocksOnCurrentLevel()
    {
        if (characterMove == null) return false;
        if (!characterMove.useDragAndDropForActions) return false;

        LevelData ld = characterMove.GetCurrentLevelData();
        if (ld == null) return false;

        // Introduction only — not regular drag path-building or edit-program levels.
        return CharacterMove.IsIntroLevel(ld);
    }

    private TutorialMode ResolveMode(LevelData ld)
    {
        if (ld == null) return TutorialMode.DragToProgramStrip;

        bool hasStarter = HasStarterBlocksInStrip();
        bool isEdit = ld.levelType != null &&
                      ld.levelType.Equals("DRAG_EDIT_PROGRAM", System.StringComparison.OrdinalIgnoreCase);

        if (isEdit && hasStarter)
        {
            // One short demo (drag to end of strip); copy hints at remove/reorder without extra clips.
            if (characterMove.addCloseButtonsToQueuedBlocks && !characterMove.allowReorderQueuedBlocks)
                return TutorialMode.RemoveCommand;
            if (characterMove.allowReorderQueuedBlocks)
                return TutorialMode.ReorderProgram;
            return TutorialMode.FixStarterProgram;
        }

        return TutorialMode.DragToProgramStrip;
    }

    private bool HasStarterBlocksInStrip()
    {
        var strip = ResolveYellowStrip();
        return strip != null && strip.childCount > 0;
    }

    private IEnumerator TutorialRoutine()
    {
        yield return new WaitForSeconds(startDelaySeconds);

        if (_studentHasDragged || !UsesDragBlocksOnCurrentLevel())
        {
            FinishTutorialRoutine(markSeen: false);
            yield break;
        }

        EnsureReferences();
        EnsureOverlayUI();

        if (instructionPanel == null)
        {
            if (debugLogs) Debug.LogWarning("[DragDropTutorial] Missing instruction panel — cannot show tutorial.");
            FinishTutorialRoutine(markSeen: false);
            yield break;
        }

        LevelData ld = characterMove.GetCurrentLevelData();
        _mode = ResolveMode(ld);
        _tutorialRunning = true;

        instructionPanel.gameObject.SetActive(true);
        instructionPanel.alpha = 1f;
        instructionPanel.interactable = false;
        instructionPanel.blocksRaycasts = false;

        SetInstructionForMode(_mode, ld);

        RectTransform forwardBtn = ResolveForwardButton();
        RectTransform strip = ResolveYellowStrip();
        if (forwardBtn == null || strip == null)
        {
            if (debugLogs) Debug.LogWarning("[DragDropTutorial] Missing forward button or yellow strip.");
            FinishTutorialRoutine(markSeen: false);
            yield break;
        }

        if (_mode == TutorialMode.FixStarterProgram || _mode == TutorialMode.ReorderProgram || _mode == TutorialMode.RemoveCommand)
            HighlightStarterProgram(strip);

        AddStripGlow(strip);
        Coroutine pulseRoutine = StartCoroutine(PulseForwardButton(forwardBtn));

        Vector2 dragStart = GetRectCenterInCanvas(forwardBtn);
        Vector2 dragEnd = GetDropPointInStrip(strip, appendToEnd: false);

        int dragRepeats = Mathf.Clamp(dragDemoRepeatCount, 2, 4);
        for (int r = 0; r < dragRepeats; r++)
        {
            if (_studentHasDragged) break;
            if (instructionText != null)
                instructionText.text = r == 0
                    ? "Drag a command into the yellow strip."
                    : "Try again — drag a block into the yellow strip.";
            yield return AnimateHandDrag(forwardBtn, dragStart, dragEnd, DraggableActionBlock.ActionKind.Forward);
            yield return PlaySnapPop(dragEnd);
            if (r < dragRepeats - 1)
                yield return new WaitForSeconds(pauseBetweenDragRepeatsSeconds);
        }

        if (pulseRoutine != null) StopCoroutine(pulseRoutine);
        CleanupDragVisualsOnly();

        if (!_studentHasDragged && IsAliveRect(ResolveRunButton()))
        {
            yield return new WaitForSeconds(pauseBeforeRunDemoSeconds);
            yield return AnimateRunButtonTapDemo("Tap Play to run your program!", pulseRunButton: true);
        }

        if (pulseRoutine != null)
        {
            try { StopCoroutine(pulseRoutine); } catch { /* already stopped */ }
        }

        float visible = 0f;
        while (visible < tutorialVisibleSeconds)
        {
            if (_studentHasDragged) break;
            visible += Time.deltaTime;
            yield return null;
        }

        yield return FadeOutInstruction();

        FinishTutorialRoutine(markSeen: true);
    }

    private void FinishTutorialRoutine(bool markSeen)
    {
        if (markSeen)
            MarkSeenForCurrentLevel();
        _tutorialRunning = false;
        CleanupVisuals();
        InvokeOpeningComplete();
    }

    private void SetInstructionForMode(TutorialMode mode, LevelData ld)
    {
        if (instructionText == null) return;
        instructionText.text = "Drag a command into the yellow strip.";
        _ = mode;
        _ = ld;

        instructionText.fontSize = Mathf.Max(instructionText.fontSize, 30f);
        instructionText.color = new Color(0.08f, 0.1f, 0.14f, 1f);
        instructionText.gameObject.SetActive(true);
    }

    private void ShowDemoInstruction(string message)
    {
        if (string.IsNullOrEmpty(message)) return;

        if (instructionText != null)
        {
            EnsureOverlayUI();
            if (instructionPanel != null)
            {
                instructionPanel.gameObject.SetActive(true);
                instructionPanel.alpha = 1f;
                instructionPanel.blocksRaycasts = false;
            }
            instructionText.text = message;
            instructionText.gameObject.SetActive(true);
        }
        else if (characterMove?.chatGPTResponseText != null)
        {
            characterMove.chatGPTResponseText.text = message;
        }
    }

    private IEnumerator IntroStepDemoRoutine(ActionBlockIntroStepData step)
    {
        IsStepDemoPlaying = true;
        EnsureReferences();
        EnsureOverlayUI();

        DraggableActionBlock.ActionKind kind = ActionBlockIntroManager.ParseAction(step.action);
        RectTransform paletteBtn = ResolveButtonForKind(kind);
        RectTransform strip = ResolveYellowStrip();
        if (paletteBtn == null || strip == null)
        {
            IsStepDemoPlaying = false;
            _introStepDemoRoutine = null;
            yield break;
        }

        bool showDrag = step.tutorial == null || step.tutorial.showDragAnimation;
        bool showRun = step.tutorial == null || step.tutorial.showRunTapAnimation;
        int dragRepeats = step.tutorial != null ? Mathf.Clamp(step.tutorial.dragRepeatCount, 1, 4) : 2;
        int runRepeats = step.tutorial != null ? Mathf.Clamp(step.tutorial.runTapRepeatCount, 1, 4) : 2;

        AddStripGlow(strip);
        Coroutine pulseRoutine = StartCoroutine(PulseForwardButton(paletteBtn));

        Vector2 dragStart = GetRectCenterInCanvas(paletteBtn);
        Vector2 dragEnd = GetDropPointInStrip(strip, appendToEnd: false);

        if (showDrag)
        {
            // ActionBlockIntroManager already set corner hint + bottom bar for this step.
            if (characterMove == null || !characterMove.IsActionBlockIntroActive)
            {
                ShowDemoInstruction(string.IsNullOrEmpty(step.dragInstruction)
                    ? "Drag this block into the yellow strip."
                    : step.dragInstruction);
            }
            else
            {
                HideTutorial();
            }

            for (int r = 0; r < dragRepeats; r++)
            {
                if (_stepDemoCancelled) break;
                yield return AnimateHandDrag(paletteBtn, dragStart, dragEnd, kind);
                yield return PlaySnapPop(dragEnd);
                if (r < dragRepeats - 1)
                    yield return new WaitForSeconds(pauseBetweenDragRepeatsSeconds);
            }
        }

        if (pulseRoutine != null) StopCoroutine(pulseRoutine);
        CleanupDragVisualsOnly();

        if (showRun && !_stepDemoCancelled)
        {
            yield return new WaitForSeconds(pauseBeforeRunDemoSeconds);
            InvalidateDestroyedUiRefs();
            runButton = null;
            EnsureReferences();
            BringDragVisualsToFront();

            RectTransform runRt = ResolveRunButton();
            if (!IsAliveRect(runRt))
            {
                if (debugLogs) Debug.LogWarning("[DragDropTutorial] Run button not found — skipping Play tap demo.");
            }
            else
            {
                if (characterMove?.runButton != null)
                    characterMove.runButton.gameObject.SetActive(true);

                int savedRunRepeats = runTapDemoRepeatCount;
                runTapDemoRepeatCount = runRepeats;
                string runMsg = string.IsNullOrEmpty(step.runInstruction) ? "Tap Play to run!" : step.runInstruction;
                if (characterMove != null && characterMove.IsActionBlockIntroActive &&
                    characterMove.actionBlockIntro != null)
                {
                    characterMove.actionBlockIntro.NotifyRunTapDemoStarting(runMsg);
                }

                yield return AnimateRunButtonTapDemo(runMsg, pulseRunButton: true);
                runTapDemoRepeatCount = savedRunRepeats;
            }
        }

        if (_stripGlowImage != null)
        {
            Destroy(_stripGlowImage.gameObject);
            _stripGlowImage = null;
        }

        IsStepDemoPlaying = false;
        _introStepDemoRoutine = null;
    }

    private RectTransform ResolveButtonForKind(DraggableActionBlock.ActionKind kind)
    {
        if (characterMove == null) return null;
        switch (kind)
        {
            case DraggableActionBlock.ActionKind.Backward:
                return SafeButtonRect(characterMove.moveDownButton);
            case DraggableActionBlock.ActionKind.TurnLeft:
                return SafeButtonRect(characterMove.rotateLeftButton);
            case DraggableActionBlock.ActionKind.TurnRight:
                return SafeButtonRect(characterMove.rotateRightButton);
            default:
                return ResolveForwardButton();
        }
    }

    private IEnumerator AnimateHandDrag(RectTransform sourceBtn, Vector2 start, Vector2 end,
        DraggableActionBlock.ActionKind kind = DraggableActionBlock.ActionKind.Forward)
    {
        EnsureHand();
        EnsureGhost(sourceBtn, kind);

        if (_runtimeHand != null) _runtimeHand.SetActive(true);
        if (_runtimeGhost != null) _runtimeGhost.SetActive(true);

        float t = 0f;
        while (t < dragAnimationSeconds)
        {
            if (ShouldAbortDemo()) yield break;
            t += Time.deltaTime;
            float k = EaseInOutCubic(Mathf.Clamp01(t / Mathf.Max(0.001f, dragAnimationSeconds)));
            Vector2 p = Vector2.Lerp(start, end, k);
            PlaceOverlayAt(_runtimeHand, p);
            PlaceOverlayAt(_runtimeGhost, p + new Vector2(0f, 8f));
            yield return null;
        }

        if (!ShouldAbortDemo())
        {
            PlaceOverlayAt(_runtimeHand, end);
            PlaceOverlayAt(_runtimeGhost, end + new Vector2(0f, 8f));
        }
    }

    private IEnumerator PlaySnapPop(Vector2 canvasPoint)
    {
        if (_runtimeGhost != null)
        {
            var rt = _runtimeGhost.GetComponent<RectTransform>();
            float t = 0f;
            Vector3 baseScale = Vector3.one;
            while (t < snapPopSeconds)
            {
                if (ShouldAbortDemo()) yield break;
                t += Time.deltaTime;
                float k = Mathf.Clamp01(t / snapPopSeconds);
                float bump = 1f + 0.18f * Mathf.Sin(k * Mathf.PI);
                rt.localScale = baseScale * bump;
                yield return null;
            }
            rt.localScale = baseScale;
        }

        SpawnSparkle(canvasPoint);
        GameInteractionSounds.PlayQueueSnapPop();

        if (_runtimeHand != null) _runtimeHand.SetActive(false);
        if (_runtimeGhost != null) _runtimeGhost.SetActive(false);
    }

    private IEnumerator AnimateRunButtonTapDemo(string runMessage = null, bool pulseRunButton = false)
    {
        RectTransform runRt = ResolveRunButton();
        if (!IsAliveRect(runRt)) yield break;

        BringDragVisualsToFront();

        if (characterMove == null || !characterMove.IsActionBlockIntroActive)
            ShowDemoInstruction(runMessage);
        else
            HideTutorial();

        if (characterMove?.runButton != null)
            characterMove.runButton.gameObject.SetActive(true);

        Vector2 tapPoint = GetRectCenterInOverlaySpace(runRt);
        int taps = Mathf.Clamp(runTapDemoRepeatCount, 1, 4);
        Vector3 runBaseScale = runRt.localScale;
        Coroutine runPulse = pulseRunButton ? StartCoroutine(PulseRunButtonDuringTap(runRt)) : null;

        for (int i = 0; i < taps; i++)
        {
            if (ShouldAbortDemo()) break;
            if (!IsAliveRect(runRt)) break;

            EnsureHand();
            if (_runtimeHand != null)
            {
                _runtimeHand.SetActive(true);
                var handRt = _runtimeHand.GetComponent<RectTransform>();
                if (handRt != null)
                    handRt.localScale = Vector3.one * Mathf.Max(0.5f, runTapHandScale);
                _runtimeHand.transform.SetAsLastSibling();
            }

            float t = 0f;
            while (t < runTapAnimationSeconds)
            {
                if (ShouldAbortDemo() || !IsAliveRect(runRt)) break;
                t += Time.deltaTime;
                float k = Mathf.Clamp01(t / Mathf.Max(0.001f, runTapAnimationSeconds));
                float press = 1f - 0.12f * Mathf.Sin(k * Mathf.PI);
                runRt.localScale = runBaseScale * press;
                Vector2 handPos = tapPoint + new Vector2(24f, 28f * (1f - press));
                PlaceOverlayAt(_runtimeHand, handPos);
                yield return null;
            }

            if (IsAliveRect(runRt))
                runRt.localScale = runBaseScale;
            if (_runtimeHand != null) _runtimeHand.SetActive(false);

            GameInteractionSounds.PlayQueueSnapPop(0.7f);

            if (i < taps - 1)
                yield return new WaitForSeconds(pauseBetweenRunTapsSeconds);
        }

        if (runPulse != null) StopCoroutine(runPulse);
        SafeResetScale(runRt);
    }

    private IEnumerator PulseRunButtonDuringTap(RectTransform runRt)
    {
        if (!IsAliveRect(runRt)) yield break;
        Vector3 baseScale = runRt.localScale;
        while (IsStepDemoPlaying || _tutorialRunning)
        {
            if (!IsAliveRect(runRt)) yield break;
            float wave = 1f + 0.08f * Mathf.Sin(Time.time * pulseSpeed * 1.2f);
            runRt.localScale = baseScale * wave;
            yield return null;
        }
        SafeResetScale(runRt);
    }

    private IEnumerator PulseForwardButton(RectTransform forwardBtn)
    {
        if (!IsAliveRect(forwardBtn)) yield break;
        Vector3 baseScale = forwardBtn.localScale;
        while (_tutorialRunning && !_studentHasDragged && IsAliveRect(forwardBtn))
        {
            float wave = 1f + buttonPulseScale * Mathf.Sin(Time.time * pulseSpeed);
            forwardBtn.localScale = baseScale * wave;
            if (IsAlive(_stripGlowImage))
            {
                float a = 0.28f + 0.18f * (0.5f + 0.5f * Mathf.Sin(Time.time * pulseSpeed * 0.85f));
                var c = stripGlowColor;
                c.a = a;
                _stripGlowImage.color = c;
            }
            yield return null;
        }
        SafeResetScale(forwardBtn);
    }

    private IEnumerator FadeOutInstruction()
    {
        if (instructionPanel == null) yield break;
        float a0 = instructionPanel.alpha;
        float f = 0f;
        while (f < fadeOutSeconds)
        {
            if (_studentHasDragged) yield break;
            f += Time.deltaTime;
            float k = Mathf.Clamp01(f / Mathf.Max(0.001f, fadeOutSeconds));
            instructionPanel.alpha = Mathf.Lerp(a0, 0f, EaseOutCubic(k));
            yield return null;
        }
        instructionPanel.alpha = 0f;
        instructionPanel.gameObject.SetActive(false);
        if (instructionText != null) instructionText.gameObject.SetActive(false);
    }

    private void HighlightStarterProgram(RectTransform strip)
    {
        ClearStarterHighlights();
        if (strip == null) return;
        for (int i = 0; i < strip.childCount; i++)
        {
            var child = strip.GetChild(i) as RectTransform;
            if (child == null) continue;
            var img = child.GetComponent<Image>();
            if (img == null) continue;
            var overlayGo = new GameObject("_TutorialStarterGlow", typeof(RectTransform), typeof(Image));
            var overlayRt = overlayGo.GetComponent<RectTransform>();
            overlayRt.SetParent(child, false);
            overlayRt.anchorMin = Vector2.zero;
            overlayRt.anchorMax = Vector2.one;
            overlayRt.offsetMin = Vector2.zero;
            overlayRt.offsetMax = Vector2.zero;
            var overlayImg = overlayGo.GetComponent<Image>();
            overlayImg.raycastTarget = false;
            overlayImg.color = pulseHighlightColor;
            overlayImg.sprite = img.sprite;
            overlayImg.preserveAspect = true;
            _starterHighlights.Add(overlayImg);
        }
    }

    private void AddStripGlow(RectTransform strip)
    {
        if (strip == null) return;
        if (_stripGlowImage != null) return;
        var go = new GameObject("_TutorialStripGlow", typeof(RectTransform), typeof(Image));
        var rt = go.GetComponent<RectTransform>();
        rt.SetParent(strip, false);
        rt.SetAsFirstSibling();
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = new Vector2(-8f, -6f);
        rt.offsetMax = new Vector2(8f, 6f);
        _stripGlowImage = go.GetComponent<Image>();
        _stripGlowImage.raycastTarget = false;
        _stripGlowImage.color = stripGlowColor;
        _stripGlowImage.sprite = CreateSoftCircleSprite();
    }

    private void EnsureHand()
    {
        if (handIcon != null)
        {
            _runtimeHand = handIcon;
            ParentToTutorialCanvas(_runtimeHand);
            _runtimeHand.SetActive(true);
            var handImg = _runtimeHand.GetComponent<Image>();
            if (handImg != null)
            {
                handImg.raycastTarget = false;
                handImg.enabled = true;
            }
            return;
        }
        if (_runtimeHand != null)
        {
            ParentToTutorialCanvas(_runtimeHand);
            _runtimeHand.SetActive(true);
            return;
        }

        _runtimeHand = new GameObject("_DragTutorialHand", typeof(RectTransform), typeof(Image));
        var img = _runtimeHand.GetComponent<Image>();
        img.raycastTarget = false;
        img.preserveAspect = true;
        if (handSprite == null)
            handSprite = Resources.Load<Sprite>("CornerHint/TapHand");
        if (handSprite == null)
            handSprite = CreateSoftCircleSprite();
        img.sprite = handSprite;
        var rt = _runtimeHand.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(72f, 72f);
        ParentToTutorialCanvas(_runtimeHand);
    }

    private void EnsureGhost(RectTransform sourceBtn, DraggableActionBlock.ActionKind kind)
    {
        if (_runtimeGhost != null) return;

        if (ghostCommandPrefab != null)
        {
            _runtimeGhost = Instantiate(ghostCommandPrefab);
            ParentToTutorialCanvas(_runtimeGhost);
            DisableInteractionOnGhost(_runtimeGhost);
            return;
        }

        _runtimeGhost = new GameObject("_DragTutorialGhost", typeof(RectTransform), typeof(CanvasGroup), typeof(Image));
        var img = _runtimeGhost.GetComponent<Image>();
        img.raycastTarget = false;
        img.preserveAspect = true;
        var cg = _runtimeGhost.GetComponent<CanvasGroup>();
        cg.blocksRaycasts = false;
        cg.interactable = false;
        cg.alpha = 0.88f;

        Sprite s = ResolveSpriteForKind(kind);
        var srcImg = sourceBtn != null ? sourceBtn.GetComponent<Image>() : null;
        if (s == null && srcImg != null) s = srcImg.sprite;
        img.sprite = s;
        img.color = Color.white;

        var rt = _runtimeGhost.GetComponent<RectTransform>();
        if (sourceBtn != null)
            rt.sizeDelta = sourceBtn.rect.size;
        else
            rt.sizeDelta = new Vector2(64f, 64f);

        ParentToTutorialCanvas(_runtimeGhost);
    }

    private Sprite ResolveSpriteForKind(DraggableActionBlock.ActionKind kind)
    {
        if (characterMove == null) return null;
        switch (kind)
        {
            case DraggableActionBlock.ActionKind.Backward: return characterMove.backwardSprite;
            case DraggableActionBlock.ActionKind.TurnLeft: return characterMove.rotateLeftSprite;
            case DraggableActionBlock.ActionKind.TurnRight: return characterMove.rotateRightSprite;
            default: return characterMove.forwardSprite;
        }
    }

    private static void DisableInteractionOnGhost(GameObject go)
    {
        var cg = go.GetComponent<CanvasGroup>();
        if (cg == null) cg = go.AddComponent<CanvasGroup>();
        cg.blocksRaycasts = false;
        cg.interactable = false;
        foreach (var g in go.GetComponentsInChildren<Graphic>(true))
            g.raycastTarget = false;
    }

    private void SpawnSparkle(Vector2 canvasPoint)
    {
        DestroyRuntimeSparkle();
        _runtimeSparkle = new GameObject("_DragTutorialSparkle", typeof(RectTransform), typeof(Image));
        var img = _runtimeSparkle.GetComponent<Image>();
        img.raycastTarget = false;
        img.sprite = sparkleSprite != null ? sparkleSprite : CreateSoftCircleSprite();
        img.color = new Color(1f, 0.95f, 0.55f, 0.95f);
        var rt = _runtimeSparkle.GetComponent<RectTransform>();
        rt.sizeDelta = new Vector2(48f, 48f);
        ParentToTutorialCanvas(_runtimeSparkle);
        PlaceOverlayAt(_runtimeSparkle, canvasPoint);
        _sparkleFadeRoutine = StartCoroutine(FadeDestroySparkle(_runtimeSparkle));
    }

    private void StopSparkleFadeRoutine()
    {
        if (_sparkleFadeRoutine != null)
        {
            StopCoroutine(_sparkleFadeRoutine);
            _sparkleFadeRoutine = null;
        }
    }

    private void DestroyRuntimeSparkle()
    {
        StopSparkleFadeRoutine();
        if (_runtimeSparkle != null)
        {
            Destroy(_runtimeSparkle);
            _runtimeSparkle = null;
        }
    }

    private IEnumerator FadeDestroySparkle(GameObject sparkleGo)
    {
        if (sparkleGo == null) yield break;

        var img = sparkleGo.GetComponent<Image>();
        var rt = sparkleGo.GetComponent<RectTransform>();
        if (img == null || rt == null) yield break;

        float t = 0f;
        const float dur = 0.45f;
        Color c0 = img.color;
        Vector3 s0 = rt.localScale;

        while (t < dur)
        {
            if (sparkleGo == null || img == null || rt == null)
                yield break;

            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / dur);
            img.color = new Color(c0.r, c0.g, c0.b, Mathf.Lerp(c0.a, 0f, k));
            rt.localScale = s0 * (1f + 0.35f * k);
            yield return null;
        }

        if (sparkleGo != null)
            Destroy(sparkleGo);

        if (_runtimeSparkle == sparkleGo)
            _runtimeSparkle = null;
        _sparkleFadeRoutine = null;
    }

    private void EnsureReferences()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        InvalidateDestroyedUiRefs();

        if (!IsAliveRect(forwardCommandButton))
            forwardCommandButton = SafeButtonRect(characterMove?.moveForwardButton);
        if (!IsAliveRect(turnLeftCommandButton))
            turnLeftCommandButton = SafeButtonRect(characterMove?.rotateLeftButton);
        if (!IsAliveRect(turnRightCommandButton))
            turnRightCommandButton = SafeButtonRect(characterMove?.rotateRightButton);
        if (!IsAliveRect(runButton))
            runButton = SafeButtonRect(characterMove?.runButton);
        if (!IsAliveRect(yellowStripDropZone))
            yellowStripDropZone = ResolveYellowStrip();
        if (!IsAliveRect(commandSourceArea) && IsAliveRect(forwardCommandButton))
            commandSourceArea = forwardCommandButton.parent as RectTransform;
    }

    private RectTransform ResolveYellowStrip()
    {
        if (yellowStripDropZone != null) return yellowStripDropZone;
        if (characterMove == null) return null;
        if (characterMove.dropZonePanel != null) return characterMove.dropZonePanel;
        if (characterMove.actionQueueTransform != null)
            return characterMove.actionQueueTransform as RectTransform;
        return null;
    }

    private RectTransform ResolveForwardButton()
    {
        if (IsAliveRect(forwardCommandButton))
            return forwardCommandButton;
        forwardCommandButton = SafeButtonRect(characterMove?.moveForwardButton);
        return forwardCommandButton;
    }

    private RectTransform ResolveRunButton()
    {
        if (IsAliveRect(runButton))
            return runButton;
        runButton = SafeButtonRect(characterMove?.runButton);
        return runButton;
    }

    private void EnsureOverlayUI()
    {
        if (instructionPanel != null) return;
        AutoBuildInstructionOverlay();
    }

    private void AutoBuildInstructionOverlay()
    {
        Canvas canvas = null;
        if (characterMove != null)
            canvas = characterMove.GetComponentInChildren<Canvas>(true);
        if (canvas == null)
            canvas = FindObjectOfType<Canvas>();
        if (canvas == null)
        {
            var cgo = new GameObject("_DragTutorialCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvas = cgo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = cgo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.matchWidthOrHeight = 0.5f;
        }
        _rootCanvas = canvas.rootCanvas != null ? canvas.rootCanvas : canvas;

        var rootGo = new GameObject("_DragDropTutorialUI", typeof(RectTransform), typeof(CanvasGroup));
        var rt = rootGo.GetComponent<RectTransform>();
        rt.SetParent(_rootCanvas.transform, false);
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        instructionPanel = rootGo.GetComponent<CanvasGroup>();
        instructionPanel.alpha = 0f;
        instructionPanel.blocksRaycasts = false;
        instructionPanel.interactable = false;

        var instructionCanvas = rootGo.AddComponent<Canvas>();
        instructionCanvas.overrideSorting = true;
        instructionCanvas.sortingOrder = ComputeTopCanvasSortingOrder(_rootCanvas) + 50;

        var bubble = new GameObject("InstructionBubble", typeof(RectTransform), typeof(Image));
        var bubbleRt = bubble.GetComponent<RectTransform>();
        bubbleRt.SetParent(rootGo.transform, false);
        bubbleRt.anchorMin = new Vector2(0.5f, 1f);
        bubbleRt.anchorMax = new Vector2(0.5f, 1f);
        bubbleRt.pivot = new Vector2(0.5f, 1f);
        bubbleRt.anchoredPosition = new Vector2(0f, -24f);
        bubbleRt.sizeDelta = new Vector2(620f, 120f);
        var bubbleImg = bubble.GetComponent<Image>();
        bubbleImg.color = new Color(1f, 1f, 1f, 0.94f);
        bubbleImg.raycastTarget = false;

        var textGo = new GameObject("InstructionText", typeof(RectTransform), typeof(TextMeshProUGUI));
        var textRt = textGo.GetComponent<RectTransform>();
        textRt.SetParent(bubble.transform, false);
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = new Vector2(20f, 14f);
        textRt.offsetMax = new Vector2(-20f, -14f);
        instructionText = textGo.GetComponent<TextMeshProUGUI>();
        instructionText.fontSize = 32f;
        instructionText.alignment = TextAlignmentOptions.Center;
        instructionText.enableWordWrapping = true;
        instructionText.raycastTarget = false;

        if (debugLogs) Debug.Log("[DragDropTutorial] Auto-built instruction overlay.");
    }

    private void EnsureDragVisualsLayer()
    {
        EnsureOverlayUI();
        if (_dragVisualsLayer != null) return;
        if (_rootCanvas == null) return;

        var layerGo = new GameObject("_DragTutorialDragLayer", typeof(RectTransform), typeof(Canvas));
        _dragVisualsLayer = layerGo.GetComponent<RectTransform>();
        _dragVisualsLayer.SetParent(_rootCanvas.transform, false);
        _dragVisualsLayer.anchorMin = Vector2.zero;
        _dragVisualsLayer.anchorMax = Vector2.one;
        _dragVisualsLayer.offsetMin = Vector2.zero;
        _dragVisualsLayer.offsetMax = Vector2.zero;
        _dragVisualsLayer.SetAsLastSibling();

        var overlayCanvas = layerGo.GetComponent<Canvas>();
        overlayCanvas.overrideSorting = true;
        overlayCanvas.sortingOrder = ComputeTopCanvasSortingOrder(_rootCanvas);
    }

    private int ComputeTopCanvasSortingOrder(Canvas fallback)
    {
        int maxSort = fallback != null ? fallback.sortingOrder : 0;
#if UNITY_2023_1_OR_NEWER
        var canvases = Object.FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
#else
        var canvases = Object.FindObjectsOfType<Canvas>();
#endif
        for (int i = 0; i < canvases.Length; i++)
        {
            var c = canvases[i];
            if (c == null || !c.isActiveAndEnabled) continue;
            if (!c.gameObject.scene.IsValid()) continue;
            if (c.sortingOrder > maxSort)
                maxSort = c.sortingOrder;
        }
        return maxSort + Mathf.Clamp(overlaySortingOrderBump, 1, 4096);
    }

    private void ParentToTutorialCanvas(GameObject go)
    {
        EnsureDragVisualsLayer();
        if (_dragVisualsLayer == null)
        {
            EnsureOverlayUI();
            if (_rootCanvas == null) return;
            go.transform.SetParent(_rootCanvas.transform, false);
        }
        else
        {
            go.transform.SetParent(_dragVisualsLayer, false);
        }
        go.transform.SetAsLastSibling();
    }

    private void BringDragVisualsToFront()
    {
        EnsureDragVisualsLayer();
        if (_dragVisualsLayer == null) return;
        _dragVisualsLayer.SetAsLastSibling();
        var layerCanvas = _dragVisualsLayer.GetComponent<Canvas>();
        if (layerCanvas != null && _rootCanvas != null)
            layerCanvas.sortingOrder = ComputeTopCanvasSortingOrder(_rootCanvas);
    }

    private RectTransform GetOverlayCoordinateSpace()
    {
        EnsureDragVisualsLayer();
        if (_dragVisualsLayer != null) return _dragVisualsLayer;
        EnsureOverlayUI();
        return _rootCanvas != null ? (RectTransform)_rootCanvas.transform : null;
    }

    private Vector2 GetRectCenterInOverlaySpace(RectTransform rect)
    {
        if (rect == null) return Vector2.zero;
        RectTransform space = GetOverlayCoordinateSpace();
        if (space == null) return Vector2.zero;
        Canvas canvas = space.GetComponentInParent<Canvas>();
        if (canvas == null) return Vector2.zero;
        Vector3 world = rect.TransformPoint(rect.rect.center);
        Camera cam = canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera;
        Vector2 screen = RectTransformUtility.WorldToScreenPoint(cam, world);
        RectTransformUtility.ScreenPointToLocalPointInRectangle(space, screen, cam, out Vector2 local);
        return local;
    }

    private Vector2 GetRectCenterInCanvas(RectTransform rect) => GetRectCenterInOverlaySpace(rect);

    private Vector2 GetDropPointInStrip(RectTransform strip, bool appendToEnd)
    {
        if (strip == null) return Vector2.zero;

        if (appendToEnd && strip.childCount > 0)
        {
            var last = strip.GetChild(strip.childCount - 1) as RectTransform;
            if (last != null)
            {
                Vector2 c = GetRectCenterInCanvas(last);
                return c + new Vector2(last.rect.width * 0.55f, 0f);
            }
        }

        return GetRectCenterInCanvas(strip);
    }

    private void PlaceOverlayAt(GameObject go, Vector2 canvasLocalPoint)
    {
        if (go == null) return;
        var rt = go.GetComponent<RectTransform>();
        if (rt == null) return;
        rt.anchorMin = new Vector2(0.5f, 0.5f);
        rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = canvasLocalPoint;
    }

    private void StopTutorialRoutine()
    {
        if (_routine != null)
        {
            StopCoroutine(_routine);
            _routine = null;
        }
    }

    private void CleanupDragVisualsOnly()
    {
        if (handIcon == null && _runtimeHand != null && _runtimeHand != handIcon)
            Destroy(_runtimeHand);
        else if (handIcon != null)
            handIcon.SetActive(false);
        _runtimeHand = null;
        if (_runtimeGhost != null)
        {
            Destroy(_runtimeGhost);
            _runtimeGhost = null;
        }
        DestroyRuntimeSparkle();
        SafeResetScale(ResolveForwardButton());
    }

    private void CleanupVisuals()
    {
        InvalidateDestroyedUiRefs();
        CleanupDragVisualsOnly();

        if (IsAlive(_stripGlowImage))
        {
            Destroy(_stripGlowImage.gameObject);
            _stripGlowImage = null;
        }
        ClearStarterHighlights();

        SafeResetScale(ResolveRunButton());
    }

    private void ClearStarterHighlights()
    {
        for (int i = 0; i < _starterHighlights.Count; i++)
        {
            if (_starterHighlights[i] != null)
                Destroy(_starterHighlights[i].gameObject);
        }
        _starterHighlights.Clear();
    }

    private bool HasSeenCurrentLevel()
    {
        LevelData ld = characterMove?.GetCurrentLevelData();
        if (ld == null || string.IsNullOrEmpty(ld.levelKey)) return false;
        return PlayerPrefs.GetInt(SeenKey(ld.levelKey), 0) == 1;
    }

    private void MarkSeenForCurrentLevel()
    {
        if (!rememberSeenPerLevel) return;
        LevelData ld = characterMove?.GetCurrentLevelData();
        if (ld == null || string.IsNullOrEmpty(ld.levelKey)) return;
        PlayerPrefs.SetInt(SeenKey(ld.levelKey), 1);
        PlayerPrefs.Save();
    }

    private static string SeenKey(string levelKey) => "DragDropTutorial_seen_" + levelKey;

    private static float EaseInOutCubic(float t) =>
        t < 0.5f ? 4f * t * t * t : 1f - Mathf.Pow(-2f * t + 2f, 3f) / 2f;

    private static float EaseOutCubic(float t) => 1f - Mathf.Pow(1f - t, 3f);

    /// <summary>Unity-safe null check (handles destroyed UI objects).</summary>
    private bool ShouldAbortDemo() =>
        IsStepDemoPlaying ? _stepDemoCancelled : _studentHasDragged;

    private static bool IsAlive(Object obj) => obj != null;

    private static bool IsAliveRect(RectTransform rt) => IsAlive(rt);

    private static void SafeResetScale(RectTransform rt)
    {
        if (!IsAliveRect(rt)) return;
        rt.localScale = Vector3.one;
    }

    private RectTransform SafeButtonRect(Button button)
    {
        if (!IsAlive(button)) return null;
        var rt = button.GetComponent<RectTransform>();
        return IsAliveRect(rt) ? rt : null;
    }

    private void InvalidateDestroyedUiRefs()
    {
        if (!IsAliveRect(forwardCommandButton)) forwardCommandButton = null;
        if (!IsAliveRect(turnLeftCommandButton)) turnLeftCommandButton = null;
        if (!IsAliveRect(turnRightCommandButton)) turnRightCommandButton = null;
        if (!IsAliveRect(yellowStripDropZone)) yellowStripDropZone = null;
        if (!IsAliveRect(runButton)) runButton = null;
        if (!IsAliveRect(commandSourceArea)) commandSourceArea = null;
    }

    private static Sprite CreateSoftCircleSprite()
    {
        const int size = 64;
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        var pixels = new Color32[size * size];
        Vector2 center = new Vector2(size * 0.5f, size * 0.5f);
        float radius = size * 0.42f;
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), center);
                float a = Mathf.Clamp01(1f - (d - radius * 0.65f) / (radius * 0.35f));
                pixels[y * size + x] = new Color32(255, 255, 255, (byte)(a * 220));
            }
        }
        tex.SetPixels32(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }
}
