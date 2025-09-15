// js/api.js
/**
 * @fileoverview API abstraction layer for all HTTP communication with the backend.
 * This module centralizes fetch requests, error handling, and header management
 * (like CSRF tokens) to keep other modules clean and focused on their own logic.
 */

(function() {
    "use strict";

    const API_BASE_URL = "/api/v1"; // The base URL for our chat API endpoints

    /**
     * A helper function to get the CSRF token from the document's cookies.
     * @returns {string|null} The CSRF token value or null if not found.
     */
    function getCsrfToken() {
        // Find the CSRF token input field rendered by Django's {% csrf_token %} tag.
        const tokenElement = document.querySelector('input[name="csrfmiddlewaretoken"]');
        return tokenElement ? tokenElement.value : null;
    }

    /**
     * The core fetch function that handles all API requests.
     * It automatically adds necessary headers and handles response parsing and errors.
     * @param {string} endpoint - The API endpoint to call (e.g., '/messages/stream').
     * @param {object} options - The options object for the fetch call (method, body, etc.).
     * @returns {Promise<any>} A promise that resolves with the JSON response data.
     * @throws {Error} Throws an error for non-successful HTTP responses.
     */
    async function fetchApi(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const csrfToken = getCsrfToken();

        const headers = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers,
        };

        if (options.method && options.method.toUpperCase() !== 'GET' && csrfToken) {
            headers['X-CSRFToken'] = csrfToken;
        }

        const config = { ...options, headers };
        
        if (options.body && typeof options.body !== 'string') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                const error = new Error(errorData.detail || `HTTP error! status: ${response.status}`);
                error.status = response.status;
                error.data = errorData;
                throw error;
            }

            if (response.status === 204) {
                return null;
            }
            
            return await response.json();

        } catch (error) {
            console.error(`API call to ${endpoint} failed:`, error);
            throw error;
        }
    }
    
    // --- Public API Methods ---
    
    const api = {
        /**
         * Checks the user's current authentication status.
         */
        getAuthStatus: () => fetchApi('/auth/status/', { method: 'GET' }),

        /**
         * ✨ --- UPDATED FUNCTION WITH ROBUST LOGIC --- ✨
         * Fetches models, synchronizes the default/selected model, and handles state reconciliation.
         */
        getModels: async () => {
            window.appState.update({ modelsLoading: true, modelsError: null });
            console.log("🔄 Fetching available models from API...");
            
            try {
                const response = await fetchApi('/models/', { method: 'GET' });
                const models = Array.isArray(response?.models) ? response.models : [];
                
                window.appState.update({ models: models, modelsLoading: false });
                console.log(`✅ Successfully fetched and stored ${models.length} models.`);

                // ✨ --- منطق جدید و بهبودیافته برای انتخاب و همگام‌سازی مدل ---
                const st = window.appState.get();
                const list = models || [];

                // 1. اگر selectedModel داریم ولی دیگر در لیست جدید نیست، آن را خنثی می‌کنیم
                const stillThere = st.selectedModel && list.some(m => m.model_id === st.selectedModel.model_id);
                if (st.selectedModel && !stillThere) {
                    console.warn(`Previously selected model "${st.selectedModel.model_id}" is no longer available. Resetting.`);
                    window.appState.update({ selectedModel: null });
                }

                // 2. شناسه مدل مورد نظر را از state یا مقدار پیش‌فرض می‌خوانیم
                let desiredId = window.appState.get().selectedModelId || 'gpt-4o-mini';

                // 3. اگر selectedModel خالی است، آن را بر اساس desiredId یا fallback پیدا و تنظیم می‌کنیم
                if (!window.appState.get().selectedModel) {
                    let chosen = list.find(m => m.model_id === desiredId);

                    if (!chosen) {
                        // Fallback روی نام‌ها/لیبل‌ها برای پیدا کردن مدل پیش‌فرض
                        const byLabel = (m) => {
                            const name = (m.name || m.label || '').toLowerCase();
                            return name.includes('gpt-4o-mini') || /4\.0\s*mini/i.test(name);
                        };
                        chosen = list.find(byLabel) || list[0] || null; // اگر هیچکدام نبود، اولین مدل را انتخاب کن
                    }

                    if (chosen) {
                        window.appState.update({
                            selectedModel: chosen,
                            selectedModelId: chosen.model_id // ← همزمان هر دو را ست می‌کنیم تا state همگام بماند
                        });
                        console.log(`🤖 Default/Chosen model set to: ${chosen.name || chosen.model_id}`);
                    } else {
                        console.warn('No models available to select as default.');
                    }
                } else {
                    // 4. (اختیاری) اگر selectedModel داریم ولی selectedModelId با آن ناهماهنگ است، همگام می‌کنیم
                    const cur = window.appState.get().selectedModel;
                    if (cur && st.selectedModelId !== cur.model_id) {
                        window.appState.update({ selectedModelId: cur.model_id });
                    }
                }
                
            } catch (error) {
                console.error("❌ Failed to fetch models:", error);
                window.appState.update({ 
                    models: [], 
                    modelsLoading: false, 
                    modelsError: 'Could not load models. Please try again.' 
                });
            }
        },
        
        getChatHistory: () => fetchApi('/conversations/', { method: 'GET' }),

        getConversationMessages: (conversationId) => fetchApi(`/conversations/${conversationId}/messages/`, { method: 'GET' }),
        
        createStreamMessage: (payload) => fetchApi('/messages/stream/', {
            method: 'POST',
            body: payload,
        }),
    };

    // Expose the api object globally.
    window.api = api;

    console.log("✅ API Module Initialized.");

})();