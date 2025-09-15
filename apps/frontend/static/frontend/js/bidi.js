// js/bidi.js
/**
 * @fileoverview Bidirectional (BiDi) Text Utilities.
 * Provides functions to automatically detect and apply the correct text direction
 * for mixed RTL (Persian) and LTR (English) content.
 */
(function() {
    "use strict";

    // Regular expressions to detect strong RTL (like Persian/Arabic) and LTR characters.
    const RTL_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const LTR_CHAR_RE = /[A-Za-z]/;

    /**
     * Determines if a text should be rendered as Right-to-Left (RTL).
     * It uses a simple heuristic: if there are more strong RTL characters than LTR,
     * it's considered RTL.
     * @param {string} text The input text.
     * @returns {boolean} True if the text is predominantly RTL.
     */
    function shouldUseRTL(text) {
        if (!text) return false;
        
        let rtlCount = (text.match(new RegExp(RTL_CHAR_RE, 'g')) || []).length;
        let ltrCount = (text.match(new RegExp(LTR_CHAR_RE, 'g')) || []).length;

        // If RTL characters are dominant, or if there are RTL chars but no LTR ones,
        // treat it as RTL. This handles purely Persian/Arabic text correctly.
        return rtlCount > ltrCount || (rtlCount > 0 && ltrCount === 0);
    }

    /**
     * Applies intelligent BiDi directionality to a container element.
     * It sets the overall direction (dir) of the container based on its text content,
     * and then allows child block elements to determine their own direction automatically.
     * @param {HTMLElement} container The container element holding the message.
     * @param {string} [baseText] Optional: The original plain text to base the detection on.
     *                              If not provided, the container's textContent is used.
     */
    function applyBidiDirection(container, baseText) {
        if (!container) return;

        // 1. Determine the overall direction for the whole message bubble.
        const textForDetection = baseText || container.textContent || "";
        const isRTL = shouldUseRTL(textForDetection);
        container.setAttribute("dir", isRTL ? "rtl" : "ltr");

        // 2. Allow individual paragraphs and list items to auto-detect their own direction.
        // This is the key for correctly handling mixed-language paragraphs.
        const blockSelectors = "p, li, blockquote, h1, h2, h3, h4, h5, h6, td, th";
        container.querySelectorAll(blockSelectors).forEach(el => {
            el.setAttribute("dir", "auto");
        });
    }

    // Expose the utility to the global window object.
    window.bidiUtils = {
        applyBidiDirection,
        shouldUseRTL
    };

    console.log("✅ BiDi Utilities Module Initialized.");

})();