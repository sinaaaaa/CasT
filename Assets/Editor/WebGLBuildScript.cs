using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

/// <summary>
/// Batch-mode WebGL export for the student play page (platform/public/unity).
/// Run: scripts/publish-webgl.ps1
/// </summary>
public static class WebGLBuildScript
{
    private static readonly string[] ScenePaths =
    {
        "Assets/MainMenu.unity",
        "Assets/LoadingScene.unity",
        "Assets/level1.unity",
    };

    public static void Build()
    {
        var outputDir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "platform", "public", "unity"));
        if (!Directory.Exists(outputDir))
            Directory.CreateDirectory(outputDir);

        var options = new BuildPlayerOptions
        {
            scenes = ScenePaths,
            locationPathName = outputDir,
            target = BuildTarget.WebGL,
            options = BuildOptions.None,
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);
        if (report.summary.result != BuildResult.Succeeded)
        {
            Debug.LogError("[WebGLBuildScript] Build failed: " + report.summary.result);
            EditorApplication.Exit(1);
            return;
        }

        InjectStudentConfigBridge(outputDir);
        Debug.Log("[WebGLBuildScript] Build succeeded: " + outputDir);
        EditorApplication.Exit(0);
    }

    /// <summary>
    /// Ensures iframe + query-string session config works after Unity overwrites index.html.
    /// </summary>
    private static void InjectStudentConfigBridge(string outputDir)
    {
        var indexPath = Path.Combine(outputDir, "index.html");
        if (!File.Exists(indexPath))
            return;

        const string marker = "StudentGameConfig bridge";
        var html = File.ReadAllText(indexPath);
        if (html.Contains(marker))
            return;

        const string snippet =
            "<script>/* StudentGameConfig bridge */" +
            "try{if(window.parent&&window.parent.StudentGameConfig&&!window.StudentGameConfig)" +
            "window.StudentGameConfig=window.parent.StudentGameConfig;}catch(e){}</script>";

        if (html.Contains("</head>"))
            html = html.Replace("</head>", snippet + "</head>");
        else
            html = snippet + html;

        File.WriteAllText(indexPath, html);
    }
}
