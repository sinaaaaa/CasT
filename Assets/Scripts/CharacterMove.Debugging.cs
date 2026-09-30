using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

/// <summary>
/// Debugging-item rules: which edits students may make, one shared edit budget across
/// arrows / Repeat / Command Bags / Action Chunks, a run budget, a minimum program size
/// and "fix, don't rebuild" protection. Execution itself is untouched.
/// </summary>
public partial class CharacterMove
{
    DebuggingEditTracker _debugEdits;
    /// <summary>Program structure when a strip block was picked up (the block leaves the strip while dragged).</summary>
    List<string> _debugDragBefore;
    bool _debugKeepProgramOnReset;
    RectTransform _debugHud;
    TextMeshProUGUI _debugHudText;
    Image _debugHudBg;
    Coroutine _debugHudPulse;
    readonly HashSet<Button> _debugLockedButtons = new HashSet<Button>();

    bool DebugGating => _debugEdits != null;
    public bool DebugRunsExhausted => _debugEdits != null && _debugEdits.RunBudgetExhausted;
    bool DebugKeepsProgramOnRetry => _debugEdits != null && _debugEdits.Config.HasEditBudget;

    /// <summary>Drop-on-a-tile replacement is only offered when the teacher saved rules that allow it.</summary>
    public bool DebugReplaceDropEnabled =>
        _debugEdits != null && _debugEdits.Config.configured &&
        _debugEdits.Config.Allows(DebugEditKind.Replace) && !isProcessing;

    public static bool IsReplaceableTarget(QueuedActionRef r) =>
        r != null && r.deletable && !r.isRepeatStart && !r.isRepeatEnd && !r.isCountAnswer &&
        r.GetComponent<QueueInsertionPlaceholder>() == null;

    static string MacroType(DraggableCommandBagBlock source) =>
        source != null && source.dragKind == DraggableCommandBagBlock.DragKind.Chunk
            ? DebugItemType.ActionChunk
            : DebugItemType.CommandBag;

    // ---------------- Level lifecycle ----------------

    void InitDebuggingForLevel(LevelData level)
    {
        _debugDragBefore = null;
        _debugKeepProgramOnReset = false;
        _debugEdits = level?.debuggingConfig != null
            ? new DebuggingEditTracker(level.debuggingConfig, _telemetryInitialStructure)
            : null;
        DebugRefreshUi();
    }

    void FillDebuggingTelemetry(GameAssessmentClient.AssessmentExtrasPayload extras)
    {
        if (extras == null || _debugEdits == null) return;
        extras.debuggingHasTelemetry = true;
        extras.debuggingEditsUsed = _debugEdits.EditsUsed;
        extras.debuggingEditBudget = _debugEdits.Config.editBudget;
        extras.debuggingRunsUsed = _debugEdits.RunsUsed;
        extras.debuggingRunBudget = _debugEdits.Config.runBudget;
        extras.debuggingEditLog = _debugEdits.EditLog;
        extras.debuggingBlocked = _debugEdits.BlockedLog;
    }

    List<string> DebugTakeKeptProgram()
    {
        if (!_debugKeepProgramOnReset) return null;
        _debugKeepProgramOnReset = false;
        return CollectProgramStructureFromUI();
    }

    void DebugReseedProgram(LevelData level, List<string> program)
    {
        if (program == null || program.Count == 0)
        {
            ClearActionQueueVisual();
            return;
        }
        var starter = level.guidedActions;
        level.guidedActions = program;
        try { SeedGuidedProgramQueue(level); }
        finally { level.guidedActions = starter; }
    }

    // ---------------- Gate helpers ----------------

    string DebugLockReason(string itemType)
    {
        var c = _debugEdits.Config;
        if (!c.Editable(itemType)) return DebuggingEditTracker.ReasonTypeLocked;
        if (_debugEdits.BudgetExhausted) return DebuggingEditTracker.ReasonBudget;
        return DebuggingEditTracker.ReasonNotAllowed;
    }

    void DebugRefuse(string kind, string itemType, string reason)
    {
        if (_debugEdits == null) return;
        _debugEdits.Blocked(kind, itemType, reason);
        string msg = _debugEdits.MessageFor(kind, itemType, reason);
        var c = _debugEdits.Config;
        if (kind == DebugEditKind.Add && reason == DebuggingEditTracker.ReasonNotAllowed &&
            c.configured && c.Allows(DebugEditKind.Replace) && c.Editable(itemType) &&
            itemType != DebugItemType.Repeat)
            msg = "You can't add new blocks in this puzzle. Drop onto a block to swap it instead.";
        if (chatGPTResponseText != null) chatGPTResponseText.text = msg;
        PulseDebugHud();
        Debug.Log($"[CharacterMove] Debugging rules refused {kind} ({itemType}): {reason}");
    }

    bool DebugGate(string kind, string itemType)
    {
        if (!DebugGating) return true;
        if (_debugEdits.CanEdit(kind, itemType, out string reason)) return true;
        DebugRefuse(kind, itemType, reason);
        return false;
    }

    void DebugCommit(string kind, string itemType, List<string> before)
    {
        if (!DebugGating || before == null) return;
        if (_debugEdits.Commit(kind, itemType, before, CollectProgramStructureFromUI()))
            DebugRefreshUi();
    }

    // ---------------- Add ----------------

    /// <summary>
    /// Inserts a user-added action block at <paramref name="uiIndex"/> in the action queue.
    /// Used by <see cref="ActionQueueDropZone.OnDrop"/> when the user drops a dragged block
    /// between existing blocks. Falls back to appending if the index is out of range.
    /// </summary>
    public void InsertActionFromDrag(DraggableActionBlock.ActionKind kind, int uiIndex)
    {
        if (!DebugGating || !CanDragPaletteBlockToQueue(kind) || IsBagOnlyProgramMode())
        {
            InsertActionFromDragCore(kind, uiIndex);
            return;
        }
        string type = DebugItemType.OfKind(kind);
        if (!DebugGate(DebugEditKind.Add, type)) return;
        var before = CollectProgramStructureFromUI();
        InsertActionFromDragCore(kind, uiIndex);
        DebugCommit(DebugEditKind.Add, type, before);
    }

    /// <summary>
    /// Insert a grouped ProgramBagInstance into the yellow strip.
    /// Source card in the blue panel is never moved — this always creates a NEW GameObject.
    /// </summary>
    public void InsertCommandBagMacroFromDrag(DraggableCommandBagBlock source, int uiIndex)
    {
        if (!DebugGating || source == null || actionQueueTransform == null || IsActionQueueLocked())
        {
            InsertCommandBagMacroFromDragCore(source, uiIndex);
            return;
        }
        string type = MacroType(source);
        if (!DebugGate(DebugEditKind.Add, type)) return;
        var before = CollectProgramStructureFromUI();
        InsertCommandBagMacroFromDragCore(source, uiIndex);
        DebugCommit(DebugEditKind.Add, type, before);
    }

    // ---------------- Remove ----------------

    /// <summary>
    /// Removes a program item (arrow, Repeat pair, Command Bag or Chunk) from the yellow strip.
    /// </summary>
    /// <returns>False when nothing was removed (locked block or refused by the debugging rules).</returns>
    public bool RemoveQueuedBlock(GameObject blockGo)
    {
        if (blockGo == null) return false;
        var refComp = blockGo.GetComponent<QueuedActionRef>();
        if (refComp != null && !refComp.deletable) return false;
        if (!DebugGating || refComp == null || actionQueueTransform == null)
        {
            RemoveQueuedBlockCore(blockGo);
            return true;
        }

        string type = DebugItemType.OfRef(refComp);
        if (!DebugGate(DebugEditKind.Remove, type)) return false;

        bool detached = blockGo.transform.parent != actionQueueTransform;
        List<string> before = detached && _debugDragBefore != null
            ? new List<string>(_debugDragBefore)
            : CollectProgramStructureFromUI();

        var remaining = CollectProgramItemsInStripOrder();
        remaining.Remove(refComp);
        if (refComp.isRepeatStart || refComp.isRepeatEnd)
        {
            var partner = FindRepeatPartner(blockGo, refComp);
            if (partner != null) remaining.Remove(partner.GetComponent<QueuedActionRef>());
        }
        if (!_debugEdits.CheckShrink(before, StructureTokensOfItems(remaining), true, out string reason))
        {
            DebugRefuse(DebugEditKind.Remove, type, reason);
            return false;
        }

        RemoveQueuedBlockCore(blockGo);
        DebugCommit(DebugEditKind.Remove, type, before);
        return true;
    }

    /// <summary>Paired Repeat boundary, also while <paramref name="blockGo"/> is being dragged outside the strip.</summary>
    GameObject FindRepeatPartner(GameObject blockGo, QueuedActionRef refComp)
    {
        if (blockGo == null || refComp == null || actionQueueTransform == null) return null;
        bool wantStart = refComp.isRepeatEnd;
        if (blockGo.transform.parent == actionQueueTransform)
            return FindPairedRepeatBlock(blockGo, wantStart);

        var drag = blockGo.GetComponent<DraggableQueuedBlock>();
        if (drag == null) return null;
        int origin = drag.OriginalSiblingIndex;
        int count = actionQueueTransform.childCount;
        if (wantStart)
        {
            for (int i = Mathf.Min(origin, count) - 1; i >= 0; i--)
            {
                var r = actionQueueTransform.GetChild(i).GetComponent<QueuedActionRef>();
                if (r != null && r.isRepeatStart) return r.gameObject;
                if (r != null && r.isRepeatEnd) break;
            }
        }
        else
        {
            for (int i = Mathf.Max(0, origin); i < count; i++)
            {
                var r = actionQueueTransform.GetChild(i).GetComponent<QueuedActionRef>();
                if (r != null && r.isRepeatEnd) return r.gameObject;
                if (r != null && r.isRepeatStart) break;
            }
        }
        return null;
    }

    // ---------------- Reorder (drag within the strip) ----------------

    /// <summary>Whether a strip block may be picked up (to move it, or to drag it out to delete).</summary>
    public bool DebugCanLift(QueuedActionRef r)
    {
        if (!DebugGating) return true;
        var c = _debugEdits.Config;
        string type = DebugItemType.OfRef(r);
        if (!c.Editable(type) || _debugEdits.BudgetExhausted) return false;
        return c.Allows(DebugEditKind.Reorder) || (dragOutQueuedToDelete && c.Allows(DebugEditKind.Remove));
    }

    public void DebugNotifyLiftRefused(QueuedActionRef r)
    {
        if (!DebugGating || isProcessing || DebugCanLift(r)) return;
        string type = DebugItemType.OfRef(r);
        DebugRefuse(DebugEditKind.Reorder, type, DebugLockReason(type));
    }

    /// <summary>Called right before a strip block is lifted out of the strip.</summary>
    public void DebugBeginQueuedDrag()
    {
        _debugDragBefore = DebugGating ? CollectProgramStructureFromUI() : null;
    }

    /// <summary>
    /// Called after a lifted block was dropped back into the strip. Returns false when the move
    /// must be undone. Dropping it where it was costs nothing.
    /// </summary>
    public bool DebugApproveReorder(QueuedActionRef r)
    {
        if (!DebugGating || _debugDragBefore == null) return true;
        var before = _debugDragBefore;
        _debugDragBefore = null;
        var after = CollectProgramStructureFromUI();
        if (DebuggingProgramMath.SameProgram(DebuggingProgramMath.NormalizeAll(before), DebuggingProgramMath.NormalizeAll(after)))
            return true;

        string type = DebugItemType.OfRef(r);
        if (!_debugEdits.CanEdit(DebugEditKind.Reorder, type, out string reason))
        {
            DebugRefuse(DebugEditKind.Reorder, type, reason);
            return false;
        }
        _debugEdits.Commit(DebugEditKind.Reorder, type, before, after);
        DebugRefreshUi();
        return true;
    }

    // ---------------- Replace (drop onto the middle of a strip block) ----------------

    public void TryReplaceQueuedBlock(GameObject target, DraggableActionBlock.ActionKind kind)
    {
        if (kind == DraggableActionBlock.ActionKind.Repeat)
        {
            if (chatGPTResponseText != null)
                chatGPTResponseText.text = "Drop Repeat between blocks, not on top of one.";
            return;
        }
        if (!CanDragPaletteBlockToQueue(kind) || IsBagOnlyProgramMode()) return;
        BuildActionForKind(kind, out _, out _, out string label);
        ReplaceQueuedBlock(target, label, DebugItemType.Arrows, idx => InsertActionFromDragCore(kind, idx));
    }

    public void TryReplaceQueuedBlockWithMacro(GameObject target, DraggableCommandBagBlock source)
    {
        if (source == null || IsActionQueueLocked()) return;
        string token = source.ResolveDropToken();
        if (string.IsNullOrEmpty(token)) return;
        if (source.dragKind == DraggableCommandBagBlock.DragKind.Chunk &&
            CommandBagUtil.FindChunk(GetCurrentLevelData(), source.chunkId) == null)
            return;
        ReplaceQueuedBlock(target, token, MacroType(source), idx => InsertCommandBagMacroFromDragCore(source, idx));
    }

    void ReplaceQueuedBlock(GameObject target, string newToken, string newType, System.Action<int> insertAt)
    {
        if (!DebugGating || target == null || actionQueueTransform == null || isProcessing) return;
        var tRef = target.GetComponent<QueuedActionRef>();
        if (!IsReplaceableTarget(tRef) || target.transform.parent != actionQueueTransform) return;

        string oldType = DebugItemType.OfRef(tRef);
        if (!_debugEdits.CanEdit(DebugEditKind.Replace, oldType, out string reason))
        {
            DebugRefuse(DebugEditKind.Replace, oldType, reason);
            return;
        }
        if (newType != oldType && !_debugEdits.CanEdit(DebugEditKind.Replace, newType, out reason))
        {
            DebugRefuse(DebugEditKind.Replace, newType, reason);
            return;
        }

        var items = CollectProgramItemsInStripOrder();
        var before = StructureTokensOfItems(items);
        int itemIndex = items.IndexOf(tRef);
        if (itemIndex >= 0 && before.Count == items.Count)
        {
            if (DebuggingProgramMath.Normalize(before[itemIndex]) == DebuggingProgramMath.Normalize(newToken))
            {
                PlayBlockDropBounce(target.transform);
                return;
            }
            var predicted = new List<string>(before);
            predicted[itemIndex] = newToken;
            if (!_debugEdits.CheckShrink(before, predicted, false, out reason))
            {
                DebugRefuse(DebugEditKind.Replace, oldType, reason);
                return;
            }
        }

        int siblingIndex = target.transform.GetSiblingIndex();
        if (_chunkPeekAnchor == target)
            HideChunkPeekPanelImmediate();
        target.transform.SetParent(null, false);
        Destroy(target);
        insertAt(siblingIndex);

        playerActions.Add("replace");
        currentAttemptActionLog.Add(new PlayerActionLogEntry { action = "replace", timestamp = Time.time });
        DebugCommit(DebugEditKind.Replace, oldType, before);
    }

    // ---------------- Repeat count ----------------

    public bool DebugApproveRepeatCount(QueuedActionRef endRef)
    {
        if (!DebugGating || endRef == null) return true;
        if (_debugEdits.CanEditRepeat(endRef.GetInstanceID(), out string reason)) return true;
        DebugRefuse(DebugEditKind.EditRepeat, DebugItemType.Repeat, reason);
        return false;
    }

    public bool DebugRepeatCountLocked(QueuedActionRef endRef) =>
        DebugGating && endRef != null && !_debugEdits.CanEditRepeat(endRef.GetInstanceID(), out _);

    public void DebugCommitRepeatCount(QueuedActionRef endRef, int from, int to)
    {
        if (!DebugGating || endRef == null || from == to) return;
        var start = FindPairedRepeatBlock(endRef.gameObject, wantStart: true);
        int pos = 0;
        if (start != null)
            pos = CollectProgramItemsInStripOrder().IndexOf(start.GetComponent<QueuedActionRef>()) + 1;
        _debugEdits.CommitRepeatEdit(endRef.GetInstanceID(), from, to, pos);
        DebugRefreshUi();
    }

    // ---------------- Palette sources ----------------

    bool DebugPaletteSourceLocked(string itemType, bool addOnly)
    {
        if (_debugEdits == null) return false;
        var c = _debugEdits.Config;
        if (!c.Editable(itemType) || _debugEdits.BudgetExhausted) return true;
        bool canReplace = !addOnly && c.configured && c.Allows(DebugEditKind.Replace);
        return !c.Allows(DebugEditKind.Add) && !canReplace;
    }

    public bool DebugMacroSourceLocked(bool isChunk) =>
        DebugPaletteSourceLocked(isChunk ? DebugItemType.ActionChunk : DebugItemType.CommandBag, addOnly: false);

    /// <summary>Bag / Chunk card drag start. Shows why when the rules lock it.</summary>
    public bool DebugTryBeginMacroDrag(bool isChunk)
    {
        if (!DebugMacroSourceLocked(isChunk)) return true;
        string type = isChunk ? DebugItemType.ActionChunk : DebugItemType.CommandBag;
        DebugRefuse(DebugEditKind.Add, type, DebugLockReason(type));
        return false;
    }

    /// <summary>A greyed-out palette arrow / Repeat was dragged: explain when the debugging rules are the reason.</summary>
    public void DebugNotifyPaletteLocked(DraggableActionBlock.ActionKind kind)
    {
        string type = DebugItemType.OfKind(kind);
        bool addOnly = kind == DraggableActionBlock.ActionKind.Repeat;
        if (!DebugGating || !DebugPaletteSourceLocked(type, addOnly)) return;
        DebugRefuse(DebugEditKind.Add, type, DebugLockReason(type));
    }

    void ApplyDebuggingPaletteLocks()
    {
        LockPaletteButton(moveForwardButton, DebugItemType.Arrows, false);
        LockPaletteButton(moveDownButton, DebugItemType.Arrows, false);
        LockPaletteButton(rotateLeftButton, DebugItemType.Arrows, false);
        LockPaletteButton(rotateRightButton, DebugItemType.Arrows, false);
        LockPaletteButton(repeatButton, DebugItemType.Repeat, true);
    }

    void LockPaletteButton(Button btn, string itemType, bool addOnly)
    {
        if (btn == null) return;
        if (DebugPaletteSourceLocked(itemType, addOnly))
        {
            if (btn.interactable)
            {
                btn.interactable = false;
                _debugLockedButtons.Add(btn);
            }
        }
        else if (_debugLockedButtons.Remove(btn))
        {
            btn.interactable = true;
        }
    }

    // ---------------- Run budget ----------------

    bool DebugTryConsumeRun()
    {
        if (_debugEdits == null) return true;
        if (_debugEdits.RunBudgetExhausted)
        {
            DebugRefuse("run", "", DebuggingEditTracker.ReasonRunBudget);
            return false;
        }
        _debugEdits.RecordRun();
        DebugRefreshUi();
        return true;
    }

    // ---------------- Visuals ----------------

    void DebugRefreshUi()
    {
        RefreshDebugHud();
        ApplyDebuggingPaletteLocks();
        RefreshDebugCloseButtons();
    }

    void RefreshDebugCloseButtons()
    {
        if (actionQueueTransform == null) return;
        for (int i = 0; i < actionQueueTransform.childCount; i++)
        {
            var child = actionQueueTransform.GetChild(i);
            var r = child.GetComponent<QueuedActionRef>();
            if (r == null) continue;
            var close = child.Find("CloseButton");
            if (close == null) continue;
            bool dim = _debugEdits != null &&
                       (!_debugEdits.Config.Allows(DebugEditKind.Remove) ||
                        !_debugEdits.Config.Editable(DebugItemType.OfRef(r)) ||
                        _debugEdits.BudgetExhausted);
            var cg = close.GetComponent<CanvasGroup>();
            if (cg == null)
            {
                if (!dim) continue;
                cg = close.gameObject.AddComponent<CanvasGroup>();
            }
            cg.alpha = dim ? 0.3f : 1f;
        }
    }

    void RefreshDebugHud()
    {
        bool show = _debugEdits != null && _debugEdits.HasAnyBudget;
        if (!show)
        {
            if (_debugHud != null) _debugHud.gameObject.SetActive(false);
            return;
        }
        EnsureDebugHud();
        if (_debugHud == null) return;
        _debugHud.gameObject.SetActive(true);
        _debugHud.SetAsLastSibling();

        string text = _debugEdits.HudText();
        _debugHudText.text = text;
        Vector2 pref = _debugHudText.GetPreferredValues(text);
        _debugHud.sizeDelta = new Vector2(pref.x + 32f, 34f);
        bool outOfBudget = _debugEdits.BudgetExhausted || _debugEdits.RunBudgetExhausted;
        _debugHudBg.color = outOfBudget
            ? new Color(0.78f, 0.22f, 0.2f, 0.95f)
            : new Color(0.16f, 0.2f, 0.36f, 0.92f);
    }

    void EnsureDebugHud()
    {
        if (_debugHud != null) return;
        RectTransform host = dropZonePanel != null ? dropZonePanel : actionQueueTransform as RectTransform;
        if (host == null) return;

        var go = new GameObject("DebuggingBudgetHud", typeof(RectTransform), typeof(Image), typeof(LayoutElement));
        go.transform.SetParent(host, false);
        go.GetComponent<LayoutElement>().ignoreLayout = true;
        _debugHud = go.GetComponent<RectTransform>();
        _debugHud.anchorMin = new Vector2(1f, 1f);
        _debugHud.anchorMax = new Vector2(1f, 1f);
        _debugHud.pivot = new Vector2(1f, 0f);
        _debugHud.anchoredPosition = new Vector2(-12f, 6f);

        _debugHudBg = go.GetComponent<Image>();
        _debugHudBg.sprite = RepeatQueueVisualizer.GetRoundedSprite();
        _debugHudBg.type = Image.Type.Sliced;
        _debugHudBg.raycastTarget = false;

        var textGo = new GameObject("Text", typeof(RectTransform), typeof(TextMeshProUGUI));
        textGo.transform.SetParent(go.transform, false);
        var trt = textGo.GetComponent<RectTransform>();
        trt.anchorMin = Vector2.zero;
        trt.anchorMax = Vector2.one;
        trt.offsetMin = new Vector2(14f, 2f);
        trt.offsetMax = new Vector2(-14f, -2f);
        _debugHudText = textGo.GetComponent<TextMeshProUGUI>();
        _debugHudText.fontSize = 18f;
        _debugHudText.fontStyle = FontStyles.Bold;
        _debugHudText.alignment = TextAlignmentOptions.Center;
        _debugHudText.color = Color.white;
        _debugHudText.enableWordWrapping = false;
        _debugHudText.raycastTarget = false;
    }

    void PulseDebugHud()
    {
        if (_debugHud == null || !_debugHud.gameObject.activeInHierarchy) return;
        if (_debugHudPulse != null) StopCoroutine(_debugHudPulse);
        _debugHudPulse = StartCoroutine(DebugHudPulseRoutine());
    }

    IEnumerator DebugHudPulseRoutine()
    {
        const float duration = 0.28f;
        float elapsed = 0f;
        while (elapsed < duration && _debugHud != null)
        {
            elapsed += Time.unscaledDeltaTime;
            float u = Mathf.Clamp01(elapsed / duration);
            _debugHud.localScale = Vector3.one * (1f + Mathf.Sin(u * Mathf.PI) * 0.12f);
            yield return null;
        }
        if (_debugHud != null) _debugHud.localScale = Vector3.one;
        _debugHudPulse = null;
    }
}
