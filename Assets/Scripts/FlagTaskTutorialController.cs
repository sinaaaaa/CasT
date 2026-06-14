using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Beginner-friendly, non-blocking tutorial for flag/prediction tasks.
///
/// Goal (elementary-friendly):
/// - Show that students must TAP a grid cell to place the flag (their prediction of where the robot stops).
///
/// How this hooks into your task system:
/// - Your Unity runtime already supports prediction/flag tasks via LevelData.useFlagPlacement and
///   LevelData.playerPicksEndCellWithFlag (see CharacterMove.IsFlagPlacementActive + PlayerPicksEndCellWithFlag()).
/// - Flag placement input is handled by FlagPlacement.cs, which calls CharacterMove.TryPlaceOrMoveFlag(cell).
/// - This controller does NOT capture input. It only watches for the flag cell changing and plays a tutorial overlay.
/// </summary>
[DisallowMultipleComponent]
public class FlagTaskTutorialController : MonoBehaviour
{
    [Header("References")]
    public CharacterMove characterMove;
    [Tooltip("Optional. If empty, uses CharacterMove.flagCamera or Camera.main.")]
    public Camera worldCamera;
    [Tooltip("Logs tutorial decisions (helpful while wiring up).")]
    public bool debugLogs = true;

    [Header("Tutorial UI (Canvas)")]
    [Tooltip("A CanvasGroup for fading the instruction. Should NOT block raycasts.")]
    public CanvasGroup tutorialCanvasGroup;
    public RectTransform tutorialRoot;
    public Image smallFlagIcon;
    public Image handTapIcon;
    [Tooltip("Optional. If Hand Tap Icon is not assigned, the controller will create one using this sprite (or Resources/CornerHint/TapHand).")]
    public Sprite handTapSprite;
    public TextMeshProUGUI instructionText;

    [Header("Audio (legacy — clips migrate to GameInteractionSoundsSettings)")]
    [Tooltip("Deprecated: assign on GameInteractionSoundsSettings instead.")]
    public AudioClip placeFlagSound;
    [Tooltip("Deprecated: assign on GameInteractionSoundsSettings instead.")]
    public AudioClip tutorialTapSound;

    [Header("Timing")]
    public float startDelaySeconds = 0.5f;
    [Tooltip("How long the full tutorial stays visible before fading (3–5 seconds recommended).")]
    public float tutorialVisibleSeconds = 4f;
    public float fadeOutSeconds = 0.6f;

    [Header("Grid highlights")]
    [Tooltip("How many example cells to pulse (2–3 recommended).")]
    [Range(1, 4)] public int pulseCellCount = 3;
    public Color pulseColor = new Color(1f, 0.9f, 0.3f, 0.85f);
    [Tooltip("Sorting order for highlight squares (higher draws on top).")]
    public int pulseSortingOrder = 50;
    public float pulseBlinkSpeed = 2.0f;
    public float highlightYOffset = 0.03f;

    [Header("Behavior")]
    [Tooltip("If true, the tutorial hides immediately on the first real flag placement.")]
    public bool hideOnFirstPlacement = true;
    [Tooltip("If false, only show on the first time this level is entered in a session.")]
    public bool allowReplayEveryLevelStart = true;

    // State
    private Coroutine _tutorialRoutine;
    private Vector2Int _lastSeenFlagCell = new Vector2Int(-999, -999);
    private bool _hasPlacedOnceThisLevel;
    private int _lastLevelSlot = -1;
    private readonly List<GameObject> _pulseMarkers = new List<GameObject>();

    /// <summary>Last chosen flag cell, for assessment logging.</summary>
    public Vector2Int chosenFlagCell { get; private set; } = new Vector2Int(-1, -1);

    private void Awake()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();

        RemoveLegacyHintButton();
    }

    /// <summary>One-time copy from scene fields into <see cref="GameInteractionSoundsSettings"/>.</summary>
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
        // On first scene load, CurrentPlaySlot may already be set before Update() runs.
        // This watcher starts the tutorial once the flag/prediction level becomes active.
        StartCoroutine(WatchForFlagLevelStart());
    }

    private void OnEnable()
    {
        HideTutorialImmediate();
        _lastSeenFlagCell = new Vector2Int(-999, -999);
        _hasPlacedOnceThisLevel = false;
    }

    private void Update()
    {
        if (characterMove == null) return;

        // Detect level changes (slot changes) so we can reset tutorial state.
        int slot = characterMove.CurrentPlaySlot;
        if (slot != _lastLevelSlot)
        {
            _lastLevelSlot = slot;
            _hasPlacedOnceThisLevel = false;
            chosenFlagCell = new Vector2Int(-1, -1);
            _lastSeenFlagCell = new Vector2Int(-999, -999);
            StopTutorialRoutine();
            HideTutorialImmediate();

            if (ShouldRunForCurrentLevel())
            {
                if (debugLogs) Debug.Log("[FlagTaskTutorial] Level slot changed -> start tutorial.");
                StartTutorialSequence();
            }
        }

        if (!ShouldRunForCurrentLevel()) return;

        // Watch for the first real student placement (FlagPlacement.cs calls TryPlaceOrMoveFlag).
        Vector2Int current = characterMove.flagCell;
        bool placed = characterMove.IsFlagPlaced;
        if (placed && current != _lastSeenFlagCell)
        {
            _lastSeenFlagCell = current;
            chosenFlagCell = current;

            // Gentle sound feedback when the flag is placed/moved.
            GameInteractionSounds.PlayFlagPlace();

            if (!_hasPlacedOnceThisLevel)
            {
                _hasPlacedOnceThisLevel = true;
                if (hideOnFirstPlacement)
                    HideTutorialImmediate();
            }

            // Assessment note:
            // If you need to send this to your platform assessment, hook here:
            // - chosenFlagCell is the student's prediction (tap target).
            // - It updates immediately on every tap/move.
        }
    }

    private bool ShouldRunForCurrentLevel()
    {
        if (characterMove == null) return false;
        if (!characterMove.IsFlagPlacementActive) return false;

        // Only prediction/flag tasks: "player picks end cell by tapping".
        // This matches your requirement: not path-building; student predicts stop cell.
        if (!characterMove.PlayerPicksEndCellWithFlag()) return false;

        if (!allowReplayEveryLevelStart && _hasPlacedOnceThisLevel) return false;
        return true;
    }

    private IEnumerator WatchForFlagLevelStart()
    {
        // Wait a moment for CharacterMove to finish loading level data.
        yield return new WaitForSeconds(0.25f);

        // If already on a flag/prediction task, start now.
        float timeout = 6f;
        float t = 0f;
        while (t < timeout)
        {
            if (characterMove != null && ShouldRunForCurrentLevel())
            {
                if (debugLogs) Debug.Log("[FlagTaskTutorial] Flag task active -> start tutorial.");
                _lastLevelSlot = characterMove.CurrentPlaySlot;
                StartTutorialSequence();
                yield break;
            }
            t += 0.25f;
            yield return new WaitForSeconds(0.25f);
        }

        if (debugLogs) Debug.Log("[FlagTaskTutorial] No flag task detected on start (ok).");
    }

    private void StartTutorialSequence()
    {
        StopTutorialRoutine();
        _tutorialRoutine = StartCoroutine(TutorialRoutine());
    }

    private void StopTutorialRoutine()
    {
        if (_tutorialRoutine != null)
        {
            StopCoroutine(_tutorialRoutine);
            _tutorialRoutine = null;
        }
        ClearPulseMarkers();
    }

    private IEnumerator TutorialRoutine()
    {
        yield return new WaitForSeconds(startDelaySeconds);

        if (!ShouldRunForCurrentLevel()) yield break;

        EnsureUIReferences();
        if (tutorialCanvasGroup == null || tutorialRoot == null)
        {
            if (debugLogs) Debug.LogWarning("[FlagTaskTutorial] Missing tutorial UI references (CanvasGroup/Root). Tutorial will not show.");
            yield break;
        }

        // Never block gameplay.
        if (tutorialCanvasGroup != null)
        {
            tutorialCanvasGroup.alpha = 1f;
            tutorialCanvasGroup.interactable = false;
            tutorialCanvasGroup.blocksRaycasts = false;
        }

        if (instructionText != null)
        {
            instructionText.text = "Tap the square where the robot will stop.";
            instructionText.gameObject.SetActive(true);
        }

        if (tutorialRoot != null) tutorialRoot.gameObject.SetActive(true);
        if (smallFlagIcon != null) smallFlagIcon.gameObject.SetActive(true);
        if (handTapIcon != null) handTapIcon.gameObject.SetActive(true);

        // Pick 2–3 example cells to pulse (valid placement cells).
        List<Vector2Int> cells = PickPulseCells(pulseCellCount);
        SpawnPulseMarkers(cells);

        // Animate a hand moving to the "main" cell and preview flag pop.
        Vector2Int targetCell = cells.Count > 0 ? cells[0] : new Vector2Int(characterMove.gridCols / 2, characterMove.gridRows / 2);
        yield return AnimateHandTapToCell(targetCell);

        // Keep visible for a bit.
        float t = 0f;
        while (t < tutorialVisibleSeconds)
        {
            if (!ShouldRunForCurrentLevel()) yield break;
            // If student already placed the flag, hide immediately.
            if (hideOnFirstPlacement && characterMove.IsFlagPlaced) break;
            t += Time.deltaTime;
            yield return null;
        }

        if (tutorialCanvasGroup != null)
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
        if (handTapIcon != null) handTapIcon.gameObject.SetActive(false);
        if (smallFlagIcon != null) smallFlagIcon.gameObject.SetActive(false);
        ClearPulseMarkers();
    }

    private void HideTutorialImmediate()
    {
        if (tutorialCanvasGroup != null)
        {
            tutorialCanvasGroup.alpha = 0f;
            tutorialCanvasGroup.interactable = false;
            tutorialCanvasGroup.blocksRaycasts = false;
        }
        if (instructionText != null) instructionText.gameObject.SetActive(false);
        if (handTapIcon != null) handTapIcon.gameObject.SetActive(false);
        if (smallFlagIcon != null) smallFlagIcon.gameObject.SetActive(false);
        if (tutorialRoot != null) tutorialRoot.gameObject.SetActive(false);
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
        // This script is designed to be hooked up in the Inspector.
        // If not assigned, auto-build a simple overlay so the tutorial is visible without setup.
        if (tutorialCanvasGroup == null)
            AutoBuildTutorialOverlay();

        if (tutorialRoot == null && tutorialCanvasGroup != null)
            tutorialRoot = tutorialCanvasGroup.GetComponent<RectTransform>();

        // If you can't (or don't want to) assign the Hand Tap Image, we can create it automatically.
        if (handTapIcon == null && tutorialRoot != null)
        {
            var go = new GameObject("_FlagTutorialHandTap", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(tutorialRoot, false);
            var rt = go.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.5f, 0.5f);
            rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.sizeDelta = new Vector2(84f, 84f);
            handTapIcon = go.GetComponent<Image>();
            handTapIcon.raycastTarget = false;

            // Sprite fallback order: explicit field -> Resources -> tiny generated circle.
            if (handTapSprite == null)
                handTapSprite = Resources.Load<Sprite>("CornerHint/TapHand");
            if (handTapSprite == null)
                handTapSprite = CreateSoftCircleSprite();
            handTapIcon.sprite = handTapSprite;
            handTapIcon.preserveAspect = true;
        }
    }

    private void AutoBuildTutorialOverlay()
    {
        Canvas canvas = null;
        if (characterMove != null)
            canvas = characterMove.GetComponentInChildren<Canvas>(true);
        if (canvas == null)
            canvas = FindObjectOfType<Canvas>();

        if (canvas == null)
        {
            var cgo = new GameObject("_FlagTutorialCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvas = cgo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = cgo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.matchWidthOrHeight = 0.5f;
        }

        var rootGo = new GameObject("_FlagTaskTutorial", typeof(RectTransform), typeof(CanvasGroup));
        var rt = rootGo.GetComponent<RectTransform>();
        rt.SetParent(canvas.transform, false);
        rt.anchorMin = new Vector2(0f, 0f);
        rt.anchorMax = new Vector2(1f, 1f);
        rt.offsetMin = Vector2.zero;
        rt.offsetMax = Vector2.zero;

        tutorialCanvasGroup = rootGo.GetComponent<CanvasGroup>();
        tutorialCanvasGroup.alpha = 0f;
        tutorialCanvasGroup.blocksRaycasts = false;
        tutorialCanvasGroup.interactable = false;
        tutorialRoot = rt;

        // Instruction bubble.
        var bubble = new GameObject("Instruction", typeof(RectTransform), typeof(Image));
        var bubbleRt = bubble.GetComponent<RectTransform>();
        bubbleRt.SetParent(rootGo.transform, false);
        bubbleRt.anchorMin = new Vector2(0.5f, 1f);
        bubbleRt.anchorMax = new Vector2(0.5f, 1f);
        bubbleRt.pivot = new Vector2(0.5f, 1f);
        bubbleRt.anchoredPosition = new Vector2(0f, -32f);
        bubbleRt.sizeDelta = new Vector2(560f, 110f);
        var bubbleImg = bubble.GetComponent<Image>();
        bubbleImg.color = new Color(1f, 1f, 1f, 0.92f);
        bubbleImg.raycastTarget = false;

        var textGo = new GameObject("Text", typeof(RectTransform), typeof(TextMeshProUGUI));
        var textRt = textGo.GetComponent<RectTransform>();
        textRt.SetParent(bubble.transform, false);
        textRt.anchorMin = Vector2.zero;
        textRt.anchorMax = Vector2.one;
        textRt.offsetMin = new Vector2(18f, 12f);
        textRt.offsetMax = new Vector2(-18f, -12f);
        instructionText = textGo.GetComponent<TextMeshProUGUI>();
        instructionText.fontSize = 34f;
        instructionText.alignment = TextAlignmentOptions.Center;
        instructionText.color = new Color(0.1f, 0.1f, 0.13f, 1f);
        instructionText.enableWordWrapping = true;
        instructionText.raycastTarget = false;

        // Small flag icon (optional visual pop).
        var flagGo = new GameObject("_FlagTutorialFlagIcon", typeof(RectTransform), typeof(Image));
        flagGo.transform.SetParent(rootGo.transform, false);
        smallFlagIcon = flagGo.GetComponent<Image>();
        smallFlagIcon.raycastTarget = false;
        smallFlagIcon.color = Color.white;
        smallFlagIcon.preserveAspect = true;
        // You can assign a sprite in the inspector; otherwise it stays invisible.
        smallFlagIcon.gameObject.SetActive(false);

        if (debugLogs) Debug.Log("[FlagTaskTutorial] Auto-built tutorial overlay UI.");
    }

    private List<Vector2Int> PickPulseCells(int max)
    {
        var results = new List<Vector2Int>();
        if (characterMove == null) return results;

        // If the teacher set a designated end cell, highlight it (still valid prediction UX).
        if (characterMove.MustUseDesignatedEndCellForFlag())
        {
            results.Add(characterMove.DesignatedEndObjectCell);
            return results;
        }

        // Otherwise: gather a few valid cells.
        for (int y = characterMove.gridRows - 1; y >= 0; y--)
        {
            for (int x = 0; x < characterMove.gridCols; x++)
            {
                var c = new Vector2Int(x, y);
                if (!characterMove.CanPlaceFlagOnCell(c)) continue;
                results.Add(c);
                if (results.Count >= max) return results;
            }
        }

        // Fallback.
        results.Add(new Vector2Int(characterMove.gridCols / 2, characterMove.gridRows / 2));
        return results;
    }

    private void SpawnPulseMarkers(List<Vector2Int> cells)
    {
        ClearPulseMarkers();
        if (characterMove == null) return;

        foreach (var cell in cells)
        {
            Vector3 wp = characterMove.GridCellToWorld(cell);
            wp.y += highlightYOffset;
            var go = new GameObject($"_FlagTutorialPulse_{cell.x}_{cell.y}");
            go.transform.position = wp;
            var m = go.AddComponent<GridCellBlinkMarker>();
            m.Configure(GridCellBlinkMarker.MarkerKind.End, pulseColor, pulseSortingOrder, pulseBlinkSpeed);

            // Scale to roughly the cell size.
            float cellSpacing = Mathf.Max(0.25f, characterMove.GetCellSpacingForLayout(null));
            go.transform.localScale = new Vector3(cellSpacing * 0.85f, cellSpacing * 0.85f, 1f);

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

    private IEnumerator AnimateHandTapToCell(Vector2Int cell)
    {
        if (handTapIcon == null || tutorialRoot == null) yield break;
        Camera cam = worldCamera != null
            ? worldCamera
            : (characterMove != null && characterMove.gridInteractionCamera != null
                ? characterMove.gridInteractionCamera
                : Camera.main);
        if (cam == null) yield break;

        Vector3 wp = characterMove.GridCellToWorld(cell);
        Vector3 sp = cam.WorldToScreenPoint(wp);
        if (sp.z < 0f) yield break;

        // Convert screen point to local point on the UI rect.
        RectTransform parent = handTapIcon.rectTransform.parent as RectTransform;
        if (parent == null) yield break;

        RectTransformUtility.ScreenPointToLocalPointInRectangle(parent, sp, null, out Vector2 targetLocal);

        // Start from slightly offset (top-right) so it “moves in”.
        Vector2 startLocal = targetLocal + new Vector2(80f, 60f);
        handTapIcon.rectTransform.anchoredPosition = startLocal;
        handTapIcon.color = new Color(1f, 1f, 1f, 0f);

        // Fade in + move.
        float moveT = 0f;
        const float moveDur = 0.75f;
        while (moveT < moveDur)
        {
            moveT += Time.deltaTime;
            float k = Mathf.Clamp01(moveT / moveDur);
            float e = EaseOutCubic(k);
            handTapIcon.rectTransform.anchoredPosition = Vector2.Lerp(startLocal, targetLocal, e);
            var c = handTapIcon.color;
            c.a = Mathf.Lerp(0f, 1f, e);
            handTapIcon.color = c;
            yield return null;
        }

        // Tap “press” (scale down a bit), then pop a tiny flag icon on the same spot.
        yield return TapPress(handTapIcon.rectTransform);
        yield return PreviewFlagPopAtScreenPoint(sp);
    }

    private IEnumerator TapPress(RectTransform rt)
    {
        if (rt == null) yield break;
        Vector3 baseScale = rt.localScale;
        Vector3 down = baseScale * 0.9f;
        float t = 0f;
        const float dur = 0.12f;

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
        if (smallFlagIcon == null) yield break;
        RectTransform parent = smallFlagIcon.rectTransform.parent as RectTransform;
        if (parent == null) yield break;
        RectTransformUtility.ScreenPointToLocalPointInRectangle(parent, screenPoint, null, out Vector2 local);

        smallFlagIcon.rectTransform.anchoredPosition = local + new Vector2(18f, 12f);
        smallFlagIcon.transform.localScale = Vector3.one * 0.75f;
        smallFlagIcon.color = new Color(1f, 1f, 1f, 0f);
        smallFlagIcon.gameObject.SetActive(true);

        float t = 0f;
        const float dur = 0.22f;
        while (t < dur)
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / dur);
            float e = EaseOutBack(k);
            smallFlagIcon.transform.localScale = Vector3.one * Mathf.Lerp(0.75f, 1.05f, e);
            var c = smallFlagIcon.color;
            c.a = Mathf.Lerp(0f, 1f, k);
            smallFlagIcon.color = c;
            yield return null;
        }

        // settle
        t = 0f;
        const float settle = 0.12f;
        Vector3 from = smallFlagIcon.transform.localScale;
        Vector3 to = Vector3.one;
        while (t < settle)
        {
            t += Time.deltaTime;
            float k = Mathf.Clamp01(t / settle);
            smallFlagIcon.transform.localScale = Vector3.Lerp(from, to, k);
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
        // Simple, child-friendly fallback if no hand sprite is provided.
        // This avoids blocking setup: the tutorial still shows a "tap" blob animation.
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
                // Soft edge
                float edge = Mathf.Clamp01((r - Mathf.Sqrt(d2)) / (size * 0.06f));
                a *= edge;
                pixels[y * size + x] = new Color(1f, 1f, 1f, a);
            }
        }
        tex.SetPixels(pixels);
        tex.Apply();
        return Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
    }
}

