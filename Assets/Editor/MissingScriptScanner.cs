#if UNITY_EDITOR
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Scans the open scene + every prefab in /Assets for components whose script
/// reference is missing. Missing scripts on a serialized component are the
/// #1 source of:
///   "ArgumentNullException: Value cannot be null. Parameter name: _unity_self"
/// that fires sporadically from the Inspector's UIElements binding updater.
///
/// Menu: Tools/Find Missing Scripts (Scene + Prefabs)
/// </summary>
public static class MissingScriptScanner
{
    [MenuItem("Tools/Find Missing Scripts (Scene + Prefabs)")]
    public static void Scan()
    {
        int totalGameObjects = 0;
        int totalMissing = 0;
        var report = new List<string>();

        // 1. Active scene
        Scene scene = SceneManager.GetActiveScene();
        var roots = scene.GetRootGameObjects();
        foreach (var root in roots)
        {
            ScanGameObjectTree(root, ref totalGameObjects, ref totalMissing, report,
                               $"[Scene '{scene.name}']");
        }

        // 2. Every prefab asset under Assets/
        string[] prefabGuids = AssetDatabase.FindAssets("t:Prefab");
        foreach (var guid in prefabGuids)
        {
            string path = AssetDatabase.GUIDToAssetPath(guid);
            GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null) continue;
            ScanGameObjectTree(prefab, ref totalGameObjects, ref totalMissing, report,
                               $"[Prefab '{path}']");
        }

        Debug.Log($"<b>[MissingScriptScanner]</b> Scanned {totalGameObjects} GameObjects. " +
                  $"Found <b>{totalMissing}</b> missing-script slots.");
        if (totalMissing == 0)
        {
            Debug.Log("[MissingScriptScanner] No missing scripts detected. " +
                      "If the _unity_self error persists, the cause is something else " +
                      "(likely a custom Editor or PropertyDrawer in this project).");
            EditorUtility.DisplayDialog("Missing Script Scanner",
                "No missing scripts found in the open scene or in any prefab.\n\n" +
                "If you're still seeing the _unity_self error, the cause is " +
                "likely a custom Editor / PropertyDrawer rather than scene data.",
                "OK");
            return;
        }

        foreach (var line in report) Debug.LogWarning(line);
        EditorUtility.DisplayDialog("Missing Script Scanner",
            $"Found {totalMissing} missing scripts in the scene and prefabs.\n\n" +
            "Open the Console to see the full list. Select each GameObject, " +
            "right-click the missing component header, and choose Remove Component " +
            "to permanently fix it.", "OK");
    }

    [MenuItem("Tools/Remove ALL Missing Scripts in Open Scene")]
    public static void RemoveAllMissingInScene()
    {
        if (!EditorUtility.DisplayDialog(
                "Remove missing scripts?",
                "This will remove every \"Missing (Mono Script)\" component from every " +
                "GameObject in the currently open scene. The scene will be marked dirty.\n\n" +
                "Continue?",
                "Remove", "Cancel"))
            return;

        Scene scene = SceneManager.GetActiveScene();
        int removed = 0;
        foreach (var root in scene.GetRootGameObjects())
            removed += RemoveMissingRecursive(root);

        EditorSceneManager.MarkSceneDirty(scene);
        Debug.Log($"[MissingScriptScanner] Removed {removed} missing-script components " +
                  $"from scene '{scene.name}'.");
        EditorUtility.DisplayDialog("Missing Script Scanner",
            $"Removed {removed} missing-script components from the open scene.\n\n" +
            "Save the scene to persist the change (Ctrl+S).", "OK");
    }

    private static int RemoveMissingRecursive(GameObject go)
    {
        int count = GameObjectUtility.RemoveMonoBehavioursWithMissingScript(go);
        foreach (Transform child in go.transform)
            count += RemoveMissingRecursive(child.gameObject);
        return count;
    }

    private static void ScanGameObjectTree(GameObject go,
                                           ref int totalGameObjects,
                                           ref int totalMissing,
                                           List<string> report,
                                           string contextLabel)
    {
        totalGameObjects++;
        var comps = go.GetComponents<Component>();
        int missingHere = 0;
        for (int i = 0; i < comps.Length; i++)
        {
            if (comps[i] == null) missingHere++;
        }
        if (missingHere > 0)
        {
            totalMissing += missingHere;
            report.Add($"{contextLabel} \"{GetHierarchyPath(go)}\" - " +
                       $"{missingHere} missing script(s).");
        }
        foreach (Transform child in go.transform)
            ScanGameObjectTree(child.gameObject, ref totalGameObjects, ref totalMissing,
                               report, contextLabel);
    }

    private static string GetHierarchyPath(GameObject go)
    {
        if (go == null) return "<null>";
        string path = go.name;
        Transform t = go.transform.parent;
        while (t != null) { path = t.name + "/" + path; t = t.parent; }
        return path;
    }
}
#endif
