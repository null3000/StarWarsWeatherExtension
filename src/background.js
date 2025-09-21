chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: chrome.runtime.getURL('public/onboarding.html') });
  }
});

if (typeof chrome.runtime.setUninstallURL === 'function') {
  chrome.runtime.setUninstallURL('https://forms.gle/TMP8XNbPxNZ55U5J9');
}
