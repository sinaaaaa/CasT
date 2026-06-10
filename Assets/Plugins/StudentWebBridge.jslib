mergeInto(LibraryManager.library, {
  StudentWebBridge_GetConfigJson: function () {
    try {
      if (typeof window.StudentGameConfig !== "undefined" && window.StudentGameConfig) {
        return allocateUTF8(JSON.stringify(window.StudentGameConfig));
      }
    } catch (e) {}
    return allocateUTF8("");
  },
});
