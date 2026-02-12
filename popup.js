// Popup script to show connection status
document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  
  try {
    const response = await fetch('http://localhost:8765/api/v1/health', {
      method: 'GET',
    });
    
    if (response.ok) {
      statusDiv.textContent = 'Connected to Agent';
      statusDiv.className = 'status connected';
    } else {
      statusDiv.textContent = 'Agent Not Running';
      statusDiv.className = 'status disconnected';
    }
  } catch (error) {
    statusDiv.textContent = 'Agent Not Running';
    statusDiv.className = 'status disconnected';
  }
});
