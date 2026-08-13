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
        InjectAspectFit(outputDir);
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
            "#unity-footer{display:none!important;}</style>";

        if (html.Contains("</head>"))
            html = html.Replace("</head>", snippet + "</head>");
        else
            html = snippet + html;

        File.WriteAllText(indexPath, html);
    }

    /// <summary>
    /// Keeps a locked 16:9 stage centered in the iframe (letterbox OK).
    /// Small frame and browser fullscreen share the same layout proportions — only uniform scale changes.
    /// </summary>
    private static void InjectAspectFit(string outputDir)
    {
        var indexPath = Path.Combine(outputDir, "index.html");
        var stylePath = Path.Combine(outputDir, "TemplateData", "style.css");
        if (!File.Exists(indexPath))
            return;

        var html = File.ReadAllText(indexPath);

        // Remove Unity Default fixed desktop sizes; aspect-fit JS owns sizing.
        html = System.Text.RegularExpressions.Regex.Replace(
            html,
            @"canvas\.style\.width\s*=\s*""\d+px"";",
            "canvas.style.width = \"100%\";");
        html = System.Text.RegularExpressions.Regex.Replace(
            html,
            @"canvas\.style\.height\s*=\s*""\d+px"";",
            "canvas.style.height = \"100%\";");

        const string marker = "sparc-aspect-fit";
        if (!html.Contains(marker))
        {
            const string head =
                "<style>/* sparc-aspect-fit */" +
                "html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;" +
                "display:flex;align-items:center;justify-content:center;}" +
                "#unity-container{position:relative!important;left:auto!important;top:auto!important;" +
                "transform:none!important;margin:0;line-height:0;}" +
                "#unity-canvas{display:block;}" +
                "#unity-footer{display:none!important;}</style>";

            if (html.Contains("</head>"))
                html = html.Replace("</head>", head + "</head>");
            else
                html = head + html;
        }

        if (!html.Contains("sparc-aspect-fit-js"))
        {
            const string js =
                "<script>/* sparc-aspect-fit-js */" +
                "(function(){var DW=1920,DH=1080,A=DW/DH;" +
                "function fit(){var c=document.querySelector('#unity-container');" +
                "var a=document.querySelector('#unity-canvas');if(!c||!a)return;" +
                "var W=window.innerWidth||DW,H=window.innerHeight||DH,w,h;" +
                "if(W/Math.max(1,H)>A){h=H;w=Math.floor(H*A);}else{w=W;h=Math.floor(W/A);}" +
                "w=Math.max(2,w);h=Math.max(2,h);" +
                "c.style.width=w+'px';c.style.height=h+'px';" +
                "a.style.width=w+'px';a.style.height=h+'px';}" +
                "fit();window.addEventListener('resize',fit);" +
                "window.addEventListener('orientationchange',function(){setTimeout(fit,50);});})();" +
                "</script>";

            if (html.Contains("</body>"))
                html = html.Replace("</body>", js + "</body>");
            else
                html = html + js;
        }

        // Drop older stretch-fill injects if a rebuild reintroduced them.
        html = html.Replace("/* sparc-viewport-fill */", "/* sparc-viewport-fill-disabled */");
        html = html.Replace("/* sparc-viewport-fill-js */", "/* sparc-viewport-fill-js-disabled */");

        File.WriteAllText(indexPath, html);

        if (File.Exists(stylePath))
        {
            var css = File.ReadAllText(stylePath);
            if (!css.Contains("sparc-aspect-fit"))
            {
                css +=
                    "\n/* sparc-aspect-fit */\n" +
                    "html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;" +
                    "display:flex;align-items:center;justify-content:center;}\n" +
                    "#unity-container,#unity-container.unity-desktop,#unity-container.unity-mobile{" +
                    "position:relative!important;left:auto!important;top:auto!important;" +
                    "transform:none!important;margin:0;line-height:0;}\n" +
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
