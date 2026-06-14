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

    public static void BuildFromEditor()
    {
        Build(exitWhenDone: false);
    }

    public static void Build()
    {
        Build(exitWhenDone: true);
    }

    private static void Build(bool exitWhenDone)
    {
        WebGLBuildCacheUtility.ClearScriptAndPlayerCaches(log: true);

        var outputDir = Path.GetFullPath(Path.Combine(Application.dataPath, "..", "platform", "public", "unity"));
        if (Directory.Exists(outputDir))
        {
            Debug.Log("[WebGLBuildScript] Removing previous WebGL output: " + outputDir);
            FileUtil.DeleteFileOrDirectory(outputDir);
        }
        Directory.CreateDirectory(outputDir);

        var options = new BuildPlayerOptions
        {
            scenes = ScenePaths,
            locationPathName = outputDir,
            target = BuildTarget.WebGL,
            options = BuildOptions.CleanBuildCache,
        };

        BuildReport report = BuildPipeline.BuildPlayer(options);
        if (report.summary.result != BuildResult.Succeeded)
        {
            Debug.LogError("[WebGLBuildScript] Build failed: " + report.summary.result);
            if (exitWhenDone)
                EditorApplication.Exit(1);
            return;
        }

        InjectStudentConfigBridge(outputDir);
        InjectTouchGestureGuards(outputDir);
        InjectLandscapeOrientationGuard(outputDir);
        Debug.Log("[WebGLBuildScript] Build succeeded: " + outputDir);
        if (exitWhenDone)
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

    /// <summary>
    /// Prevents browser pinch-zoom and stray touch scrolling while dragging action blocks on phones/tablets.
    /// </summary>
    private static void InjectTouchGestureGuards(string outputDir)
    {
        var indexPath = Path.Combine(outputDir, "index.html");
        if (!File.Exists(indexPath))
            return;

        const string marker = "touch-action: none";
        var html = File.ReadAllText(indexPath);
        if (html.Contains(marker))
            return;

        const string snippet =
            "<style>canvas,#unity-container,#unity-canvas{touch-action:none;-ms-touch-action:none;}</style>" +
            "<script>document.addEventListener('touchmove',function(e){if(e.touches.length>1)e.preventDefault();},{passive:false});</script>";

        if (html.Contains("</head>"))
            html = html.Replace("</head>", snippet + "</head>");
        else
            html = snippet + html;

        File.WriteAllText(indexPath, html);
    }

    /// <summary>
    /// Blocks portrait play on phones/tablets and requests landscape orientation in the browser.
    /// </summary>
    private static void InjectLandscapeOrientationGuard(string outputDir)
    {
        var indexPath = Path.Combine(outputDir, "index.html");
        if (!File.Exists(indexPath))
            return;

        const string marker = "sparc-landscape-only";
        var html = File.ReadAllText(indexPath);
        if (html.Contains(marker))
            return;

        const string snippet =
            "<style>/* sparc-landscape-only */" +
            "#sparc-landscape-overlay{display:none;position:fixed;inset:0;z-index:99999;" +
            "align-items:center;justify-content:center;flex-direction:column;gap:16px;" +
            "background:#020617;color:#fff;text-align:center;padding:24px;font-family:system-ui,sans-serif;}" +
            "#sparc-landscape-overlay h2{margin:0;font-size:1.5rem;}" +
            "#sparc-landscape-overlay p{margin:0;max-width:20rem;color:#cbd5e1;line-height:1.5;}" +
            "@media (orientation: portrait) and (max-width: 1024px){" +
            "#sparc-landscape-overlay{display:flex;}" +
            "#unity-container,#unity-loading-bar,#unity-footer,#unity-warning{visibility:hidden;}" +
            "}</style>" +
            "<div id=\"sparc-landscape-overlay\">" +
            "<div style=\"font-size:3rem;line-height:1\">&#8635;</div>" +
            "<h2>Rotate your device</h2>" +
            "<p>Play in landscape (horizontal) mode. Turn your phone or tablet sideways.</p>" +
            "</div>";

        if (html.Contains("</body>"))
            html = html.Replace("</body>", snippet + "</body>");
        else
            html = html + snippet;

        File.WriteAllText(indexPath, html);
    }
}
