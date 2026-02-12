// Time Tracking Extension - Background Service Worker
// Monitors browser tabs and sends URL updates to the local agent

const AGENT_SERVER_URL = 'http://localhost:8765/api/v1/url-update';
const POLL_INTERVAL_MS = 5000; // 5 seconds
const RETRY_DELAY_MS = 1000; // 1 second

let pollIntervalId = null;
let lastSentUrl = null;
let retryCount = 0;
const MAX_RETRIES = 3;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Time Tracking Extension installed');
  startPolling();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Time Tracking Extension started');
  startPolling();
});

// Listen for tab activation (user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await sendActiveTabUrl(activeInfo.tabId);
});

// Listen for tab updates (navigation, title changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL or status changes
  if (changeInfo.url || changeInfo.status === 'complete') {
    // Check if this is the active tab
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0 && activeTabs[0].id === tabId) {
      await sendActiveTabUrl(tabId);
    }
  }
});

// Start periodic polling as backup
function startPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
  }
  
  pollIntervalId = setInterval(async () => {
    await pollActiveTab();
  }, POLL_INTERVAL_MS);
  
  // Also poll immediately
  pollActiveTab();
}

// Stop polling
function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

// Poll the currently active tab
async function pollActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      await sendActiveTabUrl(tabs[0].id);
    }
  } catch (error) {
    console.error('Error polling active tab:', error);
  }
}

// Send URL update for a specific tab
async function sendActiveTabUrl(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    // Skip chrome://, chrome-extension://, and other internal URLs
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      return;
    }
    
    // Skip if URL hasn't changed
    if (tab.url === lastSentUrl) {
      return;
    }
    
    const urlUpdate = {
      application: 'Google Chrome',
      title: tab.title || '',
      url: tab.url,
      timestamp: Date.now()
    };
    
    const success = await sendToAgent(urlUpdate);
    
    if (success) {
      lastSentUrl = tab.url;
      retryCount = 0;
    } else {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        // Retry after delay
        setTimeout(() => sendActiveTabUrl(tabId), RETRY_DELAY_MS);
      }
    }
  } catch (error) {
    console.error('Error getting tab info:', error);
    retryCount++;
  }
}

// Send URL update to agent server
async function sendToAgent(urlUpdate) {
  try {
    const response = await fetch(AGENT_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(urlUpdate),
    });
    
    if (response.ok) {
      console.log('URL update sent successfully:', urlUpdate.url);
      return true;
    } else {
      console.warn('Agent server returned error:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    // Agent server might not be running - this is expected if agent isn't started
    if (error.message.includes('Failed to fetch') || error.message.includes('net::ERR_CONNECTION_REFUSED')) {
      // Silently fail - agent might not be running
      return false;
    }
    console.error('Error sending URL update to agent:', error);
    return false;
  }
}

// Cleanup on extension disable/uninstall
chrome.runtime.onSuspend.addListener(() => {
  stopPolling();
});
