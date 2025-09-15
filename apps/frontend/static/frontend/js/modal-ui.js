// js/modal-ui.js
/**
 * @fileoverview A reusable UI module for managing all modals in the application.
 * It handles opening, closing, and accessibility features for modals.
 */

(function() {
    "use strict";

    let activeModal = null; // To keep track of the currently open modal
    let triggerElement = null; // To store the element that opened the modal, for returning focus later

    /**
     * Opens a modal specified by its ID.
     * @param {string} modalId - The ID of the modal overlay element to open.
     */
    function open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with ID "${modalId}" not found.`);
            return;
        }

        // Close any other modal that might be open
        if (activeModal) {
            close();
        }

        // --- Accessibility Improvement ---
        // Store the element that had focus before the modal was opened.
        triggerElement = document.activeElement;

        // Add class to body to prevent background scrolling (CSS handles the overflow)
        document.body.classList.add('modal-open');
        
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        activeModal = modal;

        // --- Focus Management Correction ---
        // Instead of focusing the first button, we focus the modal container itself.
        // This resolves the "Blocked aria-hidden" console error and is better for accessibility.
        const modalContainer = modal.querySelector('.modal-container');
        if (modalContainer) {
            // Setting tabindex="-1" allows a non-interactive element like a div to be programmatically focused.
            modalContainer.setAttribute('tabindex', '-1'); 
            modalContainer.focus();
        }
    }

    /**
     * Closes the currently active modal.
     */
    // js/modal-ui.js

    /**
     * Closes the currently active modal.
     */
    function close() {
        if (!activeModal) return;

        // --- Visual & Functional Updates ---
        activeModal.classList.remove('active');
        activeModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');

        const modalContainer = activeModal.querySelector('.modal-container');
        if (modalContainer) {
            // Forcefully remove focus from the container to kill any remaining focus ring.
            modalContainer.blur();
            // Clean up the tabindex attribute we added.
            modalContainer.removeAttribute('tabindex');
        }
        
        // --- Bulletproof Focus Return ---
        // Return focus to the element that originally opened the modal.
        if (triggerElement && typeof triggerElement.focus === 'function') {
            triggerElement.focus();
        } else {
            // As a fallback, if the trigger element is gone, focus the body.
            // This prevents focus from being "lost" and stuck on the now-hidden modal.
            document.body.focus?.(); 
        }
        
        // Reset state variables
        activeModal = null;
        triggerElement = null;
    }
    /**
     * Initializes the modal module, setting up global event listeners.
     */
    function init() {
        // Global listener to close modal on clicking the overlay or a close button
        document.addEventListener('click', (e) => {
            if (!activeModal) return;

            // Close if the user clicks on the overlay itself
            if (e.target === activeModal) {
                close();
            }

            // Close if the user clicks on an element with the .modal-close class
            // We use `closest` to find the button even if an icon inside it is clicked
            const closeButton = e.target.closest('.modal-close');
            if (closeButton) {
                close();
            }
        });

        // Global listener for the Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && activeModal) {
                close();
            }
        });
    }

    // --- Public UI Module ---

    const modalUI = {
        init: init,
        open: open,
        close: close,
    };

    window.modalUI = modalUI;
    console.log("✅ Modal UI Module Initialized.");

})();