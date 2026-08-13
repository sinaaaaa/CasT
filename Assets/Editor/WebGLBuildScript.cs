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
        InjectWebGlBrowserGuards(outputDir);
        InjectViewportFill(outputDir);
        InjectFullscreenBridge(outputDir);
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
    /// Prevents iOS Safari crashes from Unity calling screen.orientation.lock, and keeps mobile layout simple.
    /// </summary>
    private static void InjectWebGlBrowserGuards(string outputDir)
    {
        var indexPath = Path.Combine(outputDir, "index.html");
        if (!File.Exists(indexPath))
            return;

        const string marker = "sparc-webgl-guards";
        var html = File.ReadAllText(indexPath);
        if (html.Contains(marker))
            return;

        const string snippet =
            "<script>/* sparc-webgl-guards */" +
            "(function(){try{var o=screen.orientation;if(!o)screen.orientation=o={};" +
            "if(typeof o.lock!=='function')o.lock=function(){return Promise.resolve();};}catch(e){}})();" +
            "</script>" +
            "<style>/* sparc-webgl-guards */html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}" +
            "#unity-container,#unity-container.unity-desktop,#unity-container.unity-mobile," +
            "#unity-canvas,.unity-mobile #unity-canvas{position:fixed;inset:0;left:0;top:0;transform:none;" +
            "width:100%!important;height:100%!important;}" +
            "#unity-footer{display:none!important;}</style>";

        if (html.Contains("</head>"))
            html = html.Replace("</head>", snippet + "</head>");
        else
            html = snippet + html;

        File.WriteAllText(indexPath, html);
    }

    /// <summary>
    /// Makes the WebGL canvas fill the iframe/window on desktop + mobile (no 960×600 letterbox).
    /// Browser fullscreen is optional — this is "full view" without SetFullscreen.
    /// </summary>
    private static void InjectViewportFill(string outputDir)
    {
        var indexPath = Path.Combine(outputDir, "index.html");
        var stylePath = Path.Combine(outputDir, "TemplateData", "style.css");
        if (!File.Exists(indexPath))
            return;

        var html = File.ReadAllText(indexPath);

        // Strip Unity Default template's fixed desktop canvas size (960×600, 1920×1080, etc.).
        html = System.Text.RegularExpressions.Regex.Replace(
            html,
            @"canvas\.style\.width\s*=\s*""\d+px"";",
            "canvas.style.width = \"100%\";");
        html = System.Text.RegularExpressions.Regex.Replace(
            html,
            @"canvas\.style\.height\s*=\s*""\d+px"";",
            "canvas.style.height = \"100%\";");
        html = System.Text.RegularExpressions.Regex.Replace(
            html,
            @"canvas\.style\.width\s*=\s*'\d+px';",
            "canvas.style.width = '100%';");
        html = System.Text.RegularExpressions.Regex.Replace(
            html,
            @"canvas\.style\.height\s*=\s*'\d+px';",
            "canvas.style.height = '100%';");
        html = System.Text.RegularExpressions.Regex.Replace(
            html,
            @"width=\d+\s+height=\d+",
            "width=1920 height=1080");

        const string marker = "sparc-viewport-fill";
        if (!html.Contains(marker))
        {
            const string snippet =
                "<style>/* sparc-viewport-fill */" +
                "html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}" +
                "#unity-container{position:fixed!important;inset:0!important;left:0!important;top:0!important;" +
                "transform:none!important;width:100%!important;height:100%!important;}" +
                "#unity-canvas{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;display:block;}" +
                "#unity-footer{display:none!important;}" +
                "</style>";

            if (html.Contains("</head>"))
                html = html.Replace("</head>", snippet + "</head>");
            else
                html = snippet + html;
        }

        // Ensure desktop also runs the fill sizing (Unity only did 100% for mobile).
        if (!html.Contains("sparc-viewport-fill-js"))
        {
            const string js =
                "<script>/* sparc-viewport-fill-js */" +
                "(function(){function fill(){var c=document.querySelector('#unity-container');" +
                "var a=document.querySelector('#unity-canvas');if(!c||!a)return;" +
                "c.style.cssText='position:fixed;inset:0;left:0;top:0;transform:none;width:100%;height:100%;';" +
                "a.style.width='100%';a.style.height='100%';}" +
                "fill();window.addEventListener('resize',fill);})();</script>";

            if (html.Contains("</body>"))
                html = html.Replace("</body>", js + "</body>");
            else
                html = html + js;
        }

        File.WriteAllText(indexPath, html);

        if (File.Exists(stylePath))
        {
            var css = File.ReadAllText(stylePath);
            if (!css.Contains("sparc-viewport-fill"))
            {
                css +=
                    "\n/* sparc-viewport-fill */\n" +
                    "html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}\n" +
                    "#unity-container,#unity-container.unity-desktop,#unity-container.unity-mobile{" +
                    "position:fixed!important;inset:0!important;left:0!important;top:0!important;" +
                    "transform:none!important;width:100%!important;height:100%!important;}\n" +
                    "#unity-canvas,.unity-mobile #unity-canvas{width:100%!important;height:100%!important;display:block;}\n" +
                    "#unity-footer{display:none!important;}\n";
                File.WriteAllText(stylePath, css);
            }
        }
    }

    /// <summary>
    /// Lets the parent /play page trigger Unity's canvas fullscreen via postMessage.
    /// </summary>
    private static void InjectFullscreenBridge(string outputDir)
    {
        var indexPath = Path.Combine(outputDir, "index.html");
        if (!File.Exists(indexPath))
            return;

        const string marker = "sparc-fullscreen-bridge";
        var html = File.ReadAllText(indexPath);
        if (html.Contains(marker))
            return;

        const string snippet =
            "<script>/* sparc-fullscreen-bridge */" +
            "window.addEventListener('message',function(e){" +
            "var u=window.unityInstance;if(!u)return;" +
            "if(e.data==='sparc-enter-fullscreen')u.SetFullscreen(1);" +
            "if(e.data==='sparc-exit-fullscreen')u.SetFullscreen(0);});</script>";

        if (html.Contains("</body>"))
            html = html.Replace("</body>", snippet + "</body>");
        else
            html = html + snippet;

        html = html.Replace(
            "}).then((unityInstance) => {",
            "}).then((unityInstance) => {window.unityInstance=unityInstance;");

        File.WriteAllText(indexPath, html);
    }
}
