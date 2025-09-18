// backend/apps/frontend/static/frontend/js/websocket.js
/**
 * WebSocket manager for real-time chat streaming.
 * - Robust connect/reconnect with exponential backoff
 * - Safe message queueing while disconnected
 * - Unified payload shape for `chat_message`
 * - Handles server events: connected | ConversationCreated | started | token | done | error | ping
 *
 * Exposes a singleton: window.websocketManager
 */

(function () {
  "use strict";

  // Max queued messages to prevent memory growth
  const QUEUE_MAX = 50;

  /**
   * Gets the effective model ID from the central state.
   * Priority: selectedModel.model_id → selectedModelId → 'gpt-4o-mini'
   */
  function getEffectiveModelId() {
    const st = window.appState?.get?.() || {};
    return (st.selectedModel && st.selectedModel.model_id)
        || st.selectedModelId
        || 'gpt-4o-mini';
  }

  class WebSocketManager {
    constructor() {
      this.ws = null;
      this.wsUrl = null;

      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 6;

      this.reconnectDelayBase = 1000; // 1s
      this.maxReconnectDelay = 10000; // 10s
      this.reconnectTimer = null;

      this.messageQueue = [];
      this._visibilityHookInstalled = false;
    }

    // ---------- Public API ----------

    /**
     * Initialize and connect. Optionally override the URL:
     *   websocketManager.init({ url: "wss://example.com/ws/chat/" })
     */
    init(opts = {}) {
      this.wsUrl = opts.url || this._buildDefaultUrl();

      if (!this._visibilityHookInstalled) {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' &&
              (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN)) {
            this.reconnectNow();
          }
        });

        // Listen for 'new chat' events to clear the conversation context
        window.appState?.on?.('chat:new', () => {
          console.log('✨ chat:new event received. Clearing currentConversationId.');
          window.appState?.update?.({ currentConversationId: null });
        });

        this._visibilityHookInstalled = true;
      }

      this.connect();
    }

    /**
     * Set URL and optionally reconnect immediately.
     */
    setUrl(url, { reconnect = false } = {}) {
      this.wsUrl = url;
      if (reconnect) this.reconnectNow();
    }

    /**
     * Force reconnect now (e.g., after URL change).
     */
    reconnectNow() {
      this._clearReconnectTimer();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try { this.ws.close(1000, "Client reconnect"); } catch (_) {}
      }
      this.connect();
    }

    /**
     * Send a message to the server.
     * Accepts:
     *  - string: treated as { content: "..." }
     *  - object: { content, model?, conversation_id?, deep_search?/deep?, params? }
     *
     * Ensures a string-based model identifier (model_id) is sent.
     */
    sendMessage(input) {
      const state = (window.appState && window.appState.get) ? window.appState.get() : {};

      const rawContent = (typeof input === "string") ? input : (input && input.content);
      const content = (rawContent == null) ? "" : String(rawContent).trim();
      if (!content) {
        console.error("❌ sendMessage: invalid or empty content.");
        return;
      }

      let model = null;
      if (typeof input === "object" && input && ("model" in input)) {
        const m = input.model;
        if (typeof m === "string") model = m;
        else if (m && typeof m === "object") model = m.model_id || m.id || null;
      }
      if (!model) model = getEffectiveModelId();

      if (!model || typeof model !== "string") {
        console.error("❌ No valid model to send. Select a model first.");
        window.appState?.emit?.("stream:error", "No model selected.");
        return;
      }

      const conversation_id =
        (typeof input === "object" && input && input.conversation_id != null)
          ? input.conversation_id
          : state.currentConversationId;

      const deep_search = (typeof input === "object" && input && ("deep_search" in input || "deep" in input))
          ? !!(input.deep_search ?? input.deep)
          : !!state.isDeepSearchEnabled;

      let params = null;
      if (typeof input === "object" && input?.params && typeof input.params === "object") {
        params = input.params;
      } else if (state.userParams && typeof state.userParams === "object") {
        params = state.userParams;
      }

      const payload = {
        type: "chat_message",
        content,
        model,
        conversation_id,
        deep_search
      };
      if (params) payload.params = params;

      window.appState?.update?.({ isLoading: true });

      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log("📤 Sending message via WebSocket:", payload);
        try {
          this.ws.send(JSON.stringify(payload));
        } catch (err) {
          console.error("❌ Failed to send over open socket, queuing:", err);
          if (this.messageQueue.length >= QUEUE_MAX) this.messageQueue.shift();
          this.messageQueue.push(payload);
        }
      } else {
        console.warn("⚠️ WebSocket not connected. Queuing message.", payload);
        if (this.messageQueue.length >= QUEUE_MAX) this.messageQueue.shift();
        this.messageQueue.push(payload);
        if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          this.connect();
        }
      }
    }

    cancel(conversationId) {
      const st = window.appState?.get?.() || {};
      const cid = conversationId ?? st.currentConversationId ?? null;
      this._sendRaw({ type: 'cancel', conversation_id: cid });
      window.appState?.update?.({ isLoading: false });
    }

    disconnect() {
      this._clearReconnectTimer();
      if (this.ws) {
        try { this.ws.close(1000, "Client disconnect"); } catch (_) {}
      }
    }

    _buildDefaultUrl() {
      const proto = window.location.protocol === "https:" ? "wss://" : "ws://";
      return `${proto}${window.location.host}/ws/chat/`;
    }

    connect() {
      if (!this.wsUrl) this.wsUrl = this._buildDefaultUrl();
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

      console.log(`🔌 Attempting to connect to ${this.wsUrl}`);
      try {
        this.ws = new WebSocket(this.wsUrl);
        this.ws.onopen = this._handleOpen.bind(this);
        this.ws.onmessage = this._handleMessage.bind(this);
        this.ws.onclose = this._handleClose.bind(this);
        this.ws.onerror = this._handleError.bind(this);
      } catch (err) {
        console.error("❌ WebSocket creation failed:", err);
        this._scheduleReconnect();
      }
    }

    _handleOpen() {
      console.log("✅ WebSocket connection established.");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this._clearReconnectTimer();
      this._processMessageQueue();
      window.appState?.emit?.('ws:open', { url: this.wsUrl });
    }

    _handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        console.log("📨 WebSocket message received:", data);

        switch (data.type) {
          case "connected":
            break;

          // ✨====== تغییر نهایی برای حل مشکل عنوان چت ======✨
          case "ConversationCreated": {
            console.log(`✅ New conversation started (ID: ${data.conversation_id}, Title: "${data.title}"). Updating state and history.`);
            
            // 1. یک آبجکت برای گفتگوی جدید می‌سازیم
            const newConversation = {
              id: data.conversation_id,
              title: data.title,
            };

            // 2. لیست تاریخچه فعلی را از state می‌گیریم
            const currentState = window.appState.get();
            // 3. گفتگوی جدید را به ابتدای لیست اضافه می‌کنیم
            const updatedHistory = [newConversation, ...(currentState.chatHistory || [])];

            // 4. هر دو مقدار را با هم در state آپدیت می‌کنیم تا سایدبار واکنش نشان دهد
            window.appState.update({
              currentConversationId: data.conversation_id,
              chatHistory: updatedHistory,
            });
            break;
          }
          // ✨====== پایان تغییرات ======✨

          case "started":
            if (!window.appState?.get?.().isLoading) {
              window.appState?.update?.({ isLoading: true });
            }
            break;

          case "token":
            if (data.delta != null) {
              window.appState?.emit?.("stream:token", data.delta);
            }
            break;

          case "done":
            window.appState?.update?.({ isLoading: false });
            window.appState?.emit?.("stream:done", data.finish_reason || "stop");
            break;

          case "error":
            console.error("❌ Streaming error from server:", data.error);
            window.appState?.update?.({ isLoading: false });
            window.appState?.emit?.("stream:error", data.error || "Streaming error");
            break;

          case "ping":
            this._sendRaw({ type: "pong" });
            break;

          default:
            console.warn("ℹ️ Unhandled WS message type:", data.type, data);
            break;
        }
      } catch (error) {
        console.error("❌ Error parsing WebSocket message:", error);
      }
    }

    _handleClose(event) {
      console.warn(`🔌 WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      this.isConnected = false;

      if (window.appState?.get?.().isLoading) {
        window.appState.update({ isLoading: false });
        window.appState.emit("stream:error", "Connection lost during streaming.");
      }

      window.appState?.emit?.('ws:close', { code: event.code, reason: event.reason });

      if (event.code !== 1000) {
        this._scheduleReconnect();
      }
    }

    _handleError(event) {
      console.error("❌ WebSocket error:", event);
    }

    _scheduleReconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("⛔ Max reconnect attempts reached. Giving up.");
        window.appState?.emit?.('ws:reconnect_failed');
        return;
      }
      this.reconnectAttempts += 1;
      const delay = Math.min(
        this.reconnectDelayBase * Math.pow(2, this.reconnectAttempts - 1),
        this.maxReconnectDelay
      );
      console.log(`⏳ Scheduling reconnect attempt #${this.reconnectAttempts} in ${delay}ms`);
      window.appState?.emit?.('ws:reconnecting', { attempt: this.reconnectAttempts, delay });
      this._clearReconnectTimer();
      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, delay);
    }

    _clearReconnectTimer() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    }

    _processMessageQueue() {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      while (this.messageQueue.length) {
        const msg = this.messageQueue.shift();
        try {
          this.ws.send(JSON.stringify(msg));
        } catch (err) {
          console.error("❌ Failed to send queued message:", err, msg);
          this.messageQueue.unshift(msg);
          break;
        }
      }
    }

    _sendRaw(obj) {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(obj));
      }
    }
  }

  // --- Global instance exposed on window ---
  window.websocketManager = new WebSocketManager();
  console.log("✅ WebSocket Management Module Initialized.");
})();