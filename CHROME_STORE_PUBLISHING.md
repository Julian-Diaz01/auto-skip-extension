# Publishing Bunny Skip to the Chrome Web Store

Checklist for taking this extension from "load unpacked" to a live Chrome
Web Store listing.

## 1. Package the extension

- [ ] Bump `version` in `manifest.json` if this isn't the first submission.
- [ ] Zip the extension source only — `manifest.json`, `background.js`,
      `content/`, `popup/`, `storage/`, `icons/`, `seed-rules.json`.
      Do **not** include `store-assets/`, `.git/`, `.idea/`, `.claude/`,
      `README.md`, `LICENSE`, or `PRIVACY_POLICY.md` in the upload zip —
      none of it is needed by the runtime and keeping the package minimal
      makes review easier.
- [ ] Load the zipped contents as an unpacked extension one more time in a
      clean profile to confirm nothing outside the zipped files was needed.

## 2. Developer account

- [ ] Register (or confirm access to) a Chrome Web Store developer account
      at https://chrome.google.com/webstore/devconsole — one-time $5
      registration fee if this is a new account.

## 3. Store listing content

- [ ] **Name**: Bunny Skip
- [ ] **Summary** (132 chars max): short version of the `manifest.json`
      description.
- [ ] **Description**: expand on what it does, the three supported sites,
      and the "rules are editable data, nothing is hardcoded" pitch from
      the README.
- [ ] **Category**: Productivity (or Tools).
- [ ] **Icon**: `icons/icon128.png` (already correct size).
- [ ] **Screenshots** (1280x800, at least one required): use the files in
      `store-assets/` — `screenshot-1-this-site.png`,
      `screenshot-2-other-sites.png`, `screenshot-3-add-rule.png`.
      Before uploading, open each PNG and confirm it actually shows the
      panel its filename promises (This Site / Other Sites / Add Rule) —
      the mock popup switches panels via JS after the page loads, so a
      capture taken too early will silently freeze on the default panel.
- [ ] **Small promo tile** (440x280, optional but recommended):
      `store-assets/promo-small-440x280.png`.
- [ ] **Marquee promo tile** (1400x560, optional): 
      `store-assets/promo-marquee-1400x560.png`.

## 4. Privacy practices tab

- [ ] Host `PRIVACY_POLICY.md` somewhere public (GitHub repo's rendered
      Markdown page is fine) and paste that URL into the listing's privacy
      policy field.
- [ ] In the "Permissions justification" fields, use the table in
      `PRIVACY_POLICY.md` — one sentence per permission (`storage`,
      `activeTab`, `scripting`, and the three host permissions).
- [ ] Declare data usage: no data collected, no data sold, no data used for
      purposes unrelated to the extension's core function — matches
      `PRIVACY_POLICY.md`.
- [ ] Single-purpose description: "Automatically clicks Skip Intro / Skip
      Recap / Next Episode buttons on Netflix, Prime Video, and Disney+,
      using user-editable rules."

## 5. Distribution

- [ ] Visibility: Public.
- [ ] Regions: all regions (no restriction needed — no region-specific
      content or licensing).
- [ ] Pricing: free.

## 6. Before hitting submit

- [ ] Re-read `README.md`'s "What it does — and doesn't do" section and
      confirm the listing description doesn't overclaim (no ad-skipping,
      no DRM bypass, no download/export).
- [ ] Confirm `manifest.json`'s `host_permissions` only lists the three
      sites actually supported — no broad `<all_urls>` style grant.
- [ ] Submit for review.

## 7. After submission

- [ ] Initial review is typically a few business days for a new item;
      expect a longer review the first time an extension requests
      `scripting` + host permissions together, since that combination gets
      extra scrutiny.
- [ ] If rejected, the most common reason for an extension like this is an
      unclear permissions justification — tighten the wording in the
      privacy practices tab rather than the code.
