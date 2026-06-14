mergeInto(LibraryManager.library, {
  SparcLockLandscapeOrientation: function () {
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(function () {});
      }
    } catch (e) {}
  },
});
