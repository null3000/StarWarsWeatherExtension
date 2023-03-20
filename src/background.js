chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        chrome.tabs.create({url: "./public/onboarding.html"});
}
});

chrome.runtime.setUninstallURL('https://forms.gle/TMP8XNbPxNZ55U5J9');