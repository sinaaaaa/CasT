using System.Collections.Generic;
using UnityEngine;
using CharacterActions;

/// <summary>
/// Tag component attached to each block instantiated in the action queue UI.
/// It links the UI GameObject to the underlying <see cref="CharacterAction"/> and
/// records whether the user is allowed to delete the block (close button) or
/// reorder it. Used so the queue can be rebuilt deterministically from the UI
/// after inserts and deletes.
/// </summary>
public class QueuedActionRef : MonoBehaviour
{
    [System.NonSerialized] public CharacterAction action;
    [System.NonSerialized] public bool deletable;
    [System.NonSerialized] public string actionLabel; // "forward"/"backward"/"left"/"right"/"blank"/"repeat:N"/"repeat-end"
    [System.NonSerialized] public bool isRepeatStart;
    [System.NonSerialized] public bool isRepeatEnd;
    [System.NonSerialized] public int repeatCount = 1;
    /// <summary>True for COUNT_ANSWER yellow-strip counter block.</summary>
    [System.NonSerialized] public bool isCountAnswer;
    [System.NonSerialized] public int countValue;
    /// <summary>True when this block replaced a Canvas BLANKS dash slot — closing it restores the dash.</summary>
    [System.NonSerialized] public bool fillsCanvasBlankSlot;

    /// <summary>Grouped Command Bag macro (actionLabel = bag:id). One ProgramBagInstance in the yellow strip.</summary>
    [System.NonSerialized] public bool isCommandBag;
    /// <summary>Grouped Chunk macro (actionLabel = chunk:id).</summary>
    [System.NonSerialized] public bool isCommandChunk;
    [System.NonSerialized] public string commandBagId;
    [System.NonSerialized] public string commandChunkId;
    [System.NonSerialized] public string displayTitle;
    /// <summary>Unique id for this dropped instance (not the template bag id).</summary>
    [System.NonSerialized] public string instanceId;
    /// <summary>
    /// Snapshot of motion/repeat tokens for this bag/chunk at drop time.
    /// RUN uses this ordered list so execution does not depend on re-looking-up bag data.
    /// </summary>
    [System.NonSerialized] public List<string> macroTokens;
    /// <summary>Platform / inspector icon for chunk chips (replaces number badge).</summary>
    [System.NonSerialized] public Sprite macroIconSprite;
    [System.NonSerialized] public string macroIconUrl;

    public bool IsCommandMacro => isCommandBag || isCommandChunk;
    public bool CanRemove => deletable;
    public bool CanReorder => deletable;

    /// <summary>
    /// Resolve this visible yellow-strip item to primitive/repeat tokens.
    /// A simple arrow returns one token; a Command Bag returns every stored token.
    /// </summary>
    public List<string> GetExecutableTokens(LevelData level)
    {
        var tokens = new List<string>();

        if (IsCommandMacro)
        {
            if (macroTokens != null && macroTokens.Count > 0)
            {
                tokens.AddRange(macroTokens);
                return tokens;
            }

            string macro = actionLabel;
            if (string.IsNullOrEmpty(macro))
            {
                if (isCommandBag && !string.IsNullOrEmpty(commandBagId))
                    macro = CommandBagUtil.FormatBagToken(commandBagId);
                else if (isCommandChunk && !string.IsNullOrEmpty(commandChunkId))
                    macro = CommandBagUtil.FormatChunkToken(commandChunkId);
            }

            if (!string.IsNullOrEmpty(macro))
                return CommandBagUtil.ResolveProgramTokens(new List<string> { macro }, level);

            return tokens;
        }

        if (isRepeatStart)
            tokens.Add(ProgramSequenceUtil.FormatRepeatStart(repeatCount));
        else if (isRepeatEnd)
            tokens.Add("repeat-end");
        else if (isCountAnswer)
            tokens.Add(ProgramSequenceUtil.FormatCountToken(countValue));
        else if (!string.IsNullOrEmpty(actionLabel))
            tokens.Add(actionLabel);

        return tokens;
    }
}
