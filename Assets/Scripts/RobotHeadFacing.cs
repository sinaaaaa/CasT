using UnityEngine;

/// <summary>
/// Fixes head direction when the Animator overrides rotation.
/// Add to the robot root, assign the head bone/mesh transform, then adjust Yaw/Pitch in Play mode.
/// Runs in LateUpdate so it applies after the animation.
/// </summary>
[DefaultExecutionOrder(200)]
public class RobotHeadFacing : MonoBehaviour
{
    [Header("References")]
    [Tooltip("Head bone or separate head mesh (e.g. mixamorig:Head, Head, or a child mesh).")]
    public Transform headBone;

    [Header("Rotation correction (degrees)")]
    [Tooltip("Turn head left/right.")]
    [Range(-180f, 180f)]
    public float headYawOffset;

    [Tooltip("Nod up/down.")]
    [Range(-60f, 60f)]
    public float headPitchOffset;

    [Tooltip("Tilt sideways.")]
    [Range(-45f, 45f)]
    public float headRollOffset;

    [Header("Behavior")]
    [Tooltip("On: multiply animator pose × offset (keeps walk animation, fixes facing). Off: fixed pose from captured base.")]
    public bool applyOnTopOfAnimation = true;

    [Tooltip("Disable Animator in Edit mode while tuning (so the slider is not overwritten).")]
    public bool pauseAnimatorInEditMode = true;

    private Quaternion _capturedBaseLocal = Quaternion.identity;
    private bool _hasCapturedBase;
    private Animator _animator;

    private void Awake()
    {
        _animator = GetComponent<Animator>() ?? GetComponentInChildren<Animator>();
        CaptureHeadBaseRotation();
    }

    private void OnValidate()
    {
        if (headBone != null && !_hasCapturedBase)
            CaptureHeadBaseRotation();
    }

#if UNITY_EDITOR
    private void OnDisable()
    {
        if (_animator != null)
            _animator.enabled = true;
    }
#endif

    [ContextMenu("Capture Head Base Rotation (from current pose)")]
    public void CaptureHeadBaseRotation()
    {
        if (headBone == null) return;
        _capturedBaseLocal = headBone.localRotation;
        _hasCapturedBase = true;
        Debug.Log($"[RobotHeadFacing] Captured base local rotation on '{headBone.name}'.");
    }

    [ContextMenu("Auto-Find Head Bone")]
    public void AutoFindHeadBone()
    {
        string[] names = { "Head", "head", "mixamorig:Head", "RobotHead", "Neck" };
        foreach (var t in GetComponentsInChildren<Transform>(true))
        {
            foreach (string n in names)
            {
                if (t.name.IndexOf(n, System.StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    headBone = t;
                    CaptureHeadBaseRotation();
                    Debug.Log($"[RobotHeadFacing] Assigned head bone: {t.name}");
                    return;
                }
            }
        }
        Debug.LogWarning("[RobotHeadFacing] No head bone found. Assign Head manually in the hierarchy.");
    }

    private void LateUpdate()
    {
        if (headBone == null) return;

#if UNITY_EDITOR
        if (!Application.isPlaying && pauseAnimatorInEditMode && _animator != null)
            _animator.enabled = false;
#endif

        Quaternion offset = Quaternion.Euler(headPitchOffset, headYawOffset, headRollOffset);

        if (applyOnTopOfAnimation)
            headBone.localRotation = headBone.localRotation * offset;
        else
        {
            if (!_hasCapturedBase)
                CaptureHeadBaseRotation();
            headBone.localRotation = _capturedBaseLocal * offset;
        }
    }

#if UNITY_EDITOR
    private void OnDrawGizmosSelected()
    {
        if (headBone == null) return;
        Gizmos.color = Color.cyan;
        Gizmos.DrawRay(headBone.position, headBone.forward * 0.8f);
    }
#endif
}
