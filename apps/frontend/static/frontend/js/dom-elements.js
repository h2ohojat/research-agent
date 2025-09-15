// js/dom-elements.js
/**
 * @fileoverview Centralized DOM element selectors for the application.
 * This module queries the DOM once and stores references to all necessary
 * elements in a global `window.elements` object for easy and consistent access
 * across all other modules.
 */

/**
 * Initializes the global `elements` object by querying the DOM.
 * This function should be called once the DOM is fully loaded.
 */
function initializeDOMElements() {
    // A single, global object to hold all DOM element references.
    window.elements = {
        // --- Layout & Global Elements ---
        mainLayout: document.querySelector('.main-layout'), // <-- این خط اضافه شده است
        sidebar: document.getElementById('sidebar'),
        backdrop: document.getElementById('backdrop'),
        menuButton: document.getElementById('btnMenu'),

        // --- View Containers ---
        homeView: document.getElementById('homeView'),
        chatView: document.getElementById('chatView'),

        // --- Chat Area ---
        chatMessagesContainer: document.getElementById('chatMessages'),

        // --- Composer for Home View ---
        homeTextarea: document.getElementById('homeInput'),
        homeSendButton: document.getElementById('btnSend'),
        homeDeepSearchButton: document.getElementById('btnDeep'),
        // Note: The new model selector will replace the old <select> element.
        // We get its container to inject our component into.
        homeModelSelectorContainer: document.querySelector('#homeView .model-selector-wrapper #modelSelectorContainer'),


        // --- Composer for Chat View ---
        chatTextarea: document.getElementById('chatInput'),
        chatSendButton: document.getElementById('btnSend2'),
        chatDeepSearchButton: document.getElementById('btnDeep2'),
        chatModelSelectorContainer: document.querySelector('#chatView .model-selector-wrapper #modelSelectorContainer'),


        // --- Sidebar & Other Interactive Elements ---
        recentChatsButton: document.getElementById('openSampleChat'),
        quickTilesContainer: document.getElementById('quickTiles'),
        userCard: document.querySelector('.user-card'),
    };

    console.log("✅ DOM Elements Initialized and stored in window.elements.");
}

// Ensure the DOM is fully loaded before we try to find our elements.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDOMElements);
} else {
    // The DOM was already loaded, so we can run the function immediately.
    initializeDOMElements();
}