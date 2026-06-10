#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

/// <summary>
/// Wires GridObjects/*.prefab assets onto CharacterMove fields (e.g. outlet).
/// Menu: SPARC → Assign Grid Object Prefabs on CharacterMove
/// </summary>
public static class AssignGridObjectPrefabs
{
    private const string PrefabFolder = "Assets/Prefabs/GridObjects";

    [MenuItem("SPARC/Assign Grid Object Prefabs on CharacterMove")]
    public static void Assign()
    {
        var move = Object.FindObjectOfType<CharacterMove>();
        if (move == null)
        {
            Debug.LogError("[AssignGridObjectPrefabs] No CharacterMove in the open scene.");
            return;
        }

        var so = new SerializedObject(move);
        int assigned = 0;

        TryAssign(so, "outletPrefab", "outlet", ref assigned);
        TryAssign(so, "mailPrefab", "mail", ref assigned);
        TryAssign(so, "amazonBoxPrefab", "amazon-box", ref assigned);
        TryAssign(so, "blackCrayonPrefab", "crayon", ref assigned);
        TryAssignIfNull(so, "blackCrayonPrefab", "black-crayon", ref assigned);
        TryAssign(so, "crayonsPrefab", "crayon-box", ref assigned);
        TryAssignIfNull(so, "crayonsPrefab", "crayons", ref assigned);

        so.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(move);
        Debug.Log($"[AssignGridObjectPrefabs] Assigned {assigned} prefab(s) on '{move.gameObject.name}'. Save the scene.");
    }

    private static void TryAssign(SerializedObject so, string fieldName, string prefabName, ref int count)
    {
        var prop = so.FindProperty(fieldName);
        if (prop == null)
        {
            Debug.LogWarning($"[AssignGridObjectPrefabs] Field '{fieldName}' not found on CharacterMove.");
            return;
        }

        string path = $"{PrefabFolder}/{prefabName}.prefab";
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (prefab == null)
        {
            Debug.LogWarning($"[AssignGridObjectPrefabs] Missing prefab at {path}");
            return;
        }

        prop.objectReferenceValue = prefab;
        count++;
        Debug.Log($"[AssignGridObjectPrefabs] {fieldName} ← {path}");
    }

    private static void TryAssignIfNull(SerializedObject so, string fieldName, string prefabName, ref int count)
    {
        var prop = so.FindProperty(fieldName);
        if (prop == null || prop.objectReferenceValue != null) return;
        TryAssign(so, fieldName, prefabName, ref count);
    }
}
#endif
