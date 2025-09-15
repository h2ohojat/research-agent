// backend/apps/frontend/static/frontend/js/state.js
/**
 * Central application state (Single Source of Truth) + lightweight event bus.
 * - Shallow, predictable updates
 * - Per-key change events (e.g. "stateChanged:models")
 * - Global change event ("stateChanged")
 * - Friendly console logs for debugging
 */

(function () {
  "use strict";

  // ---------------------------
  // Event Bus (very lightweight)
  // ---------------------------
  const eventBus = {
    _events: Object.create(null),

    /**
     * Subscribe to an event.
     * @param {string} name
     * @param {(payload:any)=>void} handler
     */
    on(name, handler) {
      if (!this._events[name]) this._events[name] = [];
      this._events[name].push(handler);
    },

    /**
     * Emit an event.
     * @param {string} name
     * @param {any} payload
     */
    emit(name, payload) {
      const list = this._events[name];
      if (!list || !list.length) return;
      // .slice() ensures that if a handler unsubscribes itself, it doesn't mess up the loop
      for (const fn of list.slice()) {
        try { fn(payload); }
        catch (err) { console.error(`Listener error for "${name}":`, err); }
      }
    },

    /**
     * ✨ ADDED: Unsubscribe from an event. Essential for preventing memory leaks.
     * @param {string} name - The event name.
     * @param {Function} handlerToRemove - The specific handler function to remove.
     */
    off(name, handlerToRemove) {
        const list = this._events[name];
        if (!list) return;
        this._events[name] = list.filter(handler => handler !== handlerToRemove);
    },

    /**
     * ✨ ADDED: Subscribe to an event only once. It will be removed after being triggered.
     * @param {string} name - The event name.
     * @param {Function} handler - The handler function to execute once.
     */
    once(name, handler) {
        const wrap = (payload) => {
            try {
                handler(payload);
            } finally {
                this.off(name, wrap);
            }
        };
        // We add a reference to the original handler to allow potential removal of a 'once' listener before it fires.
        wrap.original = handler; 
        this.on(name, wrap);
    }
  };

  // ---------------------------
  // State (defaults)
  // ---------------------------
  const state = {
    // --- Auth / User ---
    isAuthenticated: false,
    user: null, // { email, name, ... }

    // --- UI / Layout ---
    activeView: "home",     // "home" | "chat" | ...
    isSidebarOpen: true,    // layout-ui.js expects this key
    isLoading: false,       // streaming flag

    // --- Chat / Conversation ---
    currentConversationId: null,
    messages: [],

    // --- Models ---
    models: [],
    modelsLoading: false,   // used by API load flow/logs
    selectedModel: null,    // { model_id, display_name, ... }
    selectedModelId: 'gpt-4o-mini', // ✨ ADDED: The default model identifier as our source of truth.

    // --- Search / Features ---
    isDeepSearchEnabled: false,

    // --- Dynamic model params (optional) ---
    userParams: {},         // e.g. { temperature: 0.7, max_tokens: 512 }
    modelSchema: null,      // optional schema

    // --- Errors (optional) ---
    modelsError: null,
    lastError: null,
  };

  // ---------------------------
  // Helpers
  // ---------------------------
  function getSnapshot() {
    // shallow clone is enough
    return { ...state };
  }

  /**
   * Shallow merge + emit per-key and global events.
   * @param {Object} partial
   */
  function updateState(partial) {
    if (!partial || typeof partial !== "object") return;

    let anyChanged = false;

    for (const key of Object.keys(partial)) {
      const prev = state[key];
      const next = partial[key];

      if (prev !== next) {
        state[key] = next;
        anyChanged = true;

        // Per-key event (e.g. "stateChanged:models")
        eventBus.emit(`stateChanged:${key}`, { from: prev, to: next });

        // Debug log
        try {
          const prettyFrom = Array.isArray(prev) ? `Array(${prev.length})` : prev;
          const prettyTo   = Array.isArray(next) ? `Array(${next.length})` : next;
          console.log(`State Change: ${key}`, { from: prettyFrom, to: prettyTo });
        } catch { /* no-op */ }
      }
    }

    if (anyChanged) {
      // Global change with full snapshot
      eventBus.emit("stateChanged", getSnapshot());
    }
  }

  // ---------------------------
  // Public API
  // ---------------------------
  window.appState = {
    get: getSnapshot,
    update: updateState,
    on: eventBus.on.bind(eventBus),
    emit: eventBus.emit.bind(eventBus),
    off: eventBus.off.bind(eventBus),     // ✨ ADDED: Exposing the new 'off' method
    once: eventBus.once.bind(eventBus),   // ✨ ADDED: Exposing the new 'once' method
  };

  console.log("✅ State Management Module Initialized.");
})();