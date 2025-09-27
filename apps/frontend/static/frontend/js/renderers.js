// static/frontend/js/renderers.js
// Pipeline رندر امن و زیبا برای پاسخ‌ها

(function() {
  const md = window.markdownit({
    html: false,         // امنیت
    linkify: true,       // لینک‌سازی خودکار
    breaks: true,        // \n -> <br>
    typographer: true
  }).use(window.markdownitEmoji);

  // Mermaid را با امنیت بالا پیکربندی کن
  if (window.mermaid?.initialize) {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',  // XSS-safe
      theme: 'default'
    });
  }

  // ابزارهای کمکی
  const escapeHTML = (s) => s
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function ensureExternalLinks(container) {
    container.querySelectorAll('a[href]').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }

  function addCopyButtons(container) {
    container.querySelectorAll('pre > code').forEach(code => {
      const pre = code.parentElement;
      if (pre.querySelector('.copy-btn')) return;

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent || '');
          btn.textContent = 'Copied!';
          setTimeout(() => (btn.textContent = 'Copy'), 1200);
        } catch {
          btn.textContent = 'Error';
          setTimeout(() => (btn.textContent = 'Copy'), 1200);
        }
      });
      pre.style.position = 'relative';
      btn.style.position = 'absolute';
      btn.style.top = '6px';
      btn.style.right = '6px';
      btn.style.padding = '4px 8px';
      btn.style.fontSize = '12px';
      btn.style.borderRadius = '6px';
      btn.style.border = '1px solid var(--border, #ddd)';
      pre.appendChild(btn);
    });
  }

  async function renderMermaid(container) {
    const blocks = container.querySelectorAll('pre > code.language-mermaid, code.language-mermaid');
    if (!blocks.length || !window.mermaid?.render) return;
    let i = 0;
    for (const code of blocks) {
      const graph = code.textContent;
      const id = `mmd-${Date.now()}-${i++}`;
      try {
        const { svg } = await window.mermaid.render(id, graph);
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid';
        wrapper.innerHTML = svg;
        const pre = code.closest('pre') || code;
        pre.replaceWith(wrapper);
      } catch (e) {
        // اگر نمودار مشکل داشت، همون کد خام بمونه
        console.warn('Mermaid render failed:', e);
      }
    }
  }

  function highlightCode(container) {
    if (window.Prism?.highlightAllUnder) {
      window.Prism.highlightAllUnder(container);
    }
  }

  function renderKatex(container) {
    if (window.renderMathInElement) {
      window.renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  }

  // رندر نهایی: markdown → sanitize → decorate
  async function renderRich(htmlContainer, plainText) {
    // 1) Markdown → HTML
    const rawHtml = md.render(plainText);

    // 2) Sanitize
    const safeHtml = window.DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target','rel','aria-label']
    });

    // 3) درج HTML امن
    htmlContainer.innerHTML = safeHtml;

    // 4) Mermaid → SVG
    await renderMermaid(htmlContainer);

    // 5) Prism code highlight
    highlightCode(htmlContainer);

    // 6) KaTeX
    renderKatex(htmlContainer);

    // 7) لینک‌های بیرونی
    ensureExternalLinks(htmlContainer);

    // 8) Copy buttons
    addCopyButtons(htmlContainer);
  }

  // پیش‌نمایش سریع برای استریم (خام و Escape شده)
  function renderStreamingPreview(previewEl, buffer) {
    // فقط متن Escaped را نشان بده تا سریع باشد
    previewEl.innerHTML = `<code class="streaming-plain">${escapeHTML(buffer)}</code>`;
  }

  /**
   * ✨✨✨ START: NEW FUNCTION FOR PROMPT TILES ✨✨✨
   * Creates the HTML for a single prompt card.
   * @param {object} prompt - The prompt object from prompts-data.js.
   * @returns {string} The HTML string for the card.
   */
  function renderPromptCard(prompt) {
    // Using data-* attribute is a clean way to store the prompt text.
    return `
      <button class="card-tile" data-prompt="${escapeHTML(prompt.prompt)}" role="listitem">
        <div class="tile-left">
          <div class="tool-icon">${prompt.icon}</div>
          <div class="vstack">
            <strong>${escapeHTML(prompt.title)}</strong>
            <span style="color: var(--muted); font-size: 13px;">${escapeHTML(prompt.description)}</span>
          </div>
        </div>
        <div class="chev">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </button>
    `;
  }
  // ✨✨✨ END: NEW FUNCTION FOR PROMPT TILES ✨✨✨
  // ✨✨✨ START: NEW FUNCTION FOR LINK TILES ✨✨✨
  /**
   * Creates the HTML for a single linkable card (e.g., for courses).
   * @param {object} card - The card object from prompts-data.js.
   * @returns {string} The HTML string for the card.
   */
  function renderLinkCard(card) {
    // This creates an <a> tag instead of a <button>
    return `
      <a href="${escapeHTML(card.url)}" class="card-tile" target="_blank" rel="noopener noreferrer" role="listitem">
        <div class="tile-left">
          <div class="tool-icon">${card.icon}</div>
          <div class="vstack">
            <strong>${escapeHTML(card.title)}</strong>
            <span style="color: var(--muted); font-size: 13px;">${escapeHTML(card.description)}</span>
          </div>
        </div>
        <div class="chev">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      </a>
    `;
  }
  // ✨✨✨ END: NEW FUNCTION FOR LINK TILES ✨✨✨
  // API عمومی
  window.PyamoozRenderers = {
    renderRich,
    renderStreamingPreview,
    renderLinkCard,
    renderPromptCard // <-- تابع جدید به API اضافه شد
  };
})();