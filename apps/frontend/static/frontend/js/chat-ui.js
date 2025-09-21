// js/chat-ui.js
/**
 * @fileoverview Manages all UI interactions within the chat panel.
 * - Renders messages and streaming preview
 * - Smart scrolling (follow while near bottom; don't disturb when user scrolls up)
 * - Composer state control
 * - Rich & safe rendering via PyamoozRenderers + BiDi via bidiUtils
 */

(function() {
  "use strict";

  let currentAssistantMessageElement = null;
  let currentAssistantBubbleElement = null;
  let currentMessageTextBuffer = ''; // raw Markdown buffer

  // ---------- Smart Scroll State & Helpers ----------
  let autoScroll = true;
  let rafScrollId = null;

  function isNearBottom(container, threshold = 80) {
    const distance = container.scrollHeight - (container.scrollTop + container.clientHeight);
    return distance <= threshold;
  }

  function smoothScrollToBottom() {
    const c = window.elements.chatMessagesContainer;
    if (!c) return;
    c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
  }

  function scheduleScrollToBottom() {
    if (!autoScroll) return;
    if (rafScrollId !== null) return;
    rafScrollId = requestAnimationFrame(() => {
      rafScrollId = null;
      const c = window.elements.chatMessagesContainer;
      if (!c) return;
      if (autoScroll || isNearBottom(c)) {
        c.scrollTop = c.scrollHeight;
      }
    });
  }

  function scrollMessageIntoView(el) {
    try {
      el.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'smooth' });
    } catch {
      smoothScrollToBottom();
    }
    autoScroll = true;
  }

  function createMessageElement(role, content, plainTextForBidi) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `msg ${role} bubble-in`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble message-content';
    if (role === 'user') {
      bubble.textContent = content;
      if (window.bidiUtils) {
        window.bidiUtils.applyBidiDirection(bubble, plainTextForBidi);
      }
    } else {
      bubble.classList.add('rich-content');
    }
    messageDiv.appendChild(bubble);
    return messageDiv;
  }

  function scrollToBottom() {
    const container = window.elements.chatMessagesContainer;
    if (container) container.scrollTop = container.scrollHeight;
  }

  // ---------- Event Handlers ----------

  function handleLoadingStateChange(isLoading) {
    const nextIsLd = (isLoading && typeof isLoading === 'object' && 'to' in isLoading)
      ? isLoading.to
      : !!isLoading;
    const { chatTextarea, chatSendButton } = window.elements;
    if (chatTextarea) {
      chatTextarea.disabled = nextIsLd;
      chatTextarea.placeholder = nextIsLd ? 'Waiting for response...' : 'Give me any task to work on…';
    }
    if (chatSendButton) {
      chatSendButton.disabled = nextIsLd;
    }
  }

function handleStreamToken(token) {
  // اگر حباب دستیار وجود ندارد، یکی بساز
  if (!currentAssistantBubbleElement) {
    // ایجاد عنصر پیام دستیار
    currentAssistantMessageElement = createMessageElement('assistant');
    currentAssistantBubbleElement = currentAssistantMessageElement.querySelector('.bubble');
    // قرار دادن نشانگر چشمک‌زن
    currentAssistantBubbleElement.innerHTML = '<span class="streaming-cursor">▋</span>';
    // اضافه کردن به کانتینر چت
    window.elements.chatMessagesContainer.appendChild(currentAssistantMessageElement);
    scrollMessageIntoView(currentAssistantMessageElement);
    currentMessageTextBuffer = '';
  }

  // افزودن توکن دریافتی به بافر
  currentMessageTextBuffer += token;

  // رندر زنده متن
  if (window.PyamoozRenderers) {
    window.PyamoozRenderers.renderStreamingPreview(currentAssistantBubbleElement, currentMessageTextBuffer);
  } else {
    currentAssistantBubbleElement.textContent = currentMessageTextBuffer;
  }

  // اعمال جهت متن (RTL/LTR) در صورت نیاز
  if (window.bidiUtils) {
    window.bidiUtils.applyBidiDirection(currentAssistantBubbleElement, currentMessageTextBuffer);
  }

  // اسکرول به پایین در صورت فعال بودن autoScroll
  scheduleScrollToBottom();
}

  async function handleStreamDone() {
    if (!currentAssistantBubbleElement) return;
    if (window.PyamoozRenderers) {
      try {
        await window.PyamoozRenderers.renderRich(currentAssistantBubbleElement, currentMessageTextBuffer);
      } catch (e) {
        console.error("Rich content rendering failed:", e);
        currentAssistantBubbleElement.textContent = currentMessageTextBuffer;
      }
    }
    if (window.bidiUtils) {
      window.bidiUtils.applyBidiDirection(currentAssistantBubbleElement, currentMessageTextBuffer);
    }
    if (autoScroll) smoothScrollToBottom();
    currentAssistantMessageElement = null;
    currentAssistantBubbleElement = null;
    currentMessageTextBuffer = '';
  }

  function handleStreamError(error) {
    if (currentAssistantBubbleElement) {
      currentMessageTextBuffer += `\n\n[Error: ${error}]`;
      handleStreamDone();
    } else {
      const errorElement = createMessageElement('assistant');
      errorElement.querySelector('.bubble').textContent = `Error: ${error}`;
      errorElement.classList.add('error');
      window.elements.chatMessagesContainer.appendChild(errorElement);
    }
    scheduleScrollToBottom();
  }

  // ---------- Public UI Module ----------

  const chatUI = {
    init: function() {
      window.appState.on('stateChanged:isLoading', handleLoadingStateChange);
      window.appState.on('stream:token', handleStreamToken);
      window.appState.on('stream:done', handleStreamDone);
      window.appState.on('stream:error', handleStreamError);

      // ✨====== تغییر کلیدی اینجاست ======✨
      // 1. شنونده قدیمی و مشکل‌ساز حذف شد.
      // 2. شنونده جدید فقط به رویداد 'chat:selected' گوش می‌دهد.
      window.appState.on('chat:selected', (conversationId) => {
        if (!conversationId) return;
        
        console.log(`✅ chat:selected event received for ID: ${conversationId}. Updating state and loading history...`);
        
        // ابتدا state را آپدیت می‌کنیم تا UI (مثل سایدبار) واکنش نشان دهد
        window.appState.update({ currentConversationId: conversationId });
        
        // سپس تاریخچه گفتگو را بارگذاری می‌کنیم
        this.loadConversation(conversationId);
      });
      // ✨====== پایان تغییرات کلیدی ======✨

      const c = window.elements.chatMessagesContainer;
      if (c) {
        c.addEventListener('scroll', () => {
          autoScroll = isNearBottom(c);
          const btn = document.getElementById('jumpToBottom');
          if (btn) btn.classList.toggle('show', !autoScroll);
        }, { passive: true });
      }
      const jtb = document.getElementById('jumpToBottom');
      if (jtb) {
        jtb.addEventListener('click', () => {
          autoScroll = true;
          smoothScrollToBottom();
        });
      }
      console.log("✅ Chat UI Module Initialized and listening for events.");
    },

    addUserMessage: function(content) {
      const userMessageElement = createMessageElement('user', content, content);
      window.elements.chatMessagesContainer.appendChild(userMessageElement);
      window.elements.chatTextarea.value = '';
      if (window.autoResize) window.autoResize(window.elements.chatTextarea);
      scheduleScrollToBottom();
      currentAssistantMessageElement = createMessageElement('assistant');
      currentAssistantBubbleElement = currentAssistantMessageElement.querySelector('.bubble');
      currentAssistantBubbleElement.innerHTML = '<span class="streaming-cursor">▋</span>';
      window.elements.chatMessagesContainer.appendChild(currentAssistantMessageElement);
      scrollMessageIntoView(currentAssistantMessageElement);
      currentMessageTextBuffer = '';
    },
    
    clearMessages: function() {
      if (window.elements.chatMessagesContainer) {
        window.elements.chatMessagesContainer.innerHTML = '';
      }
    },

    // ✨ تابع loadConversation کمی ساده‌تر شده تا فقط ID عددی را بپذیرد
    loadConversation: async function(conversationId) {
      if (!conversationId || typeof conversationId !== 'number') {
        console.warn('loadConversation called with invalid ID:', conversationId);
        return;
      }

      console.log(`🔄 Loading messages for conversation ${conversationId}...`);
      
      if (window.appState.get().activeView !== 'chat') {
        window.appState.update({ activeView: 'chat' });
      }

      this.clearMessages();
      window.appState.update({ isLoading: true });
      
      try {
        const messages = await window.api.getConversationMessages(conversationId);

        for (const message of messages) {
          const messageElement = createMessageElement(message.role, message.content, message.content);
          window.elements.chatMessagesContainer.appendChild(messageElement);

          if (message.role === 'assistant') {
            const bubble = messageElement.querySelector('.bubble');
            if (window.PyamoozRenderers) {
              await window.PyamoozRenderers.renderRich(bubble, message.content);
            } else {
              bubble.textContent = message.content;
            }
            if (window.bidiUtils) {
              window.bidiUtils.applyBidiDirection(bubble, message.content);
            }
          }
        }
        setTimeout(() => scrollToBottom(), 100);
      } catch (error) {
        console.error(`❌ Failed to load messages for conversation ${conversationId}:`, error);
        handleStreamError("Could not load chat history. Please try again.");
      } finally {
        window.appState.update({ isLoading: false });
        const newUrl = `/chat/${conversationId}/`;
        try { history.pushState({ conversationId }, '', newUrl); } catch {}
      }
    }
  };

  window.chatUI = chatUI;
})();