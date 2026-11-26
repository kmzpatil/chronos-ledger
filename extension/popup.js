chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
  const box = document.getElementById('status-box');
  if (!box) return;
  const pass = res?.activePass;
  if (pass && pass.expiresAt > Date.now()) {
    const minsLeft = Math.ceil((pass.expiresAt - Date.now()) / 60000);
    box.innerHTML = `<strong style="color:#D94E41">UNLOCKED:</strong> ${pass.label}<br/><span style="font-family:monospace">${minsLeft}m remaining</span>`;
  } else {
    box.innerHTML = `<strong style="color:#2E9E6B">ALL SHIELDS LOCKED</strong><br/>Instagram, Shorts, TikTok, X &amp; Reddit enforced.`;
  }
});
