# Privacy Policy for Bunny Skip

**Last updated:** 2026-08-14

Bunny Skip is a browser extension that automatically clicks "Skip Intro," "Skip Recap," and "Next Episode" buttons on supported streaming sites (Netflix, Prime Video, Disney+).

## Data collection

Bunny Skip does not collect, transmit, sell, or share any user data. Specifically:

- **No analytics or telemetry.** The extension does not use any tracking, analytics, or crash-reporting service.
- **No network requests.** Bunny Skip never sends data to any server. The only `fetch` call in the code loads `seed-rules.json`, a file bundled inside the extension package itself (via `chrome.runtime.getURL`) — this never leaves the browser.
- **No remote code execution.** All code that runs is packaged inside the extension at install time. Nothing is downloaded or `eval`'d at runtime.

## Data stored locally

The extension stores one thing, entirely on your device, using the `chrome.storage.local` API:

- **Skip rules** — the list of buttons you've configured Bunny Skip to click (e.g., "Skip Intro" on Netflix), including any rules you create yourself with the element picker.

This data:
- Never leaves your device.
- Is never read by the developer.
- Is deleted automatically if you uninstall the extension.

## Permissions

| Permission | Why Bunny Skip needs it |
|---|---|
| `storage` | Save your skip rules locally in `chrome.storage.local`. |
| `activeTab` | Let the popup's element picker inspect the page you're currently viewing, only when you invoke it. |
| `scripting` | Inject the element-picker script on demand when you click "Pick element on page." |
| Host permissions for `netflix.com`, `primevideo.com`, `disneyplus.com` | Run the content script that watches for and clicks Skip Intro / Skip Recap / Next Episode buttons on those sites. Bunny Skip cannot see or run on any other site. |

## Third parties

Bunny Skip does not integrate with, or share data with, any third-party service, advertiser, or analytics provider.

## Changes to this policy

If Bunny Skip's data practices ever change, this policy will be updated and the extension's Chrome Web Store listing will reflect the update date above.

## Contact

Questions about this policy can be sent to gugan.diaz+info@gmail.com.
