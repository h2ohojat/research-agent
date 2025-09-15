// backend/apps/frontend/static/frontend/js/model-selection-modal-ui.js
/**
 * @fileoverview Manages the UI and interactions within the model selection modal.
 * Responsibilities:
 * - Listening to state changes for models (loading, success, error).
 * - Rendering the list of models as interactive cards (DOM-safe).
 * - Handling search/filtering with debounce.
 * - Handling model selection and updating the global state (selectedModel & selectedModelId).
 * - Managing different view states (loading, error, empty, list).
 * - Fetching external public model metadata from AvalAI and enriching internal models.
 * - Thin open/close wrappers to integrate with window.modalUI.
 * - A11y/Keyboard/Focus trap + simple sort & capability filters + RTL-friendly tweaks.
 */

(function() {
  "use strict";

  // --------- Cache & Views ---------
  const elements = {};
  let debounceTimer;
  let _stylesInjected = false;

  // UI state (local)
  let currentSort = 'default'; // 'default' | 'name' | 'provider' | 'context' | 'priceIn' | 'priceOut'
  const filterCaps = { text: false, image: false, audio: false }; // AND filter
  let lastFocusedBeforeOpen = null;
  let focusTrapHandler = null;

  function cacheElements() {
    elements.container    = document.getElementById('modal-content-container');
    elements.loadingView  = document.getElementById('modal-loading-view');
    elements.errorView    = document.getElementById('modal-error-view');
    elements.emptyView    = document.getElementById('modal-empty-view');
    elements.modelList    = document.getElementById('modal-model-list');
    elements.searchInput  = document.getElementById('model-search-input');
    elements.retryButton  = document.getElementById('modal-retry-btn');
    elements.modalRoot    = document.getElementById('model-selection-modal'); // ریشه‌ی مودال (برای focus trap)
  }

  function switchView(viewName) {
    if (!elements.container) return;
    const views = {
      loading: elements.loadingView,
      error:   elements.errorView,
      empty:   elements.emptyView,
      list:    elements.modelList
    };
    Object.values(views).forEach(v => v && v.classList.remove('active'));
    if (views[viewName]) {
      views[viewName].classList.add('active');
    } else {
      console.warn(`View "${viewName}" not found.`);
    }
  }

  // --------- Inject minimal styles (scoped to modal) ---------
  function ensureInjectedStyles() {
    if (_stylesInjected) return;
    const css = `
      /* ===== Toolbar (sort + filters) ===== */
      #model-filterbar{
        display:flex;align-items:center;gap:10px;margin:8px 0 12px 0;flex-wrap:wrap
      }
      #model-filterbar .sep { flex: 0 0 1px; height: 22px; background: rgba(0,0,0,0.08); }
      #model-filterbar label { font-size:12px; color:#475569; }
      #model-filterbar select, #model-filterbar button.cap-toggle {
        font-size:12px; padding:6px 10px; border:1px solid #e2e8f0; border-radius:8px; background:#fff; color:#0f172a;
      }
      #model-filterbar button.cap-toggle[aria-pressed="true"] {
        background:#eef2ff; border-color:#c7d2fe;
      }
      @media (max-width: 640px){
        /* پنهان‌سازی نوار ابزار در موبایل برای سادگی UI */
        #model-filterbar{ display:none; }
      }

      /* ===== Badges row ===== */
      #modal-model-list .model-caps {
        display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;
      }
      /* Badge pill */
      #modal-model-list .model-badge {
        display:inline-flex; align-items:center; gap:6px; padding:3px 8px;
        border:1px solid rgba(0,0,0,0.08); border-radius:999px;
        font-size:12px; line-height:1; background:#f8fafc; color:#0f172a;
        user-select:none; white-space:nowrap;
      }
      /* Light tints per kind (subtle) */
      #modal-model-list .model-badge[data-kind="Text"]       { background:#eef2ff; border-color:#e0e7ff; }
      #modal-model-list .model-badge[data-kind="Image"]      { background:#ecfeff; border-color:#cffafe; }
      #modal-model-list .model-badge[data-kind="Audio"]      { background:#f0fdf4; border-color:#dcfce7; }
      #modal-model-list .model-badge[data-kind="Tools"]      { background:#fff7ed; border-color:#ffedd5; }
      #modal-model-list .model-badge[data-kind="Web"]        { background:#f1f5f9; border-color:#e2e8f0; }
      #modal-model-list .model-badge[data-kind="Structured"] { background:#f5f3ff; border-color:#ede9fe; }
      #modal-model-list .model-badge[data-kind="Reasoning"]  { background:#fef2f2; border-color:#fee2e2; }

      #modal-model-list .model-badge .ico {
        width: 14px; height: 14px; display:inline-block;
      }
      #modal-model-list .model-badge .tier { font-weight:600; opacity:.85; }

      /* ===== Meta block as grid ===== */
      #modal-model-list .model-meta {
        display:grid; grid-template-columns: 1fr 1fr; gap:8px 12px; margin-top:10px;
      }
      #modal-model-list .model-kv {
        display:flex; gap:6px; font-size:12px; align-items:baseline; min-width:0;
      }
      #modal-model-list .model-kv .k { color:#64748b; flex:0 0 auto; }
      #modal-model-list .model-kv .v { color:#0f172a; font-weight:600; overflow:hidden; text-overflow:ellipsis; }

      /* Subtle separator between header and meta */
      #modal-model-list .model-sep { height:1px;
        background: linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.02)); margin-top:10px; }

      /* Keep card layout intact, spacing + a11y focus */
      #modal-model-list .model-card { text-align:left; outline:none; }
      #modal-model-list .model-card .model-card-main {
        display:flex; align-items:baseline; justify-content:space-between; gap:10px;
      }
      #modal-model-list .model-card .model-card-name {
        font-weight:700; letter-spacing:.2px; overflow:hidden; text-overflow:ellipsis;
      }
      #modal-model-list .model-card .model-card-provider { font-size:12px; color:#475569; }
      #modal-model-list .model-card:focus-visible { box-shadow:0 0 0 2px #6366f1 inset; border-radius:10px; }

      /* Pinned label */
      #modal-model-list .pinned-label {
        margin: 8px 0 4px; font-size:12px; color:#64748b;
      }
      @media (max-width: 640px){
        /* پنهان در موبایل برای صرفه‌جویی فضا */
        #modal-model-list .pinned-label { display:none; }
      }

      /* ===== RTL tweaks ===== */
      :root[dir="rtl"] #modal-model-list .model-card .model-card-main{
        flex-direction: row-reverse;
      }
      :root[dir="rtl"] #modal-model-list .model-kv .k { order:2; }
      :root[dir="rtl"] #modal-model-list .model-kv .v { order:1; }
    `;
    const tag = document.createElement('style');
    tag.setAttribute('data-model-selector-enhanced', 'true');
    tag.textContent = css;
    document.head.appendChild(tag);
    _stylesInjected = true;
  }

  // --------- State Getters ---------
  const getState = () => (window.appState?.get?.() || {});
  const getModels = () => (getState().models || []);
  const getSelectedModelId =
    () => (getState().selectedModel?.model_id || getState().selectedModelId || null);

  // --------- Small Format/DOM Helpers (DOM-safe) ---------
  function fmtPrice(v) {
    if (typeof v !== 'number') return null;
    return `$${v.toFixed(2)}/1k`;
  }
  function fmtTokens(v) {
    if (v == null) return null;
    if (typeof v === 'number') return v >= 1000 ? `${(v/1000)}k` : `${v}`;
    const s = String(v);
    return s;
  }

  function createSVGIcon(kind) {
    const svgNS = "http://www.w3.org/2000/svg";
    const el = document.createElementNS(svgNS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.classList.add('ico');

    const add = (tag, attrs) => {
      const n = document.createElementNS(svgNS, tag);
      Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k, v));
      el.appendChild(n);
    };

    switch (kind) {
      case 'Text':
        add('path', { d: 'M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' });
        break;
      case 'Image':
        add('rect', { x:'3', y:'3', width:'18', height:'18', rx:'2' });
        add('circle', { cx:'9', cy:'9', r:'2' });
        add('path', { d:'M21 15l-5-5L5 21' });
        break;
      case 'Audio':
        add('path', { d:'M4 12v4M8 8v12M12 4v16M16 8v12M20 12v4' });
        break;
      case 'Tools':
        add('path', { d:'M21 3l-6 6' });
        add('path', { d:'M3 21l9-9' });
        add('circle', { cx:'21', cy:'3', r:'2' });
        add('circle', { cx:'3', cy:'21', r:'2' });
        break;
      case 'Web':
        add('circle', { cx:'12', cy:'12', r:'10' });
        add('path', { d:'M2 12h20' });
        add('path', { d:'M12 2a15.3 15.3 0 0 1 0 20' });
        add('path', { d:'M12 2a15.3 15.3 0 0 0 0 20' });
        break;
      case 'Structured':
        add('path', { d:'M8 3H6a3 3 0 0 0-3 3v2a3 3 0 0 1-3 3 3 3 0 0 1 3 3v2a3 3 0 0 0 3 3h2' });
        add('path', { d:'M16 3h2a3 3 0 0 1 3 3v2a3 3 0 0 0 3 3 3 3 0 0 0-3 3v2a3 3 0 0 1-3 3h-2' });
        break;
      case 'Reasoning':
        add('path', { d:'M8 8a4 4 0 0 1 8 0v1a4 4 0 0 1 0 8v1a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-1a4 4 0 0 1 0-8z' });
        break;
      default:
        add('circle', { cx:'12', cy:'12', r:'10' });
    }
    return el;
  }

  function badge(kind, text, titleText) {
    const b = document.createElement('span');
    b.className = 'model-badge';
    b.dataset.kind = kind;
    b.title = titleText || text || kind;

    const icon = createSVGIcon(kind);
    const label = document.createElement('span');
    label.textContent = text || kind;

    b.appendChild(icon);
    b.appendChild(label);
    return b;
  }

  function kv(label, value) {
    if (value == null || value === '') return null;
    const item = document.createElement('div');
    item.className = 'model-kv';
    const k = document.createElement('span');
    k.className = 'k';
    k.textContent = label;
    const v = document.createElement('span');
    v.className = 'v';
    v.textContent = value;
    item.appendChild(k);
    item.appendChild(v);
    return item;
  }

  // --------- Safe getters ---------
  function g(obj, path) {
    try { return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj); }
    catch { return undefined; }
  }
  function normalizeKey(s) { return String(s || '').trim().toLowerCase(); }

  // --------- External metadata enrichment (from AvalAI) ---------
  let _externalMetaLoaded = false;
  let _externalMapById = new Map();
  let _externalMapByName = new Map();
  let _externalLastError = null;

  async function loadExternalMetaOnce() {
    if (_externalMetaLoaded) return;
    _externalLastError = null;

    try {
      const resp = await fetch('https://api.avalai.ir/public/models', {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store'
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();

      const list = Array.isArray(raw?.data) && (raw?.object === 'list' || typeof raw?.object === 'string')
                    ? raw.data
                  : Array.isArray(raw?.models)
                    ? raw.models
                  : Array.isArray(raw)
                    ? raw
                  : [];

      _externalMapById.clear();
      _externalMapByName.clear();

      for (const m of list) {
        const keys = new Set();
        ['model_id','id','model','name','display_name'].forEach(k => {
          const v = m && m[k];
          if (v) keys.add(normalizeKey(v));
        });
        for (const k of keys) {
          _externalMapById.set(k, m);
          _externalMapByName.set(k, m);
        }
      }

      _externalMetaLoaded = true;
      console.log(`🔎 Loaded external model metadata (${list.length} items)`);
    } catch (e) {
      _externalLastError = e;
      console.warn('⚠️ Could not load external models metadata:', e);
      _externalMetaLoaded = true;
    }
  }

  function findExternalForInternal(internalModel) {
    const candidates = [
      internalModel.model_id,
      internalModel.id,
      internalModel.model,
      internalModel.display_name,
      internalModel.name
    ].map(normalizeKey).filter(Boolean);

    for (const k of candidates) {
      if (_externalMapById.has(k)) return _externalMapById.get(k);
      if (_externalMapByName.has(k)) return _externalMapByName.get(k);
    }
    return null;
  }

  function enrichModelsWithExternal(models) {
    if (!Array.isArray(models) || models.length === 0) return models;

    return models.map(m => {
      const ext = findExternalForInternal(m);
      if (!ext) return m;
      const clone = { ...m };

      if (!clone.modalities && (ext.modalities || ext.modality)) {
        clone.modalities = Array.isArray(ext.modalities) ? ext.modalities
                        : ext.modality ? [ext.modality] : undefined;
      }
      if (!clone.capabilities && ext.capabilities) clone.capabilities = ext.capabilities;
      if (!clone.tasks && (ext.tasks || ext.features || ext.supports)) {
        clone.tasks = ext.tasks || ext.features || ext.supports;
      }
      if (!clone.context_window) {
        clone.context_window = ext.context_window
          || ext.context_tokens
          || ext.max_input_tokens
          || ext.max_tokens
          || ext.context_length;
      }
      if (!clone.pricing && (ext.pricing || ext.prices || ext.costs)) {
        clone.pricing = ext.pricing || ext.prices || ext.costs;
      }
      if (!clone.latency_ms && (ext.latency_ms || ext.latency)) {
        clone.latency_ms = ext.latency_ms || ext.latency;
      }
      if (!clone.quota && ext.quota) clone.quota = ext.quota;
      if (!clone.availability && (ext.availability || ext.status)) {
        clone.availability = ext.availability || ext.status;
      }

      clone.ext = { ...(clone.ext || {}), ...ext };
      return clone;
    });
  }

  async function ensureExternalEnrichment() {
    await loadExternalMetaOnce();
    if (_externalLastError) return;

    const st = getState();
    const models = st.models || [];
    if (!models.length) return;

    const alreadyEnriched = models.some(m => m.ext || m.modalities || m.capabilities || m.tasks);
    if (alreadyEnriched) return;

    const enriched = enrichModelsWithExternal(models);
    const changed = enriched.some((m,i) => m !== models[i]);
    if (changed) {
      window.appState.update({ models: enriched });
    }
  }

  // --------- Capability Detection ---------
  function detectCapabilities(model) {
    const idNorm = normalizeKey(model.model_id || model.id || g(model, 'ext.id') || '');
    const extMode = g(model, 'mode') || g(model, 'ext.mode') || null;

    const supportsVision   = !!(g(model, 'supports_vision') || g(model, 'ext.supports_vision'));
    const supportsWeb      = !!(g(model, 'supports_web_search') || g(model, 'ext.supports_web_search'));
    const supportsTools    = !!(g(model, 'supports_function_calling') || g(model, 'ext.supports_function_calling') || g(model, 'supports_tool_choice') || g(model, 'ext.supports_tool_choice'));
    const supportsSchema   = !!(g(model, 'supports_response_schema') || g(model, 'ext.supports_response_schema'));
    const supportsAudioIn  = !!(g(model, 'supports_audio_input') || g(model, 'ext.supports_audio_input'));
    const supportsAudioOut = !!(g(model, 'supports_audio_output') || g(model, 'ext.supports_audio_output'));

    const isImageMode =
      (extMode === 'image_generation')
      || supportsVision
      || /(dall[- ]?e|imagen|stable|sd(?:3|xl)?|^stability\.?|flux|wan|image|img)/i.test(idNorm);

    const isAudioMode =
      (extMode === 'audio_transcription' || extMode === 'audio_speech')
      || supportsAudioIn || supportsAudioOut
      || /(whisper|tts|audio|transcribe|speech|stt|asr)/i.test(idNorm);

    const isEmbeddingMode = (extMode === 'embedding') || /embedding/.test(idNorm);
    const isModerationMode = (extMode === 'moderation') || /moderation/.test(idNorm);

    const isTextMode =
      (extMode === 'chat' || extMode === 'responses')
      || (!isImageMode && !isAudioMode && !isEmbeddingMode && !isModerationMode);

    const reasoningTier = g(model, 'reasoning_tier') || g(model, 'reasoning') || g(model, 'ext.reasoning_tier') || null;

    return {
      hasText: isTextMode,
      hasImage: isImageMode,
      hasAudio: isAudioMode,
      hasTools: supportsTools,
      hasWeb: supportsWeb,
      hasStructured: supportsSchema,
      reasoningTier,
      hasReasoning: !!reasoningTier
    };
  }

  // --------- Toolbar (Sort + Filters) ---------
  function ensureToolbar() {
    if (!elements.searchInput || !elements.container) return;

    // اگر قبلاً ساخته شده، دوباره نساز
    if (elements.filterbar && document.body.contains(elements.filterbar)) return;

    const bar = document.createElement('div');
    bar.id = 'model-filterbar';

    // Sort
    const sortLabel = document.createElement('label');
    sortLabel.textContent = 'Sort:';
    sortLabel.setAttribute('for', 'model-sort-select');

    const sortSel = document.createElement('select');
    sortSel.id = 'model-sort-select';
    [
      {v:'default', t:'Default'},
      {v:'name', t:'Name (A→Z)'},
      {v:'provider', t:'Provider (A→Z)'},
      {v:'context', t:'Context (desc)'},
      {v:'priceIn', t:'Input $/1k (asc)'},
      {v:'priceOut', t:'Output $/1k (asc)'}
    ].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.v; opt.textContent = o.t;
      sortSel.appendChild(opt);
    });
    sortSel.value = currentSort;
    sortSel.addEventListener('change', () => {
      currentSort = sortSel.value;
      renderModelList();
    });

    // Cap toggles
    const mkCapBtn = (key, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cap-toggle';
      b.setAttribute('data-cap', key);
      b.setAttribute('aria-pressed', String(filterCaps[key]));
      b.textContent = label;
      b.addEventListener('click', () => {
        filterCaps[key] = !filterCaps[key];
        b.setAttribute('aria-pressed', String(filterCaps[key]));
        renderModelList();
      });
      return b;
    };

    const textBtn = mkCapBtn('text', 'Text');
    const imageBtn = mkCapBtn('image', 'Image');
    const audioBtn = mkCapBtn('audio', 'Audio');

    // Assemble
    bar.appendChild(sortLabel);
    bar.appendChild(sortSel);

    const sep = document.createElement('div'); sep.className='sep'; bar.appendChild(sep);

    const capsLabel = document.createElement('label');
    capsLabel.textContent = 'Filter:';
    bar.appendChild(capsLabel);
    bar.appendChild(textBtn);
    bar.appendChild(imageBtn);
    bar.appendChild(audioBtn);

    // درج دقیقاً بعد از input جست‌وجو
    elements.searchInput.insertAdjacentElement('afterend', bar);
    elements.filterbar = bar;
    elements.sortSelect = sortSel;
  }

  // --------- Card Builder (DOM-safe) ---------
  function buildCard(model, isActive) {
    const btn = document.createElement('button');
    btn.className = 'model-card';
    btn.type = 'button';
    btn.dataset.modelId = String(model.model_id || model.id || '');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', isActive ? '0' : '-1'); // a11y roving tabindex
    if (isActive) btn.classList.add('active');

    // Header
    const header = document.createElement('div');
    header.className = 'model-card-main';

    const nameEl = document.createElement('span');
    nameEl.className = 'model-card-name';
    nameEl.textContent = model.display_name || model.model_id || 'Unnamed';

    const providerEl = document.createElement('span');
    providerEl.className = 'model-card-provider';
    providerEl.textContent = model.provider?.display_name || model.provider?.name || g(model, 'ext.owned_by') || 'Unknown';

    header.appendChild(nameEl);
    header.appendChild(providerEl);
    btn.appendChild(header);

    // Capabilities (badges with icons) – در موبایل مخفی می‌شوند (قبلاً)
    const capsRow = document.createElement('div');
    capsRow.className = 'model-caps';

    const caps = detectCapabilities(model);
    if (caps.hasText)       capsRow.appendChild(badge('Text', 'Text', 'Text / Chat / Responses'));
    if (caps.hasImage)      capsRow.appendChild(badge('Image', 'Image', 'Image generation / Vision'));
    if (caps.hasAudio)      capsRow.appendChild(badge('Audio', 'Audio', 'Speech / Transcription / TTS'));
    if (caps.hasTools)      capsRow.appendChild(badge('Tools', 'Tools', 'Function Calling / Tools'));
    if (caps.hasWeb)        capsRow.appendChild(badge('Web', 'Web', 'Web / Search access'));
    if (caps.hasStructured) capsRow.appendChild(badge('Structured', 'Structured', 'JSON / Schema-aware'));
    if (caps.hasReasoning)  {
      const b = badge('Reasoning', 'Reasoning', 'Advanced reasoning');
      if (caps.reasoningTier) {
        const tier = document.createElement('span');
        tier.className = 'tier';
        tier.textContent = ` ${caps.reasoningTier}`;
        b.appendChild(tier);
      }
      capsRow.appendChild(b);
    }
    if (capsRow.childNodes.length) btn.appendChild(capsRow);

    // Separator
    const sep = document.createElement('div');
    sep.className = 'model-sep';
    btn.appendChild(sep);

    // Meta (در موبایل پنهان می‌شود طبق استایل‌های قبلی شما)
    const meta = document.createElement('div');
    meta.className = 'model-meta';

    const ctx = fmtTokens(
      model.context_window
      || g(model, 'ext.context_window')
      || g(model, 'ext.context_tokens')
      || g(model, 'ext.max_input_tokens')
      || g(model, 'ext.max_tokens')
      || g(model, 'ext.context_length')
    );

    const pricing = model.pricing || g(model, 'ext.pricing') || g(model, 'ext.prices') || g(model, 'ext.costs') || null;
    const inCost  = fmtPrice(
      pricing?.input_usd_per_1k ?? pricing?.input_per_1k ?? pricing?.input
    );
    const outCost = fmtPrice(
      pricing?.output_usd_per_1k ?? pricing?.output_per_1k ?? pricing?.output
    );

    const p50 = g(model, 'latency_ms.p50') || g(model, 'ext.latency_ms.p50') || g(model, 'ext.latency.p50');
    const p95 = g(model, 'latency_ms.p95') || g(model, 'ext.latency_ms.p95') || g(model, 'ext.latency.p95');
    const latencyLabel = (p50 || p95)
      ? `${p50 ? `p50 ${p50}ms` : ''}${p50 && p95 ? ' · ' : ''}${p95 ? `p95 ${p95}ms` : ''}`
      : null;

    const quotaRem = g(model, 'quota.remaining') ?? g(model, 'ext.quota.remaining');
    const avail = model.availability || g(model, 'ext.availability') || g(model, 'ext.status') || null;

    [
      kv('Context', ctx),
      kv('Input', inCost),
      kv('Output', outCost),
      kv('Latency', latencyLabel),
      kv('Quota', quotaRem != null ? String(quotaRem) : null),
      kv('Status', avail)
    ].forEach(node => node && meta.appendChild(node));

    if (meta.childNodes.length) btn.appendChild(meta);

    return btn;
  }

  function clearListHost() {
    if (!elements.modelList) return;
    elements.modelList.textContent = '';
  }

  function highlightSelectedCard() {
    if (!elements.modelList) return;
    const selectedId = getSelectedModelId();
    const radios = elements.modelList.querySelectorAll('.model-card[role="radio"]');
    let firstFocusable = null;
    radios.forEach((btn, idx) => {
      const mid = btn.getAttribute('data-model-id');
      const isActive = !!(selectedId && selectedId === mid);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
      // roving tabindex: فقط یکی 0 باشد
      if (isActive) {
        btn.setAttribute('tabindex', '0');
        firstFocusable = null; // selected wins
      } else {
        // اگر هنوز هیچ 0 نداریم، اولین کارت را 0 بگذاریم
        if (!firstFocusable) firstFocusable = btn;
        btn.setAttribute('tabindex', '-1');
      }
    });
    // اگر کارت انتخاب‌شده نداریم، اولین کارت فوکوس‌پذیر باشد
    if (!selectedId && firstFocusable) {
      firstFocusable.setAttribute('tabindex', '0');
    }
  }

  // --------- Sorting / Filtering helpers ---------
  function sortModels(list) {
    const byName = (a,b) => ( (a.display_name||a.model_id||'').localeCompare(b.display_name||b.model_id||'') );
    const byProvider = (a,b) => {
      const ap = a.provider?.display_name || a.provider?.name || g(a, 'ext.owned_by') || '';
      const bp = b.provider?.display_name || b.provider?.name || g(b, 'ext.owned_by') || '';
      return ap.localeCompare(bp);
    };
    const priceNum = (m, key) => {
      const p = m.pricing || g(m,'ext.pricing') || g(m,'ext.prices') || g(m,'ext.costs') || null;
      const v = key==='in' ? (p?.input_usd_per_1k ?? p?.input_per_1k ?? p?.input)
                           : (p?.output_usd_per_1k ?? p?.output_per_1k ?? p?.output);
      return typeof v === 'number' ? v : Number.POSITIVE_INFINITY;
    };
    const ctxNum = (m) => {
      const v = m.context_window
        || g(m,'ext.context_window') || g(m,'ext.context_tokens')
        || g(m,'ext.max_input_tokens') || g(m,'ext.max_tokens')
        || g(m,'ext.context_length');
      const n = (typeof v === 'number') ? v : parseFloat(v||'');
      return isNaN(n) ? -1 : n;
    };

    switch (currentSort) {
      case 'name':
        return list.sort(byName);
      case 'provider':
        return list.sort(byProvider);
      case 'priceIn':
        return list.sort((a,b)=> priceNum(a,'in') - priceNum(b,'in'));
      case 'priceOut':
        return list.sort((a,b)=> priceNum(a,'out') - priceNum(b,'out'));
      case 'context':
        return list.sort((a,b)=> ctxNum(b) - ctxNum(a)); // desc
      case 'default':
      default:
        return list; // همان ترتیب فعلی (پس از پین)
    }
  }

  function applyFilters(list) {
    // AND logic برای سه فیلتر ساده
    const anyActive = filterCaps.text || filterCaps.image || filterCaps.audio;
    if (!anyActive) return list;

    return list.filter(m => {
      const caps = detectCapabilities(m);
      if (filterCaps.text && !caps.hasText) return false;
      if (filterCaps.image && !caps.hasImage) return false;
      if (filterCaps.audio && !caps.hasAudio) return false;
      return true;
    });
  }

  // --------- Renderers ---------
  function renderModelList() {
    ensureInjectedStyles();
    ensureToolbar();

    if (elements.modelList) {
      elements.modelList.setAttribute('role', 'radiogroup');
      elements.modelList.setAttribute('aria-label', 'Model list');
    }

    const models = getModels();
    const q = elements.searchInput?.value.trim().toLowerCase() || '';

    let filtered = models.filter(m => {
      const dn = (m.display_name || '').toLowerCase();
      const pid = (m.provider?.display_name || m.provider?.name || g(m, 'ext.owned_by') || '').toLowerCase();
      const mid = (m.model_id || '').toLowerCase();
      return dn.includes(q) || pid.includes(q) || mid.includes(q);
    });

    // فیلتر قابلیت‌ها
    filtered = applyFilters(filtered);

    if (filtered.length === 0) {
      clearListHost();
      switchView('empty');
      return;
    }

    // انتخاب فعلی را پین می‌کنیم (اول لیست) و سپس سورتِ بقیه
    const selectedId = getSelectedModelId();
    let pinned = null;
    if (selectedId) {
      const idx = filtered.findIndex(m => m.model_id === selectedId);
      if (idx >= 0) pinned = filtered.splice(idx, 1)[0];
    }

    // سورت بقیه (پین‌شده سرجایش می‌ماند)
    filtered = sortModels(filtered);

    switchView('list');
    clearListHost();

    const frag = document.createDocumentFragment();

    if (pinned) {
      // لیبل Selected (دسکتاپ)
      const lab = document.createElement('div');
      lab.className = 'pinned-label';
      lab.textContent = 'Selected';
      frag.appendChild(lab);

      const cardPinned = buildCard(pinned, true);
      frag.appendChild(cardPinned);
    }

    filtered.forEach((model, i) => {
      const isActive = !!(selectedId && selectedId === model.model_id);
      const card = buildCard(model, isActive);
      // اگر هیچ کارت فعال نیست، اولین کارت tabindex=0 بگیرد (داخل buildCard set نشده)
      if (!selectedId && i === 0) card.setAttribute('tabindex', '0');
      frag.appendChild(card);
    });

    elements.modelList.appendChild(frag);
    // بعد از رندر، وضعیت tabindex/aria را هماهنگ می‌کنیم
    highlightSelectedCard();
  }

  // --------- Selection & Keyboard ---------
  function selectCard(cardEl) {
    if (!cardEl) return;
    const modelId = cardEl.getAttribute('data-model-id');
    if (!modelId) return;

    const models = getModels();
    const selected = models.find(m => m.model_id === modelId);
    if (!selected) return;

    window.appState.update({
      selectedModel: selected,
      selectedModelId: selected.model_id
    });

    highlightSelectedCard();

    if (window.modelSelectionModalUI.close) {
      window.modelSelectionModalUI.close();
    } else if (window.modalUI?.close) {
      window.modalUI.close();
    }
  }

  function handleModelSelection(e) {
    const card = e.target.closest('.model-card[role="radio"]');
    if (!card) return;
    selectCard(card);
  }

  function moveFocus(delta) {
    if (!elements.modelList) return;
    const radios = Array.from(elements.modelList.querySelectorAll('.model-card[role="radio"]'));
    if (!radios.length) return;

    let idx = radios.findIndex(el => el === document.activeElement);
    if (idx === -1) {
      // اگر فوکوس روی هیچ کارتی نیست، کارت با tabindex=0 را پیدا کن
      idx = radios.findIndex(el => el.getAttribute('tabindex') === '0');
      if (idx === -1) idx = 0;
    }
    let next = idx + delta;
    if (next < 0) next = radios.length - 1;
    if (next >= radios.length) next = 0;

    radios.forEach(el => el.setAttribute('tabindex','-1'));
    const target = radios[next];
    target.setAttribute('tabindex','0');
    target.focus();
  }

  function focusEdge(first) {
    if (!elements.modelList) return;
    const radios = Array.from(elements.modelList.querySelectorAll('.model-card[role="radio"]'));
    if (!radios.length) return;
    radios.forEach(el => el.setAttribute('tabindex','-1'));
    const t = first ? radios[0] : radios[radios.length-1];
    t.setAttribute('tabindex','0');
    t.focus();
  }

  function onKeyDownList(e) {
    const isCard = e.target && e.target.matches('.model-card[role="radio"]');
    if (!isCard) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(+1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(-1);
        break;
      case 'Home':
        e.preventDefault();
        focusEdge(true);
        break;
      case 'End':
        e.preventDefault();
        focusEdge(false);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        selectCard(e.target);
        break;
      default:
        break;
    }
  }

  // --------- Focus Trap ---------
  function getFocusable(root) {
    if (!root) return [];
    const sel = [
      'a[href]', 'area[href]', 'input:not([disabled])', 'select:not([disabled])',
      'textarea:not([disabled])', 'button:not([disabled])', '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(root.querySelectorAll(sel))
      .filter(el => el.offsetParent !== null || el.getClientRects().length); // visible
  }

  function enableFocusTrap() {
    if (!elements.modalRoot) return;
    const root = elements.modalRoot;
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const f = getFocusable(root);
      if (!f.length) return;
      const first = f[0], last = f[f.length-1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault(); last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    root.addEventListener('keydown', handler);
    focusTrapHandler = handler;
  }

  function disableFocusTrap() {
    if (elements.modalRoot && focusTrapHandler) {
      elements.modalRoot.removeEventListener('keydown', focusTrapHandler);
      focusTrapHandler = null;
    }
  }

  // --------- Other Handlers ---------
  function handleRetry() {
    console.log('Retrying to fetch models...');
    switchView('loading');
    window.api.getModels();
  }
  function handleSearchInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(renderModelList, 200);
  }

  // --------- Public UI Module ---------
  const modelSelectionModalUI = {
    init: async function() {
      cacheElements();

      if (!elements.container) {
        console.warn('Model Selection Modal container not found.');
        return;
      }

      ensureInjectedStyles();

      // Event Listeners
      elements.searchInput?.addEventListener('input', handleSearchInput);
      elements.modelList?.addEventListener('click', handleModelSelection);
      elements.modelList?.addEventListener('keydown', onKeyDownList);
      elements.retryButton?.addEventListener('click', handleRetry);

      // State Listeners
      window.appState.on('stateChanged:models', async ({ to }) => {
        if (Array.isArray(to)) {
          await ensureExternalEnrichment();
          if (to.length === 0) switchView('empty');
          renderModelList();
        }
      });

      window.appState.on('stateChanged:modelsLoading', ({ to }) => {
        if (to) switchView('loading');
      });

      window.appState.on('stateChanged:modelsError', ({ to }) => {
        if (to) switchView('error');
      });

      window.appState.on('stateChanged:selectedModel', () => {
        highlightSelectedCard();
      });

      window.appState.on('stateChanged:selectedModelId', () => {
        highlightSelectedCard();
      });

      // Initial load
      const st = getState();
      if (st.modelsLoading) {
        switchView('loading');
      } else if (!Array.isArray(st.models) || st.models.length === 0) {
        switchView('empty');
      } else {
        await ensureExternalEnrichment();
        renderModelList();
      }

      console.log("✅ Model Selection Modal UI Module Initialized.");
    },

    open: async function() {
      cacheElements(); // در صورت تغییر DOM
      ensureToolbar();
      await ensureExternalEnrichment();
      renderModelList();

      // فوکوس قبلی را ذخیره و فوکوس را به سرچ بده
      lastFocusedBeforeOpen = document.activeElement;
      elements.searchInput?.focus();

      // فعال‌سازی focus trap
      enableFocusTrap();

      if (window.modalUI?.open) window.modalUI.open('model-selection-modal');
    },

    close: function() {
      disableFocusTrap();
      if (window.modalUI?.close) window.modalUI.close();
      // بازگردانی فوکوس
      if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === 'function') {
        lastFocusedBeforeOpen.focus();
      }
      lastFocusedBeforeOpen = null;
    }
  };

  window.modelSelectionModalUI = modelSelectionModalUI;
})();
