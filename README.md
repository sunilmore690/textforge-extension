# TextForge — Local AI Writing Assistant

A Chrome extension that adds a floating icon to every text field. Click it to humanize, summarize, formalize, or fix your writing — all powered by a model running locally on your machine. Nothing ever leaves your computer.

TextForge talks to any **OpenAI-compatible** local server, so it works with **Ollama**, **LM Studio**, **llama.cpp**, **Jan**, **vLLM**, **LocalAI**, and others — you just point it at the endpoint.

It also **auto-tunes its prompts to the selected model's size**: smaller models (≤4B) get detailed prompts with examples, while larger models get concise instructions for better, faster results.

## Why TextForge

- **100% local** — your text never goes to a third-party server
- **Free** — no subscription, no token limits
- **Preview before replace** — always confirm the suggested rewrite before it touches your text
- **Works everywhere** — Gmail, LinkedIn, Twitter, GitHub, any normal text field

## Setup (one-time, ~5 minutes)

### 1. Install a local model runner
Download **Ollama** from https://ollama.com — works great on M1/M2 Macs.

### 2. Download a model
```bash
# 8 GB RAM machines (fast, lightweight)
ollama pull llama3.2:3b

# 16 GB RAM machines (better quality)
ollama pull qwen2.5:7b
# or
ollama pull mistral:7b
```

### 3. ⚠️ Enable browser access (REQUIRED)
By default, Ollama blocks browser extensions. You must allow it:

```bash
launchctl setenv OLLAMA_ORIGINS "*"
```

Then quit Ollama from the menu bar and reopen it.

> **Using LM Studio instead?** Start its local server (Developer tab → Start Server), enable CORS in the server settings, load a model, and set the endpoint in TextForge to `http://localhost:1234`. No `OLLAMA_*` variables needed — those are Ollama-specific.

### 4. Install the extension
1. Open `chrome://extensions` in Chrome
2. Toggle **Developer mode** ON (top-right corner)
3. Click **Load unpacked**
4. Select the `textforge-extension` folder

### 5. Configure
- Click the TextForge icon in your Chrome toolbar
- The **Model dropdown** auto-populates with all installed models
- Pick a model — **it auto-saves** (no Save button needed)
- Click **Test Generation** to verify the model responds
- Use the ⟳ button anytime to refresh the model list

### Using a remote endpoint (optional)
Running Ollama on another machine (a workstation, server, or another Mac)? Just enter that machine's address in the endpoint field, e.g.:
- `http://192.168.1.10:11434` (local network)
- `http://your-tailscale-ip:11434` (Tailscale/VPN)

On the **remote** machine, Ollama must be set to listen on all interfaces:
```bash
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
launchctl setenv OLLAMA_ORIGINS "*"
```
Then restart Ollama. The endpoint field has a **"Use localhost"** link to quickly switch back.

All your settings (endpoint + model) persist across Chrome restarts — they're stored in Chrome Sync.

## How to use

1. Click into any textarea on any website
2. A small orange-pink icon appears at the bottom-right of the field
3. Click the icon — a menu with 7 actions appears:
   - ✨ **Humanize** — make AI text sound natural
   - 📝 **Summarize** — shorten and clarify
   - 👔 **Formalize** — professional email tone
   - 💬 **Casualize** — friendly, relaxed tone
   - ✓ **Fix Grammar** — correct mistakes
   - ✂️ **Shorten** — make it more concise
   - ➕ **Expand** — add more detail
4. **Preview modal appears** showing:
   - Your original text
   - The suggested rewrite (editable — you can tweak it)
   - **Replace text** to accept, **Reject** to cancel
   - **Retry** to regenerate, **Copy** to copy without replacing
5. Only if you click **Replace text** does it touch your field

Press `Esc` to cancel the preview at any time.

## Troubleshooting

**Icon not appearing?**
- Some sites (Google Docs, Notion) use heavy custom editors. Standard textareas, inputs, and rich-text fields like Gmail compose work best.

**"Cannot reach local AI"?**
- Make sure Ollama is running — check menu bar icon
- Make sure you ran `launchctl setenv OLLAMA_ORIGINS "*"` and **restarted** Ollama
- Test in terminal: `curl http://localhost:11434/api/tags` — should list your models

**First request is slow?**
- Ollama loads the model into RAM on the first call. Subsequent calls are much faster.

**Want a different model?**
- Pull it in terminal: `ollama pull <name>`
- Open the extension popup and click the ⟳ refresh button — your new model will appear in the dropdown
- Select it and click **Save**

## Privacy

TextForge connects only to `http://localhost:11434` (Ollama on your own machine). Your text is never sent to any external server. You can verify this in `chrome://extensions` → TextForge → "Inspect views" → Network tab.
# textforge-extension
