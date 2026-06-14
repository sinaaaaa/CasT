using UnityEngine;

/// <summary>
/// Drag this object in the Scene view to move the whole game grid.
/// Place it at the center of the playfield (Grid Auto Center On Origin on CharacterMove).
/// </summary>
[ExecuteAlways]
[DisallowMultipleComponent]
public class GridOriginAnchor : MonoBehaviour
{
    [Tooltip("CharacterMove that owns the grid. Auto-found if empty.")]
    public CharacterMove characterMove;

    [Header("Scene gizmo")]
    public Color gizmoColor = new Color(0.2f, 0.95f, 0.35f, 0.9f);
    [Min(0.1f)] public float gizmoSize = 1.5f;

    private void Reset()
    {
        if (characterMove == null)
            characterMove = FindObjectOfType<CharacterMove>();
    }

    private void OnEnable()
    {
        if (characterMove == null)
            characterMove = FindObjectOfType<CharacterMove>();
        SyncToCharacterMove();
    }

    private void Update()
    {
        if (characterMove == null) return;
        if (characterMove.gridOriginTransform != transform)
            characterMove.AssignGridOriginTransform(transform);
        characterMove.SyncGridOriginCache();
    }

    private void SyncToCharacterMove()
    {
        if (characterMove == null) return;
        characterMove.AssignGridOriginTransform(transform);
        characterMove.drawGridGizmos = true;
    }

    private void OnDrawGizmos()
    {
        Gizmos.color = gizmoColor;
        Gizmos.DrawWireSphere(transform.position, gizmoSize * 0.35f);
        Gizmos.DrawLine(transform.position, transform.position + Vector3.right * gizmoSize);
        Gizmos.DrawLine(transform.position, transform.position + Vector3.forward * gizmoSize);
#if UNITY_EDITOR
        UnityEditor.Handles.Label(transform.position + Vector3.up * 0.5f, "Playfield center\nDrag to move grid");
#endif
    }
}
