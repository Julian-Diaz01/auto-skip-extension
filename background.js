// background.js
// MV3 service worker. Only responsible for seeding default rules on first
// install — no telemetry, no network calls, no persistent state beyond
// what rules-store.js already manages in chrome.storage.local.

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
    console.debug('[auto-skip] Seeded default rules:', rulesWithIds.length);
  } catch (err) {
    console.error('[auto-skip] Failed to seed default rules:', err);
  }
});

// The popup that starts an element-pick closes as soon as it loses focus
// (the moment the user clicks over on the page), so the flow can't wait
// for the user to come back and confirm a candidate — that's the service
// worker's job here. It auto-saves the best (first, most durable) match
// content/picker.js found the instant the pick happens, so the rule is
// already active whether or not the popup is ever reopened. The full candidate
// list is kept in `pickerPending` so the popup can offer the runner-up
// matches (with an explanation of each) as a "not the right one?" fallback.
chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== 'object') {
    return;
  }
  if (message.type === 'picker-result') {
    handlePickerResult(message).catch((err) => {
      console.error('[auto-skip] Failed to auto-save picked rule:', err);
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

  // "Choose match manually" is a popup-set preference (chrome.storage.local)
  // read here because the popup that started the pick is already closed by
  // the time this runs — see the file-level comment above. When it's on,
  // skip the auto-save below and let the popup present every candidate for
  // the user to pick from instead.
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
  // No popup listening right now is the common case (it's already closed)
  // — that's fine, it'll pick up `pickerPending` from storage on its next
  // open. sendMessage rejects (doesn't throw) when there's no receiver, so
  // this needs a .catch, not a try/catch, to avoid an unhandled rejection.
  chrome.runtime.sendMessage({ type: 'picker-auto-saved' }).catch(() => {});
}
