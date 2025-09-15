// js/app.js
/**
 * @fileoverview The main entry point for the entire frontend application.
 * This file is responsible for initializing all the other modules in the correct
 * order to ensure the application starts up smoothly. It acts as the orchestrator.
 */

document.addEventListener('DOMContentLoaded', (event) => {
    console.log("🚀 DOM fully loaded and parsed. Initializing application modules...");

    // The order of initialization is important.
    
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
    
    // ✨ --- START: ADDED FOR CHAT HISTORY --- ✨
    // Initialize the new Sidebar UI module along with other UI modules.
    if (window.sidebarUI) {
        window.sidebarUI.init();
    } else {
        console.error("❌ Sidebar UI module not found!");
    }
    // ✨ --- END: ADDED FOR CHAT HISTORY --- ✨

    // 3. Initialize feature/component modules.
    
    // ✨ --- START: FINAL FIX FOR ALL MODEL SELECTORS --- ✨
    // Instead of a single ID, we find all containers by their shared class name.
    const allModelSelectors = document.querySelectorAll('.model-selector');
    
    if (allModelSelectors.length > 0) {
        console.log(`✅ Found ${allModelSelectors.length} model selector containers. Initializing each...`);
        // We loop through each found container and initialize the UI module for it.
        allModelSelectors.forEach(container => {
            if (window.modelSelectorUI && typeof window.modelSelectorUI.init === 'function') {
                window.modelSelectorUI.init(container);
            }
        });
    } else {
        // This is now a warning, as some pages might not have a model selector.
        console.warn('🟡 No model selector containers (.model-selector) found on the page.');
    }
    // ✨ --- END: FINAL FIX --- ✨

    if (window.auth) {
        window.auth.init(); // This will trigger the authentication check.
    } else {
        console.error("❌ Auth module not found!");
    }

    // 4. Initialize the event listeners.
    if (window.eventListeners) {
        window.eventListeners.init();
    } else {
        console.error("❌ Event Listeners module not found!");
    }

    // ✨ --- START: ADDED FOR CHAT HISTORY --- ✨
    // 5. Run Initial Data Fetch
    // After all modules are initialized, we fetch the initial data needed for the app.
    async function runInitialDataFetch() {
        console.log(" M️aking initial data fetches...");
        try {
            // Fetch chat history. This works for both logged-in users and guests.
            const history = await window.api.getChatHistory();
            
            // Update the global state. sidebarUI is already listening for this event.
            if (window.appState) {
                // ✨ FIX: Changed 'setState' to 'update' to match your state.js module.
                window.appState.update({ chatHistory: history });
                console.log(`✅ Chat history loaded with ${history.length} conversations.`);
            } else {
                console.error("❌ App State module not found! Cannot store chat history.");
            }

            // Any other initial data fetches (e.g., user preferences) can be added here in the future.

        } catch (error) {
            console.error("❌ Failed during initial data fetch for chat history:", error);
            if (window.appState) {
                // Let the UI know there was an error.
                // ✨ FIX: Changed 'setState' to 'update' here as well.
                window.appState.update({ chatHistory: [], chatHistoryError: "Could not load chats." });
            }
        }
    }
    
    runInitialDataFetch();
    // ✨ --- END: ADDED FOR CHAT HISTORY --- ✨


    console.log("🎉 All application modules initialized successfully. App is ready!");
});