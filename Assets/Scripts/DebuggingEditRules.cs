using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>Platform <c>debuggingConfig</c> as sent in the level JSON (Newtonsoft).</summary>
[Serializable]
public class DebuggingConfigDto
{
    /// <summary>add | remove | replace | reorder | editRepeat. Null = all.</summary>
    public string[] allowedEdits;
    /// <summary>arrows | repeat | commandBag | actionChunk. Null = all.</summary>
    public string[] editableItemTypes;
    /// <summary>Max committed program modifications per attempt (restarts on Reset / Try Again). Null = unlimited.</summary>
    public int? editBudget;
    /// <summary>Max RUN presses for the whole item. Null = unlimited.</summary>
    public int? runBudget;
    public int? minProgramItems;
    public bool? preserveProgramStructure;
}

public static class DebugEditKind
{
    public const string Add = "add";
    public const string Remove = "remove";
    public const string Replace = "replace";
    public const string Reorder = "reorder";
    public const string EditRepeat = "editRepeat";

    public static readonly string[] All = { Add, Remove, Replace, Reorder, EditRepeat };
}

public static class DebugItemType
{
    public const string Arrows = "arrows";
    public const string Repeat = "repeat";
    public const string CommandBag = "commandBag";
    public const string ActionChunk = "actionChunk";

    public static readonly string[] All = { Arrows, Repeat, CommandBag, ActionChunk };

    public static string OfToken(string token)
    {
        if (string.IsNullOrEmpty(token)) return Arrows;
        string t = token.Trim();
        if (CommandBagUtil.IsBagToken(t, out _)) return CommandBag;
        if (CommandBagUtil.IsChunkToken(t, out _)) return ActionChunk;
        if (ProgramSequenceUtil.IsRepeatStartToken(t, out _) || ProgramSequenceUtil.IsRepeatEndToken(t)) return Repeat;
        return Arrows;
    }

    public static string OfRef(QueuedActionRef r)
    {
        if (r == null) return Arrows;
        if (r.isCommandChunk) return ActionChunk;
        if (r.isCommandBag) return CommandBag;
        if (r.isRepeatStart || r.isRepeatEnd) return Repeat;
        return Arrows;
    }

    public static string OfKind(DraggableActionBlock.ActionKind kind) =>
        kind == DraggableActionBlock.ActionKind.Repeat ? Repeat : Arrows;

    public static string StudentLabel(string type)
    {
        switch (type)
        {
            case Repeat: return "Repeat";
            case CommandBag: return "Command Bag";
            case ActionChunk: return "Action Chunk";
            default: return "Arrow";
        }
    }
}

/// <summary>Resolved debugging rules for one level. Arrays missing in JSON mean "everything allowed".</summary>
public class DebuggingConfigData
{
    public readonly HashSet<string> allowedEdits = new HashSet<string>(DebugEditKind.All);
    public readonly HashSet<string> editableItemTypes = new HashSet<string>(DebugItemType.All);
    /// <summary>0 = unlimited.</summary>
    public int editBudget;
    /// <summary>0 = unlimited.</summary>
    public int runBudget;
    public int minProgramItems;
    public bool preserveProgramStructure;
    /// <summary>False when the teacher never saved debugging rules (edits are still logged for evidence).</summary>
    public bool configured;

    public bool Allows(string kind) => allowedEdits.Contains(kind);
    public bool Editable(string type) => editableItemTypes.Contains(type);
    public bool HasEditBudget => editBudget > 0;
    public bool HasRunBudget => runBudget > 0;

    public static DebuggingConfigData FromDto(DebuggingConfigDto dto)
    {
        var data = new DebuggingConfigData();
        if (dto == null) return data;
        data.configured = true;
        if (dto.allowedEdits != null)
        {
            data.allowedEdits.Clear();
            foreach (var k in dto.allowedEdits)
                if (Array.IndexOf(DebugEditKind.All, k) >= 0) data.allowedEdits.Add(k);
        }
        if (dto.editableItemTypes != null)
        {
            data.editableItemTypes.Clear();
            foreach (var t in dto.editableItemTypes)
                if (Array.IndexOf(DebugItemType.All, t) >= 0) data.editableItemTypes.Add(t);
        }
        data.editBudget = Mathf.Max(0, dto.editBudget ?? 0);
        data.runBudget = Mathf.Max(0, dto.runBudget ?? 0);
        data.minProgramItems = Mathf.Max(0, dto.minProgramItems ?? 0);
        data.preserveProgramStructure = dto.preserveProgramStructure ?? false;
        return data;
    }
}

/// <summary>Token helpers shared by the tracker and CharacterMove.</summary>
public static class DebuggingProgramMath
{
    public static string Normalize(string token)
    {
        if (string.IsNullOrEmpty(token)) return "";
        string t = token.Trim();
        string lower = t.ToLowerInvariant();
        if (lower == "left") return "turn left";
        if (lower == "right") return "turn right";
        if (lower == "forward" || lower == "backward" || lower == "turn left" || lower == "turn right" || lower == "repeat-end")
            return lower;
        if (ProgramSequenceUtil.IsRepeatStartToken(t, out int n)) return ProgramSequenceUtil.FormatRepeatStart(n);
        return t;
    }

    public static List<string> NormalizeAll(IList<string> tokens)
    {
        var list = new List<string>(tokens != null ? tokens.Count : 0);
        if (tokens == null) return list;
        for (int i = 0; i < tokens.Count; i++)
        {
            string n = Normalize(tokens[i]);
            if (!string.IsNullOrEmpty(n) && n != "blank") list.Add(n);
        }
        return list;
    }

    /// <summary>Items as students see them: a Repeat pair counts once.</summary>
    public static int CountItems(IList<string> tokens)
    {
        int n = 0;
        if (tokens == null) return 0;
        for (int i = 0; i < tokens.Count; i++)
            if (!ProgramSequenceUtil.IsRepeatEndToken(tokens[i])) n++;
        return n;
    }

    static List<string> ItemsOnly(IList<string> tokens)
    {
        var list = new List<string>();
        if (tokens == null) return list;
        for (int i = 0; i < tokens.Count; i++)
            if (!ProgramSequenceUtil.IsRepeatEndToken(tokens[i])) list.Add(tokens[i]);
        return list;
    }

    /// <summary>Length of the longest common subsequence of program items (Repeat End markers ignored).</summary>
    public static int StarterItemsKept(IList<string> starter, IList<string> program)
    {
        var a = ItemsOnly(starter);
        var b = ItemsOnly(program);
        if (a.Count == 0 || b.Count == 0) return 0;
        var prev = new int[b.Count + 1];
        var cur = new int[b.Count + 1];
        for (int i = 1; i <= a.Count; i++)
        {
            for (int j = 1; j <= b.Count; j++)
                cur[j] = a[i - 1] == b[j - 1] ? prev[j - 1] + 1 : Mathf.Max(prev[j], cur[j - 1]);
            var tmp = prev; prev = cur; cur = tmp;
            Array.Clear(cur, 0, cur.Length);
        }
        return prev[b.Count];
    }

    /// <summary>Starter items that must survive when preserveProgramStructure is on (platform: ceil(n / 2)).</summary>
    public static int PreservedStarterItemCount(int starterItems) =>
        starterItems <= 0 ? 0 : (starterItems + 1) / 2;

    public static bool SameProgram(IList<string> a, IList<string> b)
    {
        if (a == null || b == null) return a == b;
        if (a.Count != b.Count) return false;
        for (int i = 0; i < a.Count; i++)
            if (a[i] != b[i]) return false;
        return true;
    }
}

/// <summary>
/// One shared edit budget + run budget per debugging item. An edit is one committed
/// add / remove / replace / reorder / Repeat-count change that actually changes the program.
/// The edit budget restarts whenever the starter program is restored (Reset / Try Again);
/// the run budget covers the whole item.
/// </summary>
public class DebuggingEditTracker
{
    public const string ReasonNotAllowed = "notAllowed";
    public const string ReasonTypeLocked = "typeLocked";
    public const string ReasonBudget = "budget";
    public const string ReasonMinItems = "minItems";
    public const string ReasonPreserve = "preserve";
    public const string ReasonRunBudget = "runBudget";

    const int MaxBlockedEntries = 80;

    class Edit
    {
        public int run;
        public string kind;
        public string itemType;
        public string detail;
        public int repeatKey;
        public int repeatFrom;
        public int repeatPos;
    }

    public readonly DebuggingConfigData Config;
    public readonly List<string> Starter;
    readonly List<Edit> _edits = new List<Edit>();
    readonly List<string> _blocked = new List<string>();

    public int RunsUsed { get; private set; }
    public int EditsUsed => _edits.Count;
    public int EditsLeft => Config.HasEditBudget ? Mathf.Max(0, Config.editBudget - EditsUsed) : int.MaxValue;
    public bool BudgetExhausted => Config.HasEditBudget && EditsUsed >= Config.editBudget;
    public bool RunBudgetExhausted => Config.HasRunBudget && RunsUsed >= Config.runBudget;
    public bool HasAnyBudget => Config.HasEditBudget || Config.HasRunBudget;
    /// <summary>Edits made since the start of the item are tagged with the RUN they lead into.</summary>
    int CurrentRunTag => RunsUsed + 1;

    public DebuggingEditTracker(DebuggingConfigData config, IList<string> starterStructure)
    {
        Config = config ?? new DebuggingConfigData();
        Starter = DebuggingProgramMath.NormalizeAll(starterStructure);
    }

    // ---------------- Gates ----------------

    /// <summary>Kind allowed, type editable, budget left. Does not log — callers log refusals the student actually tried.</summary>
    public bool CanEdit(string kind, string itemType, out string reason)
    {
        if (!Config.Allows(kind)) { reason = ReasonNotAllowed; return false; }
        if (!Config.Editable(itemType)) { reason = ReasonTypeLocked; return false; }
        if (BudgetExhausted) { reason = ReasonBudget; return false; }
        reason = null;
        return true;
    }

    /// <summary>Repeat count changes on the same Repeat merge into one edit, so they stay allowed at budget 0.</summary>
    public bool CanEditRepeat(int repeatKey, out string reason)
    {
        if (!Config.Allows(DebugEditKind.EditRepeat)) { reason = ReasonNotAllowed; return false; }
        if (!Config.Editable(DebugItemType.Repeat)) { reason = ReasonTypeLocked; return false; }
        if (BudgetExhausted && !CanMergeRepeat(repeatKey)) { reason = ReasonBudget; return false; }
        reason = null;
        return true;
    }

    /// <summary>minProgramItems + preserveProgramStructure checks for a removal or replacement.</summary>
    public bool CheckShrink(IList<string> before, IList<string> predictedAfter, bool isRemoval, out string reason)
    {
        var b = DebuggingProgramMath.NormalizeAll(before);
        var a = DebuggingProgramMath.NormalizeAll(predictedAfter);
        if (isRemoval && Config.minProgramItems > 0 &&
            DebuggingProgramMath.CountItems(a) < Config.minProgramItems)
        {
            reason = ReasonMinItems;
            return false;
        }
        if (Config.preserveProgramStructure && Starter.Count > 0)
        {
            int required = DebuggingProgramMath.PreservedStarterItemCount(DebuggingProgramMath.CountItems(Starter));
            int keptAfter = DebuggingProgramMath.StarterItemsKept(Starter, a);
            int keptBefore = DebuggingProgramMath.StarterItemsKept(Starter, b);
            if (keptAfter < required && keptAfter < keptBefore)
            {
                reason = ReasonPreserve;
                return false;
            }
        }
        reason = null;
        return true;
    }

    // ---------------- Commits ----------------

    /// <summary>Records one edit when <paramref name="after"/> differs from <paramref name="before"/>. Returns true if counted.</summary>
    public bool Commit(string kind, string itemType, IList<string> before, IList<string> after)
    {
        var b = DebuggingProgramMath.NormalizeAll(before);
        var a = DebuggingProgramMath.NormalizeAll(after);
        if (DebuggingProgramMath.SameProgram(a, b)) return false;
        _edits.Add(new Edit
        {
            run = CurrentRunTag,
            kind = kind,
            itemType = itemType,
            detail = DeriveDetail(kind, b, a),
        });
        return true;
    }

    /// <summary>
    /// Repeat count change. Consecutive changes on the same Repeat (before the next RUN) merge
    /// into one edit; returning to the original count refunds it.
    /// </summary>
    public void CommitRepeatEdit(int repeatKey, int from, int to, int position)
    {
        if (from == to) return;
        var last = _edits.Count > 0 ? _edits[_edits.Count - 1] : null;
        if (CanMergeRepeat(repeatKey))
        {
            if (to == last.repeatFrom)
                _edits.RemoveAt(_edits.Count - 1);
            else
                last.detail = $"{last.repeatFrom}>{to}@{last.repeatPos}";
            return;
        }
        _edits.Add(new Edit
        {
            run = CurrentRunTag,
            kind = DebugEditKind.EditRepeat,
            itemType = DebugItemType.Repeat,
            detail = $"{from}>{to}@{position}",
            repeatKey = repeatKey,
            repeatFrom = from,
            repeatPos = position,
        });
    }

    bool CanMergeRepeat(int repeatKey)
    {
        if (_edits.Count == 0) return false;
        var last = _edits[_edits.Count - 1];
        return last.kind == DebugEditKind.EditRepeat && last.repeatKey == repeatKey && last.run == CurrentRunTag;
    }

    public void Blocked(string kind, string itemType, string reason)
    {
        if (_blocked.Count >= MaxBlockedEntries) return;
        _blocked.Add($"{CurrentRunTag}|{kind}|{itemType ?? ""}|{reason}");
    }

    public void RecordRun() => RunsUsed++;

    /// <summary>Starter restored: edits (and refusals) start over for the new attempt.</summary>
    public void RestartEdits()
    {
        _edits.Clear();
        _blocked.Clear();
    }

    public string[] EditLog
    {
        get
        {
            var arr = new string[_edits.Count];
            for (int i = 0; i < _edits.Count; i++)
                arr[i] = $"{_edits[i].run}|{_edits[i].kind}|{_edits[i].itemType}|{_edits[i].detail}";
            return arr;
        }
    }

    public string[] BlockedLog => _blocked.ToArray();

    // ---------------- Student-facing text ----------------

    public string HudText()
    {
        var parts = new List<string>(2);
        if (Config.HasEditBudget)
            parts.Add($"Edits left: {EditsLeft} of {Config.editBudget}");
        if (Config.HasRunBudget)
            parts.Add($"Runs left: {Mathf.Max(0, Config.runBudget - RunsUsed)} of {Config.runBudget}");
        return string.Join("   \u00B7   ", parts);
    }

    public string MessageFor(string kind, string itemType, string reason)
    {
        switch (reason)
        {
            case ReasonNotAllowed:
                switch (kind)
                {
                    case DebugEditKind.Add: return "You can't add new blocks in this puzzle. Fix the blocks that are already there.";
                    case DebugEditKind.Remove: return "You can't remove blocks in this puzzle.";
                    case DebugEditKind.Replace: return "You can't swap blocks in this puzzle.";
                    case DebugEditKind.Reorder: return "You can't move blocks around in this puzzle.";
                    case DebugEditKind.EditRepeat: return "You can't change Repeat counts in this puzzle.";
                }
                return "That change isn't allowed in this puzzle.";
            case ReasonTypeLocked:
                return $"{DebugItemType.StudentLabel(itemType)} blocks are locked in this puzzle.";
            case ReasonBudget:
                return RunBudgetExhausted
                    ? $"You've used all {Config.editBudget} edits."
                    : $"You've used all {Config.editBudget} edits. Press RUN to test your fix, or Reset to start over.";
            case ReasonMinItems:
                return $"Keep at least {Config.minProgramItems} blocks in the program.";
            case ReasonPreserve:
                return "Fix the program you were given. Don't delete most of it and start over.";
            case ReasonRunBudget:
                return $"You've used all {Config.runBudget} runs.";
        }
        return "That change isn't allowed right now.";
    }

    // ---------------- Detail strings (1-based strip positions) ----------------

    static string DeriveDetail(string kind, List<string> b, List<string> a)
    {
        int first = 0;
        int max = Mathf.Min(b.Count, a.Count);
        while (first < max && b[first] == a[first]) first++;

        switch (kind)
        {
            case DebugEditKind.Add:
                return first < a.Count ? $"{a[first]}@{first + 1}" : "";
            case DebugEditKind.Remove:
                return first < b.Count ? $"{b[first]}@{first + 1}" : "";
            case DebugEditKind.Replace:
                if (first < b.Count && first < a.Count)
                    return $"{b[first]}>{a[first]}@{first + 1}";
                return "";
            case DebugEditKind.Reorder:
            {
                int last = b.Count - 1;
                while (last > first && last < a.Count && b[last] == a[last]) last--;
                if (first >= b.Count || last >= a.Count) return "";
                // Moved right: the item at `first` now sits at `last`; otherwise it moved left.
                if (b[first] == a[last])
                    return $"{b[first]}@{first + 1}>{last + 1}";
                return $"{a[first]}@{last + 1}>{first + 1}";
            }
        }
        return "";
    }
}
