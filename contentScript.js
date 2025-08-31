(function() {
  try {
    chrome.runtime.sendMessage({ type: 'SAVE_ALL_FOR_TAB' });
  } catch (err) {
    console.error('Auto HTML Downloader content script error:', err);
  }
})();
