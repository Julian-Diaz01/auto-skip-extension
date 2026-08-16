# Bunny Skip

A Chrome extension (Manifest V3) that automatically clicks "Skip Intro," "Skip Recap," and "Next Episode" buttons on streaming sites (Netflix, Prime Video, Disney+, Hulu, Max, Apple TV+, Paramount+). Rules that describe which button to click are stored as **data** — never as hardcoded per-site JS — so a broken rule can be fixed by picking the button again, no DevTools required.

It has no backend and makes no network calls beyond loading the pages you already visit — see [`PRIVACY_POLICY.md`](PRIVACY_POLICY.md) for the full data-handling breakdown. It's currently installed as an unpacked extension via Chrome Developer Mode.

## What it does — and doesn't do

- Only interacts with buttons/UI elements the streaming site already renders and shows you.
- Never skips, blocks, or interacts with ads, paywalls, or DRM-protected content.
- Never bypasses subscription checks or downloads/exports video.
- Rules are plain data (selectors/strings) — nothing is ever `eval`'d.
- No analytics, telemetry, or network calls.

## Install (load unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select this folder (`bunny-skip-extension`).
5. Confirm it installs with no errors and the toolbar icon appears.

On first install, three Netflix rules are seeded automatically (Skip Intro, Skip Recap, Next Episode) — see [Seed rules](#seed-rules) below.

## How it works

- `content/engine.js` runs on every page load on the sites listed in `manifest.json`'s `host_permissions`. It loads the enabled rules for the current hostname, watches the page with a debounced `MutationObserver` (these are SPAs — buttons appear and disappear without a full navigation), and clicks any element that matches a rule. Each matched DOM node is only ever clicked once (tracked in a `WeakSet`), so re-renders of the same button don't cause double-clicks.
- Rules live in `chrome.storage.local`, managed through `storage/rules-store.js`. Adding, editing, toggling, or deleting a rule from the popup takes effect immediately — the content script listens for `chrome.storage.onChanged` and refreshes live, no page reload needed.
- The popup (toolbar icon) lists rules for the site you're currently on, plus a collapsible section for every other site, and lets you add/edit/delete/enable/disable rules manually.
- The **element picker** (`content/picker.js`) is injected on demand when you click "Pick element on page" in the popup. Hover highlights elements on the live page; clicking one captures it (the click never reaches the site's real handler) and proposes 2–4 ranked candidate rules — most durable first — for you to review, label, and save.

## Rule data model

```json
{
  "id": "uuid-v4",
  "site": "netflix.com",
  "label": "Skip Intro",
  "matchType": "aria-label",
  "matchValue": "Skip Intro",
  "dataAttrName": "data-uia",
  "action": "click",
  "enabled": true,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "source": "seed"
}
```

- `site` — hostname substring; a rule applies when `location.hostname.includes(rule.site)`.
- `matchType` — one of:
  - `aria-label` — matches `[aria-label="<matchValue>"]` exactly, falling back to a "contains" scan.
  - `text` — matches trimmed `textContent` (equal or contains) within `button, [role="button"], a, div[tabindex]`.
  - `css-selector` — a raw CSS selector, used as a manual-entry escape hatch. Least durable — site redeploys can change generated class names.
  - `data-attribute` — matches `[<dataAttrName>="<matchValue>"]`, e.g. Netflix's `data-uia="next-episode-seamless-button"`. Most durable, since these are usually stable test hooks rather than styling classes.
- `source` — `seed` (shipped defaults), `manual` (typed into the popup form), or `picker` (captured via the element picker).

## Seed rules

Netflix ships with three seed rules out of the box (`seed-rules.json`), since its `data-uia` attributes are the most stable of the supported sites:

- Skip Intro (`data-attribute`, `data-uia="player-skip-intro"`)
- Skip Recap (`aria-label`)
- Next Episode (`data-attribute`, `data-uia="next-episode-seamless-button"`)

**Every other supported site (Prime Video, Disney+, Hulu, Max, Apple TV+, Paramount+) ships with no seed rules.** Their selectors are less stable than Netflix's, so rather than guessing brittle values that would break silently, capture them yourself with the picker: open a title on that site, click the toolbar icon → "Pick element on page," then click the site's actual Skip Intro / Next Episode button. Review the proposed candidates, adjust the label if you want, and save.

## Adding support for a new site

Adding a new streaming site requires two things:

1. Add its origin to `host_permissions` **and** the `content_scripts.matches` array in `manifest.json` (e.g. `"*://*.hulu.com/*"`), then reload the unpacked extension.
2. Capture its buttons with the picker (or add rules manually via the popup form) — there's no need to touch any JS.

## Future Work (explicitly out of scope for v1)

- **Ad-skipping** — deliberately excluded. This is a different mechanism from skip-intro/next-episode and is more likely to conflict with a site's terms of service around ad-supported tiers.
- **`chrome.storage.sync`** — cross-device rule syncing. v1 uses `chrome.storage.local` only; `sync` is a documented future option, not required for v1.
- **Fetching/merging a shared community rules file** from a public GitHub repo. If built later, this must be opt-in and remain the only network call the extension makes.
- **Firefox/Safari ports.**

## Permissions

`storage`, `activeTab`, `scripting`, plus host permissions scoped to the specific streaming sites listed in `manifest.json`. Nothing broader is requested.
