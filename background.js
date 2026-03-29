// Time Tracking Extension - Background Service Worker
// Event-driven browser tracking for accurate time tracking

const PORT_MIN = 8765;
const PORT_MAX = 8775;
const STORAGE_PORT_KEY = "averoxAgentPort";
const RETRY_DELAY_MS = 1000;

// HTTP POST at least every ~1 minute on same tab (chrome.alarms minimum period); liveness uses WebSocket presence.
// Chrome MV3 allows a minimum period of 1 minute for repeating chrome.alarms; without this, same-tab idle sends nothing.
const KEEPALIVE_ALARM = "averoxKeepalive";
const KEEPALIVE_PERIOD_MIN = 1;

function ensureKeepaliveAlarm() {
  chrome.alarms.create(KEEPALIVE_ALARM, {
    periodInMinutes: KEEPALIVE_PERIOD_MIN,
    delayInMinutes: 0.05,
  });
}

let sequenceCounter = 0;
let retryCount = 0;
const MAX_RETRIES = 3;

/** Cached agent base URL e.g. http://127.0.0.1:8765 */
let cachedAgentBase = null;

function buildBaseUrl(port) {
  return `http://127.0.0.1:${port}`;
}

/** Real-time presence to the agent (see /api/v1/extension-presence); connectivity is not inferred from timers. */
const PRESENCE_PATH = "/api/v1/extension-presence";

let presenceSocket = null;
let presencePort = null;
let presenceReconnectTimer = null;

function connectPresenceWebSocket(port) {
  if (typeof WebSocket === "undefined") {
    return;
  }
  if (presencePort === port && presenceSocket && presenceSocket.readyState === WebSocket.OPEN) {
    return;
  }
  if (presenceSocket) {
    try {
      presenceSocket.onclose = null;
      presenceSocket.close();
    } catch (_) {}
    presenceSocket = null;
  }
  presencePort = port;
  try {
    presenceSocket = new WebSocket(`ws://127.0.0.1:${port}${PRESENCE_PATH}`);
    presenceSocket.onopen = () => {
      console.log("Averox agent presence WebSocket connected");
    };
    presenceSocket.onclose = () => {
      presenceSocket = null;
      presencePort = null;
      schedulePresenceReconnect();
    };
    presenceSocket.onerror = () => {};
  } catch (e) {
    console.warn("Averox presence WebSocket error", e);
    presencePort = null;
    schedulePresenceReconnect();
  }
}

function schedulePresenceReconnect() {
  if (presenceReconnectTimer !== null) {
    return;
  }
  presenceReconnectTimer = setTimeout(async () => {
    presenceReconnectTimer = null;
    const port = await discoverAgentPort();
    if (port !== null) {
      cachedAgentBase = buildBaseUrl(port);
      connectPresenceWebSocket(port);
    }
  }, 1500);
}

async function probeHealth(port) {
  try {
    const r = await fetch(`${buildBaseUrl(port)}/api/v1/health`, {
      method: "GET",
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Discovers the agent HTTP port within PORT_MIN–PORT_MAX (matches agent bind range and manifest).
 */
async function discoverAgentPort() {
  const stored = await chrome.storage.local.get(STORAGE_PORT_KEY);
  const prev = stored[STORAGE_PORT_KEY];
  if (typeof prev === "number" && prev >= PORT_MIN && prev <= PORT_MAX) {
    if (await probeHealth(prev)) {
      return prev;
    }
  }

  for (let p = PORT_MIN; p <= PORT_MAX; p++) {
    if (await probeHealth(p)) {
      await chrome.storage.local.set({ [STORAGE_PORT_KEY]: p });
      return p;
    }
  }
  return null;
}

async function getAgentBaseUrl() {
  if (cachedAgentBase) {
    const port = parseInt(cachedAgentBase.split(":").pop(), 10);
    if (await probeHealth(port)) {
      connectPresenceWebSocket(port);
      return cachedAgentBase;
    }
    cachedAgentBase = null;
  }
  const port = await discoverAgentPort();
  if (port === null) {
    return null;
  }
  cachedAgentBase = buildBaseUrl(port);
  connectPresenceWebSocket(port);
  return cachedAgentBase;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Time Tracking Extension installed");
  cachedAgentBase = null;
  chrome.alarms.create("refreshAgentPort", { periodInMinutes: 30 });
  ensureKeepaliveAlarm();
  sendActiveTabEvent();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Time Tracking Extension started");
  cachedAgentBase = null;
  ensureKeepaliveAlarm();
  sendActiveTabEvent();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshAgentPort") {
    cachedAgentBase = null;
  } else if (alarm.name === KEEPALIVE_ALARM) {
    sendActiveTabEvent();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await sendTabEvent(activeInfo.tabId, activeInfo.windowId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    const activeTabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTabs.length > 0 && activeTabs[0].id === tabId) {
      await sendTabEvent(tabId, tab.windowId);
    }
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        windowId: windowId,
      });
      if (tabs.length > 0) {
        await sendTabEvent(tabs[0].id, windowId);
      }
    } catch (error) {
      console.error("Error getting active tab for focused window:", error);
    }
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  console.log("Window removed:", windowId);
});

async function sendActiveTabEvent() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      await sendTabEvent(tabs[0].id, tabs[0].windowId);
    }
  } catch (error) {
    console.error("Error getting active tab:", error);
  }
}

function getBrowserType() {
  if (typeof chrome !== "undefined") {
    if (chrome.runtime && chrome.runtime.getBrowserInfo) {
      return "firefox";
    }
    return "chrome";
  }
  return "unknown";
}

async function sendTabEvent(tabId, windowId) {
  try {
    const tab = await chrome.tabs.get(tabId);

    if (
      !tab.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:")
    ) {
      return;
    }

    const browserEvent = {
      source: "browser",
      browser: getBrowserType(),
      tabId: tabId,
      windowId: windowId || tab.windowId,
      url: tab.url,
      title: tab.title || "",
      timestamp: Date.now(),
      sequence: sequenceCounter++,
    };

    const success = await sendToAgent(browserEvent);

    if (success) {
      retryCount = 0;
    } else {
      retryCount++;
      cachedAgentBase = null;
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => sendTabEvent(tabId, windowId), RETRY_DELAY_MS);
      }
    }
  } catch (error) {
    console.error("Error getting tab info:", error);
    retryCount++;
  }
}

async function sendToAgent(browserEvent) {
  const base = await getAgentBaseUrl();
  if (!base) {
    console.warn(
      "Averox Time Track agent not reachable on 127.0.0.1:" +
        PORT_MIN +
        "-" +
        PORT_MAX,
    );
    return false;
  }

  try {
    const response = await fetch(`${base}/api/v1/browser-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(browserEvent),
    });

    if (response.ok) {
      console.log("Browser event sent successfully:", browserEvent.url);
      return true;
    }
    console.warn(
      "Agent server returned error:",
      response.status,
      response.statusText,
    );
    return false;
  } catch (error) {
    if (
      error.message &&
      (error.message.includes("Failed to fetch") ||
        error.message.includes("net::ERR_"))
    ) {
      return false;
    }
    console.error("Error sending browser event to agent:", error);
    return false;
  }
}
