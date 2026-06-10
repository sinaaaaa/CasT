using UnityEngine;

/// <summary>
/// Marker component placed on the transient "make-room" block that
/// <see cref="ActionQueueDropZone"/> inserts into the action queue while the user is
/// dragging a new action block over it. The placeholder is animated (its width grows
/// from 0 to the target size) so the existing queued blocks slide aside smoothly.
///
/// <see cref="CharacterMove"/> uses this marker so the placeholder is never confused
/// with a real queued block — it is skipped when rebuilding the execution queue from
/// the UI, when destroying children after a successful run, and is cleaned up before
/// a Run starts.
/// </summary>
public class QueueInsertionPlaceholder : MonoBehaviour
{
}
