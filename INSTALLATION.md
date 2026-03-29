# Extension Installation Guide

## Quick Start

1. **Load Extension in Chrome**:
   - Open Chrome
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `time-tracking-extension` folder

2. **Verify Installation**:
   - Extension icon should appear in Chrome toolbar
   - Click icon to see connection status
   - Status should show "Connected to Agent" if agent is running

3. **Start Agent**:
   - Ensure agent is running with URL server enabled
   - Check agent logs for: "Starting URL server for browser extension"

## Testing

1. **Test Tab Switching**:
   - Open multiple tabs with different websites
   - Switch between tabs
   - Check agent logs for URL updates

2. **Test Navigation**:
   - Navigate to a new page in a tab
   - Extension should send URL update automatically

3. **Test Polling**:
   - Wait 5 seconds without switching tabs
   - Extension should poll and send current tab URL

## Desktop vs browser tracking

- **Without this extension**: The agent still runs and can track **non-browser** applications (window titles, idle/active). It **does not** attribute time to specific browser tabs or URLs, because the agent intentionally ignores generic “browser window” focus events when the extension is expected to supply URLs.
- **With this extension**: Tab and URL data are sent to the agent at `http://127.0.0.1:<port>/api/v1/browser-event`. The extension discovers the port in **8765–8775** (must match the agent and Chrome host permissions).

## Troubleshooting

- **Popup shows that the extension could not connect to the agent**:
  - Start the Time Tracking Agent
  - Ensure `server.enabled: true` in agent config and that a port in **8765–8775** is free on `127.0.0.1`
  - If the agent updated `server.port` in its config after a conflict, reload the extension or wait for the automatic port scan

- **No URL updates in agent logs**:
  - Check the service worker console (chrome://extensions → Inspect views: background page)
  - Verify extension host permissions include the port the agent is using
  - Check that URLs aren't `chrome://` or `edge://` (these are skipped)
