// backend/apps/frontend/static/frontend/js/model-selector-ui.js
/**
 * @fileoverview Lightweight, reactive model selector chips for any container(s).
 * - Renders current selected model name + provider
 * - Shows capability badges (Text / Image / Audio / Tools / Web / Structured / Reasoning)
 * - Shows quick pricing (Input / Output) when available
 * - Handles loading / empty states
 * - Opens model selection modal on click/Enter/Space
 * - DOM-safe (no innerHTML), multi-container aware
 * - Mobile-friendly:
 *    • ≤768px: ONLY model name + caret (everything else hidden)
 *    • >768px: full details (provider, badges, pricing)
 */

(function () {
  "use strict";

  const containers = new Set();
  let _stylesInjected = false;
  let _resizeTimer = null;

  // ----- Utilities -----
  const getState = () => (window.appState?.get?.() || {});
  const getSelectedModel = () => (getState().selectedModel || null);
  const getSelectedModelId = () => (getState().selectedModelId || getState().selectedModel?.model_id || null);

  // Breakpoints
  const isCompact = () => window.matchMedia("(max-width: 768px)").matches;      // phones + small tablets
  const isUltraCompact = () => window.matchMedia("(max-width: 480px)").matches; // small phones

  function ensureStyles() {
    if (_stylesInjected) return;
    const css = `
      /* Scoped styles for selector chip */
      .msx-selector {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(0,0,0,0.08);
        background: #ffffff;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        cursor: pointer;
        user-select: none;
        transition: box-shadow .15s ease, transform .02s ease;
      }
      .msx-selector:focus-visible {
        outline: 2px solid #6366f1; /* indigo-500 */
        outline-offset: 2px;
      }
      .msx-selector:hover {
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      }
      .msx-selector:active {
        transform: translateY(1px);
      }
      .msx-title {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .msx-name {
        font-weight: 700;
        line-height: 1.1;
        letter-spacing: .2px;
        color: #0f172a; /* slate-900 */
        max-width: 28ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .msx-provider {
        font-size: 12px;
        color: #475569; /* slate-600 */
        max-width: 28ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .msx-caps {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .msx-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 999px;
        border: 1px solid rgba(0,0,0,0.08);
        font-size: 11px;
        background: #f8fafc; /* slate-50 */
        color: #0f172a;
        line-height: 1;
      }
      .msx-badge[data-kind="Text"]       { background:#eef2ff; border-color:#e0e7ff; }
      .msx-badge[data-kind="Image"]      { background:#ecfeff; border-color:#cffafe; }
      .msx-badge[data-kind="Audio"]      { background:#f0fdf4; border-color:#dcfce7; }
      .msx-badge[data-kind="Tools"]      { background:#fff7ed; border-color:#ffedd5; }
      .msx-badge[data-kind="Web"]        { background:#f1f5f9; border-color:#e2e8f0; }
      .msx-badge[data-kind="Structured"] { background:#f5f3ff; border-color:#ede9fe; }
      .msx-badge[data-kind="Reasoning"]  { background:#fef2f2; border-color:#fee2e2; }
      .msx-badge[data-kind="More"]       { background:#e2e8f0; border-color:#cbd5e1; color:#334155; }
      .msx-ico { width: 14px; height: 14px; }
      .msx-pricing {
        font-size: 12px;
        color: #334155; /* slate-700 */
        white-space: nowrap;
      }
      .msx-sep-dot {
        width: 4px; height: 4px; border-radius: 50%; background: #cbd5e1; /* slate-300 */
      }
      .msx-caret {
        width: 16px; height: 16px; color: #64748b; /* slate-500 */
        flex: 0 0 auto;
      }

      /* Loading skeleton */
      .msx-skel {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(0,0,0,0.06);
        background: linear-gradient(90deg,#f1f5f9,#f8fafc,#f1f5f9);
        background-size: 200% 100%;
        animation: msxShine 1.2s ease-in-out infinite;
      }
      .msx-skel .b {
        width: 100px; height: 10px; border-radius: 999px; background: rgba(148,163,184,.35);
      }
      @keyframes msxShine {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }

      /* Empty state button look */
      .msx-empty {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px dashed #cbd5e1; /* slate-300 */
        color: #334155; background: #ffffff;
        cursor: pointer;
      }
      .msx-empty:hover { background: #f8fafc; }

      /* ---------- Mobile tweaks (≤768px): ONLY model name + caret ---------- */
      @media (max-width: 768px) {
        .msx-selector { gap: 8px; padding: 6px 10px; }
        .msx-name { max-width: 18ch; }
        .msx-provider,
        .msx-caps,
        .msx-pricing,
        .msx-sep-dot { display: none !important; }
      }
      /* Extra small phones */
      @media (max-width: 480px) {
        .msx-selector { padding: 6px 8px; }
        .msx-name { max-width: 14ch; }
      }
    `;
    const tag = document.createElement('style');
    tag.setAttribute('data-model-selector-ui', 'true');
    tag.textContent = css;
    document.head.appendChild(tag);
    _stylesInjected = true;
  }

  function normalizeKey(s) { return String(s || '').trim().toLowerCase(); }
  function g(o, path) {
    try { return path.split('.').reduce((x,k)=> (x&&x[k]!==undefined?x[k]:undefined), o); }
    catch { return undefined; }
  }

  // tiny SVG factory
  function svg(kind, attrs = {}) {
    const svgNS = "http://www.w3.org/2000/svg";
    const el = document.createElementNS(svgNS, 'svg');
    el.setAttribute('viewBox', '0 0 24 24');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '2');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.classList.add('msx-ico');
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));

    const add = (tag, a) => {
      const n = document.createElementNS(svgNS, tag);
      Object.entries(a).forEach(([k,v]) => n.setAttribute(k, v));
      el.appendChild(n);
    };

    switch (kind) {
      case 'Text':       add('path', { d: 'M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' }); break;
      case 'Image':      add('rect', { x:'3', y:'3', width:'18', height:'18', rx:'2' }); add('circle',{cx:'9',cy:'9',r:'2'}); add('path',{d:'M21 15l-5-5L5 21'}); break;
      case 'Audio':      add('path', { d:'M4 12v4M8 8v12M12 4v16M16 8v12M20 12v4' }); break;
      case 'Tools':      add('path', { d:'M21 3l-6 6' }); add('path',{d:'M3 21l9-9'}); add('circle',{cx:'21',cy:'3',r:'2'}); add('circle',{cx:'3',cy:'21',r:'2'}); break;
      case 'Web':        add('circle',{cx:'12',cy:'12',r:'10'}); add('path',{d:'M2 12h20'}); add('path',{d:'M12 2a15.3 15.3 0 0 1 0 20'}); add('path',{d:'M12 2a15.3 15.3 0 0 0 0 20'}); break;
      case 'Structured': add('path',{d:'M8 3H6a3 3 0 0 0-3 3v2a3 3 0 0 1-3 3 3 3 0 0 1 3 3v2a3 3 0 0 0 3 3h2'}); add('path',{d:'M16 3h2a3 3 0 0 1 3 3v2a3 3 0 0 0 3 3 3 3 0 0 0-3 3v2a3 3 0 0 1-3 3h-2'}); break;
      case 'Reasoning':  add('path',{d:'M8 8a4 4 0 0 1 8 0v1a4 4 0 0 1 0 8v1a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3v-1a4 4 0 0 1 0-8z'}); break;
      case 'Caret':      add('polyline',{points:'6 9 12 15 18 9'}); break;
      case 'Dots':       add('circle',{cx:'7', cy:'12', r:'1.5'}); add('circle',{cx:'12', cy:'12', r:'1.5'}); add('circle',{cx:'17', cy:'12', r:'1.5'}); break;
      case 'Plus':       add('line',{x1:'12',y1:'5',x2:'12',y2:'19'}); add('line',{x1:'5',y1:'12',x2:'19',y2:'12'}); break;
      default:           add('circle',{cx:'12',cy:'12',r:'10'});
    }
    return el;
  }

  function badge(kind, text, titleText) {
    const b = document.createElement('span');
    b.className = 'msx-badge';
    b.dataset.kind = kind;
    b.title = titleText || text || kind;
    b.appendChild(svg(kind));
    const t = document.createElement('span');
    t.textContent = text || kind;
    b.appendChild(t);
    return b;
  }

  function moreBadge(nHidden) {
    const b = document.createElement('span');
    b.className = 'msx-badge';
    b.dataset.kind = 'More';
    b.title = `${nHidden} more`;
    b.appendChild(svg('Dots'));
    const t = document.createElement('span');
    t.textContent = `+${nHidden}`;
    b.appendChild(t);
    return b;
  }

  function fmtPrice(v) {
    if (typeof v !== 'number') return null;
    return `$${v.toFixed(2)}/1k`;
  }

  // Heuristic capability detection (aligned with modal)
  function detectCaps(model) {
    const idNorm = normalizeKey(model.model_id || model.id || g(model,'ext.id') || '');
    const extMode = g(model,'mode') || g(model,'ext.mode') || null;

    const supportsVision   = !!(g(model,'supports_vision') || g(model,'ext.supports_vision'));
    const supportsWeb      = !!(g(model,'supports_web_search') || g(model,'ext.supports_web_search'));
    const supportsTools    = !!(g(model,'supports_function_calling') || g(model,'ext.supports_function_calling') || g(model,'supports_tool_choice') || g(model,'ext.supports_tool_choice'));
    const supportsSchema   = !!(g(model,'supports_response_schema') || g(model,'ext.supports_response_schema'));
    const supportsAudioIn  = !!(g(model,'supports_audio_input') || g(model,'ext.supports_audio_input'));
    const supportsAudioOut = !!(g(model,'supports_audio_output') || g(model,'ext.supports_audio_output'));

    const isImageMode =
      (extMode === 'image_generation')
      || supportsVision
      || /(dall[- ]?e|imagen|stable|sd(?:3|xl)?|^stability\.?|flux|wan|image|img)/i.test(idNorm);

    const isAudioMode =
      (extMode === 'audio_transcription' || extMode === 'audio_speech')
      || supportsAudioIn || supportsAudioOut
      || /(whisper|tts|audio|transcribe|speech|stt|asr)/i.test(idNorm);

    const isEmbeddingMode  = (extMode === 'embedding')  || /embedding/.test(idNorm);
    const isModerationMode = (extMode === 'moderation') || /moderation/.test(idNorm);

    const isTextMode =
      (extMode === 'chat' || extMode === 'responses')
      || (!isImageMode && !isAudioMode && !isEmbeddingMode && !isModerationMode);

    const reasoningTier = g(model,'reasoning_tier') || g(model,'reasoning') || g(model,'ext.reasoning_tier') || null;

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

  // ----- Renderers -----
  function renderInto(container) {
    container.textContent = ''; // clear safely
    ensureStyles();

    const st = getState();
    const modelsLoading = !!st.modelsLoading;
    const sel = getSelectedModel();
    const selId = getSelectedModelId();

    // Loading state
    if (modelsLoading && !selId) {
      const sk = document.createElement('div');
      sk.className = 'msx-skel';
      const b1 = document.createElement('div'); b1.className = 'b';
      const b2 = document.createElement('div'); b2.className = 'b'; b2.style.width = '60px';
      sk.appendChild(b1); sk.appendChild(b2);
      container.appendChild(sk);
      return;
    }

    // Empty state (no selected model yet)
    if (!sel) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'msx-empty';
      btn.setAttribute('aria-label','Choose a model');
      btn.appendChild(svg('Plus'));
      const t = document.createElement('span');
      t.textContent = 'Select a model';
      btn.appendChild(t);
      btn.addEventListener('click', openModal);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }
      });
      container.appendChild(btn);
      return;
    }

    const compact = isCompact();
    const ultra = isUltraCompact();

    // Selected chip
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'msx-selector';
    chip.setAttribute('aria-haspopup', 'dialog');
    chip.setAttribute('aria-label', 'Change model');
    chip.addEventListener('click', openModal);
    chip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); }
    });

    // Title (name + provider)
    const title = document.createElement('div');
    title.className = 'msx-title';

    const name = document.createElement('div');
    name.className = 'msx-name';
    name.textContent = sel.display_name || sel.model_id || 'Unnamed';

    const provider = document.createElement('div');
    provider.className = 'msx-provider';
    provider.textContent = sel.provider?.display_name || sel.provider?.name || g(sel,'ext.owned_by') || 'Unknown';

    title.appendChild(name);
    title.appendChild(provider);

    // Caps + Pricing (desktop only)
    // Badges
    const capsRow = document.createElement('div');
    capsRow.className = 'msx-caps';

    // Quick pricing
    const pricing = sel.pricing || g(sel,'ext.pricing') || g(sel,'ext.prices') || g(sel,'ext.costs') || null;
    const inCost  = fmtPrice(pricing?.input_usd_per_1k ?? pricing?.input_per_1k ?? pricing?.input);
    const outCost = fmtPrice(pricing?.output_usd_per_1k ?? pricing?.output_per_1k ?? pricing?.output);
    const pricingSpan = document.createElement('span');
    pricingSpan.className = 'msx-pricing';
    const hasIn = !!inCost, hasOut = !!outCost;
    if (hasIn || hasOut) {
      pricingSpan.textContent = `${hasIn ? `In ${inCost}` : ''}${hasIn && hasOut ? ' · ' : ''}${hasOut ? `Out ${outCost}` : ''}`;
    }

    // Layout begins
    chip.appendChild(title);

    if (!compact) {
      // Build capability badges only on large screens
      const caps = detectCaps(sel);
      const list = [];
      if (caps.hasText)       list.push(badge('Text', 'Text', 'Text / Chat / Responses'));
      if (caps.hasImage)      list.push(badge('Image', 'Image', 'Image generation / Vision'));
      if (caps.hasAudio)      list.push(badge('Audio', 'Audio', 'Speech / Transcription / TTS'));
      if (caps.hasTools)      list.push(badge('Tools', 'Tools', 'Function Calling / Tools'));
      if (caps.hasWeb)        list.push(badge('Web', 'Web', 'Web / Search access'));
      if (caps.hasStructured) list.push(badge('Structured', 'Structured', 'JSON / Schema-aware'));
      if (caps.hasReasoning)  list.push(badge('Reasoning', caps.reasoningTier ? `Reasoning ${caps.reasoningTier}` : 'Reasoning', 'Advanced reasoning'));

      list.forEach(b => capsRow.appendChild(b));

      // dot between title and caps
      const dot1 = document.createElement('span'); dot1.className = 'msx-sep-dot';
      chip.appendChild(dot1);

      chip.appendChild(capsRow);

      // pricing (if exists and not ultra-compact)
      const showPricing = (hasIn || hasOut) && !ultra;
      if (showPricing) {
        const dot2 = document.createElement('span'); dot2.className = 'msx-sep-dot';
        chip.appendChild(dot2);
        chip.appendChild(pricingSpan);
      }
    }
    // caret always
    const caret = svg('Caret'); caret.classList.add('msx-caret');
    chip.appendChild(caret);

    container.appendChild(chip);
  }

  function renderAll() {
    containers.forEach(renderInto);
  }

  function openModal() {
    if (window.modelSelectionModalUI?.open) {
      window.modelSelectionModalUI.open();
    } else if (window.modalUI?.open) {
      window.modalUI.open('model-selection-modal');
    }
  }

  // ----- Public API -----
  const modelSelectorUI = {
    /**
     * Initialize one selector instance inside a container DOM node.
     * @param {HTMLElement} container
     */
    init(container) {
      if (!container || !(container instanceof HTMLElement)) {
        console.warn('modelSelectorUI.init: invalid container');
        return;
      }
      containers.add(container);
      renderInto(container);

      // react to global state changes
      window.appState?.on?.('stateChanged:models', renderAll);
      window.appState?.on?.('stateChanged:modelsLoading', renderAll);
      window.appState?.on?.('stateChanged:selectedModel', renderAll);
      window.appState?.on?.('stateChanged:selectedModelId', renderAll);

      // re-render on viewport changes to recompute compact
      window.addEventListener('resize', () => {
        clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(renderAll, 150);
      });

      console.log('✅ Model Selector UI Module Initialized (Reactive & Safe).');
    }
  };

  window.modelSelectorUI = modelSelectorUI;
})();
