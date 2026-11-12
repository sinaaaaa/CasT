mergeInto(LibraryManager.library, {
  StudentWebBridge_GetConfigJson: function () {
    try {
      function readConfig(win) {
        if (!win) return null;
        try {
          if (typeof win.StudentGameConfig !== "undefined" && win.StudentGameConfig)
            return win.StudentGameConfig;
        } catch (e) {}
        return null;
      }

      var cfg = readConfig(window);
      if (!cfg) {
        try { cfg = readConfig(window.parent); } catch (e) {}
      }
      if (!cfg) {
        try { cfg = readConfig(window.top); } catch (e) {}
      }
      if (cfg) return allocateUTF8(JSON.stringify(cfg));
    } catch (e) {}
    return allocateUTF8("");
  },

  StudentWebBridge_NavigateParent: function (pathPtr) {
    var path = UTF8ToString(pathPtr) || "/student/home";
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "sparc-exit-play", href: path }, "*");
        return;
      }
    } catch (e) {}
    try {
      window.location.href = path;
    } catch (e2) {}
  },
});
