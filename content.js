// TextForge content script
// Detects editable fields, attaches a floating icon, shows preview modal for confirmation

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M14 4l6 6-10 10H4v-6L14 4z"/></svg>`;

// Action metadata for the menu UI
const ACTIONS = [
  { key: 'humanize',  label: '✨ Humanize',   desc: 'Sound more natural' },
  { key: 'summarize', label: '📝 Summarize',  desc: 'Shorter and clearer' },
  { key: 'formal',    label: '👔 Formalize',  desc: 'Professional tone' },
  { key: 'casual',    label: '💬 Casualize',  desc: 'Friendly tone' },
  { key: 'fix',       label: '✓ Fix Grammar', desc: 'Correct mistakes' },
  { key: 'shorten',   label: '✂️ Shorten',    desc: 'More concise' },
  { key: 'expand',    label: '➕ Expand',      desc: 'Add detail' }
];

/* ---------- Size-aware prompt system ----------
 * The prompt adapts to the SELECTED MODEL's capability (read from its parameter
 * size), regardless of where the model runs. Smaller models get heavier
 * scaffolding + a few-shot example; larger models get terse instructions.
 */

const SYSTEM_PROMPTS = {
  small:  'You are a precise text-editing engine. You transform text exactly as instructed and output ONLY the transformed text. You never add greetings, explanations, notes, quotation marks, or any commentary. You never say "Here is" or "Sure". If you are unsure, you still output only your best transformed version of the text and nothing else.',
  medium: 'You are a precise text editor. Apply the requested transformation and return only the resulting text, with no preamble, explanation, or quotation marks.',
  large:  'You are a skilled writing editor. Return only the edited text.'
};

// Per-action user prompts by tier. {{text}} is replaced with the selection.
const PROMPTS = {
  humanize: {
    small:  'Rewrite the text below so it sounds like a real person wrote it — natural, warm, and conversational. Keep the exact same meaning and all facts. Do not add or remove information. Output ONLY the rewritten text.\n\nExample\nInput: "The deliverables were completed in accordance with the stipulated timeline."\nOutput: We finished everything on time.\n\nNow do the same for this:\n{{text}}',
    medium: 'Rewrite the following text so it sounds natural and human, keeping the meaning identical. Avoid stiff or robotic phrasing.\n\n{{text}}',
    large:  'Make this sound naturally human while preserving meaning:\n\n{{text}}'
  },
  summarize: {
    small:  'Summarize the text below. Rules:\n- Keep only the most important points.\n- Use 2–3 short sentences for a paragraph, or 3–5 bullets for longer text.\n- Do not add opinions or information not in the original.\n- Output ONLY the summary.\n\nExample\nInput: "The meeting covered three topics. First, the Q2 budget, which is on track. Second, hiring, where we approved two roles. Third, the office move, now delayed to March."\nOutput: Q2 budget is on track, two new roles were approved, and the office move is pushed to March.\n\nNow summarize this:\n{{text}}',
    medium: 'Summarize the following text into a clear, concise version that keeps the key points. Match the length to the input — a sentence or two for short text, a short paragraph for long.\n\n{{text}}',
    large:  'Summarize this, keeping the key points:\n\n{{text}}'
  },
  formal: {
    small:  'Rewrite the text below in a professional, polite tone suitable for a business email. Keep the meaning identical. Keep it concise — do not pad it with filler. Output ONLY the rewritten text.\n\nExample\nInput: "hey can you send me that file when you get a sec, kinda need it"\nOutput: Could you please send me that file when you have a moment? I\'d appreciate it, as I need it fairly soon.\n\nNow do the same for this:\n{{text}}',
    medium: 'Rewrite the following text in a professional, polite, formal tone suitable for business email. Keep the meaning the same and avoid unnecessary padding.\n\n{{text}}',
    large:  'Rewrite this in a polished, professional tone for a business email:\n\n{{text}}'
  },
  casual: {
    small:  'Rewrite the text below in a relaxed, friendly, casual tone, like talking to a colleague you get along with. Keep the meaning the same. Do not make it unprofessional or sloppy. Output ONLY the rewritten text.\n\nExample\nInput: "Please be advised that the report will be submitted by end of day."\nOutput: Just a heads up — I\'ll have the report to you by end of day.\n\nNow do the same for this:\n{{text}}',
    medium: 'Rewrite the following text in a relaxed, friendly, casual tone while keeping the meaning.\n\n{{text}}',
    large:  'Rewrite this in a relaxed, friendly tone:\n\n{{text}}'
  },
  fix: {
    small:  'Correct ONLY grammar, spelling, and punctuation mistakes in the text below.\nCritical rules:\n- Do NOT rephrase, reword, or change the style.\n- If a sentence is already correct, leave it exactly as it is.\n- Keep the original tone, word choices, and meaning.\n- Output ONLY the corrected text.\n\nExample\nInput: "Their going to the office tomorow, me and him will joins them."\nOutput: They\'re going to the office tomorrow; he and I will join them.\n\nNow correct this:\n{{text}}',
    medium: 'Fix grammar, spelling, and punctuation in the following text. Change only what is incorrect — do not rephrase or alter the style. Keep the original tone and meaning.\n\n{{text}}',
    large:  'Correct grammar, spelling, and punctuation only — don\'t rephrase:\n\n{{text}}'
  },
  shorten: {
    small:  'Make the text below much shorter while keeping the core meaning. Rules:\n- Remove filler, repetition, and unnecessary words.\n- Keep all essential facts.\n- Do not add anything new.\n- Output ONLY the shortened text.\n\nExample\nInput: "I just wanted to reach out and let you know that I think we should probably consider maybe rescheduling the meeting to a later time if that works for everyone."\nOutput: Let\'s reschedule the meeting to a later time if that works for everyone.\n\nNow shorten this:\n{{text}}',
    medium: 'Make the following text significantly shorter while keeping the core meaning. Cut filler and repetition, keep essential facts.\n\n{{text}}',
    large:  'Tighten this — significantly shorter, same meaning:\n\n{{text}}'
  },
  expand: {
    small:  'Expand the text below with more detail and clarity. Rules:\n- Keep the same tone and intent.\n- Add helpful detail, but do NOT invent specific facts, names, numbers, or claims.\n- Make it flow naturally — do not just repeat the same point.\n- Output ONLY the expanded text.\n\nExample\nInput: "Thanks for the help yesterday."\nOutput: Thank you so much for your help yesterday — I really appreciate you taking the time. It made a real difference, and the task went much more smoothly because of it.\n\nNow expand this:\n{{text}}',
    medium: 'Expand the following text with more detail and clarity, keeping the same tone. Don\'t invent specific facts or numbers that weren\'t implied.\n\n{{text}}',
    large:  'Expand this with more detail and clarity, keeping the tone and not inventing facts:\n\n{{text}}'
  }
};

// Map a model's parameter size to a tier.
function tierForParamSize(paramSize) {
  if (!paramSize) return 'medium'; // safe fallback when metadata is missing
  const b = parseFloat(String(paramSize)); // "3B" -> 3, "70B" -> 70, "7.2B" -> 7.2
  if (isNaN(b)) return 'medium';
  if (b <= 4) return 'small';
  if (b <= 13) return 'medium';
  return 'large';
}

// Infer param size from a model name when metadata isn't available.
// e.g. "llama3.2:3b" -> "3B", "qwen2.5:7b-instruct" -> "7B", "llama3.1:70b-q4" -> "70B"
function inferParamSizeFromName(name) {
  if (!name) return null;
  const m = String(name).toLowerCase().match(/(\d+(?:\.\d+)?)\s*b\b/);
  return m ? m[1] + 'B' : null;
}

function getActiveTier() {
  // Prefer the stored parameter size (set by popup from /v1/models or /api/tags);
  // fall back to inferring from the model name.
  const sizeFromMeta = state.settings.paramSize;
  const sizeFromName = inferParamSizeFromName(state.settings.model);
  return tierForParamSize(sizeFromMeta || sizeFromName);
}

function buildMessages(actionKey, text) {
  const tier = getActiveTier();
  const system = SYSTEM_PROMPTS[tier];
  const userTemplate = (PROMPTS[actionKey] && PROMPTS[actionKey][tier]) || PROMPTS[actionKey].medium;
  const user = userTemplate.replace('{{text}}', text);
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

const state = {
  activeField: null,
  iconEl: null,
  menuEl: null,
  modalEl: null,
  currentAction: null,
  originalText: '',
  settings: { endpoint: 'http://localhost:11434', model: 'llama3.2:3b', paramSize: null, apiKey: '' }
};

chrome.storage.sync.get(['endpoint', 'model', 'paramSize', 'apiKey'], (data) => {
  if (data.endpoint) state.settings.endpoint = data.endpoint;
  if (data.model) state.settings.model = data.model;
  if (data.paramSize) state.settings.paramSize = data.paramSize;
  if (data.apiKey) state.settings.apiKey = data.apiKey;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.endpoint) state.settings.endpoint = changes.endpoint.newValue;
  if (changes.model) state.settings.model = changes.model.newValue;
  if (changes.paramSize) state.settings.paramSize = changes.paramSize.newValue;
  if (changes.apiKey) state.settings.apiKey = changes.apiKey.newValue;
});

function isEditable(el) {
  if (!el || !el.tagName) return false;
  // Only show on multi-line writing surfaces:
  // - <textarea>
  // - contenteditable elements (Gmail compose, rich-text editors, etc.)
  // Single-line <input> fields (search, email, URL, login) are excluded
  // because they're not meant for prose.
  if (el.tagName === 'TEXTAREA') return true;
  if (el.isContentEditable) return true;
  return false;
}

function getText(el) {
  if (el.tagName === 'TEXTAREA') return el.value;
  return el.innerText;
}

function setText(el, text) {
  if (el.tagName === 'TEXTAREA') {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    el.innerText = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }
}

/* ---------- Floating icon ---------- */

function createIcon() {
  const icon = document.createElement('div');
  icon.className = 'tf-icon';
  icon.innerHTML = ICON_SVG;
  icon.title = 'TextForge';
  icon.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });
  document.body.appendChild(icon);
  return icon;
}

function positionIcon(field) {
  if (!state.iconEl) state.iconEl = createIcon();
  const rect = field.getBoundingClientRect();
  if (rect.width < 60 || rect.height < 20) {
    state.iconEl.style.display = 'none';
    return;
  }
  state.iconEl.style.display = 'flex';
  state.iconEl.style.top = (window.scrollY + rect.bottom - 32) + 'px';
  state.iconEl.style.left = (window.scrollX + rect.right - 32) + 'px';
}

/* ---------- Action menu ---------- */

function createMenu() {
  const menu = document.createElement('div');
  menu.className = 'tf-menu';
  const header = document.createElement('div');
  header.className = 'tf-menu-header';
  header.textContent = 'TextForge';
  menu.appendChild(header);

  ACTIONS.forEach(a => {
    const item = document.createElement('button');
    item.className = 'tf-menu-item';
    item.innerHTML = `<div class="tf-menu-label">${a.label}</div><div class="tf-menu-desc">${a.desc}</div>`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideMenu();
      runAction(a);
    });
    menu.appendChild(item);
  });
  document.body.appendChild(menu);
  return menu;
}

function toggleMenu() {
  if (state.menuEl && state.menuEl.style.display === 'block') hideMenu();
  else showMenu();
}

function showMenu() {
  if (!state.menuEl) state.menuEl = createMenu();
  if (!state.iconEl) return;
  state.menuEl.style.display = 'block';
  const r = state.iconEl.getBoundingClientRect();
  const menuW = state.menuEl.offsetWidth;
  const menuH = state.menuEl.offsetHeight;
  let left = window.scrollX + r.right - menuW;
  let top = window.scrollY + r.top - menuH - 6;
  if (top < window.scrollY + 8) top = window.scrollY + r.bottom + 6;
  if (left < window.scrollX + 8) left = window.scrollX + 8;
  state.menuEl.style.left = left + 'px';
  state.menuEl.style.top = top + 'px';
}

function hideMenu() {
  if (state.menuEl) state.menuEl.style.display = 'none';
}

document.addEventListener('mousedown', (e) => {
  if (state.menuEl && state.menuEl.style.display === 'block' &&
      !state.menuEl.contains(e.target) && state.iconEl && !state.iconEl.contains(e.target)) {
    hideMenu();
  }
}, true);

/* ---------- Action runner with PREVIEW MODAL ---------- */

async function runAction(action) {
  const field = state.activeField;
  if (!field) return;
  const text = getText(field).trim();
  if (!text) {
    showToast('No text to process');
    return;
  }

  state.currentAction = action;
  state.originalText = text;

  showPreviewModal({ loading: true });

  try {
    const messages = buildMessages(action.key, text);
    const result = await callLLM(messages);
    updatePreviewModal({ loading: false, result: result.trim() });
  } catch (err) {
    console.error('[TextForge]', err);
    updatePreviewModal({ loading: false, error: err.message || 'Could not reach the AI server. Is it running?' });
  }
}

// OpenAI-compatible chat completions — works with Ollama, LM Studio, llama.cpp,
// Jan, vLLM, LocalAI, and any other server exposing /v1/chat/completions.
async function callLLM(messages) {
  const base = state.settings.endpoint.replace(/\/$/, '');
  // Accept endpoints with or without a trailing /v1
  const url = (/\/v1$/.test(base) ? base : base + '/v1') + '/chat/completions';

  const headers = { 'Content-Type': 'application/json' };
  if (state.settings.apiKey) {
    headers['Authorization'] = 'Bearer ' + state.settings.apiKey;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: state.settings.model,
      messages,
      stream: false,
      temperature: 0.7
    })
  });
  if (!res.ok) {
    let detail = 'HTTP ' + res.status;
    try {
      const errBody = await res.json();
      if (errBody && errBody.error) {
        detail += ' — ' + (errBody.error.message || errBody.error);
      }
    } catch (e) { /* ignore */ }
    throw new Error(detail);
  }
  const data = await res.json();
  // OpenAI-compatible response shape
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content || '';
  }
  return '';
}

/* ---------- Preview modal ---------- */

function showPreviewModal({ loading }) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'tf-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const modal = document.createElement('div');
  modal.className = 'tf-modal';
  modal.innerHTML = `
    <div class="tf-modal-header">
      <div class="tf-modal-title">
        <span class="tf-badge">${state.currentAction.label}</span>
        <span class="tf-modal-subtitle">Preview &amp; Confirm</span>
      </div>
      <button class="tf-close" title="Close">×</button>
    </div>
    <div class="tf-modal-body">
      <div class="tf-section">
        <div class="tf-section-label">Original</div>
        <div class="tf-original">${escapeHtml(state.originalText)}</div>
      </div>
      <div class="tf-section">
        <div class="tf-section-label">Suggested</div>
        <div class="tf-result-wrap">
          <div class="tf-loading">
            <div class="tf-spinner"></div>
            <div class="tf-loading-text">Thinking with ${escapeHtml(state.settings.model)}…</div>
          </div>
        </div>
      </div>
    </div>
    <div class="tf-modal-footer">
      <div class="tf-footer-left">
        <button class="tf-btn tf-btn-ghost" data-act="copy" disabled>📋 Copy</button>
        <button class="tf-btn tf-btn-ghost" data-act="retry" disabled>🔄 Retry</button>
      </div>
      <div class="tf-footer-right">
        <button class="tf-btn tf-btn-secondary" data-act="reject">Reject</button>
        <button class="tf-btn tf-btn-primary" data-act="accept" disabled>Replace text</button>
      </div>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  state.modalEl = overlay;

  modal.querySelector('.tf-close').addEventListener('click', closeModal);
  modal.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => handleModalAction(btn.dataset.act));
  });

  document.addEventListener('keydown', escListener);
}

function updatePreviewModal({ loading, result, error }) {
  if (!state.modalEl) return;
  const wrap = state.modalEl.querySelector('.tf-result-wrap');
  const acceptBtn = state.modalEl.querySelector('[data-act="accept"]');
  const copyBtn = state.modalEl.querySelector('[data-act="copy"]');
  const retryBtn = state.modalEl.querySelector('[data-act="retry"]');

  if (error) {
    wrap.innerHTML = `<div class="tf-error">⚠ ${escapeHtml(error)}</div>`;
    retryBtn.disabled = false;
    return;
  }

  // Editable textarea so the user can tweak before accepting
  wrap.innerHTML = `<textarea class="tf-result" rows="6">${escapeHtml(result)}</textarea>`;
  acceptBtn.disabled = false;
  copyBtn.disabled = false;
  retryBtn.disabled = false;
}

function handleModalAction(act) {
  if (!state.modalEl) return;
  const resultEl = state.modalEl.querySelector('.tf-result');
  const text = resultEl ? resultEl.value : '';

  if (act === 'accept') {
    if (state.activeField && document.contains(state.activeField)) {
      setText(state.activeField, text);
      showToast('Text replaced ✓');
    }
    closeModal();
  } else if (act === 'reject') {
    closeModal();
  } else if (act === 'copy') {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'));
  } else if (act === 'retry') {
    runAction(state.currentAction);
  }
}

function closeModal() {
  if (state.modalEl) {
    state.modalEl.remove();
    state.modalEl = null;
  }
  document.removeEventListener('keydown', escListener);
}

function escListener(e) {
  if (e.key === 'Escape') closeModal();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Toast ---------- */

function showToast(msg, isError) {
  const t = document.createElement('div');
  t.className = 'tf-toast' + (isError ? ' tf-toast-error' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

/* ---------- Focus tracking ---------- */

document.addEventListener('focusin', (e) => {
  if (isEditable(e.target)) {
    state.activeField = e.target;
    positionIcon(e.target);
  }
});

document.addEventListener('focusout', () => {
  setTimeout(() => {
    if (state.iconEl && !state.iconEl.matches(':hover') &&
        (!state.menuEl || state.menuEl.style.display !== 'block') &&
        !state.modalEl) {
      state.iconEl.style.display = 'none';
    }
  }, 200);
});

window.addEventListener('scroll', () => {
  if (state.activeField && document.contains(state.activeField) && !state.modalEl) {
    positionIcon(state.activeField);
  }
}, true);
window.addEventListener('resize', () => {
  if (state.activeField && !state.modalEl) positionIcon(state.activeField);
});
