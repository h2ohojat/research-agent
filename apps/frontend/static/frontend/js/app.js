// js/app.js
/**
 * @fileoverview Main entry point for the frontend application.
 * Orchestrates the initialization of all other modules.
 */

const App = (() => {

    function init() {
        console.log("🚀 App.init() called. Initializing application modules...");

        // 1. Initialize core infrastructure modules.
        if (window.websocketManager) {
            window.websocketManager.init();
        } else {
            console.error("❌ WebSocket Manager module not found!");
        }

        // 2. Initialize UI modules.
        if (window.chatUI) {
            window.chatUI.init();
        } else {
            console.error("❌ Chat UI module not found!");
        }
        
        if (window.layoutUI) {
            window.layoutUI.init();
        } else {
            console.error("❌ Layout UI module not found!");
        }

        if (window.modalUI) {
            window.modalUI.init();
        } else {
            console.error("❌ Modal UI module not found!");
        }
        
        if (window.modelSelectionModalUI) {
            window.modelSelectionModalUI.init();
        } else {
            console.error("❌ Model Selection Modal UI module not found!");
        }
        
        if (window.sidebarUI) {
            window.sidebarUI.init();
        } else {
            console.error("❌ Sidebar UI module not found!");
        }

        // 3. Initialize feature/component modules.
        const allModelSelectors = document.querySelectorAll('.model-selector');
        if (allModelSelectors.length > 0) {
            allModelSelectors.forEach(container => {
                if (window.modelSelectorUI && typeof window.modelSelectorUI.init === 'function') {
                    window.modelSelectorUI.init(container);
                }
            });
        } else {
            console.warn('🟡 No model selector containers (.model-selector) found on the page.');
        }

        // ✨ FIX: Let's correct the auth module check
        if (window.AuthManager) { // Assuming your auth module is named AuthManager
            window.AuthManager.init(); 
        } else if (window.auth) {
            window.auth.init();
        } else {
             // Let's keep the original error message for now
            console.error("❌ Auth module not found!");
        }

        // ✨✨✨ START: INITIALIZE PROMPT TILES MODULE ✨✨✨
        // Now it will be correctly initialized within the App lifecycle
        if (window.PromptTiles) {
            console.log("✅ Initializing PromptTiles module...");
            window.PromptTiles.init();
        } else {
            // This will tell us if the script is not loaded
            console.warn("🟡 PromptTiles module not found. Skipping initialization.");
        }
        // ✨✨✨ END: INITIALIZE PROMPT TILES MODULE ✨✨✨

        // 4. Initialize the event listeners.
        if (window.eventListeners) {
            window.eventListeners.init();
        } else {
            console.error("❌ Event Listeners module not found!");
        }

        // 5. Run Initial Data Fetch
        runInitialDataFetch();
        
        console.log("🎉 All application modules initialized successfully. App is ready!");
    }

    async function runInitialDataFetch() {
        console.log(" M️aking initial data fetches...");
        try {
            const history = await window.api.getChatHistory();
            if (window.appState) {
                window.appState.update({ chatHistory: history });
                console.log(`✅ Chat history loaded with ${history.length} conversations.`);
            } else {
                console.error("❌ App State module not found! Cannot store chat history.");
            }
        } catch (error) {
            console.error("❌ Failed during initial data fetch for chat history:", error);
            if (window.appState) {
                window.appState.update({ chatHistory: [], chatHistoryError: "Could not load chats." });
            }
        }
    }

    // Public API for the App module
    return {
        init: init
    };

})();

// The only code outside the module is the event listener that starts everything.
document.addEventListener('DOMContentLoaded', (event) => {
    App.init();
});