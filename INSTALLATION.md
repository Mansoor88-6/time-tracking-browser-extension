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

## Troubleshooting

- **Extension shows "Agent Not Running"**: 
  - Start the agent
  - Check `server.enabled: true` in agent config
  - Verify agent server port (default: 8765)

- **No URL updates in agent logs**:
  - Check browser console (right-click extension → Inspect popup)
  - Verify extension has required permissions
  - Check that URLs aren't chrome:// or extension:// (these are skipped)
