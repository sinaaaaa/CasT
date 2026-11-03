using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

/// <summary>
/// DRAW_PATH: tap or drag adjacent squares to draw the predicted path.
/// Pencil and eraser live on the Unity blue bar. Over the grid the OS cursor
/// is replaced by a large pencil or eraser whose tip is the drawing point.
/// Drawing owns the press (including over the robot). Moving the robot is a short hold.
/// </summary>
public class GeometryPathDrawInput : MonoBehaviour
{
    public CharacterMove characterMove;
    [Tooltip("Ignore presses that start on buttons, the yellow strip, or the hint panel.")]
    public bool ignoreClicksOverUI = true;
    [Tooltip("On touch, aim this many pixels above the finger so the cell is not hidden under it.")]
    [Range(0f, 96f)] public float touchAimNudgePixels = 52f;
    [Tooltip("If a press starts on the robot, wait for this much finger travel before drawing so a hold can move the robot instead.")]
    [Range(8f, 48f)] public float robotPressDrawSlopPixels = 20f;
    public bool logEvents;

    public bool EraserActive => _eraser;
    public bool IsStrokeActive => _drawing;
    public Sprite PencilSprite => _pencilSprite;
    public Sprite EraserSprite => _eraserSprite;

    Vector2Int _pen;
    Vector2Int _pressCell;
    bool _hasPen;
    bool _drawing;
    bool _usingTouch;
    bool _strokeMoved;
    bool _eraser;
    bool _deferForRobot;
    Vector2 _deferScreen;
    int _pointerId = -1;
    GameObject _pencilIcon;
    GameObject _eraserIcon;
    Vector3 _pencilIconBaseScale = Vector3.one;
    Vector3 _eraserIconBaseScale = Vector3.one;
    Sprite _pencilSprite;
    Sprite _eraserSprite;
    Vector2 _lastScreen;
    bool _lastTouch;
    Canvas _cursorCanvas;
    RectTransform _cursorRt;
    Image _cursorIcon;
    Image _cursorShadow;
    Image _cursorTip;
    Image _cursorTipRing;
    bool _osCursorHidden;
    static Sprite _dotSprite;

    void Awake()
    {
        if (characterMove == null) characterMove = FindObjectOfType<CharacterMove>();
        DestroyLegacyOverlayToolbar();
    }

    void OnDisable()
    {
        EndStroke(keepPen: true);
        GeometryPathController.Instance?.ClearDrawPointerPreview();
        HideScreenCursor(restoreOs: true);
    }

    void OnDestroy()
    {
        DestroyScreenCursor();
        ShowOsCursor(true);
    }

    void LateUpdate()
    {
        DriveScreenCursor();
    }

    void Update()
    {
        if (characterMove == null) return;
        var geo = GeometryPathController.Instance;
        bool canDraw = geo != null && geo.AllowStudentDrawing && !characterMove.IsBusyForGridInput;
        if (!canDraw)
        {
            EndStroke(keepPen: false);
            geo?.ClearDrawPointerPreview();
            return;
        }

        SyncPenToRobotIfEmpty(geo);

        if (!ReadPointer(out bool pressed, out bool held, out bool released, out Vector2 pos, out bool touch, out int pointerId))
        {
            if (!_drawing)
                ShowPreview(geo, null, drawing: false);
            return;
        }

        if (pressed)
        {
            if (TrySelectIconAt(pos))
            {
                EndStroke(keepPen: true);
                return;
            }
            if (ignoreClicksOverUI && UiDragState.IsScreenPointOverBlockingUi(pos, pointerId))
            {
                EndStroke(keepPen: true);
                return;
            }
            // DRAW_PATH owns the press so kids can draw across the robot cell.
            // Robot move uses a short hold (see RobotGridDrag), not this soft grab.
            if (characterMove.IsRobotBeingManipulated())
            {
                EndStroke(keepPen: true);
                return;
            }

            _usingTouch = touch;
            _pointerId = pointerId;
            _strokeMoved = false;
            _lastScreen = pos;
            _lastTouch = touch;

            // Press on the robot: wait for a slide before drawing so a hold can grab instead.
            if (IsRobotGrabCandidate(pos, touch))
            {
                _deferForRobot = true;
                _deferScreen = pos;
                _drawing = false;
                ShowPreview(geo, null, drawing: false, pos, touch);
                return;
            }

            BeginStroke(geo, pos, touch);
            return;
        }

        if (characterMove.IsRobotBeingManipulated())
        {
            EndStroke(keepPen: true);
            ShowPreview(geo, null, drawing: false, pos, touch);
            return;
        }

        if (held && _deferForRobot)
        {
            _lastScreen = pos;
            _lastTouch = _usingTouch;
            var drag = characterMove.GetComponent<RobotGridDrag>();
            bool grabPending = drag != null && drag.IsDrawPathGrabPending;
            float travel = Vector2.Distance(pos, _deferScreen);
            if (!grabPending || travel >= robotPressDrawSlopPixels)
            {
                _deferForRobot = false;
                BeginStroke(geo, _deferScreen, _usingTouch);
                if (_drawing && PickCell(pos, _usingTouch, out Vector2Int slidCell))
                    HandleDrag(geo, slidCell);
            }
            return;
        }

        if (held && _drawing)
        {
            _lastScreen = pos;
            _lastTouch = _usingTouch;
            if (!PickCell(pos, _usingTouch, out Vector2Int cell))
            {
                ShowPreview(geo, _hasPen ? _pen : (Vector2Int?)null, drawing: true, pos, _usingTouch);
                return;
            }
            HandleDrag(geo, cell);
            return;
        }

        if (released)
        {
            if (_deferForRobot)
            {
                // Quick tap on the robot cell: treat as a draw/erase tap, not a grab.
                _deferForRobot = false;
                BeginStroke(geo, _deferScreen, _usingTouch || touch);
            }
            if (_drawing && _eraser && !_strokeMoved && _hasPen)
            {
                int cleared = geo.EraseEdgesTouching(_pressCell);
                if (cleared > 0)
                    characterMove.NotifyGeometryPathDrawingChanged();
            }
            EndStroke(keepPen: true);
            if (PickCell(pos, touch, out Vector2Int hover) && !touch)
                ShowPreview(geo, hover, drawing: false, pos, touch);
            else
                ShowPreview(geo, null, drawing: false, pos, touch);
            return;
        }

        if (!_drawing && !touch)
        {
            _lastScreen = pos;
            _lastTouch = false;
            Vector2 aim = AimPoint(pos, false);
            if (IsOverDrawIcon(aim, out _))
            {
                ShowPreview(geo, null, drawing: false);
                return;
            }
            if (ignoreClicksOverUI && UiDragState.IsScreenPointOverBlockingUi(aim, pointerId))
            {
                ShowPreview(geo, null, drawing: false);
                return;
            }
            if (PickCell(pos, false, out Vector2Int hover))
                ShowPreview(geo, hover, drawing: false, pos, false);
            else
                ShowPreview(geo, null, drawing: false, pos, false);
        }
    }

    /// <summary>Called when a long-press claims the robot so the stroke does not keep drawing.</summary>
    public void CancelStrokeForRobotGrab()
    {
        _deferForRobot = false;
        EndStroke(keepPen: true);
        GeometryPathController.Instance?.ClearDrawPointerPreview();
        HideScreenCursor(restoreOs: true);
    }

    void BeginStroke(GeometryPathController geo, Vector2 screenPos, bool touch)
    {
        _drawing = true;
        _deferForRobot = false;
        if (!PickCell(screenPos, touch, out Vector2Int cell))
            return;
        _pressCell = cell;
        HandlePress(geo, cell);
    }

    bool IsRobotGrabCandidate(Vector2 screenPos, bool touch)
    {
        if (characterMove == null) return false;
        var drag = characterMove.GetComponent<RobotGridDrag>();
        return drag != null && drag.enabled && drag.IsDrawPathGrabCandidate(screenPos, touch);
    }

    void HandlePress(GeometryPathController geo, Vector2Int cell)
    {
        if (_eraser)
        {
            _pen = cell;
            _hasPen = true;
            ShowPreview(geo, cell, drawing: true);
            return;
        }

        if (!_hasPen)
        {
            _pen = characterMove.RobotGridPosition;
            _hasPen = true;
        }

        if (cell != _pen)
        {
            TryCommit(geo, _pen, cell);
            _pen = cell;
        }
        ShowPreview(geo, cell, drawing: true);
    }

    void HandleDrag(GeometryPathController geo, Vector2Int cell)
    {
        if (!_hasPen)
        {
            _pen = _eraser ? cell : characterMove.RobotGridPosition;
            _hasPen = true;
        }

        if (cell == _pen)
        {
            ShowPreview(geo, cell, drawing: true);
            return;
        }

        _strokeMoved = true;
        int changes = _eraser
            ? geo.EraseDrawnPath(_pen, cell)
            : geo.ConnectDrawnPath(_pen, cell);
        if (changes > 0)
        {
            if (logEvents) Debug.Log($"[GeometryPathDraw] {(_eraser ? "erase" : "draw")} {_pen} -> {cell} ({changes})");
            characterMove.NotifyGeometryPathDrawingChanged();
        }
        _pen = cell;
        ShowPreview(geo, cell, drawing: true);
    }

    void TryCommit(GeometryPathController geo, Vector2Int from, Vector2Int to)
    {
        int changes = geo.ConnectDrawnPath(from, to);
        if (changes > 0)
        {
            if (logEvents) Debug.Log($"[GeometryPathDraw] tap {from} -> {to}");
            characterMove.NotifyGeometryPathDrawingChanged();
        }
    }

    public void ResetForNewAttempt()
    {
        EndStroke(keepPen: false);
        if (characterMove != null)
        {
            _pen = characterMove.RobotGridPosition;
            _hasPen = true;
        }
        GeometryPathController.Instance?.ClearDrawPointerPreview();
    }

    void SyncPenToRobotIfEmpty(GeometryPathController geo)
    {
        if (_drawing) return;
        if (characterMove != null && characterMove.IsRobotBeingManipulated()) return;
        if (geo.HasStudentDrawing && _hasPen) return;
        if (!geo.HasStudentDrawing)
        {
            _pen = characterMove.RobotGridPosition;
            _hasPen = true;
        }
    }

    public void BindSceneIcons(GameObject pencilIcon, GameObject eraserIcon)
    {
        _pencilIcon = pencilIcon;
        _eraserIcon = eraserIcon;
        if (_pencilIcon != null) _pencilIconBaseScale = _pencilIcon.transform.localScale;
        if (_eraserIcon != null) _eraserIconBaseScale = _eraserIcon.transform.localScale;
        _pencilSprite = ReadSprite(_pencilIcon) ?? LoadSprite("DrawTools/pencil");
        _eraserSprite = ReadSprite(_eraserIcon) ?? LoadSprite("DrawTools/eraser");
        NeutralizePaletteBackground();
        WireIcon(_pencilIcon, eraser: false);
        WireIcon(_eraserIcon, eraser: true);
        ApplyIconSelection();
        GeometryPathController.Instance?.SetDrawToolSprites(_pencilSprite, _eraserSprite);
    }

    public void SetEraser(bool eraser)
    {
        _eraser = eraser;
        EndStroke(keepPen: true);
        ApplyIconSelection();
        if (EventSystem.current != null)
            EventSystem.current.SetSelectedGameObject(null);
        var geo = GeometryPathController.Instance;
        if (geo != null && geo.AllowStudentDrawing)
            ShowPreview(geo, null, drawing: false);
    }

    void ShowPreview(GeometryPathController geo, Vector2Int? hover, bool drawing, Vector2? screen = null, bool touch = false)
    {
        Vector2 aim = screen.HasValue ? AimPoint(screen.Value, touch) : AimPoint(_lastScreen, _lastTouch);
        Vector3? cursorWorld = null;
        if (characterMove != null && characterMove.TryScreenToGridWorld(aim, out Vector3 world))
            cursorWorld = world;
        else if (hover.HasValue)
            cursorWorld = characterMove != null ? characterMove.GridCellToWorld(hover.Value) : (Vector3?)null;
        geo.SetDrawPointerPreview(hover, _hasPen ? _pen : (Vector2Int?)null, drawing, _eraser, cursorWorld);
    }

    bool TrySelectIconAt(Vector2 screenPos)
    {
        if (!IsOverDrawIcon(screenPos, out bool erase)) return false;
        SetEraser(erase);
        return true;
    }

    bool IsOverDrawIcon(Vector2 screenPos, out bool erase)
    {
        erase = false;
        GameObject top = TopUiHit(screenPos);
        if (top == null) return false;
        if (BelongsToIcon(top, _eraserIcon))
        {
            erase = true;
            return true;
        }
        if (BelongsToIcon(top, _pencilIcon))
            return true;
        return false;
    }

    static GameObject TopUiHit(Vector2 screenPos)
    {
        if (EventSystem.current == null) return null;
        var ped = new PointerEventData(EventSystem.current) { position = screenPos };
        var results = new System.Collections.Generic.List<RaycastResult>();
        EventSystem.current.RaycastAll(ped, results);
        return results.Count > 0 ? results[0].gameObject : null;
    }

    static bool BelongsToIcon(GameObject hit, GameObject icon)
    {
        if (hit == null || icon == null) return false;
        return hit == icon || hit.transform.IsChildOf(icon.transform);
    }

    void WireIcon(GameObject go, bool eraser)
    {
        if (go == null) return;
        go.SetActive(true);
        var graphics = go.GetComponentsInChildren<Graphic>(true);
        for (int i = 0; i < graphics.Length; i++)
        {
            if (graphics[i] != null) graphics[i].raycastTarget = true;
        }
        var btn = go.GetComponent<Button>();
        if (btn == null) btn = go.GetComponentInChildren<Button>(true);
        if (btn == null)
        {
            var graphic = go.GetComponent<Graphic>();
            if (graphic == null) graphic = go.GetComponentInChildren<Graphic>(true);
            btn = go.AddComponent<Button>();
            if (graphic != null) btn.targetGraphic = graphic;
        }
        btn.onClick.RemoveAllListeners();
        bool erase = eraser;
        btn.onClick.AddListener(() => SetEraser(erase));
        btn.interactable = true;
        btn.enabled = true;
        btn.navigation = new Navigation { mode = Navigation.Mode.None };
        btn.transition = Selectable.Transition.None;
    }

    void NeutralizePaletteBackground()
    {
        Transform parent = null;
        if (_pencilIcon != null) parent = _pencilIcon.transform.parent;
        else if (_eraserIcon != null) parent = _eraserIcon.transform.parent;
        if (parent == null) return;

        var panelImg = parent.GetComponent<Image>();
        if (panelImg != null) panelImg.raycastTarget = false;

        for (int i = 0; i < parent.childCount; i++)
        {
            var child = parent.GetChild(i);
            if (child == null) continue;
            var childBtn = child.GetComponent<Button>();
            if (childBtn != null)
                childBtn.navigation = new Navigation { mode = Navigation.Mode.None };

            if (child.gameObject == _pencilIcon || child.gameObject == _eraserIcon)
                continue;
            if (!child.name.Equals("blue", System.StringComparison.OrdinalIgnoreCase))
                continue;

            if (childBtn != null)
            {
                childBtn.interactable = false;
                childBtn.enabled = false;
            }
            var graphics = child.GetComponentsInChildren<Graphic>(true);
            for (int g = 0; g < graphics.Length; g++)
                if (graphics[g] != null) graphics[g].raycastTarget = false;
        }
    }

    void ApplyIconSelection()
    {
        SetIconSelected(_pencilIcon, _pencilIconBaseScale, !_eraser);
        SetIconSelected(_eraserIcon, _eraserIconBaseScale, _eraser);
    }

    static void SetIconSelected(GameObject go, Vector3 baseScale, bool selected)
    {
        if (go == null) return;
        go.transform.localScale = baseScale * (selected ? 1.18f : 0.92f);
        var img = go.GetComponent<Image>();
        if (img == null) img = go.GetComponentInChildren<Image>(true);
        if (img != null)
            img.color = selected ? Color.white : new Color(1f, 1f, 1f, 0.55f);
    }

    Sprite CursorSprite()
    {
        GameObject assigned = null;
        if (characterMove != null)
            assigned = _eraser ? characterMove.drawPathEraserIcon : characterMove.drawPathPencilIcon;
        Sprite sprite = ReadSprite(assigned);
        if (sprite != null) return sprite;
        sprite = _eraser ? _eraserSprite : _pencilSprite;
        if (sprite != null) return sprite;
        sprite = ReadSprite(_eraser ? _eraserIcon : _pencilIcon);
        if (sprite != null) return sprite;
        return LoadSprite(_eraser ? "DrawTools/eraser" : "DrawTools/pencil");
    }

    static Sprite ReadSprite(GameObject go)
    {
        if (go == null) return null;
        var img = go.GetComponent<Image>();
        if (img == null) img = go.GetComponentInChildren<Image>(true);
        if (img != null && img.sprite != null) return img.sprite;
        var sr = go.GetComponent<SpriteRenderer>();
        if (sr == null) sr = go.GetComponentInChildren<SpriteRenderer>(true);
        return sr != null ? sr.sprite : null;
    }

    static Sprite LoadSprite(string resourcePath)
    {
        var sprite = Resources.Load<Sprite>(resourcePath);
        if (sprite != null) return sprite;
        var tex = Resources.Load<Texture2D>(resourcePath);
        if (tex == null) return null;
        return Sprite.Create(tex, new Rect(0f, 0f, tex.width, tex.height), new Vector2(0.5f, 0.5f), 100f);
    }

    void EndStroke(bool keepPen)
    {
        _drawing = false;
        _deferForRobot = false;
        _usingTouch = false;
        _strokeMoved = false;
        _pointerId = -1;
        if (!keepPen) _hasPen = false;
    }

    bool PickCell(Vector2 screenPos, bool touch, out Vector2Int cell)
    {
        cell = Vector2Int.zero;
        if (characterMove == null) return false;
        return characterMove.TryScreenToNearestGridCell(AimPoint(screenPos, touch), out cell);
    }

    Vector2 AimPoint(Vector2 screenPos, bool touch)
    {
        if (!touch || touchAimNudgePixels <= 0.01f) return screenPos;
        return new Vector2(screenPos.x, screenPos.y + touchAimNudgePixels);
    }

    void DriveScreenCursor()
    {
        if (characterMove == null)
        {
            HideScreenCursor(restoreOs: true);
            return;
        }
        var geo = GeometryPathController.Instance;
        bool canDraw = geo != null && geo.AllowStudentDrawing && !characterMove.IsBusyForGridInput;
        if (!canDraw)
        {
            HideScreenCursor(restoreOs: true);
            return;
        }

        if (!ReadPointer(out _, out bool held, out _, out Vector2 pos, out bool touch, out int pointerId))
        {
            HideScreenCursor(restoreOs: true);
            return;
        }

        // Never ride the pencil/eraser along while the kid is moving the robot.
        if (characterMove.IsRobotBeingManipulated())
        {
            HideScreenCursor(restoreOs: true);
            return;
        }

        bool overTool = IsOverDrawIcon(pos, out _);
        bool overUi = ignoreClicksOverUI && UiDragState.IsScreenPointOverBlockingUi(pos, pointerId);
        bool show = !overTool && !overUi && _drawing;
        if (!touch) show = !overTool && !overUi;
        if (touch) show = show && held;

        Vector2 cursorPos = AimPoint(pos, touch);
        UpdateScreenCursor(cursorPos, show, _drawing || (touch && held && show));
    }

    void UpdateScreenCursor(Vector2 screenPos, bool visible, bool drawing)
    {
        EnsureScreenCursor();
        if (_cursorCanvas == null) return;
        if (!visible)
        {
            HideScreenCursor(restoreOs: true);
            return;
        }

        _cursorCanvas.gameObject.SetActive(true);
        ShowOsCursor(false);

        Sprite sprite = CursorSprite();
        _cursorIcon.sprite = sprite;
        _cursorShadow.sprite = sprite;
        _cursorIcon.enabled = sprite != null;
        _cursorShadow.enabled = sprite != null;
        _cursorIcon.preserveAspect = true;
        _cursorShadow.preserveAspect = true;
        _cursorIcon.color = Color.white;
        _cursorShadow.color = new Color(0.05f, 0.08f, 0.16f, 0.28f);

        Vector2 tip = TipPivot();
        float size = _eraser ? 100f : 112f;
        if (drawing) size *= 0.92f;
        _cursorRt.pivot = new Vector2(0.5f, 0.5f);
        _cursorRt.sizeDelta = Vector2.zero;
        _cursorRt.position = screenPos;
        _cursorRt.localRotation = Quaternion.identity;
        _cursorRt.localScale = Vector3.one * (drawing ? 0.96f : 1f);

        LayoutCursorGraphic(_cursorShadow.rectTransform, tip, size);
        LayoutCursorGraphic(_cursorIcon.rectTransform, tip, size);
        _cursorShadow.rectTransform.anchoredPosition = new Vector2(6f, -7f);

        float pulse = drawing ? 1f : 0.82f + 0.08f * Mathf.Sin(Time.unscaledTime * 6.2f);
        float fill = (drawing ? 28f : 22f) * pulse;
        Color mark = _eraser
            ? new Color(1f, 0.48f, 0.68f, drawing ? 0.98f : 0.88f)
            : new Color(1f, 0.84f, 0.12f, drawing ? 1f : 0.92f);
        PlaceTipMark(_cursorTipRing, fill + 8f, new Color(1f, 1f, 1f, 0.95f));
        PlaceTipMark(_cursorTip, fill, mark);
        if (_cursorTipRing != null) _cursorTipRing.transform.SetAsLastSibling();
        if (_cursorTip != null) _cursorTip.transform.SetAsLastSibling();
    }

    void EnsureScreenCursor()
    {
        if (_cursorRt != null && _cursorTipRing == null)
            DestroyScreenCursor();
        if (_cursorRt != null) return;

        var canvasGo = new GameObject("DrawToolCursorCanvas");
        canvasGo.transform.SetParent(null, false);
        _cursorCanvas = canvasGo.AddComponent<Canvas>();
        _cursorCanvas.renderMode = RenderMode.ScreenSpaceOverlay;
        _cursorCanvas.sortingOrder = 32000;
        _cursorCanvas.pixelPerfect = false;
        var scaler = canvasGo.AddComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
        scaler.scaleFactor = 1f;

        var rootGo = new GameObject("Tool", typeof(RectTransform));
        rootGo.transform.SetParent(canvasGo.transform, false);
        _cursorRt = rootGo.GetComponent<RectTransform>();
        _cursorRt.anchorMin = _cursorRt.anchorMax = new Vector2(0.5f, 0.5f);
        _cursorRt.sizeDelta = new Vector2(138f, 138f);

        _cursorShadow = CreateCursorImage(rootGo.transform, "Shadow", stretch: false);
        _cursorShadow.color = new Color(0.05f, 0.08f, 0.16f, 0.32f);

        _cursorIcon = CreateCursorImage(rootGo.transform, "Icon", stretch: false);
        _cursorIcon.color = Color.white;

        _cursorTipRing = CreateCursorImage(rootGo.transform, "TipRing", stretch: false);
        _cursorTipRing.sprite = DotSprite();
        _cursorTipRing.color = Color.white;

        _cursorTip = CreateCursorImage(rootGo.transform, "Tip", stretch: false);
        _cursorTip.sprite = DotSprite();

        canvasGo.SetActive(false);
    }

    static Image CreateCursorImage(Transform parent, string name, bool stretch)
    {
        var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
        go.transform.SetParent(parent, false);
        var rt = go.GetComponent<RectTransform>();
        if (stretch)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }
        else
        {
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = Vector2.zero;
            rt.sizeDelta = new Vector2(112f, 112f);
        }
        var img = go.GetComponent<Image>();
        img.raycastTarget = false;
        img.preserveAspect = true;
        return img;
    }

    static void LayoutCursorGraphic(RectTransform rt, Vector2 tipPivot, float size)
    {
        if (rt == null) return;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = tipPivot;
        rt.anchoredPosition = Vector2.zero;
        rt.sizeDelta = new Vector2(size, size);
    }

    static void PlaceTipMark(Image img, float size, Color color)
    {
        if (img == null) return;
        img.enabled = true;
        img.sprite = DotSprite();
        img.color = color;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.5f);
        rt.pivot = new Vector2(0.5f, 0.5f);
        rt.anchoredPosition = Vector2.zero;
        rt.sizeDelta = new Vector2(size, size);
    }

    Vector2 TipPivot()
    {
        return _eraser ? new Vector2(0.22f, 0.20f) : new Vector2(0.13f, 0.18f);
    }

    void HideScreenCursor(bool restoreOs)
    {
        if (_cursorCanvas != null)
            _cursorCanvas.gameObject.SetActive(false);
        if (restoreOs) ShowOsCursor(true);
    }

    void DestroyScreenCursor()
    {
        if (_cursorCanvas != null)
        {
            Destroy(_cursorCanvas.gameObject);
            _cursorCanvas = null;
        }
        _cursorRt = null;
        _cursorIcon = null;
        _cursorShadow = null;
        _cursorTip = null;
        _cursorTipRing = null;
        ShowOsCursor(true);
    }

    void ShowOsCursor(bool show)
    {
        if (show)
        {
            if (_osCursorHidden)
            {
                Cursor.visible = true;
                _osCursorHidden = false;
            }
        }
        else if (!_osCursorHidden)
        {
            Cursor.visible = false;
            _osCursorHidden = true;
        }
    }

    static Sprite DotSprite()
    {
        if (_dotSprite != null) return _dotSprite;
        const int n = 48;
        var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
        tex.wrapMode = TextureWrapMode.Clamp;
        tex.filterMode = FilterMode.Bilinear;
        float c = (n - 1) * 0.5f;
        for (int y = 0; y < n; y++)
        {
            for (int x = 0; x < n; x++)
            {
                float d = Vector2.Distance(new Vector2(x, y), new Vector2(c, c)) / Mathf.Max(0.01f, c);
                float a = Mathf.Clamp01(1f - d);
                a = a * a * (d < 0.92f ? 1f : 0.35f);
                tex.SetPixel(x, y, new Color(1f, 1f, 1f, a));
            }
        }
        tex.Apply(false, false);
        _dotSprite = Sprite.Create(tex, new Rect(0f, 0f, n, n), new Vector2(0.5f, 0.5f), n);
        _dotSprite.name = "DrawToolTipDot";
        return _dotSprite;
    }

    static void DestroyLegacyOverlayToolbar()
    {
        var leftover = GameObject.Find("GeometryDrawTools");
        if (leftover != null) Destroy(leftover);
        var canvas = GameObject.Find("GeometryDrawToolsCanvas");
        if (canvas != null) Destroy(canvas);
    }

    static bool ReadPointer(out bool pressed, out bool held, out bool released, out Vector2 pos, out bool touch, out int pointerId)
    {
        pressed = false;
        held = false;
        released = false;
        pos = Vector2.zero;
        touch = false;
        pointerId = -1;

#if ENABLE_INPUT_SYSTEM && !ENABLE_LEGACY_INPUT_MANAGER
        var ts = UnityEngine.InputSystem.Touchscreen.current;
        if (ts != null && (ts.primaryTouch.press.isPressed || ts.primaryTouch.press.wasReleasedThisFrame))
        {
            pos = ts.primaryTouch.position.ReadValue();
            pressed = ts.primaryTouch.press.wasPressedThisFrame;
            held = ts.primaryTouch.press.isPressed;
            released = ts.primaryTouch.press.wasReleasedThisFrame;
            touch = true;
            pointerId = ts.primaryTouch.touchId.ReadValue();
            return pressed || held || released;
        }
        var mouse = UnityEngine.InputSystem.Mouse.current;
        if (mouse != null)
        {
            pos = mouse.position.ReadValue();
            pressed = mouse.leftButton.wasPressedThisFrame;
            held = mouse.leftButton.isPressed;
            released = mouse.leftButton.wasReleasedThisFrame;
            pointerId = -1;
            return true;
        }
        return false;
#else
        if (Input.touchCount > 0)
        {
            Touch t = Input.GetTouch(0);
            pos = t.position;
            pressed = t.phase == TouchPhase.Began;
            held = t.phase == TouchPhase.Moved || t.phase == TouchPhase.Stationary || t.phase == TouchPhase.Began;
            released = t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled;
            touch = true;
            pointerId = t.fingerId;
            return true;
        }

        pos = Input.mousePosition;
        pressed = Input.GetMouseButtonDown(0);
        held = Input.GetMouseButton(0);
        released = Input.GetMouseButtonUp(0);
        pointerId = -1;
        return true;
#endif
    }
}
