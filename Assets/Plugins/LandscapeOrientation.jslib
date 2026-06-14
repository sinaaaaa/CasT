mergeInto(LibraryManager.library, {
  SparcLockLandscapeOrientation: function () {
    // No-op: screen.orientation.lock throws inside iframes / iOS Safari.
  },
});
