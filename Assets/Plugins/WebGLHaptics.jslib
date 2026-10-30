mergeInto(LibraryManager.library, {
  WebGLHapticPulse: function (durationMs) {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        var ms = durationMs | 0;
        if (ms < 1) ms = 1;
        if (ms > 80) ms = 80;
        navigator.vibrate(ms);
      }
    } catch (e) {}
  }
});
