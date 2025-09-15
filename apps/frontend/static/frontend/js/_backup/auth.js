/* =========================================================
   Pyamooz AI - Authentication Manager
   Complete Google OAuth & User Management System
   ========================================================= */

class AuthManager {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    this.checkingAuth = false;
    this.authCallbacks = [];
    
    // Initialize authentication
    this.init();
  }

  /* =========================================================
     Initialization & Setup
     ========================================================= */

  async init() {
    console.log('🔐 Initializing AuthManager...');
    
    try {
      // Setup event listeners
      this.setupEventListeners();
      
      // Check current authentication status
      await this.checkAuthStatus();
      
      // Update UI based on auth status
      this.updateUI();
      
      console.log('✅ AuthManager initialized successfully');
    } catch (error) {
      console.error('❌ AuthManager initialization failed:', error);
    }
  }

  setupEventListeners() {
    // Google Login Button
    const googleLoginBtn = document.querySelector('button[aria-label="Login with Google"]');
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.initiateGoogleLogin();
      });
      console.log('✅ Google login event listener added');
    } else {
      console.log('⚠️ Google login button not found');
    }

    // Logout buttons (will be created dynamically)
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-auth-action="logout"]') || 
          e.target.closest('[data-auth-action="logout"]')) {
        e.preventDefault();
        this.logout();
      }
    });

    // Handle URL changes (for OAuth callback)
    window.addEventListener('popstate', () => {
      this.handleAuthCallback();
    });
  }

  /* =========================================================
     Authentication Methods
     ========================================================= */

  async checkAuthStatus() {
    if (this.checkingAuth) return;
    
    this.checkingAuth = true;
    console.log('🔍 Checking authentication status...');

    try {
      const response = await this.apiCall('/api/v1/auth/status/', 'GET');
      
      if (response.authenticated) {
        this.user = response.user;
        this.isAuthenticated = true;
        console.log('✅ User is authenticated:', this.user.email);
      } else {
        this.user = null;
        this.isAuthenticated = false;
        console.log('ℹ️ User is not authenticated');
      }
      
      // Trigger callbacks
      this.triggerAuthCallbacks();
      
    } catch (error) {
      console.error('❌ Auth status check failed:', error);
      this.user = null;
      this.isAuthenticated = false;
    } finally {
      this.checkingAuth = false;
    }
  }

  initiateGoogleLogin() {
    console.log('🔍 Initiating Google login...');
    
    try {
      // Store current page for redirect after login
      sessionStorage.setItem('auth_redirect_url', window.location.pathname);
      
      // Redirect to Django allauth Google login
      window.location.href = '/accounts/google/login/';
    } catch (error) {
      console.error('❌ Google login failed:', error);
      this.showError('خطا در ورود با Google. لطفاً دوباره تلاش کنید.');
    }
  }

  async logout() {
    console.log('🚪 Logging out...');
    
    try {
      // Call logout API
      await this.apiCall('/accounts/logout/', 'POST');
      
      // Clear local state
      this.user = null;
      this.isAuthenticated = false;
      
      // Clear session storage
      sessionStorage.removeItem('auth_redirect_url');
      
      // Update UI
      this.updateUI();
      
      // Trigger callbacks
      this.triggerAuthCallbacks();
      
      console.log('✅ Logged out successfully');
      
      // Optionally redirect to home
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
      
    } catch (error) {
      console.error('❌ Logout failed:', error);
      this.showError('خطا در خروج از حساب کاربری.');
    }
  }

  handleAuthCallback() {
    // Handle successful OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('authenticated') || window.location.pathname.includes('/accounts/')) {
      console.log('🔄 Handling auth callback...');
      
      // Re-check auth status
      setTimeout(() => {
        this.checkAuthStatus().then(() => {
          // Redirect to stored URL or home
          const redirectUrl = sessionStorage.getItem('auth_redirect_url') || '/';
          sessionStorage.removeItem('auth_redirect_url');
          
          if (window.location.pathname !== redirectUrl) {
            window.location.href = redirectUrl;
          }
        });
      }, 1000);
    }
  }

  /* =========================================================
     UI Management - Sidebar User Card Control
     ========================================================= */

  updateUI() {
    if (this.isAuthenticated && this.user) {
      this.showAuthenticatedUI();
    } else {
      this.showUnauthenticatedUI();
    }
  }

  showAuthenticatedUI() {
    console.log('🎨 Showing authenticated UI for:', this.user.email);
    
    // ✅ مخفی کردن دکمه Google Login در header
    const googleLoginBtn = document.querySelector('button[aria-label="Login with Google"]');
    if (googleLoginBtn) {
      googleLoginBtn.style.display = 'none';
    }

    // ✅ به‌روزرسانی user card موجود در sidebar
    this.updateUserCard();
    
    // ✅ اضافه کردن دکمه logout به user card
    this.addLogoutToUserCard();
  }

  showUnauthenticatedUI() {
    console.log('🎨 Showing unauthenticated UI');
    
    // ✅ نمایش دکمه Google Login در header
    const googleLoginBtn = document.querySelector('button[aria-label="Login with Google"]');
    if (googleLoginBtn) {
      googleLoginBtn.style.display = 'flex';
    }

    // ✅ مخفی کردن user card در sidebar
    this.hideUserCard();
  }

  updateUserCard() {
    const userCard = document.querySelector('.user-card');
    if (!userCard) {
      console.warn('⚠️ User card not found');
      return;
    }

    // نمایش user card
    userCard.style.display = 'flex';

    // به‌روزرسانی avatar
    const avatar = userCard.querySelector('.avatar');
    if (avatar) {
      const displayName = this.getUserDisplayName();
      const firstLetter = displayName.charAt(0).toUpperCase();
      avatar.textContent = firstLetter;
      avatar.title = displayName;
    }

    // به‌روزرسانی اطلاعات کاربر
    const userInfo = userCard.querySelector('div[style*="font-size: 13px"]');
    if (userInfo) {
      userInfo.innerHTML = `
        <div style="font-weight: 600">${this.getUserDisplayName()}</div>
        <div style="color: #64748b">${this.user.email}</div>
      `;
    }

    console.log('✅ User card updated with current user info');
  }

  hideUserCard() {
    const userCard = document.querySelector('.user-card');
    if (userCard) {
      userCard.style.display = 'none';
    }
    
    // حذف دکمه logout اگر وجود دارد
    this.removeLogoutFromUserCard();
  }

  addLogoutToUserCard() {
    const userCard = document.querySelector('.user-card');
    if (!userCard) return;

    // حذف دکمه قبلی اگر وجود دارد
    this.removeLogoutFromUserCard();

    // ایجاد دکمه logout
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'user-logout-btn';
    logoutBtn.setAttribute('data-auth-action', 'logout');
    logoutBtn.title = 'خروج از حساب کاربری';
    logoutBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
      </svg>
    `;

    // اضافه کردن استایل
    this.addLogoutButtonStyles();

    // اضافه کردن به user card
    userCard.appendChild(logoutBtn);

    console.log('✅ Logout button added to user card');
  }

  removeLogoutFromUserCard() {
    const existingLogoutBtn = document.querySelector('.user-logout-btn');
    if (existingLogoutBtn) {
      existingLogoutBtn.remove();
    }
  }

  addLogoutButtonStyles() {
    // چک کردن اینکه استایل قبلاً اضافه نشده باشد
    if (document.getElementById('logoutButtonStyles')) return;

    const style = document.createElement('style');
    style.id = 'logoutButtonStyles';
    style.textContent = `
      .user-logout-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 0.375rem;
        color: #64748b;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: auto;
        flex-shrink: 0;
      }

      .user-logout-btn:hover {
        background: #fee2e2;
        color: #dc2626;
      }

      .user-logout-btn:active {
        transform: scale(0.95);
      }

      /* تنظیم user-card برای نمایش دکمه logout */
      .user-card {
        align-items: center;
        gap: 0.5rem;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .user-logout-btn {
          color: #94a3b8;
        }
        
        .user-logout-btn:hover {
          background: #7f1d1d;
          color: #f87171;
        }
      }
    `;

    document.head.appendChild(style);
  }

  getUserDisplayName() {
    if (!this.user) return 'کاربر';
    
    if (this.user.first_name && this.user.last_name) {
      return `${this.user.first_name} ${this.user.last_name}`;
    }
    
    if (this.user.first_name) {
      return this.user.first_name;
    }
    
    // Extract name from email
    const emailName = this.user.email.split('@')[0];
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }

  /* =========================================================
     Utility Methods
     ========================================================= */

  async apiCall(url, method = 'GET', data = null) {
    const options = {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      }
    };

    // Add CSRF token for POST requests
    if (method === 'POST') {
      const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
      if (csrfToken) {
        options.headers['X-CSRFToken'] = csrfToken;
      }
    }

    // Add body for POST requests
    if (data && method === 'POST') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle different content types
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  }

  showError(message) {
    // Simple error display - can be enhanced with better UI
    console.error('Auth Error:', message);
    
    // You can integrate this with your existing notification system
    if (typeof addMessageToChat === 'function') {
      addMessageToChat(`❌ ${message}`, false);
    } else {
      alert(message);
    }
  }

  showSuccess(message) {
    console.log('Auth Success:', message);
    
    // You can integrate this with your existing notification system
    if (typeof addMessageToChat === 'function') {
      addMessageToChat(`✅ ${message}`, false);
    }
  }

  /* =========================================================
     Event System for Other Components
     ========================================================= */

  onAuthChange(callback) {
    if (typeof callback === 'function') {
      this.authCallbacks.push(callback);
    }
  }

  triggerAuthCallbacks() {
    this.authCallbacks.forEach(callback => {
      try {
        callback({
          isAuthenticated: this.isAuthenticated,
          user: this.user
        });
      } catch (error) {
        console.error('❌ Auth callback error:', error);
      }
    });
  }

  /* =========================================================
     Public API
     ========================================================= */

  // Getter methods for other components
  getUser() {
    return this.user;
  }

  isLoggedIn() {
    return this.isAuthenticated;
  }

  getUserId() {
    return this.user?.id || null;
  }

  getUserEmail() {
    return this.user?.email || null;
  }

  // Force refresh auth status
  async refresh() {
    await this.checkAuthStatus();
    this.updateUI();
  }
}

/* =========================================================
   Global Instance & Initialization
   ========================================================= */

// Global auth manager instance
let authManager = null;

// Initialize when DOM is ready
function initializeAuth() {
  if (!authManager) {
    authManager = new AuthManager();
    
    // Export for global access
    window.authManager = authManager;
    
    console.log('✅ Auth system initialized');
  }
}

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
  initializeAuth();
}

/* =========================================================
   Export for Module Systems (if needed)
   ========================================================= */

// For ES6 modules (if you decide to use them later)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthManager, authManager };
}

console.log('📱 Auth module loaded');