/* =========================================================
   State Management
   ========================================================= */

// Global application state
window.AppState = {
  // UI State
  value: '',
  deep: false,
  model: "gpt-4o-mini",
  isChatOpen: false,
  sidebarOpen: false,
  isMobile: false,
  
  // Chat State
  messages: [],
  
  // Cards State
  wantExpanded: false,
  useExpanded: false,
  makeExpanded: false,
  
  // Data
  wantBase: [
    { icon: 'search', label: 'Search Papers' },
    { icon: 'file', label: 'Write a Report' },
    { icon: 'book', label: 'Review Literature' }
  ],
  wantExtra: [
    { icon: 'chart', label: 'Analyse Data' },
    { icon: 'grant', label: 'Find Grants' },
    { icon: 'database', label: 'Extract Data' }
  ],
  
  useBase: [
    { icon: 'rocket', label: 'Deep Review' },
    { icon: 'globe', label: 'arXiv' },
    { icon: 'globe', label: 'PubMed' }
  ],
  useExtra: [
    { icon: 'globe', label: 'Google Scholar' },
    { icon: 'globe', label: 'Grants.gov' },
    { icon: 'globe', label: 'ClinicalTrials.gov' }
  ],
  
  makeBase: [
    { icon: 'globe', label: 'Website' },
    { icon: 'doc', label: 'LaTeX Manuscript' },
    { icon: 'chart', label: 'Data Visualisation' }
  ],
  makeExtra: [
    { icon: 'slides', label: 'PPT presentation' },
    { icon: 'doc', label: 'LaTeX Poster' },
    { icon: 'doc', label: 'Word document' }
  ]
};

// State update helper
window.updateState = function(updates) {
  Object.assign(window.AppState, updates);
};

// State getters
window.getState = function(key) {
  return key ? window.AppState[key] : window.AppState;
};