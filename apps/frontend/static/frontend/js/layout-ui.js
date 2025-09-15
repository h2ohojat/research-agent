// js/layout-ui.js
/**
 * @fileoverview Manages the overall application layout and view transitions.
 * This includes handling the sidebar for both mobile and desktop, switching
 * between the home and chat views, and managing the mobile backdrop.
 * It reacts to state changes for `activeView` and `isSidebarOpen`.
 */

(function() {
    "use strict";

    /**
     * Handles changes to the active view state.
     * Shows or hides the home and chat views accordingly.
     * @param {string|{from: string, to: string}} activeView - The new active view or the state change payload.
     */
    function handleActiveViewChange(activeView) {
        // ✨ FIX: Support both raw value and {from, to} object from state change event.
        const nextView = (activeView && typeof activeView === 'object' && 'to' in activeView)
            ? activeView.to
            : activeView;

        const { homeView, chatView } = window.elements;

        if (!homeView || !chatView) {
            console.error("Home or Chat view elements not found.");
            return;
        }

        if (nextView === 'chat') {
            homeView.style.display = 'none';
            chatView.style.display = 'flex'; // Use flex to match the CSS panel styles
            window.elements.chatTextarea.focus();
        } else { // 'home'
            homeView.style.display = 'block';
            chatView.style.display = 'none';
            window.elements.homeTextarea.focus();
        }
        console.log(`🎨 View switched to: ${nextView}`);
    }

    /**
     * Handles changes to the sidebar's open/closed state.
     * This function now works for both desktop and mobile views.
     * @param {boolean|{from: boolean, to: boolean}} isOpen - The new state of the sidebar or the state change payload.
     */
    function handleSidebarStateChange(isOpen) {
        // ✨ FIX: Support both raw value and {from, to} object from state change event.
        const nextOpen = (isOpen && typeof isOpen === 'object' && 'to' in isOpen)
            ? isOpen.to
            : isOpen;
            
        const { body } = document; 
        const { sidebar, backdrop, menuButton } = window.elements;

        if (!sidebar || !backdrop || !menuButton) {
            console.error("Sidebar, backdrop, or menu button elements not found.");
            return;
        }
        
        // --- Universal Controls (work on both desktop and mobile) ---
        menuButton.setAttribute('aria-expanded', nextOpen.toString());

        // --- Desktop Logic: Toggles a class on the body ---
        body.classList.toggle('sidebar-closed', !nextOpen);

        // --- Mobile-Only Logic: Toggles classes for off-canvas behavior ---
        const isMobile = window.innerWidth < 992;

        if (isMobile) {
            sidebar.classList.toggle('open', nextOpen);
            backdrop.classList.toggle('show', nextOpen);
            body.classList.toggle('sidebar-open-mobile', nextOpen);
        } else {
            body.classList.remove('sidebar-open-mobile');
        }

        console.log(`🎨 Sidebar state changed to: ${nextOpen ? 'Open' : 'Closed'}`);
    }
    
    // --- Public UI Module ---

    const layoutUI = {
        /**
         * Initializes the Layout UI module.
         * Sets up listeners for state changes.
         */
        init: function() {
            // Listen for specific state changes
            // Note: The global `appState` is now used instead of a local `state` object.
            window.appState.on('stateChanged:activeView', handleActiveViewChange);
            window.appState.on('stateChanged:isSidebarOpen', handleSidebarStateChange);

            // Initial setup based on the default state
            this.syncWithState();
            
            console.log("✅ Layout UI Module Initialized.");
        },
        
        /**
         * Toggles the sidebar's open/closed state by updating the central state.
         * This is the function called by event listeners (e.g., menu button click).
         */
        toggleSidebar: function() {
            const currentState = window.appState.get();
            // The new state is the opposite of the current state.
            window.appState.update({ isSidebarOpen: !currentState.isSidebarOpen });
        },

        /**
         * Ensures the UI correctly represents the initial state on load.
         */
        syncWithState: function() {
            const initialState = window.appState.get();
            handleActiveViewChange(initialState.activeView);
            handleSidebarStateChange(initialState.isSidebarOpen);
        }
    };

    // Expose the layoutUI object globally
    window.layoutUI = layoutUI;

})();