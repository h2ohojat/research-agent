// backend/apps/frontend/static/frontend/js/websocket.js
/**
 * WebSocket manager for real-time chat streaming.
 * - Robust connect/reconnect with exponential backoff
 * - Safe message queueing while disconnected
 * - Unified payload shape for `chat_message`
 * - Handles server events: connected | started | token | done | error | ping
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

      // Reconnect eagerly when tab becomes visible again
      if (!this._visibilityHookInstalled) {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' &&
              (!this.isConnected || this.ws?.readyState !== WebSocket.OPEN)) {
            this.reconnectNow();
          }
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

      // Normalize content
      const rawContent = (typeof input === "string") ? input : (input && input.content);
      const content = (rawContent == null) ? "" : String(rawContent).trim();
      if (!content) {
        console.error("❌ sendMessage: invalid or empty content.");
        return;
      }

      // Resolve model to string model_id
      let model = null;
      if (typeof input === "object" && input && ("model" in input)) {
        const m = input.model;
        if (typeof m === "string") {
          model = m;
        } else if (m && typeof m === "object") {
          model = m.model_id || m.id || null;
        } else if (typeof m === "number") {
          model = null; // numeric id alone is not valid; will fallback below
        }
      }
      if (!model) {
        model = getEffectiveModelId();
      }
      if (!model || typeof model !== "string") {
        console.error("❌ No valid model to send. Select a model first.");
        window.appState?.emit?.("stream:error", "No model selected.");
        return;
      }

      // Resolve other optional fields
      const conversation_id =
        (typeof input === "object" && input && input.conversation_id != null)
          ? input.conversation_id
          : (state.currentConversationId ?? null);

      const deep_search =
        (typeof input === "object" && input && ("deep_search" in input || "deep" in input))
          ? !!(input.deep_search ?? input.deep)
          : !!(state.isDeepSearchEnabled ?? state.deepSearch);

      // Dynamic params (optional): prefer input.params; fall back to state.userParams
      let params = null;
      if (typeof input === "object" && input && input.params && typeof input.params === "object") {
        params = input.params;
      } else if (state.userParams && typeof state.userParams === "object") {
        params = state.userParams;
      }

      // Construct payload
      const payload = {
        type: "chat_message",
        content,
        model,                 // must be string (e.g., "gpt-4o-mini")
        conversation_id,       // nullable
        deep_search            // boolean
      };
      if (params) payload.params = params;

      // Fast feedback in UI
      window.appState?.update?.({ isLoading: true });

      // Send or queue
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

    /**
     * Cancel current streaming (if backend supports it).
     */
    cancel(conversationId) {
      const st = window.appState?.get?.() || {};
      const cid = conversationId ?? st.currentConversationId ?? null;
      this._sendRaw({ type: 'cancel', conversation_id: cid });
      window.appState?.update?.({ isLoading: false });
    }

    /**
     * Gracefully close the socket.
     */
    disconnect() {
      this._clearReconnectTimer();
      if (this.ws) {
        try { this.ws.close(1000, "Client disconnect"); } catch (_) {}
      }
    }

    // ---------- Internals ----------

    _buildDefaultUrl() {
      const proto = window.location.protocol === "https:" ? "wss://" : "ws://";
      return `${proto}${window.location.host}/ws/chat/`;
    }

    connect() {
      if (!this.wsUrl) {
        this.wsUrl = this._buildDefaultUrl();
      }
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        return; // already open/connecting
      }

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

      // UI hooks
      window.appState?.emit?.('ws:open', { url: this.wsUrl });
    }

    _handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        // Debug:
        console.log("📨 WebSocket message received:", data);

        switch (data.type) {
          case "connected":
            // Optional 'hello' from server; no-op
            break;

          case "started":
            // AI started generating a response
            if (!window.appState?.get?.().isLoading) {
              window.appState?.update?.({ isLoading: true });
            }
            break;

          case "token":
            // Append streamed delta token
            if (data.delta != null) {
              window.appState?.emit?.("stream:token", data.delta);
            }
            break;

          case "done":
            // Stream finished
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

      // If we were loading, mark as error
      if (window.appState?.get?.().isLoading) {
        window.appState.update({ isLoading: false });
        window.appState.emit("stream:error", "Connection lost during streaming.");
      }

      // UI hooks
      window.appState?.emit?.('ws:close', { code: event.code, reason: event.reason });

      // Reconnect unless it was a clean/intentional close (1000)
      if (event.code !== 1000) {
        this._scheduleReconnect();
      }
    }

    _handleError(event) {
      console.error("❌ WebSocket error:", event);
      // onclose handler will schedule reconnect if needed
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

      // UI hook
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
          // Put it back and break; retry on next open
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
