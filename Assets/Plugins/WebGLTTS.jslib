mergeInto(LibraryManager.library, {
  SpeakTTS: function (messagePtr) {
    var message = UTF8ToString(messagePtr);
    if ('speechSynthesis' in window) {
      var utterance = new window.SpeechSynthesisUtterance(message);
      window.speechSynthesis.speak(utterance);
    }
  }
});
