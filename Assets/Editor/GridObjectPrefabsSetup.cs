#if UNITY_EDITOR
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Creates grid object prefabs under Assets/Prefabs/GridObjects/ and wires them on CharacterMove.
/// </summary>
public static class GridObjectPrefabsSetup
{
    private const string PrefabFolder = "Assets/Prefabs/GridObjects";

    private static readonly (string objectType, string spritePath, string fieldName)[] Definitions =
    {
        ("mail", "Assets/Image/mail.png", "mailPrefab"),
        ("amazon-box", "Assets/Image/amazon-box.png", "amazonBoxPrefab"),
        ("package", "Assets/Image/package.png", "packagePrefab"),
        ("post", "Assets/Image/post.png", "postPrefab"),
        ("pencil", "Assets/Image/pencil.png", "pencilPrefab"),
        ("glue", "Assets/Image/glue.png", "gluePrefab"),
        ("home", "Assets/Image/home.png", "homePrefab"),
        ("school", "Assets/Image/school.png", "schoolPrefab"),
        ("tree", "Assets/Image/tree.png", "treePrefab"),
    };

    [MenuItem("SPARC/Grid Objects/Recreate Mail Prefab")]
    public static void RecreateMailPrefab() => RecreatePrefab("mail", "Assets/Image/mail.png");

    [MenuItem("SPARC/Grid Objects/Wire Mail Prefab on CharacterMove")]
    public static void WireMail() => WireOne("mail", "mailPrefab");

    [MenuItem("SPARC/Grid Objects/Wire All Grid Prefabs on CharacterMove")]
    public static void WireAll()
    {
        int wired = 0;
        foreach (var def in Definitions)
        {
            if (WireOne(def.objectType, def.fieldName, quiet: true)) wired++;
        }
        Debug.Log($"[GridObjectPrefabs] Wired {wired} prefab field(s) on CharacterMove.");
    }

    [MenuItem("SPARC/Grid Objects/Recreate All Missing Grid Prefabs")]
    public static void RecreateAll()
    {
        foreach (var def in Definitions)
            RecreatePrefab(def.objectType, def.spritePath);
        Debug.Log("[GridObjectPrefabs] Recreated prefabs in Assets/Prefabs/GridObjects/");
    }

    private static bool WireOne(string objectType, string fieldName, bool quiet = false)
    {
        string path = $"{PrefabFolder}/{objectType}.prefab";
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (prefab == null)
        {
            if (!quiet) Debug.LogError($"[GridObjectPrefabs] Missing {path}. Run SPARC → Grid Objects → Recreate Mail Prefab (or Recreate All).");
            return false;
        }

        var cm = Object.FindObjectOfType<CharacterMove>();
        if (cm == null)
        {
            if (!quiet) Debug.LogWarning("[GridObjectPrefabs] No CharacterMove in scene. Open your game scene first.");
            Selection.activeObject = prefab;
            return false;
        }

        var so = new SerializedObject(cm);
        var prop = so.FindProperty(fieldName);
        if (prop == null)
        {
            if (!quiet) Debug.LogError($"[GridObjectPrefabs] CharacterMove has no field '{fieldName}'.");
            return false;
        }

        Undo.RecordObject(cm, $"Assign {fieldName}");
        prop.objectReferenceValue = prefab;
        so.ApplyModifiedProperties();
        EditorUtility.SetDirty(cm);
        if (!quiet) Debug.Log($"[GridObjectPrefabs] Assigned {fieldName} ← {path}");
        return true;
    }

    public static void RecreatePrefab(string objectType, string spritePath)
    {
        var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(spritePath);
        if (sprite == null)
        {
            Debug.LogError($"[GridObjectPrefabs] Sprite not found: {spritePath}");
            return;
        }

        var go = new GameObject(objectType);
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = sprite;
        go.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
        go.transform.localScale = Vector3.one * 8f;
        var col = go.AddComponent<BoxCollider>();
        var bounds = sprite.bounds.size;
        col.size = new Vector3(
            Mathf.Max(bounds.x, 0.5f),
            Mathf.Max(bounds.y, 0.5f),
            0.2f);

        System.IO.Directory.CreateDirectory(PrefabFolder);
        string path = $"{PrefabFolder}/{objectType}.prefab";
        PrefabUtility.SaveAsPrefabAsset(go, path);
        Object.DestroyImmediate(go);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log($"[GridObjectPrefabs] Saved {path}");
    }
}
#endif
