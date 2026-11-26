// Bridges Chronos Web App state -> Chrome MV3 Extension storage & alarms
if (
  window.location.hostname === 'localhost' ||
  window.location.hostname.includes('chronos')
) {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.source === 'CHRONOS_WEB_APP' && event.data?.type === 'SYNC_STATE') {
      chrome.runtime.sendMessage({
        type: 'SYNC_STATE',
        activePass: event.data.activePass,
        blockedDomains: event.data.blockedDomains,
      });
    }
  });
}

// YouTube SPA navigation Shorts guard (fails OPEN on standard /watch lectures)
if (window.location.hostname.includes('youtube.com')) {
  const checkShortsRoute = () => {
    if (!window.location.pathname.startsWith('/shorts')) {
      return; // Standard YouTube lectures remain unrestricted
    }
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
      if (chrome.runtime.lastError) return; // Fail open cleanly
      const pass = res?.activePass;
      const unlocked =
        pass &&
        pass.domain === 'youtube.com/shorts' &&
        pass.expiresAt > Date.now();
      if (!unlocked) {
        window.location.replace(
          chrome.runtime.getURL('blocked.html?domain=youtube.com/shorts')
        );
      }
    });
  };

  checkShortsRoute();
  window.addEventListener('yt-navigate-finish', checkShortsRoute);
  window.addEventListener('popstate', checkShortsRoute);
}
