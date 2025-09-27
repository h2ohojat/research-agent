// backend/apps/frontend/static/frontend/js/prompt-tiles.js

window.PromptTiles = (() => {
  const INITIAL_COUNT = 3; // تعداد کارت‌های اولیه برای هر بخش

  // نگاشت کلید بخش به تابع رندر مربوطه
  const rendererMap = {
    want: window.PyamoozRenderers.renderPromptCard,
    use: window.PyamoozRenderers.renderLinkCard,
    make: window.PyamoozRenderers.renderLinkCard
  };

  // ✨✨✨ START: NEW HELPER FUNCTION ADDED ✨✨✨
  /**
   * ارتفاع یک textarea را به صورت خودکار تنظیم می‌کند.
   * منطق min/max و overflow کاملاً به CSS واگذار شده است.
   * @param {HTMLTextAreaElement} textarea - المان textarea مورد نظر.
   */
  function autoGrowTextarea(textarea) {
    if (!textarea) return;
    // 1. ارتفاع را ریست کن تا scrollHeight به درستی محاسبه شود.
    textarea.style.height = 'auto'; 
    // 2. ارتفاع را برابر با ارتفاع واقعی محتوا قرار بده.
    textarea.style.height = `${textarea.scrollHeight}px`;
  }
  // ✨✨✨ END: NEW HELPER FUNCTION ADDED ✨✨✨

  /**
   * ماژول را مقداردهی اولیه می‌کند.
   */
  function init() {
    document.querySelectorAll('#quickTiles section.col').forEach(section => {
      const cardContainer = section.querySelector('.vstack[id]');
      if (!cardContainer) return;

      const sectionKey = cardContainer.id.replace('Cards', '');
      
      if (PROMPT_DATA[sectionKey] && PROMPT_DATA[sectionKey].length > 0) {
        loadCardsForSection(sectionKey, cardContainer, INITIAL_COUNT);
        
        const moreButton = section.querySelector('.load-more');
        if (moreButton && PROMPT_DATA[sectionKey].length > INITIAL_COUNT) {
          moreButton.style.display = 'block';
          moreButton.setAttribute('aria-expanded', 'false');
          moreButton.textContent = 'بیشتر';
        } else if (moreButton) {
          moreButton.style.display = 'none';
        }
      }
    });

    // ✨✨✨ START: NEW LOGIC FOR TYPING/PASTING IN TEXTAREA ✨✨✨
    // شنونده رویداد برای تایپ، paste و هر نوع تغییر در کامپوزر
    const homeTextarea = document.getElementById('homeInput');
    if (homeTextarea) {
      homeTextarea.addEventListener('input', () => {
        autoGrowTextarea(homeTextarea);
      });
      // تنظیم ارتفاع اولیه در زمان بارگذاری صفحه (برای متن‌های احتمالی از قبل)
      autoGrowTextarea(homeTextarea);
    }
    // ✨✨✨ END: NEW LOGIC FOR TYPING/PASTING IN TEXTAREA ✨✨✨

    addPromptClickListeners();
    addMoreButtonListeners();
  }
  
  /**
   * تابع عمومی برای بارگذاری کارت‌های هر بخش
   */
  function loadCardsForSection(sectionKey, container, count = null) {
    if (!PROMPT_DATA || !PROMPT_DATA[sectionKey] || !rendererMap[sectionKey]) return;

    const allItems = PROMPT_DATA[sectionKey];
    const itemsToShow = count === null ? allItems : allItems.slice(0, count);

    if (itemsToShow.length === 0) {
      container.innerHTML = '';
      return;
    }

    const renderer = rendererMap[sectionKey];
    const cardsHTML = itemsToShow.map(item => renderer(item)).join('');
    container.innerHTML = cardsHTML;
    console.log(`✅ ${itemsToShow.length} cards rendered for section '${sectionKey}'.`);
  }

  /**
   * شنونده رویداد کلیک برای کانتینر پرامپت‌ها
   */
  function addPromptClickListeners() {
    const wantCardsContainer = document.getElementById('wantCards');
    const homeTextarea = document.getElementById('homeInput');
    
    if (!wantCardsContainer || !homeTextarea) return;

    wantCardsContainer.addEventListener('click', (event) => {
      const card = event.target.closest('.card-tile[data-prompt]');
      if (card) {
        event.preventDefault();
        const promptText = card.dataset.prompt;
        if (promptText) {
          homeTextarea.value = promptText;
          homeTextarea.focus();
          
          // ✨✨✨ CHANGE: Using the new helper function for consistency ✨✨✨
          autoGrowTextarea(homeTextarea);
        }
      }
    });
  }

  /**
   * شنونده رویداد کلیک برای دکمه‌های "بیشتر" / "کمتر"
   */
  function addMoreButtonListeners() {
    const quickTilesGrid = document.getElementById('quickTiles');
    if (!quickTilesGrid) return;
    
    quickTilesGrid.addEventListener('click', (event) => {
      const moreButton = event.target.closest('.load-more');
      if (!moreButton) return;

      const sectionKey = moreButton.dataset.section;
      const sectionElement = moreButton.closest('section.col');
      const container = sectionElement ? sectionElement.querySelector('.vstack') : null;

      if (container && sectionKey) {
        const isExpanded = moreButton.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
          loadCardsForSection(sectionKey, container, INITIAL_COUNT);
          moreButton.setAttribute('aria-expanded', 'false');
          moreButton.textContent = 'بیشتر';
        } else {
          loadCardsForSection(sectionKey, container, null);
          moreButton.setAttribute('aria-expanded', 'true');
          moreButton.textContent = 'کمتر';
        }
      }
    });
  }

  return {
    init
  };
})();