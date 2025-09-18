// js/sidebar-ui.js
(function() {
  "use strict";

  function buildHistoryItem(chat, isActive) {
    const a = document.createElement('a');
    a.href = `/chat/${chat.id}/`;
    a.className = `nav-link history-link${isActive ? ' active' : ''}`;
    a.dataset.chatId = chat.id;

    if (isActive) a.setAttribute('aria-current', 'page');

    const span = document.createElement('span');
    // DOM-safe: عنوان فقط متن می‌شود، نه HTML
    span.textContent = chat.title || 'Untitled Chat';

    a.appendChild(span);
    return a;
  }

  const sidebarUI = {
    /**
     * Renders the chat history into the sidebar.
     * Accepts array or state event payload {to: [...]}
     */
    renderChatHistory: function(data) {
      const container = document.getElementById('chatHistoryList');
      if (!container) return;

      const history = Array.isArray(data) ? data : (data && Array.isArray(data.to)) ? data.to : [];
      container.textContent = '';

      if (!history || history.length === 0) {
        const hint = document.createElement('span');
        hint.className = 'empty-hint';
        hint.style.padding = '0 12px';
        hint.style.fontSize = '13px';
        hint.textContent = 'No recent chats.';
        container.appendChild(hint);
        return;
      }

      const activeId = window.appState.get().currentConversationId;
      const nodes = [];

      for (const chat of history) {
        // مقایسهٔ سهل‌گیرانه برای پوشش string/number
        const isActive = (chat.id == activeId);
        nodes.push(buildHistoryItem(chat, isActive));
      }

      container.replaceChildren(...nodes);

      // اطمینان از دیده‌شدن آیتم فعال
      const activeEl = container.querySelector('.history-link.active');
      if (activeEl) {
        try { activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch {}
      }
    },

    init: function() {
      window.appState.on('stateChanged:chatHistory', this.renderChatHistory.bind(this));
      
      // این شنونده برای آپدیت کردن UI سایدبار (مثلا فعال کردن آیتم) لازم است
      window.appState.on('stateChanged:currentConversationId', () => {
        const history = window.appState.get().chatHistory || [];
        this.renderChatHistory(history);
      });

      const container = document.getElementById('chatHistoryList');
      if (container) {
        container.addEventListener('click', (event) => {
          const link = event.target.closest('.history-link');
          if (!link) return;

          event.preventDefault();

          const conversationId = link.dataset.chatId;
          const current = window.appState.get().currentConversationId;

          if (conversationId && conversationId != current) {
            console.log(`History link clicked. Emitting 'chat:selected' event with ID: ${conversationId}`);
            
            // ✨ تغییر کلیدی اینجاست: به جای آپدیت مستقیم state، یک رویداد مشخص ارسال می‌کنیم
            window.appState.emit('chat:selected', parseInt(conversationId, 10));
          }
        });
      }

      console.log("✅ Sidebar UI Module Initialized.");
    }
  };

  window.sidebarUI = sidebarUI;
})();