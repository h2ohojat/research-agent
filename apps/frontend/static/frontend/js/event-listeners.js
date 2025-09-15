// backend/apps/frontend/static/frontend/js/event-listeners.js
/**
 * @fileoverview Centralizes all DOM event listeners for the application.
 * This module acts as the "glue" connecting user interactions (clicks, key presses)
 * to the appropriate logic in other modules. It keeps the other modules clean
 * by handling the "wiring" in one place.
 */

(function() {
  "use strict";

  /**
   * Toggle busy/disabled state for composers (home/chat) based on isLoading.
   * Applies aria-busy and disables textareas/send buttons.
   */
  function setComposerBusy(busy) {
    const els = window.elements || {};
    const {
      homeTextarea, chatTextarea,
      homeSendButton, chatSendButton
    } = els;

    [homeTextarea, chatTextarea].forEach(el => {
      if (!el) return;
      if (busy) {
        el.setAttribute('aria-busy', 'true');
        el.disabled = true;
      } else {
        el.removeAttribute('aria-busy');
        el.disabled = false;
      }
    });

    [homeSendButton, chatSendButton].forEach(btn => {
      if (!btn) return;
      btn.disabled = !!busy;
      btn.setAttribute('aria-disabled', busy ? 'true' : 'false');
    });
  }

  /**
   * ✨ Unified & simplified send logic.
   * @param {'home'|'chat'} scope
   */
  function trySendMessage(scope) {
    const els = window.elements || {};
    const textarea = scope === 'home' ? els.homeTextarea : els.chatTextarea;
    if (!textarea) return;

    const content = (textarea.value || "").trim();
    const currentState = window.appState.get();

    // Prevent sending empty or while busy
    if (!content || currentState.isLoading) return;

    // 1) Switch to chat view if we're on home
    if (currentState.activeView === 'home') {
      window.appState.update({ activeView: 'chat' });
    }

    // 2) Instant UI feedback
    window.chatUI?.addUserMessage(content);

    // 3) Send via WS (WS resolves model/conversation/deep params from state)
    setComposerBusy(true); // optimistic lock UI until stream completes
    window.websocketManager?.sendMessage({ content });

    // 4) Cleanup textarea
    textarea.value = '';
    textarea.focus();
    if (window.autoResize) window.autoResize(textarea);
  }

  /**
   * ✨ IME-safe Enter handler (Enter to send, Shift+Enter for newline)
   * @param {HTMLTextAreaElement} textarea
   * @param {'home'|'chat'} scope
   */
  function wireEnterHandler(textarea, scope) {
    if (!textarea) return;
    textarea.addEventListener('keydown', (event) => {
      if (event.isComposing) return;                  // IME safety
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        trySendMessage(scope);
      }
    });
  }

  /**
   * Optional wiring for "Jump to Bottom" button if present.
   */
  function wireJumpToBottom() {
    const { jumpToBottom, chatScroll } = window.elements || {};
    if (!jumpToBottom || !chatScroll) return;

    function updateVisibility() {
      const gap = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight;
      if (gap > 48) {
        jumpToBottom.classList.add('show');
      } else {
        jumpToBottom.classList.remove('show');
      }
    }

    jumpToBottom.addEventListener('click', () => {
      chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: 'smooth' });
    });

    chatScroll.addEventListener('scroll', updateVisibility);

    // Also refresh on streaming tokens
    window.appState?.on?.('stream:token', () => {
      // Keep button visibility logical while streaming
      updateVisibility();
    });

    // Initial state
    updateVisibility();
  }

  const eventListeners = {
    init: function() {
      if (!window.elements) {
        console.error("DOM elements not initialized. Listeners cannot be attached.");
        return;
      }

      const {
        homeSendButton, chatSendButton,
        homeTextarea, chatTextarea,
        menuButton, backdrop,
        homeModelSelectorContainer, chatModelSelectorContainer
      } = window.elements;

      // --- Send handlers ---
      if (homeSendButton && homeTextarea) {
        homeSendButton.addEventListener('click', () => trySendMessage('home'));
        wireEnterHandler(homeTextarea, 'home');
      }
      if (chatSendButton && chatTextarea) {
        chatSendButton.addEventListener('click', () => trySendMessage('chat'));
        wireEnterHandler(chatTextarea, 'chat');
      }

      // --- Auto-resize ---
      if (homeTextarea && window.autoResize) {
        homeTextarea.addEventListener('input', () => window.autoResize(homeTextarea));
      }
      if (chatTextarea && window.autoResize) {
        chatTextarea.addEventListener('input', () => window.autoResize(chatTextarea));
      }

      // --- Layout (menu/backdrop) ---
      if (menuButton) {
        menuButton.addEventListener('click', () => window.layoutUI?.toggleSidebar());
      }
      if (backdrop) {
        backdrop.addEventListener('click', () => window.layoutUI?.toggleSidebar());
      }
      // ESC closes sidebar/modal if open
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          try { window.modalUI?.close(); } catch {}
          try {
            const st = window.appState.get();
            if (st.isSidebarOpen) window.layoutUI?.toggleSidebar();
          } catch {}
        }
      });

      // --- Model selector UI ---
      if (window.modelSelectorUI) {
        if (homeModelSelectorContainer) window.modelSelectorUI.init(homeModelSelectorContainer);
        if (chatModelSelectorContainer) window.modelSelectorUI.init(chatModelSelectorContainer);
      }

      // --- Busy state ↔ isLoading ---
      window.appState.on('stateChanged:isLoading', ({ to }) => {
        setComposerBusy(!!to);
        // Focus chat textarea after completion for fast typing
        if (!to && window.elements?.chatTextarea) {
          window.elements.chatTextarea.focus();
        }
      });

      // --- JTB (optional) ---
      wireJumpToBottom();

      console.log("✅ All Application Event Listeners Initialized.");
    }
  };

  window.eventListeners = eventListeners;
})();
