using UnityEngine;

namespace MAST
{
    namespace Component
    {
        /// <summary>
        /// Must exist in player builds too. Prefabs serialize this component; wrapping the
        /// whole class in UNITY_EDITOR caused WebGL "serialization layout" warnings
        /// (Read 32 bytes but expected 208 bytes) and unstable loads on iPad.
        /// </summary>
        [ExecuteInEditMode]
        public class MASTPrefabSettings : MonoBehaviour
        {
            [Space(5)]
            [Header("Placement Settings")]

            [Tooltip("Allow this Prefab to be placed inside other Prefabs?")]
            public bool allowOverlap = true;
            [Tooltip("Offset relative to position on grid")]
            public Vector3 offsetPosition = new Vector3(0.0f, 0.0f, 0.0f);
            [Tooltip("Degrees to rotate each time.  Set to zero for no rotation")]
            public Vector3 rotationStep = new Vector3(0f, 90f, 0f);
            [Tooltip("Stretch Prefab when painting an area?")]
            public bool paintAreaStretch = false;

            [Space(5)]
            [Header("Raycast Settings")]
            [Tooltip("Raycast Options")]
            public MAST.DataClass.PlacementRaycast placementRaycast;

            [Space(5)]
            [Header("Randomizer Settings")]
            [Tooltip("Randomizer Options")]
            public MAST.DataClass.Randomizer randomizer;

            [Space(5)]
            [Header("Other Settings")]

            [Space(10)]
            [Tooltip("Include prefab when merging models?")]
            public bool includeInMerge = true;
        }
    }
}
