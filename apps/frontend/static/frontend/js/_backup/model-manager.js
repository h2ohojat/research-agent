class ModelManager {
    constructor() {
        this.baseUrl = '/api/models/api';
        this.selectedModel = null;
        this.availableModels = [];
        this.providers = [];
        this.isLoading = false;
        
        // مدل پیش‌فرض
        this.defaultModel = {
            id: 'gpt-4o-mini',
            model_id: 'gpt-4o-mini',
            display_name: 'GPT-4o Mini',
            provider: {
                name: 'openai',
                display_name: 'OpenAI'
            },
            tier: 'free',
            supports_vision: false,
            supports_function_calling: true,
            supports_tool_choice: false,
            supports_response_schema: false
        };
        
        // Event callbacks
        this.onModelChange = null;
        this.onModelsLoad = null;
        this.onError = null;
        
        this.init();
    }
    
    async init() {
        console.log('🔧 ModelManager initializing...');
        
        // ✅ فوراً مدل پیش‌فرض را تنظیم کن
        this.setDefaultModel();
        
        // ✅ سپس مدل‌ها را بارگذاری کن
        await this.loadModelsAsync();
    }
    
    /**
     * تنظیم مدل پیش‌فرض فوری
     */
    setDefaultModel() {
        console.log('🎯 Setting default model:', this.defaultModel.display_name);
        
        this.selectedModel = this.defaultModel;
        this.availableModels = [this.defaultModel];
        
        // فوراً callback را فراخوانی کن
        if (this.onModelChange) {
            this.onModelChange(this.selectedModel);
        }
        
        if (this.onModelsLoad) {
            this.onModelsLoad(this.availableModels, {
                success: true,
                count: 1,
                models: this.availableModels,
                user_authenticated: false,
                user_tier: 'guest'
            });
        }
    }
    
    /**
     * بارگذاری async مدل‌ها در پس‌زمینه
     */
    async loadModelsAsync() {
        try {
            console.log('🔄 Loading models in background...');
            
            // بارگذاری providers
            await this.loadProviders();
            
            // بارگذاری مدل‌ها
            const data = await this.loadModels();
            
            // اگر مدل انتخاب شده در لیست جدید نیست، اولین مدل رایگان را انتخاب کن
            if (data && data.models && data.models.length > 0) {
                const currentModelExists = data.models.some(model => 
                    model.model_id === this.selectedModel.model_id
                );
                
                if (!currentModelExists) {
                    // پیدا کردن اولین مدل رایگان
                    const freeModel = data.models.find(model => model.tier === 'free') || data.models[0];
                    
                    if (freeModel) {
                        this.selectedModel = freeModel;
                        console.log('🔄 Updated to available model:', freeModel.display_name);
                        
                        if (this.onModelChange) {
                            this.onModelChange(this.selectedModel);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Background model loading failed:', error);
            // اما مدل پیش‌فرض همچنان کار می‌کند
        }
    }
    
    /**
     * بارگذاری لیست ارائه‌دهندگان
     */
    async loadProviders() {
        try {
            const response = await fetch(`${this.baseUrl}/providers/`);
            const data = await response.json();
            
            if (response.ok) {
                this.providers = data;
                console.log(`✅ Loaded ${data.length} providers`);
            } else {
                throw new Error('Failed to load providers');
            }
        } catch (error) {
            console.warn('⚠️ Error loading providers (using fallback):', error);
            // استفاده از provider پیش‌فرض
            this.providers = [this.defaultModel.provider];
        }
    }
    
    /**
     * بارگذاری لیست مدل‌ها
     */
    async loadModels(filters = {}) {
        try {
            this.isLoading = true;
            
            // ساخت URL با فیلترها
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
            
            const url = `${this.baseUrl}/models/${params.toString() ? '?' + params.toString() : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                this.availableModels = data.models;
                console.log(`✅ Loaded ${data.count} models`);
                
                if (this.onModelsLoad) {
                    this.onModelsLoad(this.availableModels, data);
                }
                
                return data;
            } else {
                throw new Error('Failed to load models');
            }
        } catch (error) {
            console.warn('⚠️ Error loading models (keeping default):', error);
            // در صورت خطا، مدل پیش‌فرض را نگه دار
            if (this.handleError) {
                this.handleError(error);
            }
            return null;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * بارگذاری مدل انتخاب شده فعلی
     */
    async loadSelectedModel() {
        try {
            const response = await fetch(`${this.baseUrl}/selected-model/`);
            const data = await response.json();
            
            if (data.success && data.selected_model) {
                // اگر مدل از سرور دریافت شد، آن را به‌روزرسانی کن
                const serverModel = data.selected_model;
                
                // بررسی اینکه آیا مدل سرور با مدل فعلی متفاوت است
                if (!this.selectedModel || this.selectedModel.model_id !== serverModel.model_id) {
                    this.selectedModel = serverModel;
                    console.log(`✅ Server selected model: ${this.selectedModel.display_name}`);
                    
                    if (this.onModelChange) {
                        this.onModelChange(this.selectedModel);
                    }
                }
                
                return this.selectedModel;
            } else {
                // اگر سرور مدلی ندارد، مدل پیش‌فرض را ارسال کن
                await this.selectModel(this.defaultModel.model_id);
            }
        } catch (error) {
            console.warn('⚠️ Error loading selected model (using default):', error);
            // در صورت خطا، مدل پیش‌فرض را نگه دار
        }
    }
    
    /**
     * انتخاب مدل جدید
     */
/**
 * انتخاب مدل جدید
 */
async selectModel(modelId) {
    try {
        console.log(`🔄 Selecting model: ${modelId}`);
        
        // اول مدل را در لیست محلی پیدا کن
        const localModel = this.availableModels.find(model => model.model_id === modelId);
        if (!localModel) {
            console.error(`❌ Model ${modelId} not found in available models`);
            return null;
        }
        
        // 🆕 فوراً مدل محلی را تنظیم کن
        this.selectedModel = localModel;
        console.log(`✅ Model selected locally: ${this.selectedModel.display_name}`);
        
        // 🆕 فوراً callback را فراخوانی کن
        if (this.onModelChange) {
            this.onModelChange(this.selectedModel);
        }
        
        // سپس سعی کن به سرور ارسال کنی
        try {
            const response = await fetch(`${this.baseUrl}/select-model/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ model_id: modelId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ Model selection confirmed by server: ${data.selected_model.display_name}`);
                
                // اگر سرور مدل متفاوتی برگردانده، آن را به‌روزرسانی کن
                if (data.selected_model.model_id !== this.selectedModel.model_id) {
                    this.selectedModel = data.selected_model;
                    
                    if (this.onModelChange) {
                        this.onModelChange(this.selectedModel);
                    }
                }
            } else {
                console.warn('⚠️ Server failed to confirm model selection, using local selection');
            }
        } catch (serverError) {
            console.warn('⚠️ Server request failed, using local selection:', serverError);
        }
        
        return this.selectedModel;
        
    } catch (error) {
        console.error('❌ Error selecting model:', error);
        throw error;
    }
}
    
    /**
     * دریافت جزئیات یک مدل
     */
    async getModelDetails(modelId) {
        try {
            const response = await fetch(`${this.baseUrl}/models/${modelId}/`);
            const data = await response.json();
            
            if (data.success) {
                return data.model;
            } else {
                throw new Error('Model not found');
            }
        } catch (error) {
            console.error('❌ Error getting model details:', error);
            throw error;
        }
    }
    
    /**
     * دریافت آمار مدل‌ها
     */
    async getStats() {
        try {
            const response = await fetch(`${this.baseUrl}/stats/`);
            const data = await response.json();
            
            if (data.success) {
                return data.stats;
            }
        } catch (error) {
            console.error('❌ Error loading stats:', error);
        }
    }
    
    /**
     * فیلتر کردن مدل‌ها
     */
    filterModels(filters) {
        return this.loadModels(filters);
    }
    
    /**
     * گروه‌بندی مدل‌ها بر اساس ارائه‌دهنده
     */
    getModelsByProvider() {
        const grouped = {};
        
        this.availableModels.forEach(model => {
            const providerName = model.provider.display_name;
            if (!grouped[providerName]) {
                grouped[providerName] = [];
            }
            grouped[providerName].push(model);
        });
        
        return grouped;
    }
    
    /**
     * گروه‌بندی مدل‌ها بر اساس tier
     */
    getModelsByTier() {
        const grouped = {
            free: [],
            basic: [],
            premium: [],
            enterprise: []
        };
        
        this.availableModels.forEach(model => {
            if (grouped[model.tier]) {
                grouped[model.tier].push(model);
            }
        });
        
        return grouped;
    }
    
    /**
     * جستجو در مدل‌ها
     */
    searchModels(query) {
        if (!query) return this.availableModels;
        
        const lowerQuery = query.toLowerCase();
        return this.availableModels.filter(model => 
            model.display_name.toLowerCase().includes(lowerQuery) ||
            model.model_id.toLowerCase().includes(lowerQuery) ||
            model.provider.display_name.toLowerCase().includes(lowerQuery)
        );
    }
    
    /**
     * دریافت CSRF Token
     */
    getCSRFToken() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        return cookieValue || '';
    }
    
    /**
     * مدیریت خطاها
     */
    handleError(error) {
        if (this.onError) {
            this.onError(error);
        }
    }
    
    /**
     * تنظیم callback برای تغییر مدل
     */
    setOnModelChange(callback) {
        this.onModelChange = callback;
    }
    
    /**
     * تنظیم callback برای بارگذاری مدل‌ها
     */
    setOnModelsLoad(callback) {
        this.onModelsLoad = callback;
    }
    
    /**
     * تنظیم callback برای خطاها
     */
    setOnError(callback) {
        this.onError = callback;
    }
    
    /**
     * دریافت مدل انتخاب شده
     */
    getSelectedModel() {
        return this.selectedModel;
    }
    
    /**
     * دریافت لیست مدل‌ها
     */
    getAvailableModels() {
        return this.availableModels;
    }
    
    /**
     * بررسی اینکه آیا مدلی انتخاب شده یا نه
     */
    hasSelectedModel() {
        return this.selectedModel !== null;
    }
    
    /**
     * دریافت نام مدل انتخاب شده
     */
    getSelectedModelName() {
        return this.selectedModel ? this.selectedModel.display_name : 'هیچ مدلی انتخاب نشده';
    }
    
    /**
     * بررسی اینکه آیا مدل انتخاب شده قابلیت vision دارد
     */
    selectedModelSupportsVision() {
        return this.selectedModel ? this.selectedModel.supports_vision : false;
    }
    
    /**
     * بررسی اینکه آیا مدل انتخاب شده قابلیت function calling دارد
     */
    selectedModelSupportsFunctionCalling() {
        return this.selectedModel ? this.selectedModel.supports_function_calling : false;
    }
}

// Export برای استفاده در سایر فایل‌ها
window.ModelManager = ModelManager;