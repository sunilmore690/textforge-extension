# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Loading / Testing

No build step. Load directly in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder

After any JS/CSS change: click ⟳ in `chrome://extensions` to reload. After `manifest.json` changes: remove and re-add the extension.

No automated tests or linter config in this project.

## Architecture

**Manifest V3** Chrome extension with two contexts that share state only via `chrome.storage.sync`:

### Content script (`content.js` + `styles.css`)
Injected into every page. Manages the entire in-page UI:
- Tracks `state.activeField` on `focusin` — only `<textarea>` and `contenteditable` elements qualify (single-line inputs excluded)
- Floating icon positioned absolutely via `getBoundingClientRect()` + scroll offsets; repositioned on scroll/resize
- Action menu and preview modal are DOM elements appended to `document.body` and removed on close
- `setText()` uses `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set` + dispatches `input`/`change` events — required for React/Vue controlled inputs to register the change
- `chrome.storage.onChanged` listener keeps `state.settings` in sync without page reload

### Popup (`popup.html` + `popup.js`)
Settings UI. Fetches model list from `GET /v1/models`, stores `{ endpoint, model, paramSize, apiKey }` to `chrome.storage.sync`. All fields auto-save on `change`/`blur`.

### Tiered prompt system
Model parameter size → tier → different system+user prompts per action:
- `small` (≤4B): detailed instructions + few-shot example
- `medium` (≤13B): standard instructions
- `large` (>13B): terse instructions

`paramSize` is inferred from the model name (regex `(\d+(?:\.\d+)?)\s*b\b`) when the `/v1/models` response doesn't include metadata, and stored in `chrome.storage.sync` so `content.js` can pick the right prompt tier without re-fetching.

### LLM calls
`callLLM()` in `content.js` uses OpenAI-compatible `/v1/chat/completions`. Endpoint URL auto-gets `/v1` appended unless already present. Supports optional Bearer token via `state.settings.apiKey`. Always `stream: false`, `temperature: 0.7`.

## Key constraints

- **No background service worker** — the extension uses only a content script and popup. There is no persistent background context.
- **`host_permissions`** include `http://*/*` and `https://*/*` to allow `fetch()` from content scripts to arbitrary endpoints (including localhost).
- Settings persist across Chrome restarts and sync across profiles via `chrome.storage.sync`.
