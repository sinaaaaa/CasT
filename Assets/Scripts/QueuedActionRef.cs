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
}
