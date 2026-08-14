// storage/rules-store.js
// Thin wrapper around chrome.storage.local for rule CRUD.
// Shared by content scripts (engine.js), the popup, and the background
// service worker. Loaded as a plain script (no ES modules) so it works
// both as a content-script include and via importScripts() in the
// service worker.

const RULES_STORAGE_KEY = 'rules';

function generateRuleId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getRules() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([RULES_STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(Array.isArray(result[RULES_STORAGE_KEY]) ? result[RULES_STORAGE_KEY] : []);
    });
  });
}

function saveRules(rules) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [RULES_STORAGE_KEY]: rules }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

async function getRulesForSite(hostname) {
  const rules = await getRules();
  return rules.filter((rule) => hostname.includes(rule.site));
}

async function addRule(rule) {
  const rules = await getRules();
  const newRule = {
    id: generateRuleId(),
    action: 'click',
    enabled: true,
    createdAt: new Date().toISOString(),
    source: 'manual',
    ...rule,
  };
  rules.push(newRule);
  await saveRules(rules);
  return newRule;
}

async function updateRule(id, patch) {
  const rules = await getRules();
  const index = rules.findIndex((rule) => rule.id === id);
  if (index === -1) {
    throw new Error(`Rule not found: ${id}`);
  }
  rules[index] = { ...rules[index], ...patch };
  await saveRules(rules);
  return rules[index];
}

async function deleteRule(id) {
  const rules = await getRules();
  const filtered = rules.filter((rule) => rule.id !== id);
  await saveRules(filtered);
}

async function toggleRule(id) {
  const rules = await getRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) {
    throw new Error(`Rule not found: ${id}`);
  }
  return updateRule(id, { enabled: !rule.enabled });
}

// Exposed as a global object (`RulesStore`) since these files are loaded
// as plain scripts, not ES modules, in both content-script and
// service-worker contexts.
const RulesStore = {
  RULES_STORAGE_KEY,
  getRules,
  saveRules,
  getRulesForSite,
  addRule,
  updateRule,
  deleteRule,
  toggleRule,
  generateRuleId,
};

if (typeof self !== 'undefined') {
  self.RulesStore = RulesStore;
}
