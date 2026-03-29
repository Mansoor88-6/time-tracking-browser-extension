// Popup script to show connection status
const PORT_MIN = 8765;
const PORT_MAX = 8775;

function buildBaseUrl(port) {
  return `http://127.0.0.1:${port}`;
}

async function probeHealth(port) {
  try {
    const r = await fetch(`${buildBaseUrl(port)}/api/v1/health`, {
      method: 'GET',
      cache: 'no-store',
    });
    return r.ok ? port : null;
  } catch {
    return null;
  }
}

async function findAgentPort() {
  const stored = await chrome.storage.local.get('averoxAgentPort');
  const prev = stored.averoxAgentPort;
  if (typeof prev === 'number' && prev >= PORT_MIN && prev <= PORT_MAX) {
    const found = await probeHealth(prev);
    if (found !== null) return found;
  }
  for (let p = PORT_MIN; p <= PORT_MAX; p++) {
    const found = await probeHealth(p);
    if (found !== null) return found;
  }
  return null;
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');

  try {
    const port = await findAgentPort();

    if (port !== null) {
      statusDiv.textContent = 'Connected to agent on port ' + port;
      statusDiv.className = 'status connected';
    } else {
      statusDiv.textContent =
        'Averox Time Track extension could not connect to the agent. Start the agent or check that it listens on 127.0.0.1:' +
        PORT_MIN +
        '-' +
        PORT_MAX +
        '.';
      statusDiv.className = 'status disconnected';
    }
  } catch (error) {
    statusDiv.textContent = 'Agent not running or unreachable';
    statusDiv.className = 'status disconnected';
  }
});
