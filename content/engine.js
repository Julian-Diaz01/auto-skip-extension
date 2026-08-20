// content/engine.js — rule-driven auto-clicker for "Skip Intro" / "Skip
// Recap" / "Next Episode" buttons. Loaded after storage/rules-store.js
// (plain script, no ES modules), so `RulesStore` is already global.
// Rules are pure data and are never eval'd.

const DEBUG = false;

// Module-level state.
let activeRules = [];
const clickedNodes = new WeakSet();
let rescanTimer = null;
const RESCAN_DEBOUNCE_MS = 200;

function log(...args) {
  if (DEBUG) {
    console.debug('[bunny-skip]', ...args);
  }
}

// ---------------------------------------------------------------------
// Matching logic: each function takes (rule, doc) and returns an array
// (never throws) of candidate elements for that rule.
// ---------------------------------------------------------------------

function matchAriaLabel(rule, doc) {
  const value = rule.matchValue;
  if (!value) {
    return [];
  }

  const exact = doc.querySelectorAll(`[aria-label="${CSS.escape(value)}"]`);
  if (exact.length > 0) {
    return Array.from(exact);
  }

  // Fall back to a "contains" scan over every element with an aria-label.
  const candidates = [];
  const withAriaLabel = doc.querySelectorAll('[aria-label]');
  for (const el of withAriaLabel) {
    const label = el.getAttribute('aria-label');
    if (label && label.includes(value)) {
      candidates.push(el);
    }
  }
  return candidates;
}

function matchText(rule, doc) {
  const value = rule.matchValue;
  if (!value) {
    return [];
  }

  const candidates = [];
  const scope = doc.querySelectorAll('button, [role="button"], a, div[tabindex]');
  for (const el of scope) {
    const text = (el.textContent || '').trim();
    if (text === value || text.includes(value)) {
      candidates.push(el);
    }
  }
  return candidates;
}

function matchCssSelector(rule, doc) {
  const value = rule.matchValue;
  if (!value) {
    return [];
  }

  try {
    return Array.from(doc.querySelectorAll(value));
  } catch (err) {
    log('invalid css-selector rule, skipping', rule.id, value, err);
    return [];
  }
}

function matchDataAttribute(rule, doc) {
  const { dataAttrName, matchValue } = rule;
  if (!dataAttrName || !matchValue) {
    return [];
  }

  const selector = `[${dataAttrName}="${CSS.escape(matchValue)}"]`;
  try {
    return Array.from(doc.querySelectorAll(selector));
  } catch (err) {
    log('invalid data-attribute rule, skipping', rule.id, selector, err);
    return [];
  }
}

const MATCHERS = {
  'aria-label': matchAriaLabel,
  text: matchText,
  'css-selector': matchCssSelector,
  'data-attribute': matchDataAttribute,
};

function findCandidates(rule, doc) {
  const matcher = MATCHERS[rule.matchType];
  if (!matcher) {
    log('unknown matchType, skipping rule', rule.id, rule.matchType);
    return [];
  }
  try {
    return matcher(rule, doc);
  } catch (err) {
    log('matcher threw, skipping rule', rule.id, err);
    return [];
  }
}

// ---------------------------------------------------------------------
// Visibility + click handling.
// ---------------------------------------------------------------------

function isVisible(el) {
  if (typeof el.checkVisibility === 'function') {
    try {
      return el.checkVisibility();
    } catch (err) {
      // Fall through to the offsetWidth/offsetHeight check below.
    }
  }
  return el.offsetWidth > 0 && el.offsetHeight > 0;
}

function tryClick(rule, el) {
  if (clickedNodes.has(el)) {
    return false;
  }
  if (!isVisible(el)) {
    return false;
  }

  clickedNodes.add(el);
  try {
    el.click();
    log('clicked element for rule', rule.id, rule.label || rule.matchValue, el);
    return true;
  } catch (err) {
    log('click() threw for rule', rule.id, err);
    return false;
  }
}

// ---------------------------------------------------------------------
// Scanning.
// ---------------------------------------------------------------------

function scan() {
  if (activeRules.length === 0) {
    return;
  }

  for (const rule of activeRules) {
    if (!rule.enabled) {
      continue;
    }

    const candidates = findCandidates(rule, document);
    if (candidates.length > 0) {
      log('rule matched', rule.id, rule.label || rule.matchValue, 'candidates:', candidates.length);
    }

    for (const el of candidates) {
      tryClick(rule, el);
    }
  }
}

function scheduleRescan() {
  if (rescanTimer !== null) {
    return;
  }
  rescanTimer = setTimeout(() => {
    rescanTimer = null;
    scan();
  }, RESCAN_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------
// Rule loading + live updates.
// ---------------------------------------------------------------------

async function loadActiveRules() {
  try {
    const rules = await RulesStore.getRulesForSite(location.hostname);
    activeRules = rules.filter((rule) => rule.enabled === true);
    log('loaded active rules', activeRules.length, activeRules);
  } catch (err) {
    log('failed to load rules', err);
    activeRules = [];
  }
}

function watchStorageChanges() {
  if (!chrome.storage || !chrome.storage.onChanged) {
    return;
  }
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }
    if (!changes[RulesStore.RULES_STORAGE_KEY]) {
      return;
    }
    log('rules changed in storage, reloading active rule set');
    // Intentionally do NOT clear clickedNodes here — a node that has
    // already been clicked stays "done" even if its rule was edited.
    loadActiveRules().then(() => {
      scheduleRescan();
    });
  });
}

function watchDom() {
  const observer = new MutationObserver(() => {
    scheduleRescan();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ---------------------------------------------------------------------
// Bootstrap.
// ---------------------------------------------------------------------

async function init() {
  log('initializing on', location.hostname);
  await loadActiveRules();
  watchStorageChanges();
  watchDom();
  scan();
}

init();
