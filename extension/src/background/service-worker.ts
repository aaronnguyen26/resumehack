// Chrome Extension Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log('ResumeHack Copilot installed successfully.');
  
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error: any) => console.error('Failed to set side panel behavior:', error));
  }
});

// Message listener for content scripts communicating with the sidepanel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'JOB_SCRAPED') {
    chrome.storage.local.set({ latestScrapedJob: message.data }, () => {
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  if (message.type === 'SCREEN_RESUME_DETECTED' || message.type === 'DOCS_DETECTED') {
    chrome.storage.local.set({ activeScreenResume: message.data, activeGoogleDoc: message.data }, () => {
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  if (message.type === 'SCREEN_SELECTION_UPDATED') {
    chrome.storage.local.set({ activeScreenSelection: message.data }, () => {
      sendResponse({ status: 'ok' });
    });
    return true;
  }

  if (message.type === 'OPEN_SIDEPANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id && chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ tabId: activeTab.id })
          .catch((err: any) => console.log('Side panel open error:', err));
      }
    });
    sendResponse({ status: 'opened' });
    return true;
  }
});
