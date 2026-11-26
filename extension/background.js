const DEFAULT_SHIELD_HOSTS = [
  { id: 101, pattern: 'instagram.com', domain: 'instagram.com' },
  { id: 102, pattern: 'tiktok.com', domain: 'tiktok.com' },
  { id: 103, pattern: 'x.com', domain: 'x.com / reddit.com' },
  { id: 104, pattern: 'twitter.com', domain: 'x.com / reddit.com' },
  { id: 105, pattern: 'reddit.com', domain: 'x.com / reddit.com' },
];

async function applyShieldRules(activePass) {
  const now = Date.now();
  const validPass = activePass && activePass.expiresAt > now ? activePass : null;

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);

  const addRules = [];
  for (const item of DEFAULT_SHIELD_HOSTS) {
    if (validPass && validPass.domain === item.domain) {
      // Unlocked via active pass
      continue;
    }

    addRules.push({
      id: item.id,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: `/blocked.html?domain=${encodeURIComponent(item.domain)}`,
        },
      },
      condition: {
        urlFilter: `||${item.pattern}`,
        resourceTypes: ['main_frame'],
      },
    });
  }

  // Note: YouTube Shorts is enforced via URL filter on /shorts while keeping standard /watch open
  if (!validPass || validPass.domain !== 'youtube.com/shorts') {
    addRules.push({
      id: 106,
      priority: 2,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: `/blocked.html?domain=${encodeURIComponent('youtube.com/shorts')}`,
        },
      },
      condition: {
        urlFilter: '||youtube.com/shorts',
        resourceTypes: ['main_frame'],
      },
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });

  // Manage 2m warning + expiration alarms
  await chrome.alarms.clear('chronos-pass-warning');
  await chrome.alarms.clear('chronos-pass-expired');

  if (validPass) {
    const warnAt = validPass.expiresAt - 2 * 60 * 1000;
    if (warnAt > now) {
      chrome.alarms.create('chronos-pass-warning', { when: warnAt });
    }
    chrome.alarms.create('chronos-pass-expired', { when: validPass.expiresAt });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['activePass']);
  await applyShieldRules(data.activePass || null);
});

chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(['activePass']);
  await applyShieldRules(data.activePass || null);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'chronos-pass-warning') {
    chrome.notifications.create('chronos-warn', {
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      title: 'Chronos — 2 Minutes Left on Pass',
      message: 'Wrap up your session or Lock Now inside Command Center to refund credits.',
    });
  }

  if (alarm.name === 'chronos-pass-expired') {
    await chrome.storage.local.set({ activePass: null });
    await applyShieldRules(null);
    chrome.notifications.create('chronos-locked', {
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      title: 'Chronos Shield Re-Engaged',
      message: 'Timed unlock expired. Distraction domain has been re-locked.',
    });
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'SYNC_STATE') {
    chrome.storage.local
      .set({
        activePass: msg.activePass || null,
        blockedDomains: msg.blockedDomains || [],
      })
      .then(() => applyShieldRules(msg.activePass || null))
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === 'GET_STATE') {
    chrome.storage.local.get(['activePass', 'blockedDomains']).then(sendResponse);
    return true;
  }
});
