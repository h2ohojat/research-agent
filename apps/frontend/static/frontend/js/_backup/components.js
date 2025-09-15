/* =========================================================
   Reusable Components - Fixed Version
   ========================================================= */

// Icon SVG paths
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M4 4v15.5A2.5 2.5 0 0 1 6.5 22H20V6a2 2 0 0 0-2-2H6"></path>',
  chart: '<line x1="3" y1="20" x2="21" y2="20"></line><rect x="7" y="9" width="3" height="8"></rect><rect x="12" y="5" width="3" height="12"></rect><rect x="17" y="12" width="3" height="5"></rect>',
  rocket: '<path d="M5 19l-1.5 1.5M7 17l-2 2M9 15l-2 2"></path><path d="M14 4l6 6-7 7H7v-6z"></path><circle cx="15.5" cy="8.5" r="1.5"></circle>',
  globe: '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2c3 4 3 16 0 20c-3-4-3-16 0-20z"></path>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"></rect><line x1="12" y1="16" x2="12" y2="21"></line><line x1="8" y1="21" x2="16" y2="21"></line>',
  doc: '<path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line>',
  grant: '<circle cx="12" cy="8" r="4"></circle><path d="M2 22c2-4 6-6 10-6s8 2 10 6"></path>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"></path><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path>',
  paperclip: '<path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78"></path>',
  arrowUp: '<polyline points="7 11 12 6 17 11"></polyline><line x1="12" y1="6" x2="12" y2="18"></line>'
};

// Create icon SVG
window.createIcon = function(name, size = 18) {
  const path = ICONS[name] || '';
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      ${path}
    </svg>
  `;
};

// Create composer HTML (DRY solution)
window.createComposer = function(inputId, sendButtonId, deepButtonId, modelSelectId) {
  return `
    <div class="composer">
      <textarea id="${inputId}" class="textarea" placeholder="Give me any task to work on…" wrap="soft"></textarea>
      <div class="composer-bar">
        <div class="composer-left">
          <span class="credits">
            ${window.createIcon('database')}
            <span>87</span>
          </span>
          <button class="btn btn-square" aria-label="Attach file">
            ${window.createIcon('paperclip')}
          </button>
          <button class="chip icon-only" id="${deepButtonId}" aria-label="Toggle Deep Search" aria-pressed="false">
            ${window.createIcon('search')}
          </button>
          <select class="model-select" id="${modelSelectId}" aria-label="Select AI model">
            <option value="gpt-4o-mini">gpt 4o</option>
            <option value="gimini">gimini</option>
            <option value="cluod">cluod</option>
          </select>
        </div>
        <button class="btn btn-primary btn-square" id="${sendButtonId}" aria-label="Send message">
          ${window.createIcon('arrowUp')}
        </button>
      </div>
    </div>
  `;
};

// Create card tile
window.createCardTile = function(item) {
  return `
    <button class="card-tile fade-in" type="button" aria-label="${item.label}">
      <span class="tile-left">
        <span class="tool-icon" aria-hidden="true">
          ${window.createIcon(item.icon)}
        </span>
        <span>${item.label}</span>
      </span>
      <span class="chev" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </span>
    </button>
  `;
};

// Create message bubble (with DocumentFragment for performance)
window.createMessageElement = function(msg) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `msg ${msg.role} bubble-in`;
  messageDiv.setAttribute('role', msg.role === 'user' ? 'log' : 'log');
  messageDiv.setAttribute('aria-label', `${msg.role} message`);
  
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = msg.content; // Safe text insertion
  
  messageDiv.appendChild(bubble);
  return messageDiv;
};

// Escape HTML (fallback)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Textarea auto-resize
window.autoResize = function(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, window.innerHeight * 0.4) + 'px';
};

// Next textarea height calculation
window.nextTextareaHeight = function(value, lineHeight = 22, minRows = 1, maxRows = 12) {
  const lines = value.split(/\r?\n/).reduce((acc, line) => 
    acc + Math.max(1, Math.ceil(line.length / 60)), 0
  );
  const rows = Math.max(minRows, Math.min(maxRows, lines));
  return rows * lineHeight + 16;
};

// 🐞 FIX: Scroll to bottom (fixed selector)
window.scrollToBottom = function() {
  const chatScroll = document.querySelector('.chat-scroll');
  if (chatScroll) {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }
};

// Render cards for section
window.renderCards = function() {
  const state = window.getState();
  
  // Want cards
  const wantCards = document.getElementById('wantCards');
  const wantItems = state.wantExpanded ? 
    [...state.wantBase, ...state.wantExtra] : state.wantBase;
  wantCards.innerHTML = wantItems.map(window.createCardTile).join('');
  
  // Use cards
  const useCards = document.getElementById('useCards');
  const useItems = state.useExpanded ? 
    [...state.useBase, ...state.useExtra] : state.useBase;
  useCards.innerHTML = useItems.map(window.createCardTile).join('');
  
  // Make cards
  const makeCards = document.getElementById('makeCards');
  const makeItems = state.makeExpanded ? 
    [...state.makeBase, ...state.makeExtra] : state.makeBase;
  makeCards.innerHTML = makeItems.map(window.createCardTile).join('');
  
  // Update load more buttons
  const loadMoreButtons = document.querySelectorAll('.load-more');
  loadMoreButtons.forEach(btn => {
    const section = btn.dataset.section;
    const expanded = state[section + 'Expanded'];
    btn.textContent = expanded ? 'Show less' : 'Load more';
    btn.setAttribute('aria-expanded', expanded.toString());
  });
};

// ⚙️ FIX: Optimized message rendering with diff
let lastMessageCount = 0;
window.renderMessages = function() {
  const state = window.getState();
  const chatMessages = document.getElementById('chatMessages');
  
  if (state.messages.length === 0) {
    chatMessages.innerHTML = '<div class="empty-hint" role="status" aria-live="polite">Start your conversation…</div>';
    lastMessageCount = 0;
    return;
  }
  
  // Performance optimization: only render new messages
  if (state.messages.length > lastMessageCount) {
    const fragment = document.createDocumentFragment();
    
    // Add only new messages
    for (let i = lastMessageCount; i < state.messages.length; i++) {
      const messageElement = window.createMessageElement(state.messages[i]);
      fragment.appendChild(messageElement);
    }
    
    // Clear empty hint if exists
    if (lastMessageCount === 0) {
      chatMessages.innerHTML = '';
    }
    
    chatMessages.appendChild(fragment);
    lastMessageCount = state.messages.length;
  } else if (state.messages.length < lastMessageCount) {
    // Full re-render if messages were removed
    const fragment = document.createDocumentFragment();
    state.messages.forEach(msg => {
      fragment.appendChild(window.createMessageElement(msg));
    });
    chatMessages.innerHTML = '';
    chatMessages.appendChild(fragment);
    lastMessageCount = state.messages.length;
  }
  
  window.scrollToBottom();
};

// Focus trap for sidebar (accessibility)
window.trapFocus = function(element) {
  const focusableElements = element.querySelectorAll(
    'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
  );
  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements[focusableElements.length - 1];

  element.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusableElement) {
          lastFocusableElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusableElement) {
          firstFocusableElement.focus();
          e.preventDefault();
        }
      }
    }
  });

  // Focus first element when trap is activated
  if (firstFocusableElement) {
    firstFocusableElement.focus();
  }
};

// ♿ FIX: Enhanced layout rendering with proper ARIA
window.renderLayout = function() {
  const state = window.getState();
  
  // Views
  const homeView = document.getElementById('homeView');
  const chatView = document.getElementById('chatView');
  
  homeView.style.display = state.isChatOpen ? 'none' : 'block';
  chatView.style.display = state.isChatOpen ? 'flex' : 'none';
  
  // ♿ ARIA & Sidebar fixes
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const menuButton = document.getElementById('btnMenu');
  
  if (state.isMobile) {
    sidebar.classList.toggle('open', state.sidebarOpen);
    backdrop.classList.toggle('show', state.sidebarOpen);
    
    // ♿ ARIA updates
    menuButton.setAttribute('aria-expanded', state.sidebarOpen.toString());
    sidebar.setAttribute('aria-hidden', (!state.sidebarOpen).toString());
    
    // Focus management
    if (state.sidebarOpen) {
      window.trapFocus(sidebar);
      // Prevent body scroll when sidebar is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  } else {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    menuButton.setAttribute('aria-expanded', 'false');
    sidebar.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = '';
  }
  
  // Deep search buttons
  const deepButtons = document.querySelectorAll('#btnDeep, #btnDeep2');
  deepButtons.forEach(btn => {
    btn.classList.toggle('active', state.deep);
    btn.setAttribute('aria-pressed', state.deep.toString());
  });
  
  // Model selects
  const modelSelects = document.querySelectorAll('#modelSelect, #modelSelect2');
  modelSelects.forEach(select => {
    select.value = state.model;
  });
};