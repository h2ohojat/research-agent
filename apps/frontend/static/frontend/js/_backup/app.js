/* =========================================================
   Pyamooz AI - Complete Application Logic with Model Management
   ========================================================= */

// Helper functions for API calls
async function GET(url, options = {}) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...options.headers
      },
      ...options
    });
    return await response.json();
  } catch (error) {
    console.error('GET request failed:', error);
    throw error;
  }
}

async function POST(url, data = {}, options = {}) {
  try {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken,
        ...options.headers
      },
      body: JSON.stringify(data),
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('POST request failed:', error);
    throw error;
  }
}

/* =========================================================
   WebSocket Streaming Manager - Final Optimized Version
   ========================================================= */

class StreamingManager {
  constructor() {
    this.ws = null;
    this.currentMessageElement = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.messageQueue = [];
    this.currentTypingIndicator = null;
    this.streamStarted = false; // ✅ جلوگیری از ایجاد حباب دوبار
    this.setupWebSocket();
  }

  setupWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat/`;
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.processMessageQueue();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket received:', data);
          this.handleStreamMessage(data);
        } catch (error) {
          console.error('❌ WebSocket message parse error:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed: ${event.code} - ${event.reason}`);
        this.isConnected = false;
        this.resetStreamState();
        
        // Auto-reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`🔄 Reconnecting in ${delay}ms... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.setupWebSocket(), delay);
        } else {
          console.error('❌ Max reconnection attempts reached');
          this.showConnectionError();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
        this.resetStreamState();
      };
      
    } catch (error) {
      console.error('❌ WebSocket creation failed:', error);
      this.showConnectionError();
    }
  }
  
  handleStreamMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('🔗 WebSocket handshake complete');
        break;
        
      case 'started':
        console.log('🚀 Stream started for model:', data.model);
        
        // ✅ فقط اولین بار حباب ایجاد کن
        if (!this.streamStarted) {
          this.streamStarted = true;
          this.startNewMessage();
        } else {
          console.log('⚠️ Duplicate started message ignored');
        }
        break;
        
      case 'token':
        if (data.delta) {
          console.log('📝 Received token:', data.delta);
          this.appendToken(data.delta);
        }
        break;
        
      case 'done':
        console.log('✅ Stream completed:', data.finish_reason);
        this.finishMessage(data.finish_reason);
        break;
        
      case 'error':
        console.error('❌ Stream error:', data.error || data.message);
        this.handleStreamError(data.error || data.message || 'Unknown error');
        break;
        
      case 'conversation_created':
        if (data.conversation_id) {
          currentConversationId = data.conversation_id;
          console.log('📝 Conversation ID set:', currentConversationId);
        }
        break;
        
      default:
        console.log('❓ Unknown message type:', data.type, data);
    }
  }
  
  startNewMessage() {
    // Remove any existing typing indicator
    this.removeTypingIndicator();
    
    // Remove any previous streaming message if exists
    if (this.currentMessageElement) {
      console.warn('⚠️ Previous streaming message still exists, removing...');
      this.currentMessageElement.remove();
    }
    
    // Create new streaming message element
    this.currentMessageElement = this.createStreamingMessage();
    
    const { chatMessages } = el;
    if (chatMessages) {
      chatMessages.appendChild(this.currentMessageElement);
      this.scrollToBottom();
    }
  }
  
  createStreamingMessage() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'msg assistant bubble-in streaming';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = '';
    
    // Add cursor for streaming effect
    const cursor = document.createElement('span');
    cursor.className = 'streaming-cursor';
    cursor.textContent = '▋';
    bubble.appendChild(cursor);
    
    msgDiv.appendChild(bubble);
    return msgDiv;
  }
  
  appendToken(token) {
    if (!this.currentMessageElement) {
      console.warn('⚠️ No current message element for token:', token);
      return;
    }
    
    const bubble = this.currentMessageElement.querySelector('.bubble');
    const cursor = bubble.querySelector('.streaming-cursor');
    
    if (bubble && cursor) {
      // Insert token before cursor
      const textNode = document.createTextNode(token);
      bubble.insertBefore(textNode, cursor);
      
      // Auto-scroll to keep up with streaming
      this.scrollToBottom();
    }
  }
  
  finishMessage(finishReason = 'stop') {
    if (!this.currentMessageElement) {
      console.warn('⚠️ No current message element to finish');
      return;
    }
    
    // Remove streaming class and add completed class
    this.currentMessageElement.classList.remove('streaming');
    this.currentMessageElement.classList.add('completed');
    
    const bubble = this.currentMessageElement.querySelector('.bubble');
    const cursor = bubble.querySelector('.streaming-cursor');
    
    // Remove cursor
    if (cursor) {
      cursor.remove();
    }
    
    // Check if message has content
    const content = bubble.textContent.trim();
    if (!content || content === '') {
      bubble.textContent = 'پاسخ دریافت شد.';
      console.warn('⚠️ Empty message content, added default text');
    }
    
    console.log('✅ Message completed with reason:', finishReason);
    
    // Reset state
    this.resetStreamState();
  }
  
  handleStreamError(error) {
    console.error('❌ Handling stream error:', error);
    
    // Remove typing indicator
    this.removeTypingIndicator();
    
    if (this.currentMessageElement) {
      const bubble = this.currentMessageElement.querySelector('.bubble');
      const cursor = bubble.querySelector('.streaming-cursor');
      
      if (cursor) cursor.remove();
      
      bubble.textContent = `❌ خطا: ${error}`;
      this.currentMessageElement.classList.remove('streaming');
      this.currentMessageElement.classList.add('error');
    } else {
      // Create new error message if no streaming message exists
      this.addErrorMessage(`❌ خطا: ${error}`);
    }
    
    // Reset state
    this.resetStreamState();
  }
  
  removeTypingIndicator() {
    // Remove all typing indicators from DOM
    const typingIndicators = document.querySelectorAll('.typing-indicator');
    typingIndicators.forEach(indicator => {
      indicator.remove();
    });
    
    // Clear reference
    this.currentTypingIndicator = null;
  }
  
  scrollToBottom() {
    const { chatMessages } = el;
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
  
  showConnectionError() {
    this.addErrorMessage('❌ اتصال به سرور قطع شد. لطفاً صفحه را رفرش کنید.');
  }
  
  addErrorMessage(message) {
    if (typeof addMessageToChat === 'function') {
      addMessageToChat(message, false);
    } else {
      console.error('❌ addMessageToChat function not available');
    }
  }
  
sendMessage(content, conversationId = null) {
    if (!content || !content.trim()) {
      console.warn('⚠️ Empty message content');
      return false;
    }
    
    // 🆕 Get current selected model
    let currentModel = selectedModel;
    if (window.modelManager && window.modelManager.hasSelectedModel()) {
      currentModel = window.modelManager.getSelectedModel().model_id;
    }
    
    const message = {
      type: 'chat_message',
      content: content.trim(),
      model: currentModel, // 🆕 استفاده از مدل به‌روزرسانی شده
      conversation_id: conversationId,
      deep_search: isDeepSearchEnabled,
      timestamp: Date.now()
    };
    
    console.log('📤 WebSocket message with model:', message.model);
    
    // Check WebSocket connection
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📤 Sending via WebSocket:', message);
      
      try {
        // Reset stream state before sending
        this.resetStreamState();
        
        // Send message
        this.ws.send(JSON.stringify(message));
        
        // Show typing indicator
        this.showTypingIndicator();
        
        return true;
      } catch (error) {
        console.error('❌ WebSocket send failed:', error);
        return false;
      }
    } else {
      console.log('⚠️ WebSocket not ready, state:', this.ws?.readyState);
      this.messageQueue.push(message);
      return false;
    }
}
  showTypingIndicator() {
    // Remove any existing typing indicator first
    this.removeTypingIndicator();
    
    const { chatMessages } = el;
    if (!chatMessages) {
      console.warn('⚠️ chatMessages element not found');
      return;
    }
    
    const indicator = document.createElement('div');
    indicator.className = 'msg assistant bubble-in typing-indicator';
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = '<span class="typing-dots">در حال تایپ...</span>';
    
    indicator.appendChild(bubble);
    chatMessages.appendChild(indicator);
    this.scrollToBottom();
    
    // Store reference
    this.currentTypingIndicator = indicator;
  }
  
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    console.log(`📤 Processing ${this.messageQueue.length} queued messages`);
    
    // Process all queued messages
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(message => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(message));
          this.showTypingIndicator();
        } catch (error) {
          console.error('❌ Failed to send queued message:', error);
          this.messageQueue.push(message); // Re-queue failed message
        }
      } else {
        this.messageQueue.push(message); // Re-queue if connection lost
      }
    });
  }
  
  resetStreamState() {
    this.streamStarted = false;
    this.currentMessageElement = null;
  }
  
  // ✅ Clean disconnect method
  disconnect() {
    console.log('🔌 Disconnecting WebSocket...');
    
    this.resetStreamState();
    this.removeTypingIndicator();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.messageQueue = [];
  }
  
  // ✅ Health check method
  isHealthy() {
    return this.isConnected && 
           this.ws && 
           this.ws.readyState === WebSocket.OPEN;
  }
  
  // ✅ Get connection status
  getStatus() {
    const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
    return {
      connected: this.isConnected,
      readyState: this.ws?.readyState,
      readyStateText: states[this.ws?.readyState] || 'UNKNOWN',
      queuedMessages: this.messageQueue.length,
      streaming: this.streamStarted
    };
  }
}

/* =========================================================
   Model Management System
   ========================================================= */

// Global model management variables
let modelManager = null;
let modelSelector = null;

async function initializeModelManager() {
    console.log('🔧 Initializing Model Manager...');
    
    try {
        // Check if ModelManager class is available
        if (typeof ModelManager === 'undefined') {
            console.warn('⚠️ ModelManager class not found, skipping model management');
            return;
        }
        
        // ایجاد Model Manager
        modelManager = new ModelManager();
        
        // 🆕 فوراً به window اضافه کن
        window.modelManager = modelManager;
        
        // منتظر بارگذاری اولیه بمانید
        await new Promise(resolve => {
            let attempts = 0;
            const checkLoaded = () => {
                attempts++;
                if (modelManager.hasSelectedModel() || attempts > 50) { // 5 second timeout
                    resolve();
                } else {
                    setTimeout(checkLoaded, 100);
                }
            };
            checkLoaded();
        });
        
        console.log('✅ Model Manager initialized');
        
        // ایجاد Model Selector در composer
        const selectorContainer = document.getElementById('modelSelectorContainer');
        if (selectorContainer) {
            if (typeof ModelSelector !== 'undefined') {
                modelSelector = new ModelSelector('modelSelectorContainer', modelManager);
                
                // 🆕 فوراً به window اضافه کن
                window.modelSelector = modelSelector;
                
                console.log('✅ Model Selector initialized in composer');
            } else {
                console.warn('⚠️ ModelSelector class not found');
            }
        } else {
            console.warn('⚠️ modelSelectorContainer not found');
        }
        
        // Set up event listeners
        setupModelEvents();
        
    } catch (error) {
        console.error('❌ Error initializing Model Manager:', error);
    }
}
// Update legacy select elements
function updateLegacySelects(modelId) {
    const allModelSelects = document.querySelectorAll('#modelSelect, #modelSelect2');
    allModelSelects.forEach(select => {
        if (select && select.value !== modelId) {
            // Check if option exists
            const option = select.querySelector(`option[value="${modelId}"]`);
            if (option) {
                select.value = modelId;
                console.log(`✅ Updated legacy select: ${select.id}`);
            } else {
                console.warn(`⚠️ Option ${modelId} not found in ${select.id}`);
            }
        }
    });
}
function setupModelEvents() {
    if (!modelManager) return;
    
    // Listen to model changes
    modelManager.setOnModelChange((model) => {
        console.log(`🔄 Model changed to: ${model.display_name} (${model.model_id})`);
        
        // 🆕 Update selected model for streaming - فوراً
        selectedModel = model.model_id;
        console.log(`✅ Global selectedModel updated to: ${selectedModel}`);
        
        // 🆕 Force update UI immediately
        if (modelSelector) {
            console.log('🎨 Forcing UI update via modelSelector...');
            modelSelector.updateSelectedModel(model);
        } else {
            console.warn('⚠️ modelSelector not available for UI update');
        }
        
        // Update chat interface
        updateChatInterface(model);
        
        // Update composer placeholder
        updateComposerPlaceholder(model);
        
        // Update any other UI components
        updateModelDependentUI(model);
        
        // 🆕 Update legacy selects if they exist
        updateLegacySelects(model.model_id);
    });
    
    // Listen to errors
    modelManager.setOnError((error) => {
        console.error('❌ Model Manager Error:', error);
        showNotification && showNotification('خطا در بارگذاری مدل‌ها', 'error');
    });
}

function updateComposerPlaceholder(model) {
    const textarea = document.querySelector('.composer .textarea');
    if (textarea) {
        let placeholder = 'Give me any task to work on…';
        
        if (model.supports_vision) {
            placeholder += ' (You can also attach images)';
        }
        
        if (model.supports_function_calling) {
            placeholder += ' I can also call functions and use tools.';
        }
        
        textarea.placeholder = placeholder;
    }
}

function updateChatInterface(model) {
    // Update chat interface based on selected model
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        // Add model info to chat header or somewhere visible
        updateChatHeader(model);
    }
}

function updateChatHeader(model) {
    // اضافه کردن اطلاعات مدل به هدر چت
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader) {
        let modelInfo = chatHeader.querySelector('.current-model-info');
        if (!modelInfo) {
            modelInfo = document.createElement('div');
            modelInfo.className = 'current-model-info';
            chatHeader.appendChild(modelInfo);
        }
        
        modelInfo.innerHTML = `
            <div class="current-model">
                <i class="fas fa-brain"></i>
                <span>${model.display_name}</span>
                ${model.supports_vision ? '<i class="fas fa-eye" title="پشتیبانی از تصاویر"></i>' : ''}
            </div>
        `;
    }
}

function updateModelDependentUI(model) {
    // Show/hide attach button based on vision support
    const attachBtn = document.querySelector('.composer .btn[aria-label="Attach file"]');
    if (attachBtn) {
        if (model.supports_vision) {
            attachBtn.style.display = 'flex';
            attachBtn.title = 'Attach image (Vision supported)';
            attachBtn.style.opacity = '1';
        } else {
            attachBtn.style.opacity = '0.5';
            attachBtn.title = 'File attachment (Vision not supported by current model)';
        }
    }
    
    // Update deep search button if model supports advanced features
    const deepBtns = document.querySelectorAll('#btnDeep, #btnDeep2');
    deepBtns.forEach(deepBtn => {
        if (deepBtn && model.supports_function_calling) {
            deepBtn.classList.add('enhanced');
            deepBtn.title = 'Deep Search with Function Calling';
        } else if (deepBtn) {
            deepBtn.classList.remove('enhanced');
            deepBtn.title = 'Deep Search';
        }
    });
}

// تابع برای دریافت مدل انتخاب شده در chat
function getSelectedModelForChat() {
    if (modelManager && modelManager.hasSelectedModel()) {
        return modelManager.getSelectedModel();
    }
    return null;
}
/* =========================================================
   Model Selector Visibility Auto-Fix
   ========================================================= */

// تابع تضمین نمایش model selector
function ensureModelSelectorVisibility() {
    console.log('🔧 Ensuring model selector visibility...');
    
    const composers = document.querySelectorAll('.composer, #composer, [class*="composer"]');
    let fixedCount = 0;
    
    composers.forEach((composer, index) => {
        const rect = composer.getBoundingClientRect();
        const textarea = composer.querySelector('textarea, input[type="text"]');
        const isVisible = rect.width > 0 && rect.height > 0;
        const isActive = textarea && !textarea.disabled;
        
        if (isVisible && isActive) {
            const modelWrapper = composer.querySelector('.model-selector-wrapper');
            
            if (modelWrapper) {
                // Force visibility styles
                modelWrapper.style.setProperty('display', 'flex', 'important');
                modelWrapper.style.setProperty('visibility', 'visible', 'important');
                modelWrapper.style.setProperty('opacity', '1', 'important');
                modelWrapper.style.setProperty('position', 'relative', 'important');
                modelWrapper.style.setProperty('z-index', '100', 'important');
                
                const modelSelector = modelWrapper.querySelector('.model-selector');
                if (modelSelector) {
                    modelSelector.style.setProperty('display', 'block', 'important');
                    modelSelector.style.setProperty('visibility', 'visible', 'important');
                    modelSelector.style.setProperty('opacity', '1', 'important');
                }
                
                const trigger = modelWrapper.querySelector('.model-selector-trigger');
                if (trigger) {
                    trigger.style.setProperty('display', 'flex', 'important');
                    trigger.style.setProperty('visibility', 'visible', 'important');
                    trigger.style.setProperty('opacity', '1', 'important');
                    trigger.style.setProperty('pointer-events', 'auto', 'important');
                }
                
                fixedCount++;
                console.log(`✅ Fixed model selector visibility for composer ${index + 1}`);
            }
        }
    });
    
    console.log(`🎯 Fixed ${fixedCount} model selector(s)`);
    return fixedCount > 0;
}

// تابع نظارت بر تغییرات DOM
function setupModelSelectorObserver() {
    console.log('👁️ Setting up model selector visibility observer...');
    
    const observer = new MutationObserver(function(mutations) {
        let needsFix = false;
        
        mutations.forEach(function(mutation) {
            // بررسی تغییر attribute ها
            if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (target.classList?.contains('model-selector-wrapper') || 
                    target.classList?.contains('model-selector') ||
                    target.classList?.contains('composer')) {
                    needsFix = true;
                }
            }
            
            // بررسی اضافه/حذف element ها
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && 
                        (node.classList?.contains('composer') || 
                         node.querySelector?.('.composer'))) {
                        needsFix = true;
                    }
                });
            }
        });
        
        if (needsFix) {
            console.log('🔄 DOM changes detected, fixing model selector visibility...');
            setTimeout(ensureModelSelectorVisibility, 50);
        }
    });
    
    // شروع نظارت
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    });
    
    console.log('✅ Model selector observer started');
    return observer;
}

// Auto-fix در مواقع مختلف
function setupModelSelectorAutoFix() {
    console.log('🔧 Setting up model selector auto-fix...');
    
    // Fix فوری
    setTimeout(ensureModelSelectorVisibility, 100);
    
    // Fix بعد از load کامل
    window.addEventListener('load', () => {
        setTimeout(ensureModelSelectorVisibility, 200);
    });
    
    // Fix بعد از هر پیام
    const originalFinishMessage = StreamingManager.prototype.finishMessage;
    StreamingManager.prototype.finishMessage = function(finishReason) {
        const result = originalFinishMessage.call(this, finishReason);
        setTimeout(ensureModelSelectorVisibility, 100);
        return result;
    };
    
    // Fix بعد از تغییر view
    const originalSwitchToView = window.switchToView;
    window.switchToView = function(viewName) {
        const result = originalSwitchToView(viewName);
        if (viewName === 'chat') {
            setTimeout(ensureModelSelectorVisibility, 100);
        }
        return result;
    };
    
    // Setup observer
    setupModelSelectorObserver();
    
    // Periodic check (هر 5 ثانیه)
    setInterval(() => {
        const composers = document.querySelectorAll('.composer');
        const visibleComposers = Array.from(composers).filter(c => {
            const rect = c.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        
        if (visibleComposers.length > 0) {
            ensureModelSelectorVisibility();
        }
    }, 5000);
    
    console.log('✅ Model selector auto-fix setup complete');
}
/* =========================================================
   DOM Elements and State Management
   ========================================================= */

// DOM Elements Cache
const el = {};

// Global state
let currentConversationId = null;
let isDeepSearchEnabled = false;
let selectedModel = 'gpt-4o-mini';
let streamingManager = null;

// Initialize DOM elements
function initializeElements() {
  Object.assign(el, {
    // Sidebar elements
    sidebar: document.getElementById('sidebar'),
    backdrop: document.getElementById('backdrop'),
    btnMenu: document.getElementById('btnMenu'),
    
    // View elements
    homeView: document.getElementById('homeView'),
    chatView: document.getElementById('chatView'),
    
    // Input elements
    homeInput: document.getElementById('homeInput'),
    chatInput: document.getElementById('chatInput'),
    
    // Button elements
    btnSend: document.getElementById('btnSend'),
    btnSend2: document.getElementById('btnSend2'),
    btnDeep: document.getElementById('btnDeep'),
    btnDeep2: document.getElementById('btnDeep2'),
    
    // Select elements
    modelSelect: document.getElementById('modelSelect'),
    modelSelect2: document.getElementById('modelSelect2'),
    
    // Chat elements
    chatMessages: document.getElementById('chatMessages'),
    openSampleChat: document.getElementById('openSampleChat')
  });
}

/* =========================================================
   UI Functions
   ========================================================= */

// Toggle sidebar
function toggleSidebar() {
  const { sidebar, backdrop, btnMenu } = el;
  const isOpen = sidebar?.classList.contains('open');
  
  if (isOpen) {
    sidebar.classList.remove('open');
    backdrop?.classList.remove('show');
    btnMenu?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  } else {
    sidebar?.classList.add('open');
    backdrop?.classList.add('show');
    btnMenu?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
}

// Switch views
function switchToView(viewName) {
  const { homeView, chatView } = el;
  
  if (viewName === 'chat') {
    if (homeView) homeView.style.display = 'none';
    if (chatView) chatView.style.display = 'flex';
  } else {
    if (homeView) homeView.style.display = 'block';
    if (chatView) chatView.style.display = 'none';
  }
}

// Toggle deep search
function toggleDeepSearch(buttonId) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  
  isDeepSearchEnabled = !isDeepSearchEnabled;
  
  button.setAttribute('aria-pressed', isDeepSearchEnabled);
  button.classList.toggle('active', isDeepSearchEnabled);
  
  // Update both buttons to stay in sync
  const allDeepButtons = document.querySelectorAll('#btnDeep, #btnDeep2');
  allDeepButtons.forEach(btn => {
    btn.setAttribute('aria-pressed', isDeepSearchEnabled);
    btn.classList.toggle('active', isDeepSearchEnabled);
  });
  
  console.log('🔍 Deep search toggled:', isDeepSearchEnabled);
}

// Handle model selection (legacy support for old select elements)
function handleModelChange(selectElement) {
  selectedModel = selectElement.value;
  
  // Keep both selects in sync
  const allModelSelects = document.querySelectorAll('#modelSelect, #modelSelect2');
  allModelSelects.forEach(select => {
    if (select !== selectElement) {
      select.value = selectedModel;
    }
  });
  
  console.log('🤖 Model changed to:', selectedModel);
}

/* =========================================================
   Message Handling - Enhanced with Model Management
   ========================================================= */

// Send message with streaming support - ENHANCED
// Send message with streaming support - ENHANCED
async function sendMessage(input, isFromHome = false) {
  const message = input.value.trim();
  if (!message) return;
  
  console.log('📤 Sending message:', message);
  
  // 🆕 Get selected model from Model Manager با اولویت
  let currentModel = selectedModel; // fallback
  
  if (modelManager && modelManager.hasSelectedModel()) {
    const selectedModelData = modelManager.getSelectedModel();
    currentModel = selectedModelData.model_id;
    console.log(`🤖 Using model from Model Manager: ${currentModel} (${selectedModelData.display_name})`);
  } else {
    console.log(`🤖 Using fallback model: ${currentModel}`);
  }
  
  // 🆕 Update global selectedModel
  selectedModel = currentModel;
  
  // Switch to chat view if from home
  if (isFromHome) {
    switchToView('chat');
  }
  
  // Add user message to chat immediately
  addMessageToChat(message, true);
  
  // Clear input and resize
  input.value = '';
  if (window.autoResize) {
    window.autoResize(input);
  }
  
  // ✅ اول بررسی کن WebSocket آماده است یا نه
  if (streamingManager && streamingManager.isConnected && streamingManager.ws && streamingManager.ws.readyState === WebSocket.OPEN) {
    console.log('✅ Using WebSocket streaming');
    
    // ✅ WebSocket موجود است - پیام را ارسال کن
    const sent = streamingManager.sendMessage(message, currentConversationId);
    
    if (sent) {
      // ✅ پیام ارسال شد - هیچ کار دیگری نکن
      console.log('✅ Message sent via WebSocket successfully');
      return;
    }
  }
  
  // ❌ WebSocket کار نکرد - از HTTP استفاده کن
  console.log('⚠️ WebSocket not available, using HTTP fallback');
  
  // نمایش typing indicator برای HTTP
  const typingIndicator = addTypingIndicator();
  
  try {
    const requestData = {
      content: message,
      model: currentModel, // 🆕 استفاده از مدل به‌روزرسانی شده
      deep_search: isDeepSearchEnabled
    };
    
    if (currentConversationId) {
      requestData.conversation_id = currentConversationId;
    }
    
    console.log('📤 HTTP request data:', requestData);
    
    const response = await POST('/api/v1/messages', requestData);
    
    // Remove typing indicator
    if (typingIndicator) {
      typingIndicator.remove();
    }
    
    // Update conversation ID
    if (response.conversation_id) {
      currentConversationId = response.conversation_id;
    }
    
    // Add response
    if (response.response) {
      addMessageToChat(response.response, false);
    } else {
      addMessageToChat('متاسفانه نتوانستم پاسخی تولید کنم. لطفاً دوباره تلاش کنید.', false);
    }
    
  } catch (error) {
    // Remove typing indicator
    if (typingIndicator) {
      typingIndicator.remove();
    }
    
    console.error('❌ Send message error:', error);
    
    // Show user-friendly error
    let errorMessage = 'متاسفانه خطایی رخ داده است. لطفاً دوباره تلاش کنید.';
    
    if (error.message.includes('413')) {
      errorMessage = 'پیام شما خیلی طولانی است. لطفاً پیام کوتاه‌تری بفرستید.';
    } else if (error.message.includes('429')) {
      errorMessage = 'درخواست‌های زیادی ارسال کرده‌اید. لطفاً کمی صبر کنید.';
    } else if (error.message.includes('Network')) {
      errorMessage = 'خطا در اتصال. لطفاً اتصال اینترنت خود را بررسی کنید.';
    }
    
    addMessageToChat(errorMessage, false);
  }
}

// Add message to chat
function addMessageToChat(content, isUser) {
  const { chatMessages } = el;
  if (!chatMessages) return;
  
  const messageElement = createChatMessage(content, isUser);
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Create chat message element
function createChatMessage(content, isUser) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${isUser ? 'user' : 'assistant'} bubble-in`;
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = content;
  
  msgDiv.appendChild(bubble);
  return msgDiv;
}

// Add typing indicator - فقط برای HTTP fallback
function addTypingIndicator() {
  const { chatMessages } = el;
  if (!chatMessages) return null;
  
  // Remove existing typing indicator
  const existing = document.querySelector('.typing-indicator');
  if (existing) existing.remove();
  
  const indicator = document.createElement('div');
  indicator.className = 'msg assistant bubble-in typing-indicator';
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<span class="typing-dots">در حال تایپ...</span>';
  
  indicator.appendChild(bubble);
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return indicator;
}

// Open sample chat
function openSampleChat() {
  switchToView('chat');
  
  // Add sample messages with delay
  setTimeout(() => {
    addMessageToChat('چطور می‌توانم برنامه‌نویسی را به طور مؤثر یاد بگیرم؟', true);
  }, 100);
  
  setTimeout(() => {
    const sampleResponse = `در اینجا چند راه مؤثر برای یادگیری برنامه‌نویسی آورده‌ام:

1. **از مبانی شروع کنید**: منطق برنامه‌نویسی و مفاهیم پایه
2. **تمرین منظم**: هر روز حداقل یک ساعت کد بنویسید
3. **پروژه بسازید**: تئوری را با عمل ترکیب کنید
4. **در جامعه‌ها شرکت کنید**: GitHub, Stack Overflow
5. **مستندات بخوانید**: همیشه منبع رسمی را مطالعه کنید`;
    
    addMessageToChat(sampleResponse, false);
  }, 800);
}

// Load conversations list
async function loadConversations() {
  try {
    const conversations = await GET('/api/v1/conversations');
    console.log('📋 Loaded conversations:', conversations);
    // TODO: Update sidebar with conversation list
  } catch (error) {
    console.error('❌ Failed to load conversations:', error);
  }
}

/* =========================================================
   Event Handlers
   ========================================================= */

// Handle send button click
function handleSend(input) {
  const isFromHome = input?.id === 'homeInput';
  sendMessage(input, isFromHome);
}

// Handle keyboard shortcuts
function handleKeyDown(e, input) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend(input);
  }
}

// Responsive breakpoint handling
function handleBreakpoint() {
  const isMobile = window.matchMedia('(max-width: 991.98px)').matches;
  
  // Close sidebar on desktop
  if (!isMobile) {
    const { sidebar, backdrop, btnMenu } = el;
    
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('show');
    btnMenu?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
}

/* =========================================================
   Event Listeners Setup
   ========================================================= */

function setupEventListeners() {
  const { 
    btnMenu, backdrop, btnSend, btnSend2, 
    btnDeep, btnDeep2, homeInput, chatInput,
    modelSelect, modelSelect2, openSampleChat: sampleChatBtn
  } = el;

  // Sidebar toggle
  btnMenu?.addEventListener('click', toggleSidebar);
  backdrop?.addEventListener('click', toggleSidebar);

  // Send messages
  btnSend?.addEventListener('click', () => handleSend(homeInput));
  btnSend2?.addEventListener('click', () => handleSend(chatInput));

  // Enter key for sending
  homeInput?.addEventListener('keypress', (e) => handleKeyDown(e, homeInput));
  chatInput?.addEventListener('keypress', (e) => handleKeyDown(e, chatInput));

  // Auto-resize textareas
  homeInput?.addEventListener('input', (e) => {
    if (window.autoResize) window.autoResize(e.target);
  });
  chatInput?.addEventListener('input', (e) => {
    if (window.autoResize) window.autoResize(e.target);
  });

  // Deep search toggles
  btnDeep?.addEventListener('click', () => toggleDeepSearch('btnDeep'));
  btnDeep2?.addEventListener('click', () => toggleDeepSearch('btnDeep2'));

  // Model selection (legacy support)
  modelSelect?.addEventListener('change', (e) => handleModelChange(e.target));
  modelSelect2?.addEventListener('change', (e) => handleModelChange(e.target));

  // Sample chat
  sampleChatBtn?.addEventListener('click', openSampleChat);

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close sidebar
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('sidebar');
      if (sidebar?.classList.contains('open')) {
        toggleSidebar();
      }
    }
  });

  // Handle page unload
  window.addEventListener('beforeunload', () => {
    if (streamingManager) {
      streamingManager.disconnect();
    }
  });
}

/* =========================================================
   App Initialization - Complete with Model Management
   ========================================================= */

async function initializeApp() {
  console.log('🚀 Initializing Pyamooz AI App with Model Management and Fixed Streaming...');
  
  try {
    // Initialize DOM elements
    initializeElements();
    
    // Initialize WebSocket streaming manager
    streamingManager = new StreamingManager();
    
    // 🆕 Initialize Model Manager
    await initializeModelManager();
    
    // Setup event listeners
    setupEventListeners();
    
    // Handle responsive breakpoint
    const mq = window.matchMedia('(max-width: 991.98px)');
    handleBreakpoint();
    
    if (mq.addEventListener) {
      mq.addEventListener('change', handleBreakpoint);
    } else {
      mq.addListener(handleBreakpoint);
    }
    
    // Initialize components
    if (window.renderCards) {
      window.renderCards();
    }
    
    // Auto-resize textareas
    if (window.autoResize) {
      const { homeInput, chatInput } = el;
      if (homeInput) window.autoResize(homeInput);
      if (chatInput) window.autoResize(chatInput);
    }
    
    // Load conversations
    await loadConversations();
    
    // Focus first input
    el.homeInput?.focus();
    
    console.log('✅ App initialized successfully with Model Manager and fixed streaming support');
    
  } catch (error) {
    console.error('❌ App initialization failed:', error);
  }
}

/* =========================================================
   App Startup
   ========================================================= */

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

/* =========================================================
   Legacy Support & Global Exports - Complete
   ========================================================= */

// Legacy support for old functions
window.sendMessage = sendMessage;
window.openSampleChat = openSampleChat;
window.toggleSidebar = toggleSidebar;
window.switchToView = switchToView;
window.toggleDeepSearch = toggleDeepSearch;
window.handleModelChange = handleModelChange;

// 🆕 Export model management for debugging and external access
//window.modelManager = modelManager;
//window.modelSelector = modelSelector;
window.getSelectedModelForChat = getSelectedModelForChat;

// Export streaming manager for debugging
window.streamingManager = streamingManager;

// Export utility functions
window.addMessageToChat = addMessageToChat;
window.createChatMessage = createChatMessage;
window.addTypingIndicator = addTypingIndicator;

// Section toggle function
window.toggleSection = function(section) {
  console.log('🔄 Toggle section:', section);
  // TODO: Implement section toggle logic based on your needs
};

// Notification function placeholder
window.showNotification = function(message, type = 'info') {
  console.log(`📢 ${type.toUpperCase()}: ${message}`);
  // TODO: Implement actual notification system
};

console.log('📱 Pyamooz AI App loaded with Complete Model Management and Fixed Streaming');

// Force create StreamingManager if not exists (fallback)
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(() => {
    if (!window.streamingManager) {
      console.log('🔄 Force creating StreamingManager...');
      window.streamingManager = new StreamingManager();
      console.log('✅ StreamingManager force created');
    }
  }, 100);
});

/* =========================================================
   Debug and Development Helpers
   ========================================================= */

// Debug function for development
window.debugApp = function() {
  return {
    streamingManager: {
      status: streamingManager?.getStatus(),
      healthy: streamingManager?.isHealthy()
    },
    modelManager: {
      available: !!modelManager,
      selectedModel: getSelectedModelForChat(),
      totalModels: modelManager?.getAvailableModels()?.length || 0
    },
    state: {
      currentConversationId,
      isDeepSearchEnabled,
      selectedModel
    },
    elements: Object.keys(el).reduce((acc, key) => {
      acc[key] = !!el[key];
      return acc;
    }, {})
  };
};

// Performance monitoring
window.performanceMonitor = {
  startTime: Date.now(),
  getUptime: () => Date.now() - window.performanceMonitor.startTime,
  getMemoryUsage: () => {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576),
        total: Math.round(performance.memory.totalJSHeapSize / 1048576),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
      };
    }
    return null;
  }
};

console.log('🔧 Debug helpers loaded. Use window.debugApp() for status info.');

