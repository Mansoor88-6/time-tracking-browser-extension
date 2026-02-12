# Time Tracking Browser Extension

This Chrome extension captures actual URLs from browser tabs and sends them to the time tracking agent for accurate domain tracking.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `time-tracking-extension` directory
5. The extension should now be installed and active

## How It Works

- **Tab Monitoring**: Automatically monitors when you switch tabs or navigate to new pages
- **Periodic Polling**: Polls active tabs every 5 seconds as a backup mechanism
- **Local Communication**: Sends URL updates to the agent running on `localhost:8765`
- **Privacy**: Only sends URLs to the local agent, never to external servers

## Requirements

- Chrome browser (Chromium-based browsers also supported)
- Time tracking agent must be running with URL server enabled
- Agent server should be listening on `localhost:8765` (configurable in agent config)

## Configuration

The extension connects to the agent server at `http://localhost:8765/api/v1/url-update`. If your agent is configured to use a different port, you'll need to update `background.js`:

```javascript
const AGENT_SERVER_URL = 'http://localhost:YOUR_PORT/api/v1/url-update';
```

## Troubleshooting

1. **Extension not sending URLs**: 
   - Check that the agent is running
   - Verify agent server is enabled in config (`server.enabled: true`)
   - Check browser console for errors (right-click extension icon → Inspect popup)

2. **Connection refused errors**:
   - Ensure agent is running
   - Check agent server port matches extension configuration
   - Verify firewall isn't blocking localhost connections

3. **URLs not appearing in tracking**:
   - Check agent logs for URL server activity
   - Verify extension is enabled in Chrome
   - Check that browser window title matches what extension sends

## Icons

Place extension icons in the `icons/` directory:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)  
- `icon128.png` (128x128 pixels)

You can create simple icons or use placeholder images for development.
