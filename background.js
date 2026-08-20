// background.js — MV3 service worker: seeds default rules on first install.
// No telemetry, no persistent state beyond what rules-store.js manages.

importScripts('storage/rules-store.js');

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'install') {
    return;
  }

  const existingRules = await RulesStore.getRules();
  if (existingRules.length > 0) {
    return;
  }

  try {
    const seedUrl = chrome.runtime.getURL('seed-rules.json');
    const response = await fetch(seedUrl);
    const seedRules = await response.json();

    const now = new Date().toISOString();
    const rulesWithIds = seedRules.map((rule) => ({
      id: RulesStore.generateRuleId(),
      createdAt: now,
      ...rule,
    }));

    await RulesStore.saveRules(rulesWithIds);
    console.debug('[bunny-skip] Seeded default rules:', rulesWithIds.length);
  } catch (err) {
    console.error('[bunny-skip] Failed to seed default rules:', err);
  }
});

// The popup closes the instant the user clicks the page to pick an element,
// so it can't wait for confirmation — this auto-saves the best candidate
// immediately. Runner-up candidates are kept in `pickerPending` for the
// popup's "not the right one?" fallback.
chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== 'object') {
    return;
  }
  if (message.type === 'picker-result') {
    handlePickerResult(message).catch((err) => {
      console.error('[bunny-skip] Failed to auto-save picked rule:', err);
    });
  } else if (message.type === 'picker-cancelled') {
    chrome.action.setBadgeText({ text: '' });
  }
});

async function handlePickerResult(message) {
  const candidates = Array.isArray(message.candidates) ? message.candidates : [];
  const site = message.site || '';

  if (candidates.length === 0) {
    await chrome.storage.local.set({
      pickerPending: { candidates: [], site, ts: Date.now() },
    });
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#d92d20' });
    notifyPopup();
    return;
  }

  // Popup already closed, so read this preference from storage. When on,
  // skip auto-save and let the popup present all candidates instead.
  const { manualSelectEnabled } = await chrome.storage.local.get('manualSelectEnabled');
  if (manualSelectEnabled) {
    await chrome.storage.local.set({
      pickerPending: { needsSelection: true, candidates, site, ts: Date.now() },
    });
    chrome.action.setBadgeText({ text: '?' });
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
    notifyPopup();
    return;
  }

  const best = candidates[0];
  const patch = {
    site: site || best.site || '',
    label: best.label || 'Picked element',
    matchType: best.matchType,
    matchValue: best.matchValue,
    dataAttrName: best.matchType === 'data-attribute' ? best.dataAttrName || '' : '',
    source: 'picker',
  };

  const newRule = await RulesStore.addRule(patch);

  await chrome.storage.local.set({
    pickerPending: {
      savedRuleId: newRule.id,
      savedLabel: patch.label,
      savedMatchType: patch.matchType,
      savedMatchValue: patch.matchValue,
      candidates,
      site,
      ts: Date.now(),
    },
  });

  chrome.action.setBadgeText({ text: '✓' });
  chrome.action.setBadgeBackgroundColor({ color: '#16a34a' });
  notifyPopup();
}

function notifyPopup() {
  // sendMessage rejects (doesn't throw) with no receiver — catch avoids an
  // unhandled rejection when the popup (the common case) isn't listening.
  chrome.runtime.sendMessage({ type: 'picker-auto-saved' }).catch(() => {});
}
