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

  // API عمومی
  window.PyamoozRenderers = {
    renderRich,
    renderStreamingPreview
  };
})();
