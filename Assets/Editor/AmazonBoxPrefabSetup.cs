#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;

/// <summary>
/// Ensures amazon-box grid prefab exists and can be assigned to CharacterMove.
/// Menu: SPARC / Wire Amazon Box Prefab on CharacterMove
/// </summary>
public static class AmazonBoxPrefabSetup
{
    private const string PrefabPath = "Assets/Prefabs/GridObjects/amazon-box.prefab";
    private const string SpritePath = "Assets/Image/amazon-box.png";

    [MenuItem("SPARC/Wire Amazon Box Prefab on CharacterMove")]
    public static void WireCharacterMove()
    {
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
        if (prefab == null)
        {
            Debug.LogError($"[AmazonBox] Missing prefab at {PrefabPath}. Reimport the project or run SPARC / Recreate Amazon Box Prefab.");
            return;
        }

        var cm = Object.FindObjectOfType<CharacterMove>();
        if (cm == null)
        {
            Debug.LogWarning("[AmazonBox] No CharacterMove in the open scene. Assign manually: amazonBoxPrefab → amazon-box prefab.");
            Selection.activeObject = prefab;
            return;
        }

        Undo.RecordObject(cm, "Assign amazon box prefab");
        cm.amazonBoxPrefab = prefab;
        EditorUtility.SetDirty(cm);
        Debug.Log("[AmazonBox] Assigned amazonBoxPrefab on CharacterMove in the current scene.");
    }

    [MenuItem("SPARC/Recreate Amazon Box Prefab")]
    public static void RecreatePrefab()
    {
        var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(SpritePath);
        if (sprite == null)
            sprite = AssetDatabase.LoadAssetAtPath<Sprite>("Assets/Image/package.png");

        var go = new GameObject("amazon-box");
        var sr = go.AddComponent<SpriteRenderer>();
        sr.sprite = sprite;
        go.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
        go.transform.localScale = Vector3.one * 8f;
        var col = go.AddComponent<BoxCollider>();
        col.size = new Vector3(12.26f, 6.89f, 0.2f);

        System.IO.Directory.CreateDirectory("Assets/Prefabs/GridObjects");
        PrefabUtility.SaveAsPrefabAsset(go, PrefabPath);
        Object.DestroyImmediate(go);
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        Debug.Log($"[AmazonBox] Saved prefab to {PrefabPath}");
    }
}
#endif
