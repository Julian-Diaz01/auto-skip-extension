// content/picker.js — on-demand "element picker" content script, injected
// via chrome.scripting.executeScript from the popup (not in manifest.json's
// static content_scripts). Reads only DOM attributes; no eval, no network.

(function () {
  'use strict';

  if (window.__bunnySkipPickerActive) {
    // Picker already active from a previous invocation (e.g. user double
    // clicked the "Pick element" button) — don't stack listeners.
    return;
  }
  window.__bunnySkipPickerActive = true;

  var HOVER_OUTLINE = '2px solid #d1466f';
  var HOVER_OUTLINE_OFFSET = '-2px';

  var hoveredEl = null;
  var prevOutline = '';
  var prevOutlineOffset = '';

  function restoreOutline() {
    if (hoveredEl) {
      hoveredEl.style.outline = prevOutline;
      hoveredEl.style.outlineOffset = prevOutlineOffset;
      hoveredEl = null;
    }
  }

  function onMouseOver(event) {
    var el = event.target;
    if (!el || el === hoveredEl || el.nodeType !== 1) {
      return;
    }
    restoreOutline();
    hoveredEl = el;
    prevOutline = el.style.outline;
    prevOutlineOffset = el.style.outlineOffset;
    el.style.outline = HOVER_OUTLINE;
    el.style.outlineOffset = HOVER_OUTLINE_OFFSET;
  }

  function closestClickable(el) {
    if (!el) {
      return el;
    }
    var selector = 'button, [role="button"], a, [data-uia], [data-testid]';
    if (typeof el.matches === 'function' && el.matches(selector)) {
      return el;
    }
    if (typeof el.closest === 'function') {
      var closest = el.closest(selector);
      if (closest) {
        return closest;
      }
    }
    return el;
  }

  function cssEscape(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    // Minimal fallback: escape characters that are not letters, digits,
    // hyphens or underscores.
    return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function buildSelector(el) {
    if (el.id) {
      return '#' + cssEscape(el.id);
    }

    var parts = [];
    var node = el;
    var depth = 0;

    while (node && node.nodeType === 1 && depth < 6) {
      if (node.id) {
        parts.unshift('#' + cssEscape(node.id));
        break;
      }

      var part = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) {
        var classes = Array.prototype.slice
          .call(node.classList, 0, 2)
          .map(cssEscape);
        if (classes.length) {
          part += '.' + classes.join('.');
        }
      } else if (node.parentElement) {
        var idx = Array.prototype.indexOf.call(node.parentElement.children, node) + 1;
        part += ':nth-child(' + idx + ')';
      }

      parts.unshift(part);
      node = node.parentElement;
      depth += 1;
    }

    return parts.join(' > ');
  }

  function guessLabel(el) {
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text && text.length > 0 && text.length < 40) {
      return text;
    }
    var ariaLabel = el.getAttribute && el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      return ariaLabel.trim();
    }
    return 'Picked element';
  }

  function buildCandidates(el) {
    var site = location.hostname;
    var label = guessLabel(el);
    var candidates = [];

    // 1. data-* attribute, preferring stable test hooks.
    var dataAttrs = Array.prototype.filter.call(el.attributes || [], function (attr) {
      return attr.name.indexOf('data-') === 0 && attr.value;
    });
    dataAttrs.sort(function (a, b) {
      var score = function (name) {
        return /testid|uia|test/i.test(name) ? 0 : 1;
      };
      return score(a.name) - score(b.name);
    });
    if (dataAttrs.length) {
      candidates.push({
        matchType: 'data-attribute',
        dataAttrName: dataAttrs[0].name,
        matchValue: dataAttrs[0].value,
        label: label,
        site: site,
      });
    }

    // 2. aria-label.
    var ariaLabel = el.getAttribute && el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
      candidates.push({
        matchType: 'aria-label',
        matchValue: ariaLabel.trim(),
        label: label,
        site: site,
      });
    }

    // 3. trimmed text content (short, non icon-only).
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text && text.length > 0 && text.length < 40) {
      candidates.push({
        matchType: 'text',
        matchValue: text,
        label: label,
        site: site,
      });
    }

    // 4. CSS selector fallback — always included, least durable.
    candidates.push({
      matchType: 'css-selector',
      matchValue: buildSelector(el),
      label: label,
      site: site,
      note: 'Least durable — may break on site redeploys',
    });

    return candidates;
  }

  function cleanup() {
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    restoreOutline();
    window.__bunnySkipPickerActive = false;
  }

  function onClick(event) {
    // Swallow the click immediately so it never reaches the site's real
    // button handler.
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }

    var target = closestClickable(event.target);
    var candidates = buildCandidates(target);

    cleanup();

    // Popup already closed (it closes on focus loss) — persist to storage
    // for its next open, and notify background.js to badge the toolbar icon.
    chrome.storage.local.set({
      pickerPending: { candidates: candidates, site: location.hostname, ts: Date.now() },
    });

    try {
      chrome.runtime.sendMessage({
        type: 'picker-result',
        candidates: candidates,
        site: location.hostname,
      });
    } catch (err) {
      // Popup may already be closed — the storage write above is the
      // durable path, this is just a best-effort live nudge.
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      cleanup();
      try {
        chrome.runtime.sendMessage({ type: 'picker-cancelled' });
      } catch (err) {
        // Popup may already be closed — nothing to do.
      }
    }
  }

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, { capture: true });
  document.addEventListener('keydown', onKeyDown, true);
})();
