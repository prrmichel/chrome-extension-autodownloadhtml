// Handles the toggle for automatic extraction
const checkbox = document.getElementById('toggleAutoExtract');
const status = document.getElementById('extractStatus');

function updateStatus(enabled) {
  if (enabled) {
    status.textContent = 'Enabled';
    status.classList.remove('disabled');
  } else {
    status.textContent = 'Disabled';
    status.classList.add('disabled');
  }
}

// Load current setting
chrome.storage.sync.get(['autoExtractEnabled'], (result) => {
  const enabled = result.autoExtractEnabled !== false;
  checkbox.checked = enabled;
  updateStatus(enabled);
});

checkbox.addEventListener('change', () => {
  const enabled = checkbox.checked;
  chrome.storage.sync.set({ autoExtractEnabled: enabled });
  updateStatus(enabled);
});
