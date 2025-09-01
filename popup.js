// Handles the toggle for automatic extraction per tab
const checkbox = document.getElementById('toggleAutoExtract');
const status = document.getElementById('extractStatus');
let currentTabId = null;

function updateStatus(enabled) {
  if (enabled) {
    status.textContent = 'Enabled for this tab';
    status.classList.remove('disabled');
  } else {
    status.textContent = 'Disabled for this tab';
    status.classList.add('disabled');
  }
}

// Get current tab and load its setting
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  if (!tabs || !tabs.length) return;
  currentTabId = tabs[0].id;
  chrome.storage.local.get(['autoExtractTab'], (result) => {
    const tabSettings = result.autoExtractTab || {};
    const enabled = tabSettings[currentTabId] !== false;
    checkbox.checked = enabled;
    updateStatus(enabled);
  });
});

checkbox.addEventListener('change', () => {
  if (currentTabId == null) return;
  chrome.storage.local.get(['autoExtractTab'], (result) => {
    const tabSettings = result.autoExtractTab || {};
    tabSettings[currentTabId] = checkbox.checked;
    chrome.storage.local.set({ autoExtractTab: tabSettings });
    updateStatus(checkbox.checked);
  });
});
