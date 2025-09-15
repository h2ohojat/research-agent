class ModelSelector {
    constructor(containerId, modelManager) {
        this.container = document.getElementById(containerId);
        this.modelManager = modelManager;
        this.isOpen = false;
        
        if (!this.container) {
            console.error(`❌ Container with id "${containerId}" not found`);
            return;
        }
        
        if (!this.modelManager) {
            console.error('❌ ModelManager instance required');
            return;
        }
        
        this.init();
    }
    
    init() {
        console.log('🔧 ModelSelector initializing...');
        this.render();
        this.attachEventListeners();
        
        // Listen to model manager events
        this.modelManager.setOnModelChange((model) => {
            this.updateSelectedModel(model);
        });
        
        this.modelManager.setOnModelsLoad((models) => {
            this.renderModelList(models);
        });
    }
    
    render() {
        this.container.innerHTML = `
            <div class="model-selector">
                <div class="model-selector-trigger" id="modelSelectorTrigger">
                    <div class="selected-model">
                        <div class="model-icon">
                            <i class="fas fa-brain"></i>
                        </div>
                        <div class="model-info">
                            <div class="model-name" id="selectedModelName">GPT-4o Mini</div>
                            <div class="model-provider" id="selectedModelProvider">OpenAI</div>
                        </div>
                        <div class="dropdown-arrow">
                            <i class="fas fa-chevron-down" id="dropdownArrow"></i>
                        </div>
                    </div>
                </div>
                
                <div class="model-selector-dropdown" id="modelSelectorDropdown">
                    <div class="dropdown-header">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="modelSearch" placeholder="جستجوی مدل..." />
                        </div>
                        <div class="filter-tabs">
                            <button class="filter-tab active" data-filter="all">همه</button>
                            <button class="filter-tab" data-filter="free">رایگان</button>
                            <button class="filter-tab" data-filter="premium">پریمیوم</button>
                        </div>
                    </div>
                    
                    <div class="dropdown-content">
                        <div class="models-loading" id="modelsLoading" style="display: none;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>در حال بارگذاری مدل‌ها...</span>
                        </div>
                        <div class="models-list" id="modelsList">
                            <!-- مدل پیش‌فرض فوراً نمایش داده می‌شود -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.addStyles();
        
        // ✅ فوراً مدل پیش‌فرض را نمایش بده
        if (this.modelManager.hasSelectedModel()) {
            this.updateSelectedModel(this.modelManager.getSelectedModel());
            this.renderModelList(this.modelManager.getAvailableModels());
        }
    }
    
    addStyles() {
        if (document.getElementById('modelSelectorStyles')) return;
        
        const styles = `
            <style id="modelSelectorStyles">
                .model-selector {
                    position: relative;
                    width: 100%;
                    max-width: 300px;
                }
                
                .model-selector-trigger {
                    background: var(--bg-secondary, #f8f9fa);
                    border: 1px solid var(--border-color, #e9ecef);
                    border-radius: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    user-select: none;
                }
                
                .model-selector-trigger:hover {
                    border-color: var(--primary-color, #007bff);
                    box-shadow: 0 2px 8px rgba(0,123,255,0.1);
                }
                
                .selected-model {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .model-icon {
                    width: 32px;
                    height: 32px;
                    background: var(--primary-color, #007bff);
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 14px;
                }
                
                .model-info {
                    flex: 1;
                    min-width: 0;
                }
                
                .model-name {
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--text-primary, #212529);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .model-provider {
                    font-size: 12px;
                    color: var(--text-secondary, #6c757d);
                    margin-top: 2px;
                }
                
                .dropdown-arrow {
                    transition: transform 0.2s ease;
                }
                
                .model-selector.open .dropdown-arrow {
                    transform: rotate(180deg);
                }
                
                .model-selector-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border: 1px solid var(--border-color, #e9ecef);
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    z-index: 1000;
                    margin-top: 4px;
                    max-height: 400px;
                    overflow: hidden;
                    
                    /* Default hidden state */
                    opacity: 0;
                    visibility: hidden;
                    transform: translateY(-10px);
                    transition: all 0.2s ease;
                    display: none;
                }
                
                .model-selector.open .model-selector-dropdown {
                    opacity: 1;
                    visibility: visible;
                    transform: translateY(0);
                    display: block;
                }
                
                .dropdown-header {
                    padding: 16px;
                    border-bottom: 1px solid var(--border-color, #e9ecef);
                }
                
                .search-box {
                    position: relative;
                    margin-bottom: 12px;
                }
                
                .search-box i {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-secondary, #6c757d);
                    font-size: 14px;
                }
                
                .search-box input {
                    width: 100%;
                    padding: 8px 12px 8px 36px;
                    border: 1px solid var(--border-color, #e9ecef);
                    border-radius: 6px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s ease;
                }
                
                .search-box input:focus {
                    border-color: var(--primary-color, #007bff);
                }
                
                .filter-tabs {
                    display: flex;
                    gap: 4px;
                }
                
                .filter-tab {
                    flex: 1;
                    padding: 6px 12px;
                    border: 1px solid var(--border-color, #e9ecef);
                    background: transparent;
                    border-radius: 4px;
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .filter-tab:hover {
                    background: var(--bg-secondary, #f8f9fa);
                }
                
                .filter-tab.active {
                    background: var(--primary-color, #007bff);
                    color: white;
                    border-color: var(--primary-color, #007bff);
                }
                
                .dropdown-content {
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .models-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 32px;
                    color: var(--text-secondary, #6c757d);
                }
                
                .model-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                    border-bottom: 1px solid var(--border-light, #f8f9fa);
                }
                
                .model-item:hover {
                    background: var(--bg-secondary, #f8f9fa);
                }
                
                .model-item.selected {
                    background: var(--primary-light, #e3f2fd);
                    border-left: 3px solid var(--primary-color, #007bff);
                }
                
                .model-item-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                }
                
                .model-item-info {
                    flex: 1;
                    min-width: 0;
                }
                
                .model-item-name {
                    font-weight: 500;
                    font-size: 14px;
                    color: var(--text-primary, #212529);
                }
                
                .model-item-details {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 2px;
                }
                
                .model-item-provider {
                    font-size: 12px;
                    color: var(--text-secondary, #6c757d);
                }
                
                .model-tier {
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-weight: 500;
                    text-transform: uppercase;
                }
                
                .model-tier.free {
                    background: #d4edda;
                    color: #155724;
                }
                
                .model-tier.basic {
                    background: #cce5ff;
                    color: #004085;
                }
                
                .model-tier.premium {
                    background: #fff3cd;
                    color: #856404;
                }
                
                .model-tier.enterprise {
                    background: #f8d7da;
                    color: #721c24;
                }
                
                .model-capabilities {
                    display: flex;
                    gap: 4px;
                }
                
                .capability-icon {
                    width: 16px;
                    height: 16px;
                    border-radius: 2px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 8px;
                    color: white;
                }
                
                .capability-vision {
                    background: #28a745;
                }
                
                .capability-function {
                    background: #17a2b8;
                }
                
                .provider-group {
                    margin-bottom: 8px;
                }
                
                .provider-header {
                    padding: 8px 16px;
                    background: var(--bg-light, #f8f9fa);
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-secondary, #6c757d);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                @media (max-width: 768px) {
                    .model-selector {
                        max-width: 100%;
                    }
                    
                    .model-selector-dropdown {
                        max-height: 350px;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    attachEventListeners() {
        console.log('🔧 Attaching event listeners...');
        
        const trigger = document.getElementById('modelSelectorTrigger');
        const dropdown = document.getElementById('modelSelectorDropdown');
        const searchInput = document.getElementById('modelSearch');
        const filterTabs = document.querySelectorAll('.filter-tab');
        
        console.log('   Trigger element:', trigger);
        
        // 🆕 اضافه کردن event listener با bind
        if (trigger) {
            // حذف event listener قبلی اگر وجود دارد
            trigger.onclick = null;
            
            // اضافه کردن event listener جدید
            const clickHandler = (e) => {
                console.log('🖱️ Trigger clicked!');
                e.preventDefault();
                e.stopPropagation();
                
                // 🆕 فراخوانی مستقیم toggle
                console.log('🔄 Current isOpen:', this.isOpen);
                
                if (this.isOpen) {
                    console.log('📁 Closing dropdown...');
                    this.closeDropdown();
                } else {
                    console.log('📂 Opening dropdown...');
                    this.openDropdown();
                }
            };
            
            trigger.addEventListener('click', clickHandler);
            console.log('✅ Click listener attached to trigger');
        } else {
            console.error('❌ Trigger element not found for event listener');
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (this.container && !this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });
        
        // Search functionality
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
        
        // Filter tabs
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.handleFilterChange(e.target.dataset.filter);
                
                // Update active tab
                filterTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        console.log('✅ All event listeners attached');
    }
    
    openDropdown() {
        console.log('📂 Opening dropdown...');
        
        const selector = this.container.querySelector('.model-selector');
        const dropdown = document.getElementById('modelSelectorDropdown');
        
        if (selector && dropdown) {
            selector.classList.add('open');
            this.isOpen = true;
            
            console.log('✅ Dropdown opened, classes:', selector.className);
            console.log('✅ isOpen set to:', this.isOpen);
            
            // Focus search input
            setTimeout(() => {
                const searchInput = document.getElementById('modelSearch');
                if (searchInput) {
                    searchInput.focus();
                }
            }, 100);
        } else {
            console.error('❌ Selector or dropdown not found');
        }
    }
    
    closeDropdown() {
        console.log('📁 Closing dropdown...');
        
        const selector = this.container.querySelector('.model-selector');
        
        if (selector) {
            selector.classList.remove('open');
            this.isOpen = false;
            
            console.log('✅ Dropdown closed, classes:', selector.className);
            console.log('✅ isOpen set to:', this.isOpen);
        } else {
            console.error('❌ Selector not found');
        }
    }
    
    toggleDropdown() {
        console.log('🔄 Toggle dropdown called, current isOpen:', this.isOpen);
        
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }
    
updateSelectedModel(model) {
    if (!model) {
        console.warn('⚠️ No model provided to updateSelectedModel');
        return;
    }
    
    console.log('🔄 Updating UI with model:', model.display_name);
    
    const nameElement = document.getElementById('selectedModelName');
    const providerElement = document.getElementById('selectedModelProvider');
    
    console.log('   Name element:', nameElement);
    console.log('   Provider element:', providerElement);
    
    if (nameElement) {
        nameElement.textContent = model.display_name;
        console.log('✅ Updated model name in UI:', model.display_name);
    } else {
        console.error('❌ selectedModelName element not found');
    }
    
    if (providerElement) {
        providerElement.textContent = model.provider.display_name;
        console.log('✅ Updated provider name in UI:', model.provider.display_name);
    } else {
        console.error('❌ selectedModelProvider element not found');
    }
    
    // Update selected item in list
    this.updateSelectedInList(model.model_id);
}
    
    updateSelectedInList(modelId) {
        const items = document.querySelectorAll('.model-item');
        items.forEach(item => {
            if (item.dataset.modelId === modelId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    renderModelList(models = null) {
        const modelsToRender = models || this.modelManager.getAvailableModels();
        const loadingElement = document.getElementById('modelsLoading');
        const listElement = document.getElementById('modelsList');
        
        if (loadingElement) loadingElement.style.display = 'none';
        
        if (!modelsToRender || modelsToRender.length === 0) {
            listElement.innerHTML = `
                <div style="padding: 32px; text-align: center; color: var(--text-secondary, #6c757d);">
                    <i class="fas fa-search" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i>
                    <div>هیچ مدلی یافت نشد</div>
                </div>
            `;
            return;
        }
        
        // Group by provider
        const groupedModels = {};
        modelsToRender.forEach(model => {
            const providerName = model.provider.display_name;
            if (!groupedModels[providerName]) {
                groupedModels[providerName] = [];
            }
            groupedModels[providerName].push(model);
        });
        
        let html = '';
        Object.keys(groupedModels).forEach(providerName => {
            html += `<div class="provider-group">`;
            html += `<div class="provider-header">${providerName}</div>`;
            
            groupedModels[providerName].forEach(model => {
                html += this.renderModelItem(model);
            });
            
            html += `</div>`;
        });
        
        listElement.innerHTML = html;
        
        // Attach click events
        this.attachModelItemEvents();
        
        // Update selected model
        if (this.modelManager.getSelectedModel()) {
            this.updateSelectedInList(this.modelManager.getSelectedModel().model_id);
        }
    }
    
    renderModelItem(model) {
        const providerColor = this.getProviderColor(model.provider.name);
        const capabilities = [];
        
        if (model.supports_vision) {
            capabilities.push('<div class="capability-icon capability-vision" title="پشتیبانی از تصاویر"><i class="fas fa-eye"></i></div>');
        }
        
        if (model.supports_function_calling) {
            capabilities.push('<div class="capability-icon capability-function" title="قابلیت Function Calling"><i class="fas fa-code"></i></div>');
        }
        
        return `
            <div class="model-item" data-model-id="${model.model_id}">
                <div class="model-item-icon" style="background: ${providerColor};">
                    <i class="fas fa-brain"></i>
                </div>
                <div class="model-item-info">
                    <div class="model-item-name">${model.display_name}</div>
                    <div class="model-item-details">
                        <span class="model-item-provider">${model.provider.display_name}</span>
                        <span class="model-tier ${model.tier}">${this.getTierLabel(model.tier)}</span>
                        <div class="model-capabilities">
                            ${capabilities.join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    attachModelItemEvents() {
        const items = document.querySelectorAll('.model-item');
        items.forEach(item => {
            item.addEventListener('click', async (e) => {
                const modelId = item.dataset.modelId;
                
                try {
                    await this.modelManager.selectModel(modelId);
                    this.closeDropdown();
                } catch (error) {
                    console.error('Error selecting model:', error);
                    // TODO: Show error message to user
                }
            });
        });
    }
    
    handleSearch(query) {
        const filteredModels = this.modelManager.searchModels(query);
        this.renderModelList(filteredModels);
    }
    
    async handleFilterChange(filter) {
        let filters = {};
        
        if (filter === 'free') {
            filters.tier = 'free';
        } else if (filter === 'premium') {
            // Show all non-free models
            const allModels = this.modelManager.getAvailableModels();
            const premiumModels = allModels.filter(model => model.tier !== 'free');
            this.renderModelList(premiumModels);
            return;
        }
        
        if (filter !== 'all') {
            await this.modelManager.loadModels(filters);
        } else {
            await this.modelManager.loadModels();
        }
    }
    
    getProviderColor(providerName) {
        const colors = {
            'openai': '#10a37f',
            'anthropic': '#d97757',
            'google': '#4285f4',
            'meta': '#1877f2',
            'mistral': '#ff7000',
            'cohere': '#39594c',
            'default': '#6c757d'
        };
        
        return colors[providerName.toLowerCase()] || colors.default;
    }
    
    getTierLabel(tier) {
        const labels = {
            'free': 'رایگان',
            'basic': 'پایه',
            'premium': 'پریمیوم',
            'enterprise': 'سازمانی'
        };
        
        return labels[tier] || tier;
    }
}

// Export برای استفاده در سایر فایل‌ها
window.ModelSelector = ModelSelector;