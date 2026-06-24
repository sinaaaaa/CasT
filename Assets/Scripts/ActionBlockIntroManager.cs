using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>Title / body text layout for the intro welcome popup (set in Inspector).</summary>
[Serializable]
public class WelcomePopupTextLayout
{
    [Tooltip("Anchors relative to the popup panel (0–1).")]
    public Vector2 anchorMin = new Vector2(0.05f, 0.72f);
    public Vector2 anchorMax = new Vector2(0.95f, 0.95f);
    public Vector2 offsetMin = Vector2.zero;
    public Vector2 offsetMax = Vector2.zero;

    public float fontSize = 28f;
    public Color color = new Color(0.1f, 0.15f, 0.25f, 1f);
    public FontStyles fontStyle = FontStyles.Bold;
    public TextAlignmentOptions alignment = TextAlignmentOptions.Center;
    [Tooltip("Optional TMP font asset. Leave empty for default.")]
    public TMP_FontAsset font;
    public bool enableWordWrapping = true;
    [Range(-50f, 50f)] public float lineSpacing = 0f;
}

/// <summary>Let's go button placement on the welcome popup panel.</summary>
[Serializable]
public class WelcomePopupButtonLayout
{
    public Vector2 anchorMin = new Vector2(0.5f, 0.14f);
    public Vector2 anchorMax = new Vector2(0.5f, 0.14f);
    public Vector2 pivot = new Vector2(0.5f, 0.5f);
    public Vector2 anchoredPosition = Vector2.zero;
    public Vector2 sizeDelta = new Vector2(220f, 52f);

    public float labelFontSize = 22f;
    public Color labelColor = Color.white;
    public FontStyles labelFontStyle = FontStyles.Bold;
    public TextAlignmentOptions labelAlignment = TextAlignmentOptions.Center;
    public TMP_FontAsset labelFont;
}

/// <summary>
/// Runs <see cref="LevelData.actionBlockIntro"/> — one palette block at a time, with a distinct
/// learning UI (overlay + top-right hints + skip). Configured per level in InitializeLevelData.
/// </summary>
public class ActionBlockIntroManager : MonoBehaviour
{
    public const string PrefsKeyPrefix = "ActionBlockIntro_";

    [Header("References")]
    public CharacterMove characterMove;

    [Header("Intro look (different from normal levels)")]
    public Color highlightColor = new Color(0.25f, 0.95f, 0.35f, 1f);
    [Tooltip("Soft tint over the playfield during introduction.")]
    public Color introOverlayColor = new Color(0.45f, 0.72f, 0.95f, 0.22f);
    [Tooltip("Inspector override — always run intro when level has actionBlockIntro.enabled.")]
    public bool forceShowIntro;

    [Header("Welcome popup — panel background")]
    [Tooltip("Center card image behind the welcome title and text.")]
    public Sprite welcomePopupPanelSprite;
    public Color welcomePopupPanelColor = Color.white;
    public Vector2 welcomePopupPanelSize = new Vector2(440f, 300f);
    [Tooltip("When on, panel size matches the sprite pixel size.")]
    public bool welcomePopupUsePanelSpriteSize = true;
    public Image.Type welcomePopupPanelImageType = Image.Type.Simple;

    [Header("Welcome popup — backdrop (dim layer)")]
    public Color welcomePopupBackdropColor = new Color(0.06f, 0.1f, 0.18f, 0.78f);
    [Tooltip("Optional full-screen image behind the panel (e.g. blurred overlay).")]
    public Sprite welcomePopupBackdropSprite;

    [Header("Welcome popup — title text")]
    public WelcomePopupTextLayout welcomePopupTitle = new WelcomePopupTextLayout
    {
        anchorMin = new Vector2(0.05f, 0.72f),
        anchorMax = new Vector2(0.95f, 0.95f),
        fontSize = 32f,
        fontStyle = FontStyles.Bold,
    };

    [Header("Welcome popup — body text")]
    public WelcomePopupTextLayout welcomePopupBody = new WelcomePopupTextLayout
    {
        anchorMin = new Vector2(0.08f, 0.32f),
        anchorMax = new Vector2(0.92f, 0.7f),
        fontSize = 22f,
        fontStyle = FontStyles.Normal,
        color = new Color(0.2f, 0.28f, 0.38f, 1f),
    };

    [Header("Welcome popup — Let's go button")]
    [Tooltip("Assign a sprite here to style the popup button (shown in the Inspector on CharacterMove / ActionBlockIntroManager).")]
    public Sprite welcomeLetsGoButtonSprite;
    public bool welcomeLetsGoUseSpriteSize = true;
    public Vector2 welcomeLetsGoButtonSize = new Vector2(240f, 64f);
    public Color welcomeLetsGoButtonColor = Color.white;
    [Tooltip("When a sprite is set, hide the text label (sprite-only button).")]
    public bool welcomeLetsGoHideTextWhenSprite = true;
    public string welcomeLetsGoButtonLabel = "Let's go!";
    public WelcomePopupButtonLayout welcomePopupButtonLayout = new WelcomePopupButtonLayout();

    [Header("Welcome popup — timing")]
    [Tooltip("Seconds after step 1 UI is visible before the drag ghost demo starts.")]
    public float delayBeforeStepDemoSeconds = 0.35f;

    public bool IsActive { get; private set; }

    private enum Phase { Welcome, TeachDrag, TeachRun, Running }

    private ActionBlockIntroConfig _config;
    private int _stepIndex;
    private Phase _phase = Phase.TeachDrag;
    private Coroutine _highlightCoroutine;
    private Coroutine _stepApplyRoutine;
    private Button _activeButton;
    private GameObject _introOverlay;
    private GameObject _welcomePopupRoot;
    private readonly Dictionary<Button, bool> _buttonWasActive = new Dictionary<Button, bool>();
    private readonly Dictionary<Button, Vector3> _buttonScales = new Dictionary<Button, Vector3>();
    private bool _palettePreparedForIntro;

    public void Initialize(CharacterMove move)
    {
        characterMove = move;
    }

    public static string GetStudentIdForIntroPrefs()
    {
        return PlayerPrefs.GetString("UserId", "").Trim();
    }

    /// <summary>PlayerPrefs key scoped to the logged-in student (and intro id).</summary>
    public static string GetCompletionPrefsKey(ActionBlockIntroConfig cfg, string studentId = null)
    {
        if (cfg == null) return PrefsKeyPrefix + "default";
        string introPart = string.IsNullOrEmpty(cfg.introId) ? "default" : cfg.introId;
        string sid = studentId ?? GetStudentIdForIntroPrefs();
        if (string.IsNullOrEmpty(sid) || sid == "UnknownUser")
            return PrefsKeyPrefix + introPart;
        return sid + "_" + PrefsKeyPrefix + introPart;
    }

    public static bool IsIntroCompletedForStudent(ActionBlockIntroConfig cfg, string studentId = null)
    {
        if (cfg == null || !cfg.showOnlyOnce) return false;
        string sid = studentId ?? GetStudentIdForIntroPrefs();
        string key = GetCompletionPrefsKey(cfg, sid);
        if (PlayerPrefs.GetInt(key, 0) == 1) return true;
        // Legacy global key (pre per-student fix) — only when no logged-in student id.
        if (string.IsNullOrEmpty(sid) || sid == "UnknownUser")
        {
            string legacyKey = PrefsKeyPrefix + (string.IsNullOrEmpty(cfg.introId) ? "default" : cfg.introId);
            return PlayerPrefs.GetInt(legacyKey, 0) == 1;
        }
        return false;
    }

    public static void MarkIntroCompletedForStudent(ActionBlockIntroConfig cfg, string studentId = null)
    {
        if (cfg == null || !cfg.showOnlyOnce) return;
        string key = GetCompletionPrefsKey(cfg, studentId);
        PlayerPrefs.SetInt(key, 1);
        PlayerPrefs.Save();
    }

    public bool ShouldRunIntro(LevelData levelData)
    {
        if (!CharacterMove.IsIntroLevel(levelData)) return false;
        if (levelData?.actionBlockIntro == null || !levelData.actionBlockIntro.enabled) return false;
        if (levelData.actionBlockIntro.steps == null || levelData.actionBlockIntro.steps.Count == 0) return false;
        if (forceShowIntro) return true;
        var cfg = levelData.actionBlockIntro;
        if (!cfg.showOnlyOnce) return true;
        return !IsIntroCompletedForStudent(cfg);
    }

    /// <summary>
    /// Before the opening drag demo or step 1, show only the first teaching step's button
    /// (e.g. Forward) — not all four palette buttons.
    /// </summary>
    public void PrepareForIntroSequence(LevelData levelData)
    {
        if (levelData?.actionBlockIntro?.steps == null || levelData.actionBlockIntro.steps.Count == 0)
            return;
        if (_palettePreparedForIntro) return;

        CacheButtonStates();
        PrepareStepButtonsForDemo(levelData.actionBlockIntro.steps[0]);
        _palettePreparedForIntro = true;
    }

    public void TryBeginAfterLevelSetup(int levelNumber, LevelData levelData)
    {
        if (characterMove == null || levelData == null) return;
        if (!ShouldRunIntro(levelData)) return;
        StartCoroutine(BeginIntroNextFrame(levelData));
    }

    private IEnumerator BeginIntroNextFrame(LevelData levelData)
    {
        yield return null;
        BeginIntro(levelData);
    }

    private void BeginIntro(LevelData levelData)
    {
        _config = levelData.actionBlockIntro;
        _stepIndex = 0;
        IsActive = true;

        CacheButtonStates();

        CreateIntroOverlay();

        bool welcomeEnabled = levelData?.cornerHint != null && levelData.cornerHint.enabled;

        if (characterMove.chatGPTResponseText != null)
        {
            var firstStep = _config?.steps != null && _config.steps.Count > 0 ? _config.steps[0] : null;
            if (!welcomeEnabled && firstStep != null && !string.IsNullOrEmpty(firstStep.dragInstruction))
                characterMove.chatGPTResponseText.text = firstStep.dragInstruction;
            else if (!welcomeEnabled && firstStep?.stepHint != null && !string.IsNullOrEmpty(firstStep.stepHint.body))
                characterMove.chatGPTResponseText.text = firstStep.stepHint.body;
            else if (welcomeEnabled)
                characterMove.chatGPTResponseText.text = levelData.cornerHint.body ?? "Welcome!";
            else
                characterMove.chatGPTResponseText.text = "Let's learn the action blocks first!";
        }

        if (welcomeEnabled == false && characterMove.cornerHintPanel != null)
            characterMove.cornerHintPanel.Hide();

        SetRunInteractable(false);
        if (characterMove != null)
            characterMove.SnapshotIntroPlayfieldBaseline();

        if (welcomeEnabled)
        {
            _phase = Phase.Welcome;
            ShowAllPaletteButtonsForWelcome();
            if (characterMove.cornerHintPanel != null)
            {
                characterMove.cornerHintPanel.SetSkipVisible(false, null);
                characterMove.cornerHintPanel.PlayHintAudioOnly(levelData.cornerHint);
            }
            ShowWelcomeLetsGoPopup(levelData);
            return;
        }

        _phase = Phase.TeachDrag;
        ApplyIntroChrome();
        ApplyCurrentStep();
    }

    private void OnWelcomeContinueToStep1()
    {
        if (!IsActive || _phase != Phase.Welcome) return;
        DestroyWelcomePopup();
        StopStepApplyRoutine();
        if (characterMove?.dragDropTutorial != null)
            characterMove.dragDropTutorial.HideTutorial();
        _phase = Phase.TeachDrag;
        ApplyIntroChrome();
        ApplyCurrentStep();
    }

    private void ApplyIntroChrome()
    {
        var panel = characterMove.cornerHintPanel;
        if (panel == null) return;
        panel.EnsureBuilt();
        bool allowSkip = _config == null || _config.allowSkip;
        panel.SetSkipVisible(allowSkip, allowSkip ? SkipIntro : null);
    }

    private Canvas FindOverlayCanvas()
    {
        Canvas best = null;
        int bestOrder = int.MinValue;
#if UNITY_2023_1_OR_NEWER
        var canvases = FindObjectsByType<Canvas>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
#else
        var canvases = FindObjectsOfType<Canvas>();
#endif
        foreach (var c in canvases)
        {
            if (c == null || !c.isActiveAndEnabled || c.renderMode != RenderMode.ScreenSpaceOverlay)
                continue;
            if (c.sortingOrder >= bestOrder)
            {
                bestOrder = c.sortingOrder;
                best = c;
            }
        }
        return best;
    }

    private void CreateIntroOverlay()
    {
        if (_introOverlay != null) return;

        Canvas canvas = FindOverlayCanvas();
        if (canvas == null) return;

        _introOverlay = new GameObject("IntroModeOverlay", typeof(RectTransform), typeof(Image));
        var rt = _introOverlay.GetComponent<RectTransform>();
        rt.SetParent(canvas.transform, false);
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
        rt.SetAsFirstSibling();

        var img = _introOverlay.GetComponent<Image>();
        img.color = introOverlayColor;
        img.raycastTarget = false;
    }

    private void DestroyIntroOverlay()
    {
        if (_introOverlay != null)
        {
            Destroy(_introOverlay);
            _introOverlay = null;
        }
        DestroyWelcomePopup();
    }

    private void ShowWelcomeLetsGoPopup(LevelData levelData)
    {
        DestroyWelcomePopup();
        Canvas canvas = FindOverlayCanvas();
        if (canvas == null)
        {
            Debug.LogWarning("[ActionBlockIntro] No overlay canvas — starting step 1 without welcome popup.");
            OnWelcomeContinueToStep1();
            return;
        }

        _welcomePopupRoot = new GameObject("IntroWelcomePopup", typeof(RectTransform));
        var rootRt = _welcomePopupRoot.GetComponent<RectTransform>();
        rootRt.SetParent(canvas.transform, false);
        StretchRectFull(rootRt);
        rootRt.SetAsLastSibling();

        var backdrop = _welcomePopupRoot.AddComponent<Image>();
        backdrop.raycastTarget = true;
        ApplyWelcomePopupBackdropStyle(backdrop);

        var panelGo = new GameObject("Panel", typeof(RectTransform), typeof(Image));
        var panelRt = panelGo.GetComponent<RectTransform>();
        panelRt.SetParent(rootRt, false);
        panelRt.anchorMin = panelRt.anchorMax = new Vector2(0.5f, 0.5f);
        panelRt.pivot = new Vector2(0.5f, 0.5f);
        panelRt.anchoredPosition = Vector2.zero;
        var panelImg = panelGo.GetComponent<Image>();
        panelImg.raycastTarget = true;
        ApplyWelcomePopupPanelStyle(panelImg, panelRt);

        var hint = levelData?.cornerHint;
        string title = hint != null && !string.IsNullOrEmpty(hint.title) ? hint.title : "Welcome!";
        string body = hint != null && !string.IsNullOrEmpty(hint.body)
            ? hint.body
            : "These are your action blocks. Tap Let's go! to start step 1.";

        CreateWelcomePopupText(panelRt, "Title", welcomePopupTitle, title);
        CreateWelcomePopupText(panelRt, "Body", welcomePopupBody, body);

        var btnLayout = welcomePopupButtonLayout ?? new WelcomePopupButtonLayout();
        var btnGo = new GameObject("LetsGoButton", typeof(RectTransform), typeof(Image), typeof(Button));
        var btnRt = btnGo.GetComponent<RectTransform>();
        btnRt.SetParent(panelRt, false);
        btnRt.anchorMin = btnLayout.anchorMin;
        btnRt.anchorMax = btnLayout.anchorMax;
        btnRt.pivot = btnLayout.pivot;
        btnRt.anchoredPosition = btnLayout.anchoredPosition;
        btnRt.sizeDelta = btnLayout.sizeDelta;
        var btnImg = btnGo.GetComponent<Image>();
        var btn = btnGo.GetComponent<Button>();
        btn.targetGraphic = btnImg;

        var btnLabelGo = new GameObject("Label", typeof(RectTransform), typeof(TextMeshProUGUI));
        var btnLabelRt = btnLabelGo.GetComponent<RectTransform>();
        btnLabelRt.SetParent(btnRt, false);
        StretchRectFull(btnLabelRt);
        var btnLabel = btnLabelGo.GetComponent<TextMeshProUGUI>();
        btnLabel.text = welcomeLetsGoButtonLabel;
        ApplyWelcomePopupTextStyle(btnLabel, new WelcomePopupTextLayout
        {
            fontSize = btnLayout.labelFontSize,
            color = btnLayout.labelColor,
            fontStyle = btnLayout.labelFontStyle,
            alignment = btnLayout.labelAlignment,
            font = btnLayout.labelFont,
            enableWordWrapping = false,
        });

        ApplyWelcomeLetsGoButtonStyle(btnImg, btnLabel);

        btn.onClick.AddListener(OnWelcomeContinueToStep1);
    }

    private TextMeshProUGUI CreateWelcomePopupText(
        RectTransform panelRt, string objectName, WelcomePopupTextLayout layout, string text)
    {
        var go = new GameObject(objectName, typeof(RectTransform), typeof(TextMeshProUGUI));
        var rt = go.GetComponent<RectTransform>();
        rt.SetParent(panelRt, false);
        ApplyWelcomePopupTextRect(rt, layout);
        var tmp = go.GetComponent<TextMeshProUGUI>();
        tmp.text = text;
        ApplyWelcomePopupTextStyle(tmp, layout);
        return tmp;
    }

    private static void ApplyWelcomePopupTextRect(RectTransform rt, WelcomePopupTextLayout layout)
    {
        if (rt == null || layout == null) return;
        rt.anchorMin = layout.anchorMin;
        rt.anchorMax = layout.anchorMax;
        rt.offsetMin = layout.offsetMin;
        rt.offsetMax = layout.offsetMax;
        rt.pivot = new Vector2(0.5f, 0.5f);
    }

    private static void ApplyWelcomePopupTextStyle(TextMeshProUGUI tmp, WelcomePopupTextLayout layout)
    {
        if (tmp == null || layout == null) return;
        tmp.fontSize = layout.fontSize;
        tmp.color = layout.color;
        tmp.fontStyle = layout.fontStyle;
        tmp.alignment = layout.alignment;
        tmp.enableWordWrapping = layout.enableWordWrapping;
        tmp.lineSpacing = layout.lineSpacing;
        tmp.raycastTarget = false;
        if (layout.font != null)
            tmp.font = layout.font;
    }

    private void ApplyWelcomePopupBackdropStyle(Image backdropImg)
    {
        if (backdropImg == null) return;

        if (welcomePopupBackdropSprite != null)
        {
            backdropImg.sprite = welcomePopupBackdropSprite;
            backdropImg.color = welcomePopupBackdropColor;
            backdropImg.type = Image.Type.Simple;
            backdropImg.preserveAspect = false;
        }
        else
        {
            backdropImg.sprite = null;
            backdropImg.color = welcomePopupBackdropColor;
        }
    }

    private void ApplyWelcomePopupPanelStyle(Image panelImg, RectTransform panelRt)
    {
        if (panelImg == null || panelRt == null) return;

        panelImg.type = welcomePopupPanelImageType;

        if (welcomePopupPanelSprite != null)
        {
            panelImg.sprite = welcomePopupPanelSprite;
            panelImg.color = welcomePopupPanelColor;
            panelImg.preserveAspect = welcomePopupPanelImageType == Image.Type.Simple;

            if (welcomePopupUsePanelSpriteSize)
            {
                var sz = welcomePopupPanelSprite.rect.size;
                if (sz.x > 0f && sz.y > 0f)
                    panelRt.sizeDelta = sz;
                else if (welcomePopupPanelSize.x > 0f)
                    panelRt.sizeDelta = welcomePopupPanelSize;
            }
            else if (welcomePopupPanelSize.x > 0f)
            {
                panelRt.sizeDelta = welcomePopupPanelSize;
            }
        }
        else
        {
            panelImg.sprite = null;
            panelImg.color = welcomePopupPanelColor.a > 0f
                ? welcomePopupPanelColor
                : new Color(1f, 1f, 1f, 0.98f);
            if (welcomePopupPanelSize.x > 0f)
                panelRt.sizeDelta = welcomePopupPanelSize;
        }
    }

    private void ApplyWelcomeLetsGoButtonStyle(Image btnImg, TextMeshProUGUI btnLabel)
    {
        if (btnImg == null) return;

        if (welcomeLetsGoButtonSprite != null)
        {
            btnImg.sprite = welcomeLetsGoButtonSprite;
            btnImg.color = welcomeLetsGoButtonColor;
            btnImg.preserveAspect = true;
            btnImg.type = Image.Type.Simple;
            if (welcomeLetsGoUseSpriteSize)
            {
                var sz = welcomeLetsGoButtonSprite.rect.size;
                if (sz.x > 0f && sz.y > 0f)
                    btnImg.rectTransform.sizeDelta = sz;
                else if (welcomeLetsGoButtonSize.x > 0f)
                    btnImg.rectTransform.sizeDelta = welcomeLetsGoButtonSize;
            }
            else if (welcomeLetsGoButtonSize.x > 0f)
            {
                btnImg.rectTransform.sizeDelta = welcomeLetsGoButtonSize;
            }

            if (welcomeLetsGoHideTextWhenSprite && btnLabel != null)
                btnLabel.gameObject.SetActive(false);
        }
        else
        {
            btnImg.sprite = null;
            btnImg.color = new Color(0.2f, 0.72f, 0.38f, 1f);
            if (btnLabel != null)
            {
                btnLabel.gameObject.SetActive(true);
                btnLabel.text = welcomeLetsGoButtonLabel;
            }
            if (welcomeLetsGoButtonSize.x > 0f)
                btnImg.rectTransform.sizeDelta = welcomeLetsGoButtonSize;
        }
    }

    private void DestroyWelcomePopup()
    {
        if (_welcomePopupRoot != null)
        {
            Destroy(_welcomePopupRoot);
            _welcomePopupRoot = null;
        }
    }

    private static void StretchRectFull(RectTransform rt)
    {
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;
    }

    public void SkipIntro()
    {
        if (!IsActive) return;
        StopStepApplyRoutine();
        CompleteIntro(markPrefs: true);
    }

    public void OnBlockInserted(DraggableActionBlock.ActionKind kind)
    {
        if (!IsActive || _phase != Phase.TeachDrag) return;
        if (!KindMatchesCurrentStep(kind)) return;

        _phase = Phase.TeachRun;
        StopHighlight();

        var step = CurrentStep();
        SetBottomInstruction(step != null ? step.runInstruction : "Now tap Run!");
        SetRunInteractable(true);
        StartHighlight(characterMove.runButton);
    }

    public void OnIntroRunFinished()
    {
        if (!IsActive || _phase != Phase.Running) return;

        characterMove.ClearUserActionQueue();
        characterMove.ResetRobotToLevelStart();
        StopHighlight();
        SetRunInteractable(false);

        _stepIndex++;
        if (_config == null || _stepIndex >= _config.steps.Count)
        {
            CompleteIntro(markPrefs: true);
            return;
        }

        StopStepApplyRoutine();
        if (characterMove?.dragDropTutorial != null)
            characterMove.dragDropTutorial.HideTutorial();
        _phase = Phase.TeachDrag;
        ApplyCurrentStep();
    }

    /// <summary>Bottom instruction while the Play-button tap ghost runs.</summary>
    public void NotifyRunTapDemoStarting(string runInstruction)
    {
        if (!IsActive) return;
        SetBottomInstruction(runInstruction);
    }

    public bool AllowsKind(DraggableActionBlock.ActionKind kind)
    {
        if (!IsActive) return true;
        if (_phase == Phase.Welcome) return false;
        return KindMatchesCurrentStep(kind);
    }

    /// <summary>Only allow dragging a block onto the strip during the "drag it here" phase.</summary>
    public bool AllowsPaletteDrag()
    {
        if (!IsActive) return true;
        return _phase == Phase.TeachDrag;
    }

    public bool CanStartRun()
    {
        if (!IsActive) return true;
        return _phase == Phase.TeachRun || _phase == Phase.Running;
    }

    public void NotifyRunStarted()
    {
        if (!IsActive) return;
        _phase = Phase.Running;
        StopHighlight();
        SetRunInteractable(false);
        var step = CurrentStep();
        SetBottomInstruction(step != null ? step.runningInstruction : "Watch Robo go!");
    }

    private void CompleteIntro(bool markPrefs)
    {
        IsActive = false;
        _palettePreparedForIntro = false;
        StopStepApplyRoutine();
        StopHighlight();
        RestoreButtonStates();
        DestroyIntroOverlay();
        SetRunInteractable(true);

        if (characterMove.cornerHintPanel != null)
            characterMove.cornerHintPanel.SetSkipVisible(false, null);

        if (markPrefs && _config != null && _config.showOnlyOnce)
            MarkIntroCompletedForStudent(_config);

        if (characterMove.chatGPTResponseText != null && _config != null &&
            !string.IsNullOrEmpty(_config.completeMessage))
        {
            characterMove.chatGPTResponseText.text = _config.completeMessage;
        }

        characterMove.RefreshLevelCornerHint();
        if (CharacterMove.IsIntroLevel(characterMove.GetCurrentLevelData()))
            characterMove.OnIntroLevelComplete();
        else
            characterMove.SchedulePrewarmPlatformRunAttempt();
        Debug.Log("[ActionBlockIntro] Completed.");
    }

    private void ApplyCurrentStep()
    {
        StopStepApplyRoutine();
        _stepApplyRoutine = StartCoroutine(ApplyCurrentStepRoutine());
    }

    private void StopStepApplyRoutine()
    {
        if (_stepApplyRoutine != null)
        {
            StopCoroutine(_stepApplyRoutine);
            _stepApplyRoutine = null;
        }
        if (characterMove?.dragDropTutorial != null)
            characterMove.dragDropTutorial.StopIntroStepDemo();
    }

    private IEnumerator ApplyCurrentStepRoutine()
    {
        var step = CurrentStep();
        if (step == null)
        {
            CompleteIntro(markPrefs: true);
            yield break;
        }

        if (characterMove != null)
            characterMove.ApplyIntroStepPlayfield(step);

        PrepareStepButtonsForDemo(step);
        SetPaletteInteractable(false);
        yield return null;
        Canvas.ForceUpdateCanvases();
        yield return null;

        // Step corner hint + bottom text must appear before the ghost drag demo.
        ApplyCurrentStepPresentation(step);

        if (characterMove?.dragDropTutorial != null)
            characterMove.dragDropTutorial.HideTutorial();

        if (delayBeforeStepDemoSeconds > 0f)
            yield return new WaitForSeconds(delayBeforeStepDemoSeconds);
        else
            yield return null;

        if (!IsActive) yield break;

        var dragTutorial = characterMove != null ? characterMove.dragDropTutorial : null;
        bool playTutorial = step.tutorial == null || step.tutorial.showDragAnimation ||
                            step.tutorial.showRunTapAnimation;
        if (dragTutorial != null && playTutorial)
        {
            dragTutorial.PlayIntroStepDemo(step);
            while (dragTutorial.IsStepDemoPlaying)
                yield return null;
        }

        if (!IsActive) yield break;

        FinishCurrentStepInteraction(step);
        _stepApplyRoutine = null;
    }

    /// <summary>Makes only the current step's command button visible for the drag ghost animation.</summary>
    private void PrepareStepButtonsForDemo(ActionBlockIntroStepData step)
    {
        DraggableActionBlock.ActionKind kind = ParseAction(step.action);
        _activeButton = ButtonForKind(kind);

        foreach (var btn in AllPaletteButtons())
        {
            if (btn == null) continue;
            bool show = btn == _activeButton;
            btn.gameObject.SetActive(show);
            // Students may try the command while / right after the ghost demo on this step.
            btn.interactable = show;
            ResetButtonVisual(btn);
        }

        if (characterMove?.runButton != null)
        {
            characterMove.runButton.gameObject.SetActive(true);
            characterMove.runButton.interactable = false;
        }
    }

    private void ApplyCurrentStepPresentation(ActionBlockIntroStepData step)
    {
        if (step == null) return;
        DraggableActionBlock.ActionKind kind = ParseAction(step.action);
        _activeButton = ButtonForKind(kind);

        foreach (var btn in AllPaletteButtons())
        {
            if (btn == null) continue;
            bool show = btn == _activeButton;
            btn.gameObject.SetActive(show);
            ResetButtonVisual(btn);
        }

        if (characterMove?.runButton != null)
            characterMove.runButton.gameObject.SetActive(true);

        SetBottomInstruction(step.dragInstruction);
        ShowStepCornerHint(step);
    }

    private void FinishCurrentStepInteraction(ActionBlockIntroStepData step)
    {
        if (step == null) return;
        SetPaletteInteractable(true);
        if (characterMove?.runButton != null)
            characterMove.runButton.interactable = false;
        StartHighlight(_activeButton);
    }

    private void SetPaletteInteractable(bool on)
    {
        foreach (var btn in AllPaletteButtons())
        {
            if (btn == null) continue;
            if (!btn.gameObject.activeSelf) continue;
            btn.interactable = on;
        }
    }

    private void ShowStepCornerHint(ActionBlockIntroStepData step)
    {
        if (characterMove.cornerHintPanel == null || step == null) return;
        var hint = step.stepHint ?? new LevelCornerHint { enabled = true };
        if (!hint.enabled)
        {
            characterMove.cornerHintPanel.Hide();
            return;
        }
        if (string.IsNullOrEmpty(hint.title) && !string.IsNullOrEmpty(step.action))
            hint.title = TitleCaseAction(step.action);
        if (string.IsNullOrEmpty(hint.body) && !string.IsNullOrEmpty(step.dragInstruction))
            hint.body = step.dragInstruction;
        characterMove.cornerHintPanel.Show(hint, introMode: true);
    }

    /// <summary>Welcome screen: show the full action palette (non-interactive until step 1).</summary>
    private void ShowAllPaletteButtonsForWelcome()
    {
        foreach (var btn in AllPaletteButtons())
        {
            if (btn == null) continue;
            btn.gameObject.SetActive(true);
            btn.interactable = false;
            ResetButtonVisual(btn);
        }
        if (characterMove?.runButton != null)
        {
            characterMove.runButton.gameObject.SetActive(true);
            characterMove.runButton.interactable = false;
        }
    }

    private ActionBlockIntroStepData CurrentStep()
    {
        if (_config?.steps == null || _stepIndex < 0 || _stepIndex >= _config.steps.Count)
            return null;
        return _config.steps[_stepIndex];
    }

    private bool KindMatchesCurrentStep(DraggableActionBlock.ActionKind kind)
    {
        var step = CurrentStep();
        return step != null && ParseAction(step.action) == kind;
    }

    public static DraggableActionBlock.ActionKind ParseAction(string action)
    {
        if (string.IsNullOrEmpty(action)) return DraggableActionBlock.ActionKind.Forward;
        string a = action.Trim().ToLowerInvariant();
        if (a == "forward" || a == "move forward") return DraggableActionBlock.ActionKind.Forward;
        if (a == "backward" || a == "back" || a == "move backward") return DraggableActionBlock.ActionKind.Backward;
        if (a == "turn left" || a == "left") return DraggableActionBlock.ActionKind.TurnLeft;
        if (a == "turn right" || a == "right") return DraggableActionBlock.ActionKind.TurnRight;
        return DraggableActionBlock.ActionKind.Forward;
    }

    private static string TitleCaseAction(string action)
    {
        var k = ParseAction(action);
        switch (k)
        {
            case DraggableActionBlock.ActionKind.Backward: return "Backward";
            case DraggableActionBlock.ActionKind.TurnLeft: return "Turn Left";
            case DraggableActionBlock.ActionKind.TurnRight: return "Turn Right";
            default: return "Forward";
        }
    }

    private Button ButtonForKind(DraggableActionBlock.ActionKind kind)
    {
        if (characterMove == null) return null;
        switch (kind)
        {
            case DraggableActionBlock.ActionKind.Forward: return characterMove.moveForwardButton;
            case DraggableActionBlock.ActionKind.Backward: return characterMove.moveDownButton;
            case DraggableActionBlock.ActionKind.TurnLeft: return characterMove.rotateLeftButton;
            case DraggableActionBlock.ActionKind.TurnRight: return characterMove.rotateRightButton;
        }
        return null;
    }

    private IEnumerable<Button> AllPaletteButtons()
    {
        if (characterMove == null) yield break;
        yield return characterMove.moveForwardButton;
        yield return characterMove.moveDownButton;
        yield return characterMove.rotateLeftButton;
        yield return characterMove.rotateRightButton;
    }

    private void SetBottomInstruction(string msg)
    {
        if (characterMove?.chatGPTResponseText != null && !string.IsNullOrEmpty(msg))
            characterMove.chatGPTResponseText.text = msg;
    }

    private void SetRunInteractable(bool on)
    {
        if (characterMove?.runButton != null)
            characterMove.runButton.interactable = on;
    }

    private void CacheButtonStates()
    {
        _buttonWasActive.Clear();
        _buttonScales.Clear();
        foreach (var btn in AllPaletteButtons())
        {
            if (btn == null) continue;
            _buttonWasActive[btn] = btn.gameObject.activeSelf;
            _buttonScales[btn] = btn.transform.localScale;
        }
    }

    private void RestoreButtonStates()
    {
        foreach (var kvp in _buttonWasActive)
        {
            if (kvp.Key == null) continue;
            kvp.Key.gameObject.SetActive(kvp.Value);
            if (_buttonScales.TryGetValue(kvp.Key, out var scale))
                kvp.Key.transform.localScale = scale;
            ResetButtonVisual(kvp.Key);
            kvp.Key.interactable = true;
        }
        _buttonWasActive.Clear();
        _buttonScales.Clear();
    }

    private void StartHighlight(Button button)
    {
        StopHighlight();
        if (button == null) return;
        _highlightCoroutine = StartCoroutine(PulseGreenHighlight(button));
    }

    private void StopHighlight()
    {
        if (_highlightCoroutine != null)
        {
            StopCoroutine(_highlightCoroutine);
            _highlightCoroutine = null;
        }
        if (_activeButton != null)
            ResetButtonVisual(_activeButton);
        if (characterMove?.runButton != null && _phase != Phase.TeachRun)
            ResetButtonVisual(characterMove.runButton);
    }

    private IEnumerator PulseGreenHighlight(Button button)
    {
        var img = button.GetComponent<Image>();
        if (img == null) yield break;

        var outline = button.GetComponent<Outline>();
        if (outline == null) outline = button.gameObject.AddComponent<Outline>();
        outline.enabled = true;
        outline.effectColor = highlightColor;
        outline.effectDistance = new Vector2(4f, -4f);

        Color baseColor = Color.white;
        float pulseSpeed = 2.5f;
        float t = 0f;
        Vector3 baseScale = _buttonScales.ContainsKey(button)
            ? _buttonScales[button]
            : button.transform.localScale;

        while (true)
        {
            t += Time.deltaTime * pulseSpeed;
            float lerp = (Mathf.Sin(t) + 1f) * 0.5f;
            img.color = Color.Lerp(baseColor, highlightColor, lerp * 0.65f);
            outline.effectColor = Color.Lerp(baseColor, highlightColor, lerp);
            button.transform.localScale = baseScale * (1f + 0.06f * lerp);
            if (button.targetGraphic != null)
                button.targetGraphic.color = img.color;
            yield return null;
        }
    }

    private static void ResetButtonVisual(Button button)
    {
        if (button == null) return;
        var img = button.GetComponent<Image>();
        if (img != null) img.color = Color.white;
        if (button.targetGraphic != null)
            button.targetGraphic.color = Color.white;
        var outline = button.GetComponent<Outline>();
        if (outline != null) outline.enabled = false;
    }
}
