using System.IO;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Clears Bee / IL2CPP caches that cause "Data layout for script ... has changed".
/// </summary>
public static class WebGLBuildCacheUtility
{
    public static void ClearScriptAndPlayerCaches(bool log = true)
    {
        string projectRoot = Path.GetFullPath(Path.Combine(Application.dataPath, ".."));
        string libraryRoot = Path.Combine(projectRoot, "Library");

        string[] relativePaths =
        {
            "Bee",
            Path.Combine("PlayerDataCache", "WebGL"),
            Path.Combine("BuildPlayerData", "WebGL"),
            Path.Combine("Il2cppBuildCache", "WebGL"),
            Path.Combine("Il2cppBuildCache", "WebGLSupport"),
        };

        foreach (string relative in relativePaths)
        {
            DeleteIfExists(Path.Combine(libraryRoot, relative), log);
        }

        AssetDatabase.Refresh();
        if (log)
            Debug.Log("[WebGLBuildCacheUtility] Cleared WebGL script/player build caches.");
    }

    private static void DeleteIfExists(string path, bool log)
    {
        if (!Directory.Exists(path) && !File.Exists(path))
            return;

        if (log)
            Debug.Log("[WebGLBuildCacheUtility] Deleting " + path);

        FileUtil.DeleteFileOrDirectory(path);
        var meta = path + ".meta";
        if (File.Exists(meta))
            FileUtil.DeleteFileOrDirectory(meta);
    }

    [MenuItem("SPARC/Clear WebGL Build Cache")]
    public static void ClearFromMenu()
    {
        ClearScriptAndPlayerCaches(log: true);
        EditorUtility.DisplayDialog(
            "WebGL cache cleared",
            "Bee / WebGL player caches were cleared.\n\n" +
            "Now use SPARC → Build WebGL (Clean Export) or File → Build Settings → Build.",
            "OK");
    }

    [MenuItem("SPARC/Build WebGL (Clean Export)")]
    public static void BuildCleanFromMenu()
    {
        WebGLBuildScript.BuildFromEditor();
    }
}
