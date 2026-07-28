using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Beginner-friendly, non-blocking tutorial for flag/prediction tasks.
/// Shows kids they must TAP a grid square to place the flag.
/// Does not capture input — FlagPlacement handles taps.
/// </summary>
[DisallowMultipleComponent]
public class FlagTaskTutorialController : MonoBehaviour
{
    [Header("References")]
    public CharacterMove characterMove;
    [Tooltip("Optional. If empty, uses CharacterMove.gridInteractionCamera or Camera.main.")]
    public Camera worldCamera;
    public bool debugLogs = true;

    [Header("Tutorial UI (Canvas)")]
    public CanvasGroup tutorialCanvasGroup;
    public RectTransform tutorialRoot;
    public Image smallFlagIcon;
    public Image handTapIcon;
    public Sprite handTapSprite;
    public TextMeshProUGUI instructionText;
    public Image instructionBubble;
    [Tooltip("Soft tap ring under the hand (UI). Replaces the old solid grid square.")]
    public Image tapRingIcon;

    [Header("Audio (legacy — clips migrate to GameInteractionSoundsSettings)")]
    public AudioClip placeFlagSound;
    public AudioClip tutorialTapSound;

    [Header("Timing")]
    public float startDelaySeconds = 0.35f;
    [Tooltip("How long coaching stays after the hand demo (kids need time to try).")]
    public float tutorialVisibleSeconds = 5.5f;
    public float fadeOutSeconds = 0.55f;
    [Range(1, 4)] public int handTapRepeatCount = 2;
    public float pauseBetweenHandTapsSeconds = 0.4f;

    [Header("Grid highlights")]
    [Tooltip("OFF by default — the solid white cell square confused kids.")]
    public bool showWorldCellPulse = false;
    [Range(1, 4)] public int pulseCellCount = 1;
    public Color pulseColor = new Color(1f, 0.88f, 0.15f, 0.55f);
    public int pulseSortingOrder = 55;
    public float pulseBlinkSpeed = 2.4f;
    public float highlightYOffset = 0.04f;

    [Header("Behavior")]
    public bool hideOnFirstPlacement = true;
    public bool allowReplayEveryLevelStart = true;

    private Coroutine _tutorialRoutine;
    private Vector2Int _lastSeenFlagCell = new Vector2Int(-999, -999);
    private bool _hasPlacedOnceThisLevel;
    private int _lastLevelSlot = -1;
    private int _activeTutorialSlot = -1;
    private int _lastCompletedTutorialSlot = -1;
    private bool _tutorialActive;
    private readonly List<GameObject> _pulseMarkers = new List<GameObject>();

    public Vector2Int chosenFlagCell { get; private set; } = new Vector2Int(-1, -1);

    private void Awake()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        RemoveLegacyHintButton();
    }

    public void MigrateSoundClipsTo(GameInteractionSoundsSettings target)
    {
        if (target == null) return;
        if (target.flagPlaceClip == null && placeFlagSound != null)
            target.flagPlaceClip = placeFlagSound;
        if (target.flagTutorialTapClip == null && tutorialTapSound != null)
            target.flagTutorialTapClip = tutorialTapSound;
    }

    private void Start()
    {
        StartCoroutine(WatchForFlagLevelStart());
    }

    private void OnEnable()
    {
        HideTutorialVisualsOnly();
        ClearPulseMarkers();
        _lastSeenFlagCell = new Vector2Int(-999, -999);
        _hasPlacedOnceThisLevel = false;
        _tutorialActive = false;
        _activeTutorialSlot = -1;
        _lastCompletedTutorialSlot = -1;
    }

    private void Update()
    {
        if (characterMove == null) return;

        int slot = characterMove.CurrentPlaySlot;
        if (slot != _lastLevelSlot)
        {
            _lastLevelSlot = slot;
            _hasPlacedOnceThisLevel = false;
            chosenFlagCell = new Vector2Int(-1, -1);
            _lastSeenFlagCell = new Vector2Int(-999, -999);
            _lastCompletedTutorialSlot = -1;
            StopTutorialRoutine();
            HideTutorialVisualsOnly();

            if (ShouldRunForCurrentLevel())
            {
                if (debugLogs) Debug.Log("[FlagTaskTutorial] Level slot changed -> start tutorial.");
                StartTutorialSequence();
            }
        }

        if (!ShouldRunForCurrentLevel()) return;

        Vector2Int current = characterMove.flagCell;
        bool placed = characterMove.IsFlagPlaced;
        if (placed && current != _lastSeenFlagCell)
        {
            _lastSeenFlagCell = current;
            chosenFlagCell = current;
            GameInteractionSounds.PlayFlagPlace();

            if (!_hasPlacedOnceThisLevel)
            {
                _hasPlacedOnceThisLevel = true;
                if (hideOnFirstPlacement)
                {
                    _lastCompletedTutorialSlot = characterMove.CurrentPlaySlot;
                    HideTutorialImmediate();
                }
            }
        }
    }

    private bool ShouldRunForCurrentLevel()
    {
        if (characterMove == null) return false;
        if (!characterMove.IsFlagPlacementActive) return false;
        if (!allowReplayEveryLevelStart && _hasPlacedOnceThisLevel) return false;
        return true;
    }

    private IEnumerator WatchForFlagLevelStart()
    {
        yield return new WaitForSeconds(0.35f);

        // Keep watching — intro may run first; flag items come later (or after Skip).
        float t = 0f;
        while (t < 180f)
        {
            int slot = characterMove != null ? characterMove.CurrentPlaySlot : -1;
            bool alreadyDoneThisSlot = slot >= 0 && slot == _lastCompletedTutorialSlot;
            if (characterMove != null && ShouldRunForCurrentLevel() && !_tutorialActive && !alreadyDoneThisSlot
                && !_hasPlacedOnceThisLevel)
            {
                if (debugLogs) Debug.Log("[FlagTaskTutorial] Flag task active -> start tutorial.");
                _lastLevelSlot = slot;
                StartTutorialSequence();
            }
            t += 0.35f;
            yield return new WaitForSeconds(0.35f);
        }
    }

    /// <summary>Call after a level transition finishes so the flag help can appear (including after Skip).</summary>
    public void NotifyLevelReadyForTutorial()
    {
        if (!ShouldRunForCurrentLevel()) return;
        if (_hasPlacedOnceThisLevel && !allowReplayEveryLevelStart) return;

        // Do NOT bail out while the fade is still up — TutorialRoutine waits for unmute.
        // (Old early-return here caused “no tutorial after Skip”.)
        _lastLevelSlot = characterMove != null ? characterMove.CurrentPlaySlot : _lastLevelSlot;
        if (_tutorialActive && _activeTutorialSlot == _lastLevelSlot)
            return;
        if (_lastCompletedTutorialSlot == _lastLevelSlot && _hasPlacedOnceThisLevel)
            return;

        if (debugLogs) Debug.Log("[FlagTaskTutorial] NotifyLevelReadyForTutorial -> start.");
        // Allow re-show after Skip / transition even if a previous attempt marked complete without placement.
        if (!_hasPlacedOnceThisLevel)
            _lastCompletedTutorialSlot = -1;
        StartTutorialSequence();
    }

    private void StartTutorialSequence()
    {
        StopTutorialRoutine();
        _activeTutorialSlot = characterMove != null ? characterMove.CurrentPlaySlot : _lastLevelSlot;
        _tutorialActive = true;
        _tutorialRoutine = StartCoroutine(TutorialRoutine());
    }

    private void StopTutorialRoutine()
    {
        if (_tutorialRoutine != null)
        {
            StopCoroutine(_tutorialRoutine);
            _tutorialRoutine = null;
        }
        _tutorialActive = false;
        ClearPulseMarkers();
    }

    private IEnumerator TutorialRoutine()
    {
        yield return new WaitForSeconds(startDelaySeconds);

        float coverWait = 0f;
        while (LevelTransitionController.ShouldMuteGameplayAudio() && coverWait < 6f)
        {
            coverWait += Time.unscaledDeltaTime;
            yield return null;
        }
        yield return new WaitForSecondsRealtime(0.2f);
        yield return null;

        if (!ShouldRunForCurrentLevel())
        {
            _tutorialActive = false;
            _tutorialRoutine = null;
            yield break;
        }

        // Student may already have placed during the transition wait.
        if (hideOnFirstPlacement && characterMove != null && characterMove.IsFlagPlaced)
        {
            _hasPlacedOnceThisLevel = true;
            _lastCompletedTutorialSlot = _activeTutorialSlot;
            _tutorialActive = false;
            _tutorialRoutine = null;
            yield break;
        }

        EnsureUIReferences();
        LayoutKidFriendlyBanner();

        if (tutorialCanvasGroup == null || tutorialRoot == null)
        {
            if (debugLogs) Debug.LogWarning("[FlagTaskTutorial] Missing tutorial UI — cannot show.");
            _tutorialActive = false;
            _tutorialRoutine = null;
            yield break;
        }

        var canvas = tutorialRoot.GetComponentInParent<Canvas>();
        if (canvas != null)
        {
            canvas.overrideSorting = true;
            // Below drag-hand overlays (~850) but above gameplay / corner tips.
            canvas.sortingOrder = Mathf.Max(canvas.sortingOrder, 700);
        }

        tutorialCanvasGroup.alpha = 1f;
        tutorialCanvasGroup.interactable = false;
        tutorialCanvasGroup.blocksRaycasts = false;

        bool freePick = characterMove != null && characterMove.PlayerPicksEndCellWithFlag();
        if (instructionText != null)
        {
            instructionText.text = freePick
                ? "Tap a tile to put your flag!"
                : "Tap the glowing tile for your flag!";
            instructionText.gameObject.SetActive(true);
        }

        tutorialRoot.gameObject.SetActive(true);
        if (instructionBubble != null) instructionBubble.gameObject.SetActive(true);
        Transform tipShadow = tutorialRoot.Find("InstructionShadow");
        if (tipShadow != null) tipShadow.gameObject.SetActive(true);
        if (smallFlagIcon != null) smallFlagIcon.gameObject.SetActive(false);
        if (tapRingIcon != null) tapRingIcon.gameObject.SetActive(false);
        if (handTapIcon != null)
        {
            handTapIcon.gameObject.SetActive(true);
            // Keep hand sprite natural (no neon yellow tint).
            handTapIcon.color = Color.white;
            handTapIcon.rectTransform.localScale = Vector3.one;
        }

        // Soft bounce on the tip chip so it feels alive.
        if (instructionBubble != null)
            StartCoroutine(PulseTipChip(instructionBubble.rectTransform, tutorialVisibleSeconds + 2f));

        List<Vector2Int> cells = PickDemoCells(1);
        // No solid white world square — hand + soft UI ring is enough for kids.

        Vector2Int targetCell = cells.Count > 0
            ? cells[0]
            : new Vector2Int(characterMove.gridCols / 2, characterMove.gridRows / 2);

        int taps = Mathf.Clamp(handTapRepeatCount, 1, 4);
        for (int i = 0; i < taps; i++)
        {
            if (!ShouldRunForCurrentLevel()) break;
            if (hideOnFirstPlacement && characterMove.IsFlagPlaced) break;
            yield return AnimateHandTapToCell(targetCell);
            if (i < taps - 1)
                yield return new WaitForSeconds(pauseBetweenHandTapsSeconds);
        }

        float t = 0f;
        while (t < tutorialVisibleSeconds)
        {
            if (!ShouldRunForCurrentLevel()) break;
            if (hideOnFirstPlacement && characterMove.IsFlagPlaced) break;
            t += Time.deltaTime;
            yield return null;
        }

        if (tutorialCanvasGroup != null && tutorialCanvasGroup.alpha > 0.01f)
        {
            float a0 = tutorialCanvasGroup.alpha;
            float f = 0f;
            while (f < fadeOutSeconds)
            {
                if (hideOnFirstPlacement && characterMove.IsFlagPlaced) break;
                f += Time.deltaTime;
                float k = Mathf.Clamp01(f / Mathf.Max(0.001f, fadeOutSeconds));
                tutorialCanvasGroup.alpha = Mathf.Lerp(a0, 0f, EaseOutCubic(k));
                yield return null;
            }
            tutorialCanvasGroup.alpha = 0f;
        }

        if (instructionText != null) instructionText.gameObject.SetActive(false);
        if (instructionBubble != null) instructionBubble.gameObject.SetActive(false);
        if (handTapIcon != null) handTapIcon.gameObject.SetActive(false);
        if (tapRingIcon != null) tapRingIcon.gameObject.SetActive(false);
        if (smallFlagIcon != null) smallFlagIcon.gameObject.SetActive(false);
        ClearPulseMarkers();

        Transform shadow = tutorialRoot != null ? tutorialRoot.Find("InstructionShadow") : null;
        if (shadow != null) shadow.gameObject.SetActive(false);

        _lastCompletedTutorialSlot = _activeTutorialSlot;
        _tutorialActive = false;
        _tutorialRoutine = null;
    }

    private void HideTutorialImmediate()
    {
        StopTutorialRoutine();
        HideTutorialVisualsOnly();
    }

    private void HideTutorialVisualsOnly()
    {
        if (tutorialCanvasGroup != null)
        {
            tutorialCanvasGroup.alpha = 0f;
            tutorialCanvasGroup.interactable = false;
            tutorialCanvasGroup.blocksRaycasts = false;
        }
        if (instructionText != null) instructionText.gameObject.SetActive(false);
        if (instructionBubble != null) instructionBubble.gameObject.SetActive(false);
        if (handTapIcon != null) handTapIcon.gameObject.SetActive(false);
        if (tapRingIcon != null) tapRingIcon.gameObject.SetActive(false);
        if (smallFlagIcon != null) smallFlagIcon.gameObject.SetActive(false);
        if (tutorialRoot != null)
        {
            tutorialRoot.gameObject.SetActive(false);
            Transform shadow = tutorialRoot.Find("InstructionShadow");
            if (shadow != null) shadow.gameObject.SetActive(false);
        }
        ClearPulseMarkers();
    }

    private void RemoveLegacyHintButton()
    {
        var legacy = GameObject.Find("_FlagTutorialHintButton");
        if (legacy != null)
            Destroy(legacy);
    }

    private void EnsureUIReferences()
    {
        if (tutorialCanvasGroup == null)
            AutoBuildTutorialOverlay();

        if (tutorialRoot == null && tutorialCanvasGroup != null)
            tutorialRoot = tutorialCanvasGroup.GetComponent<RectTransform>();

        EnsureTapRing();
        EnsureHand();
        LayoutKidFriendlyBanner();
    }

    private void EnsureHand()
    {
        if (tutorialRoot == null) return;
        if (handTapIcon == null)
        {
            var go = new GameObject("_FlagTutorialHandTap", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(tutorialRoot, false);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.5f, 0.5f);
            rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.32f, 0.88f);
            rt.sizeDelta = new Vector2(128f, 128f);
            handTapIcon = go.GetComponent<Image>();
            handTapIcon.raycastTarget = false;

            if (handTapSprite == null)
                handTapSprite = Resources.Load<Sprite>("CornerHint/TapHand");
            if (handTapSprite == null)
                handTapSprite = CreateSoftCircleSprite();
            handTapIcon.sprite = handTapSprite;
            handTapIcon.preserveAspect = true;
            handTapIcon.color = Color.white;
        }
        else
        {
            handTapIcon.color = Color.white;
            handTapIcon.rectTransform.sizeDelta = new Vector2(
                Mathf.Max(handTapIcon.rectTransform.sizeDelta.x, 120f),
                Mathf.Max(handTapIcon.rectTransform.sizeDelta.y, 120f));
        }
    }

    private void EnsureTapRing()
    {
        if (tutorialRoot == null) return;
        if (tapRingIcon != null) return;

        var go = new GameObject("_FlagTutorialTapRing", typeof(RectTransform), typeof(Image));
        go.transform.SetParent(tutorialRoot, false);
        var rt = go.GetComponent<RectTransform>();
        rt.anchorMin = new Vector2(0.5f, 0.5f);
        rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.sizeDelta = new Vector2(70f, 70f);
        tapRingIcon = go.GetComponent<Image>();
        tapRingIcon.raycastTarget = false;
        tapRingIcon.sprite = CreateRingSprite();
        tapRingIcon.color = new Color(1f, 0.75f, 0.2f, 0.85f);
        tapRingIcon.gameObject.SetActive(false);
        // Behind the hand.
        go.transform.SetAsFirstSibling();
    }

    /// <summary>Compact rounded tip chip near the bottom — modern & kid-friendly.</summary>
    private void LayoutKidFriendlyBanner()
    {
        if (tutorialRoot == null) return;

        if (instructionBubble == null && instructionText != null)
            instructionBubble = instructionText.GetComponentInParent<Image>();

        if (instructionBubble == null)
        {
            var found = tutorialRoot.Find("Instruction");
            if (found != null)
                instructionBubble = found.GetComponent<Image>();
        }

        if (instructionBubble == null) return;

        var bubbleRt = instructionBubble.rectTransform;
        bubbleRt.anchorMin = new Vector2(0.5f, 0f);
        bubbleRt.anchorMax = new Vector2(0.5f, 0f);
        bubbleRt.pivot = new Vector2(0.5f, 0f);
        // Compact chip — leave the grid readable.
        bubbleRt.anchoredPosition = new Vector2(0f, 118f);
        bubbleRt.sizeDelta = new Vector2(480f, 72f);

        instructionBubble.sprite = CreateRoundedRectSprite(48, 24, 12);
        instructionBubble.type = Image.Type.Sliced;
        instructionBubble.color = new Color(1f, 1f, 1f, 0.94f);
        instructionBubble.raycastTarget = false;

        // Soft drop-shadow sibling behind the chip.
        Transform shadowT = tutorialRoot.Find("InstructionShadow");
        Image shadowImg;
        if (shadowT == null)
        {
            var shadowGo = new GameObject("InstructionShadow", typeof(RectTransform), typeof(Image));
            shadowGo.transform.SetParent(tutorialRoot, false);
            shadowGo.transform.SetSiblingIndex(instructionBubble.transform.GetSiblingIndex());
            shadowImg = shadowGo.GetComponent<Image>();
        }
        else
        {
            shadowImg = shadowT.GetComponent<Image>();
        }

        if (shadowImg != null)
        {
            var srt = shadowImg.rectTransform;
            srt.anchorMin = bubbleRt.anchorMin;
            srt.anchorMax = bubbleRt.anchorMax;
            srt.pivot = bubbleRt.pivot;
            srt.anchoredPosition = bubbleRt.anchoredPosition + new Vector2(0f, -5f);
            srt.sizeDelta = bubbleRt.sizeDelta + new Vector2(8f, 8f);
            shadowImg.sprite = instructionBubble.sprite;
            shadowImg.type = Image.Type.Sliced;
            shadowImg.color = new Color(0.12f, 0.2f, 0.35f, 0.22f);
            shadowImg.raycastTarget = false;
        }

        if (instructionText != null)
        {
            var textRt = instructionText.rectTransform;
            textRt.offsetMin = new Vector2(28f, 12f);
            textRt.offsetMax = new Vector2(-28f, -12f);
            instructionText.fontSize = 28f;
            instructionText.fontStyle = FontStyles.Bold;
            instructionText.alignment = TextAlignmentOptions.Center;
            instructionText.color = new Color(0.16f, 0.28f, 0.42f, 1f);
            instructionText.enableWordWrapping = true;
            instructionText.raycastTarget = false;
        }
    }

    private void AutoBuildTutorialOverlay()
    {
        var cgo = new GameObject("_FlagTutorialCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        var canvas = cgo.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        canvas.overrideSorting = true;
        canvas.sortingOrder = 700;
        var scaler = cgo.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(1280, 720);
        scaler.matchWidthOrHeight = 0.5f;

        var rootGo = new GameObject("_FlagTaskTutorial", typeof(RectTransform), typeof(CanvasGroup));
        var rt = rootGo.GetComponent<RectTransform>();
        rt.SetParent(cgo.transform, false);
        rt.anchorMin = Vector2.zero;
        rt.anchorMax = Vector2.one;
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        tutorialCanvasGroup = rootGo.GetComponent<CanvasGroup>();
        tutorialCanvasGroup.alpha = 0f;
        tutorialCanvasGroup.blocksRaycasts = false;
        tutorialCanvasGroup.interactable = false;
        tutorialRoot = rt;

        var bubble = new GameObject("Instruction", typeof(RectTransform), typeof(Image));
        bubble.transform.SetParent(rootGo.transform, false);
        instructionBubble = bubble.GetComponent<Image>();
        instructionBubble.raycastTarget = false;

        var textGo = new GameObject("Text", typeof(RectTransform), typeof(TextMeshProUGUI));
        var textRt = textGo.GetComponent<RectTransform>();
        textRt.SetParent(bubble.transform, false);
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        instructionText = textGo.GetComponent<TextMeshProUGUI>();
        instructionText.raycastTarget = false;

        LayoutKidFriendlyBanner();

        var flagGo = new GameObject("_FlagTutorialFlagIcon", typeof(RectTransform), typeof(Image));
        flagGo.transform.SetParent(rootGo.transform, false);
        smallFlagIcon = flagGo.GetComponent<Image>();
        smallFlagIcon.raycastTarget = false;
        smallFlagIcon.color = Color.white;
        smallFlagIcon.preserveAspect = true;
        // Prefer a real flag sprite so we never flash a blank white Image.
        Sprite flagSprite = null;
        if (characterMove != null && characterMove.flagPrefab != null)
        {
            var sr = characterMove.flagPrefab.GetComponentInChildren<SpriteRenderer>(true);
            if (sr != null) flagSprite = sr.sprite;
            if (flagSprite == null)
            {
                var img = characterMove.flagPrefab.GetComponentInChildren<Image>(true);
                if (img != null) flagSprite = img.sprite;
            }
        }
        if (flagSprite != null)
            smallFlagIcon.sprite = flagSprite;
        smallFlagIcon.gameObject.SetActive(false);

        if (debugLogs) Debug.Log("[FlagTaskTutorial] Auto-built modern tip chip.");
    }

    private List<Vector2Int> PickDemoCells(int max)
    {
        var results = new List<Vector2Int>();
        if (characterMove == null) return results;

        if (characterMove.MustUseDesignatedEndCellForFlag())
        {
            results.Add(characterMove.DesignatedEndObjectCell);
            return results;
        }

        Vector2Int prefer = characterMove.RobotGridPosition;
        if (!characterMove.CellInGridBounds(prefer))
            prefer = new Vector2Int(characterMove.gridCols / 2, characterMove.gridRows / 2);

        var candidates = new List<Vector2Int>();
        for (int y = 0; y < characterMove.gridRows; y++)
        {
            for (int x = 0; x < characterMove.gridCols; x++)
            {
                var c = new Vector2Int(x, y);
                if (!characterMove.CanPlaceFlagOnCell(c)) continue;
                if (c == prefer) continue;
                candidates.Add(c);
            }
        }

        candidates.Sort((a, b) =>
        {
            int da = Mathf.Abs(a.x - prefer.x) + Mathf.Abs(a.y - prefer.y);
            int db = Mathf.Abs(b.x - prefer.x) + Mathf.Abs(b.y - prefer.y);
            return da.CompareTo(db);
        });

        for (int i = 0; i < candidates.Count && results.Count < max; i++)
            results.Add(candidates[i]);

        if (results.Count == 0)
            results.Add(prefer);
        return results;
    }

    private void SpawnPulseMarkers(List<Vector2Int> cells)
    {
        ClearPulseMarkers();
        if (!showWorldCellPulse || characterMove == null) return;

        foreach (var cell in cells)
        {
            Vector3 wp = characterMove.GridCellToWorld(cell);
            wp.y += highlightYOffset;
            var go = new GameObject($"_FlagTutorialPulse_{cell.x}_{cell.y}");
            go.transform.position = wp;
            var m = go.AddComponent<GridCellBlinkMarker>();
            m.Configure(GridCellBlinkMarker.MarkerKind.End, pulseColor, pulseSortingOrder, pulseBlinkSpeed);
            float cellSpacing = Mathf.Max(0.25f, characterMove.GetCellSpacingForLayout(null));
            go.transform.localScale = new Vector3(cellSpacing * 0.9f, cellSpacing * 0.9f, 1f);
            _pulseMarkers.Add(go);
        }
    }

    private void ClearPulseMarkers()
    {
        for (int i = 0; i < _pulseMarkers.Count; i++)
        {
            if (_pulseMarkers[i] != null)
                Destroy(_pulseMarkers[i]);
        }
        _pulseMarkers.Clear();
    }

    private Camera ResolveCamera()
    {
        if (worldCamera != null) return worldCamera;
        if (characterMove != null && characterMove.gridInteractionCamera != null)
            return characterMove.gridInteractionCamera;
        return Camera.main;
    }

    private IEnumerator PulseTipChip(RectTransform chip, float duration)
    {
        if (chip == null) yield break;
        Vector3 baseScale = Vector3.one;
        float t = 0f;
        while (t < duration && chip != null && chip.gameObject.activeInHierarchy)
        {
            if (hideOnFirstPlacement && characterMove != null && characterMove.IsFlagPlaced) yield break;
            t += Time.deltaTime;
            float wobble = 1f + 0.025f * Mathf.Sin(t * 3.2f);
            chip.localScale = baseScale * wobble;
            yield return null;
        }
        if (chip != null) chip.localScale = baseScale;
    }

    private IEnumerator AnimateHandTapToCell(Vector2Int cell)
    {
        if (handTapIcon == null || tutorialRoot == null) yield break;
        Camera cam = ResolveCamera();
        if (cam == null || characterMove == null) yield break;

        Vector3 wp = characterMove.GridCellToWorld(cell);
        Vector3 sp = cam.WorldToScreenPoint(wp);
        if (sp.z < 0f) yield break;

        RectTransform parent = handTapIcon.rectTransform.parent as RectTransform;
        if (parent == null) yield break;

        Canvas canvas = parent.GetComponentInParent<Canvas>();
        Camera uiCam = null;
        if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
            uiCam = canvas.worldCamera != null ? canvas.worldCamera : cam;

        if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(parent, sp, uiCam, out Vector2 targetLocal))
            yield break;

        Vector2 startLocal = targetLocal + new Vector2(70f, 55f);
        handTapIcon.gameObject.SetActive(true);
        handTapIcon.rectTransform.anchoredPosition = startLocal;
        handTapIcon.color = new Color(1f, 1f, 1f, 0f);
        handTapIcon.rectTransform.localScale = Vector3.one * 1.05f;

        if (tapRingIcon != null)
        {
            tapRingIcon.gameObject.SetActive(true);
            tapRingIcon.rectTransform.anchoredPosition = targetLocal;
            tapRingIcon.rectTransform.localScale = Vector3.one * 0.55f;
            tapRingIcon.color = new Color(1f, 0.72f, 0.18f, 0f);
        }

        float moveT = 0f;
        const float moveDur = 0.5f;
        while (moveT < moveDur)
        {
            if (hideOnFirstPlacement && characterMove.IsFlagPlaced) yield break;
            moveT += Time.deltaTime;
            float k = Mathf.Clamp01(moveT / moveDur);
            float e = EaseOutCubic(k);
            handTapIcon.rectTransform.anchoredPosition = Vector2.Lerp(startLocal, targetLocal, e);
            var c = handTapIcon.color;
            c.a = Mathf.Lerp(0f, 1f, e);
            handTapIcon.color = c;
            yield return null;
        }

        yield return AnimateTapRingBurst();
        yield return TapPress(handTapIcon.rectTransform);
        yield return PreviewFlagPopAtScreenPoint(sp);
        yield return new WaitForSeconds(0.1f);
        yield return AnimateTapRingBurst();
        yield return TapPress(handTapIcon.rectTransform);
    }

    private IEnumerator AnimateTapRingBurst()
    {
        if (tapRingIcon == null) yield break;
        tapRingIcon.gameObject.SetActive(true);
        float t = 0f;
        const float dur = 0.45f;
        while (t < dur)
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / dur);
            float e = EaseOutCubic(k);
            tapRingIcon.rectTransform.localScale = Vector3.one * Mathf.Lerp(0.45f, 1.55f, e);
            tapRingIcon.color = new Color(1f, 0.72f, 0.18f, Mathf.Lerp(0.8f, 0f, e));
            yield return null;
        }
        tapRingIcon.color = new Color(1f, 0.72f, 0.18f, 0f);
    }

    private IEnumerator TapPress(RectTransform rt)
    {
        if (rt == null) yield break;
        Vector3 baseScale = rt.localScale;
        Vector3 down = baseScale * 0.86f;
        float t = 0f;
        const float dur = 0.11f;

        GameInteractionSounds.PlayFlagTutorialTap();

        while (t < dur)
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / dur);
            rt.localScale = Vector3.Lerp(baseScale, down, k);
            yield return null;
        }
        t = 0f;
        while (t < dur)
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / dur);
            rt.localScale = Vector3.Lerp(down, baseScale, k);
            yield return null;
        }
    }

    private IEnumerator PreviewFlagPopAtScreenPoint(Vector3 screenPoint)
    {
        // Without a real flag sprite, Unity draws a solid white quad — skip that.
        if (smallFlagIcon == null || smallFlagIcon.sprite == null) yield break;
        RectTransform parent = smallFlagIcon.rectTransform.parent as RectTransform;
        if (parent == null) yield break;

        Canvas canvas = parent.GetComponentInParent<Canvas>();
        Camera uiCam = null;
        if (canvas != null && canvas.renderMode != RenderMode.ScreenSpaceOverlay)
            uiCam = canvas.worldCamera;

        RectTransformUtility.ScreenPointToLocalPointInRectangle(parent, screenPoint, uiCam, out Vector2 local);

        smallFlagIcon.rectTransform.anchoredPosition = local + new Vector2(22f, 16f);
        smallFlagIcon.rectTransform.sizeDelta = new Vector2(56f, 56f);
        smallFlagIcon.transform.localScale = Vector3.one * 0.7f;
        smallFlagIcon.color = new Color(1f, 1f, 1f, 0f);
        smallFlagIcon.gameObject.SetActive(true);

        float t = 0f;
        const float dur = 0.2f;
        while (t < dur)
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / dur);
            float e = EaseOutBack(k);
            smallFlagIcon.transform.localScale = Vector3.one * Mathf.Lerp(0.7f, 1.05f, e);
            var c = smallFlagIcon.color;
            c.a = Mathf.Lerp(0f, 1f, k);
            smallFlagIcon.color = c;
            yield return null;
        }
    }

    private static float EaseOutCubic(float t)
    {
        t = Mathf.Clamp01(t);
        float u = 1f - t;
        return 1f - u * u * u;
    }

    private static float EaseOutBack(float t)
    {
        t = Mathf.Clamp01(t);
        const float c1 = 1.70158f;
        const float c3 = c1 + 1f;
        return 1f + c3 * Mathf.Pow(t - 1f, 3f) + c1 * Mathf.Pow(t - 1f, 2f);
    }

    private static Sprite CreateSoftCircleSprite()
    {
        const int size = 64;
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        var pixels = new Color[size * size];
        Vector2 center = new Vector2((size - 1) * 0.5f, (size - 1) * 0.5f);
        float r = size * 0.45f;
        float r2 = r * r;
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float dx = x - center.x;
                float dy = y - center.y;
                float d2 = dx * dx + dy * dy;
                float a = d2 <= r2 ? 1f : 0f;
                float edge = Mathf.Clamp01((r - Mathf.Sqrt(d2)) / (size * 0.06f));
                a *= edge;
                pixels[y * size + x] = new Color(1f, 1f, 1f, a);
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    private static Sprite CreateRingSprite()
    {
        const int size = 128;
        var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        var pixels = new Color[size * size];
        Vector2 center = new Vector2((size - 1) * 0.5f, (size - 1) * 0.5f);
        float outer = size * 0.46f;
        float inner = size * 0.34f;
        for (int y = 0; y < size; y++)
        {
            for (int x = 0; x < size; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), center);
                float a = 0f;
                if (d <= outer && d >= inner)
                {
                    float edgeOut = Mathf.Clamp01((outer - d) / 3f);
                    float edgeIn = Mathf.Clamp01((d - inner) / 3f);
                    a = Mathf.Min(edgeOut, edgeIn);
                }
                pixels[y * size + x] = new Color(1f, 1f, 1f, a);
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }

    private static Sprite CreateRoundedRectSprite(int width, int height, int radius)
    {
        width = Mathf.Max(width, radius * 2 + 2);
        height = Mathf.Max(height, radius * 2 + 2);
        var tex = new Texture2D(width, height, TextureFormat.RGBA32, false);
        tex.filterMode = FilterMode.Bilinear;
        var pixels = new Color[width * height];
        for (int y = 0; y < height; y++)
        {
            for (int x = 0; x < width; x++)
            {
                float a = RoundedRectAlpha(x, y, width, height, radius);
                pixels[y * width + x] = new Color(1f, 1f, 1f, a);
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();
        // 9-slice borders
        var border = new Vector4(radius, radius, radius, radius);
        return Sprite.Create(tex, new Rect(0, 0, width, height), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect, border);
    }

    private static float RoundedRectAlpha(int x, int y, int w, int h, int r)
    {
        // Inside body
        if (x >= r && x < w - r && y >= 0 && y < h) return 1f;
        if (y >= r && y < h - r && x >= 0 && x < w) return 1f;

        Vector2 c;
        if (x < r && y < r) c = new Vector2(r, r);
        else if (x >= w - r && y < r) c = new Vector2(w - r - 1, r);
        else if (x < r && y >= h - r) c = new Vector2(r, h - r - 1);
        else if (x >= w - r && y >= h - r) c = new Vector2(w - r - 1, h - r - 1);
        else return 1f;

        float d = Vector2.Distance(new Vector2(x, y), c);
        if (d <= r - 1.2f) return 1f;
        if (d >= r + 0.5f) return 0f;
        return Mathf.Clamp01(1f - (d - (r - 1.2f)) / 1.7f);
    }
}
