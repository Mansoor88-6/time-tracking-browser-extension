// Time Tracking Extension - Background Service Worker
// Event-driven browser tracking for accurate time tracking

const AGENT_SERVER_URL = 'http://localhost:8765/api/v1/browser-event';
const RETRY_DELAY_MS = 1000; // 1 second

let sequenceCounter = 0;
let retryCount = 0;
const MAX_RETRIES = 3;

// Detect browser type
function getBrowserType() {
  if (typeof chrome !== 'undefined') {
    if (chrome.runtime && chrome.runtime.getBrowserInfo) {
      return 'firefox';
    }
    return 'chrome';
  }
  return 'unknown';
}

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Time Tracking Extension installed');
  // Send initial active tab event
  sendActiveTabEvent();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Time Tracking Extension started');
  // Send initial active tab event
  sendActiveTabEvent();
});

// Listen for tab activation (user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await sendTabEvent(activeInfo.tabId, activeInfo.windowId);
});

// Listen for tab updates (navigation, title changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when URL or status changes
  if (changeInfo.url || changeInfo.status === 'complete') {
    // Check if this is the active tab
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs.length > 0 && activeTabs[0].id === tabId) {
      await sendTabEvent(tabId, tab.windowId);
    }
  }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    // Get active tab in focused window
    try {
      const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0) {
        await sendTabEvent(tabs[0].id, windowId);
      }
    } catch (error) {
      console.error('Error getting active tab for focused window:', error);
    }
  }
});

// Listen for window removal (cleanup)
chrome.windows.onRemoved.addListener((windowId) => {
  // Window removed, no action needed as session manager handles this
  console.log('Window removed:', windowId);
});

// Send event for active tab
async function sendActiveTabEvent() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      await sendTabEvent(tabs[0].id, tabs[0].windowId);
    }
  } catch (error) {
    console.error('Error getting active tab:', error);
  }
}

// Send browser event for a specific tab
async function sendTabEvent(tabId, windowId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    
    // Skip chrome://, chrome-extension://, and other internal URLs
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      return;
    }
    
    const browserEvent = {
      source: 'browser',
      browser: getBrowserType(),
      tabId: tabId,
      windowId: windowId || tab.windowId,
      url: tab.url,
      title: tab.title || '',
      timestamp: Date.now(),
      sequence: sequenceCounter++
    };
    
    const success = await sendToAgent(browserEvent);
    
    if (success) {
      retryCount = 0;
    } else {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        // Retry after delay
        setTimeout(() => sendTabEvent(tabId, windowId), RETRY_DELAY_MS);
      }
    }
  } catch (error) {
    console.error('Error getting tab info:', error);
    retryCount++;
  }
}

// Send browser event to agent server
async function sendToAgent(browserEvent) {
  try {
    const response = await fetch(AGENT_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(browserEvent),
    });
    
    if (response.ok) {
      console.log('Browser event sent successfully:', browserEvent.url);
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
    console.error('Error sending browser event to agent:', error);
    return false;
  }
}
