const endpointEl = document.getElementById('endpoint');
const modelEl = document.getElementById('model');
const modelMetaEl = document.getElementById('model-meta');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh');
const resetBtn = document.getElementById('reset-endpoint');
const apikeyEl = document.getElementById('apikey');
const advancedToggle = document.getElementById('advanced-toggle');
const advancedPanel = document.getElementById('advanced');

let availableModels = [];   // [{ id, paramSize }]
let savedModel = '';
let savedEndpoint = '';
let savedApiKey = '';

// ---- Load saved settings ----
chrome.storage.sync.get(['endpoint', 'model', 'apiKey'], (data) => {
  savedEndpoint = data.endpoint || 'http://localhost:11434';
  savedModel = data.model || '';
  savedApiKey = data.apiKey || '';
  endpointEl.value = savedEndpoint;
  apikeyEl.value = savedApiKey;
  if (savedApiKey) advancedPanel.classList.add('open'); // reveal if a key exists
  loadModels();
});

// ---- Advanced panel toggle ----
advancedToggle.addEventListener('click', () => {
  const open = advancedPanel.classList.toggle('open');
  advancedToggle.textContent = (open ? '▾' : '▸') + ' Advanced';
});

// ---- Auto-save endpoint ----
endpointEl.addEventListener('change', () => {
  const v = endpointEl.value.trim();
  if (!v) { endpointEl.value = savedEndpoint; return; }
  if (v !== savedEndpoint) {
    chrome.storage.sync.set({ endpoint: v }, () => {
      savedEndpoint = v;
      flashStatus('✓ Endpoint saved — refreshing models', 'ok', 2000);
      loadModels();
    });
  }
});
endpointEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); endpointEl.blur(); }
});

// ---- Auto-save API key ----
apikeyEl.addEventListener('change', () => {
  const v = apikeyEl.value.trim();
  if (v !== savedApiKey) {
    chrome.storage.sync.set({ apiKey: v }, () => {
      savedApiKey = v;
      flashStatus('✓ API key saved', 'ok', 1500);
      loadModels(); // re-fetch with the new key
    });
  }
});

// ---- Auto-save model (+ its param size) ----
modelEl.addEventListener('change', () => {
  updateModelMeta();
  const newModel = modelEl.value.trim();
  if (newModel && newModel !== savedModel) {
    const opt = modelEl.selectedOptions[0];
    const paramSize = opt ? (opt.dataset.params || '') : '';
    chrome.storage.sync.set({ model: newModel, paramSize: paramSize }, () => {
      savedModel = newModel;
      flashStatus('✓ Model saved: ' + newModel, 'ok', 2500);
    });
  }
});

refreshBtn.addEventListener('click', () => loadModels(true));
resetBtn.addEventListener('click', () => {
  endpointEl.value = 'http://localhost:11434';
  endpointEl.dispatchEvent(new Event('change'));
});

// ---- Helpers ----
function v1Base(raw) {
  const b = raw.trim().replace(/\/$/, '');
  return /\/v1$/.test(b) ? b : b + '/v1';
}
function authHeaders() {
  const h = {};
  const key = apikeyEl.value.trim();
  if (key) h['Authorization'] = 'Bearer ' + key;
  return h;
}

// Infer parameter size from a model id, e.g. "llama3.2:3b" -> "3B"
function inferParamSize(id) {
  const m = String(id).toLowerCase().match(/(\d+(?:\.\d+)?)\s*b\b/);
  return m ? m[1] + 'B' : '';
}
function tierFor(paramSize) {
  const n = parseFloat(paramSize);
  if (isNaN(n)) return 'medium';
  if (n <= 4) return 'small';
  if (n <= 13) return 'medium';
  return 'large';
}

// ---- Fetch model list via OpenAI-compatible /v1/models ----
async function loadModels(animate) {
  if (animate) refreshBtn.classList.add('spinning');
  modelEl.innerHTML = '<option value="">Loading…</option>';
  modelMetaEl.textContent = '';

  const url = v1Base(endpointEl.value) + '/models';
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // OpenAI shape: { data: [ { id: "..." }, ... ] }
    const list = (data.data || data.models || []);
    availableModels = list.map(m => {
      const id = m.id || m.name || '';
      return { id, paramSize: inferParamSize(id) };
    }).filter(m => m.id);
    renderModelOptions();
  } catch (e) {
    availableModels = [];
    renderEmptyState();
    flashStatus('✗ Cannot reach ' + endpointEl.value.trim(), 'err', 4000);
  } finally {
    setTimeout(() => refreshBtn.classList.remove('spinning'), 300);
  }
}

function renderModelOptions() {
  if (availableModels.length === 0) { renderEmptyState(); return; }
  modelEl.innerHTML = '';
  availableModels.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.id + (m.paramSize ? '  ·  ' + m.paramSize : '');
    opt.dataset.params = m.paramSize || '';
    modelEl.appendChild(opt);
  });

  if (savedModel && availableModels.find(m => m.id === savedModel)) {
    modelEl.value = savedModel;
  } else if (availableModels.length > 0) {
    modelEl.value = availableModels[0].id;
    const ps = availableModels[0].paramSize || '';
    chrome.storage.sync.set({ model: availableModels[0].id, paramSize: ps }, () => {
      savedModel = availableModels[0].id;
    });
  }
  updateModelMeta();
}

function renderEmptyState() {
  modelEl.innerHTML = '<option value="">No models available</option>';
  modelMetaEl.innerHTML = `
    <div class="empty-state">
      No models found at this endpoint.<br>
      Ollama: <code>ollama pull llama3.2:3b</code><br>
      LM Studio: load a model in the Developer tab.<br>
      Then click ⟳ to refresh.
    </div>`;
}

function updateModelMeta() {
  const opt = modelEl.selectedOptions[0];
  if (!opt || !opt.value) { modelMetaEl.textContent = ''; return; }
  const ps = opt.dataset.params || '';
  if (!ps) {
    modelMetaEl.innerHTML = 'Size unknown — using <strong>medium</strong> prompt tuning' +
      '<span class="tier-pill tier-medium">medium</span>';
    return;
  }
  const tier = tierFor(ps);
  const tierDesc = {
    small:  'detailed prompts + examples',
    medium: 'standard prompts',
    large:  'concise prompts'
  }[tier];
  modelMetaEl.innerHTML =
    ps + ' params · prompts auto-tuned' +
    `<span class="tier-pill tier-${tier}">${tier}</span>` +
    `<br><span style="color:#9ca3af;">${tierDesc}</span>`;
}

// ---- Test generation via /v1/chat/completions ----
document.getElementById('test').addEventListener('click', async () => {
  const model = modelEl.value.trim();
  if (!model) { flashStatus('No model selected', 'err', 3000); return; }
  flashStatus('Generating test response…', '');
  const url = v1Base(endpointEl.value) + '/chat/completions';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "ready" in one word.' }],
        stream: false,
        temperature: 0
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const out = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
    if (out) {
      flashStatus(`✓ Model responded: "${out.trim().slice(0, 40)}"`, 'ok', 4000);
    } else {
      flashStatus('Model returned no response', 'err', 3000);
    }
  } catch (e) {
    flashStatus('✗ Test failed: ' + e.message, 'err', 4000);
  }
});

function flashStatus(msg, cls, duration) {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + (cls || '');
  if (duration) {
    setTimeout(() => {
      if (statusEl.textContent === msg) {
        statusEl.textContent = '';
        statusEl.className = 'status';
      }
    }, duration);
  }
}
