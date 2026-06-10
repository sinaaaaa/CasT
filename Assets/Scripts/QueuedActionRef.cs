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
    [System.NonSerialized] public string actionLabel; // "forward"/"backward"/"left"/"right"/"blank"
}
