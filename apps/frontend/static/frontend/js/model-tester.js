class ModelTester {
    constructor() {
        this.testResults = {};
        this.currentTest = null;
        this.testQueue = [];
        this.isRunning = false;
        
        // Test configurations
        this.testConfigs = {
            simple: {
                name: 'تست ساده',
                message: 'سلام، نام خود را بگو',
                expectedKeywords: ['سلام', 'نام', 'هوش مصنوعی', 'مدل']
            },
            complex: {
                name: 'تست پیچیده',
                message: 'لطفاً یک قصه کوتاه در 50 کلمه بنویس',
                expectedKeywords: ['قصه', 'داستان']
            },
            json: {
                name: 'تست JSON',
                message: 'پاسخ را در قالب JSON برگردان: {"name": "نام تو", "type": "نوع مدل"}',
                expectedKeywords: ['json', '{', '}', 'name', 'type']
            },
            persian: {
                name: 'تست فارسی',
                message: 'یک شعر فارسی کوتاه بسرای',
                expectedKeywords: ['شعر', 'فارسی']
            },
            code: {
                name: 'تست کد',
                message: 'یک تابع Python برای جمع دو عدد بنویس',
                expectedKeywords: ['def', 'python', 'return', '+']
            }
        };
    }
    
    // شروع تست همه مدل‌ها
    async testAllModels(testType = 'simple') {
        console.log(`🧪 Starting ${testType} test for all models...`);
        
        if (!window.modelManager) {
            console.error('❌ ModelManager not available');
            return;
        }
        
        const models = window.modelManager.getAvailableModels();
        console.log(`📋 Found ${models.length} models to test`);
        
        this.testResults = {};
        this.isRunning = true;
        
        // Create UI
        this.createTestUI();
        
        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            console.log(`🔄 Testing model ${i + 1}/${models.length}: ${model.display_name}`);
            
            this.updateTestUI(`Testing ${model.display_name}... (${i + 1}/${models.length})`);
            
            try {
                const result = await this.testSingleModel(model, testType);
                this.testResults[model.model_id] = result;
                
                // نمایش نتیجه فوری
                this.displayModelResult(model, result);
                
                // استراحت بین تست‌ها
                await this.sleep(2000);
                
            } catch (error) {
                console.error(`❌ Error testing ${model.display_name}:`, error);
                this.testResults[model.model_id] = {
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        }
        
        this.isRunning = false;
        this.generateReport();
        console.log('✅ All tests completed!');
    }
    
    // تست یک مدل
    async testSingleModel(model, testType = 'simple') {
        const config = this.testConfigs[testType];
        if (!config) {
            throw new Error(`Test type ${testType} not found`);
        }
        
        console.log(`🔬 Testing ${model.display_name} with ${config.name}...`);
        
        const startTime = Date.now();
        
        try {
            // انتخاب مدل
            await window.modelManager.selectModel(model.model_id);
            await this.sleep(500); // صبر برای تنظیم مدل
            
            // ارسال پیام تست
            const response = await this.sendTestMessage(config.message);
            const endTime = Date.now();
            
            // تحلیل پاسخ
            const analysis = this.analyzeResponse(response, config);
            
            return {
                success: true,
                model_id: model.model_id,
                model_name: model.display_name,
                provider: model.provider.display_name,
                tier: model.tier,
                test_type: testType,
                request: {
                    message: config.message,
                    timestamp: new Date(startTime).toISOString()
                },
                response: {
                    content: response,
                    length: response.length,
                    word_count: response.split(' ').length,
                    has_persian: /[\u0600-\u06FF]/.test(response),
                    has_english: /[a-zA-Z]/.test(response),
                    has_numbers: /\d/.test(response),
                    has_json: response.includes('{') && response.includes('}'),
                    timestamp: new Date(endTime).toISOString()
                },
                performance: {
                    response_time_ms: endTime - startTime,
                    response_time_seconds: (endTime - startTime) / 1000
                },
                analysis: analysis,
                raw_data: {
                    request_data: {
                        model: model.model_id,
                        message: config.message,
                        test_config: config
                    },
                    response_data: response
                }
            };
            
        } catch (error) {
            const endTime = Date.now();
            
            return {
                success: false,
                model_id: model.model_id,
                model_name: model.display_name,
                provider: model.provider.display_name,
                tier: model.tier,
                test_type: testType,
                error: error.message,
                error_type: this.categorizeError(error.message),
                performance: {
                    response_time_ms: endTime - startTime,
                    response_time_seconds: (endTime - startTime) / 1000
                },
                timestamp: new Date(endTime).toISOString()
            };
        }
    }
    
    // ارسال پیام تست
    async sendTestMessage(message) {
        return new Promise((resolve, reject) => {
            let responseText = '';
            let timeoutId;
            
            // تنظیم timeout
            timeoutId = setTimeout(() => {
                reject(new Error('Response timeout after 30 seconds'));
            }, 30000);
            
            // اگر WebSocket موجود است
            if (window.streamingManager && window.streamingManager.isConnected) {
                console.log('📡 Using WebSocket for test...');
                
                // Listen for response
                const originalOnToken = window.streamingManager.onStreamToken;
                const originalOnComplete = window.streamingManager.onStreamComplete;
                
                window.streamingManager.onStreamToken = (token) => {
                    responseText += token;
                };
                
                window.streamingManager.onStreamComplete = (reason) => {
                    clearTimeout(timeoutId);
                    
                    // Restore original handlers
                    window.streamingManager.onStreamToken = originalOnToken;
                    window.streamingManager.onStreamComplete = originalOnComplete;
                    
                    if (reason === 'error' && responseText.includes('Error:')) {
                        reject(new Error(responseText));
                    } else {
                        resolve(responseText.trim());
                    }
                };
                
                // Send message
                const sent = window.streamingManager.sendMessage(message);
                if (!sent) {
                    clearTimeout(timeoutId);
                    reject(new Error('Failed to send WebSocket message'));
                }
                
            } else {
                // استفاده از HTTP
                console.log('🌐 Using HTTP for test...');
                
                const requestData = {
                    content: message,
                    model: window.modelManager.getSelectedModel().model_id,
                    conversation_id: null
                };
                
                fetch('/api/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.getCSRFToken()
                    },
                    body: JSON.stringify(requestData)
                })
                .then(response => response.json())
                .then(data => {
                    clearTimeout(timeoutId);
                    if (data.response) {
                        resolve(data.response);
                    } else {
                        reject(new Error('No response from server'));
                    }
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
            }
        });
    }
    
    // تحلیل پاسخ
    analyzeResponse(response, config) {
        const analysis = {
            keyword_matches: [],
            keyword_score: 0,
            quality_score: 0,
            issues: [],
            strengths: []
        };
        
        // بررسی کلمات کلیدی
        const lowerResponse = response.toLowerCase();
        config.expectedKeywords.forEach(keyword => {
            if (lowerResponse.includes(keyword.toLowerCase())) {
                analysis.keyword_matches.push(keyword);
            }
        });
        
        analysis.keyword_score = (analysis.keyword_matches.length / config.expectedKeywords.length) * 100;
        
        // بررسی کیفیت
        if (response.length < 10) {
            analysis.issues.push('پاسخ خیلی کوتاه است');
            analysis.quality_score -= 20;
        } else if (response.length > 1000) {
            analysis.issues.push('پاسخ خیلی طولانی است');
            analysis.quality_score -= 10;
        } else {
            analysis.strengths.push('طول پاسخ مناسب است');
            analysis.quality_score += 20;
        }
        
        // بررسی خطاها
        if (response.includes('Error:') || response.includes('error')) {
            analysis.issues.push('پاسخ حاوی خطا است');
            analysis.quality_score -= 50;
        } else {
            analysis.strengths.push('پاسخ بدون خطا است');
            analysis.quality_score += 30;
        }
        
        // بررسی زبان
        const hasPersian = /[\u0600-\u06FF]/.test(response);
        const hasEnglish = /[a-zA-Z]/.test(response);
        
        if (hasPersian) {
            analysis.strengths.push('پشتیبانی از زبان فارسی');
            analysis.quality_score += 10;
        }
        
        if (hasEnglish) {
            analysis.strengths.push('پشتیبانی از زبان انگلیسی');
            analysis.quality_score += 10;
        }
        
        // محاسبه نمره نهایی
        analysis.quality_score = Math.max(0, Math.min(100, analysis.quality_score + 50));
        
        return analysis;
    }
    
    // دسته‌بندی خطاها
    categorizeError(errorMessage) {
        const lowerError = errorMessage.toLowerCase();
        
        if (lowerError.includes('insufficient_tier') || lowerError.includes('access')) {
            return 'ACCESS_DENIED';
        } else if (lowerError.includes('timeout')) {
            return 'TIMEOUT';
        } else if (lowerError.includes('network') || lowerError.includes('connection')) {
            return 'NETWORK_ERROR';
        } else if (lowerError.includes('parameter') || lowerError.includes('invalid')) {
            return 'INVALID_PARAMETER';
        } else if (lowerError.includes('rate limit') || lowerError.includes('quota')) {
            return 'RATE_LIMIT';
        } else {
            return 'UNKNOWN_ERROR';
        }
    }
    
    // ایجاد رابط کاربری تست
    createTestUI() {
        // حذف UI قبلی اگر وجود دارد
        const existingUI = document.getElementById('modelTesterUI');
        if (existingUI) {
            existingUI.remove();
        }
        
        const ui = document.createElement('div');
        ui.id = 'modelTesterUI';
        ui.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                width: 400px;
                max-height: 80vh;
                background: white;
                border: 2px solid #007bff;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                overflow: hidden;
                font-family: Arial, sans-serif;
            ">
                <div style="
                    background: #007bff;
                    color: white;
                    padding: 12px;
                    font-weight: bold;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <span>🧪 Model Tester</span>
                    <button onclick="document.getElementById('modelTesterUI').remove()" 
                            style="background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
                </div>
                
                <div id="testStatus" style="padding: 12px; background: #f8f9fa; border-bottom: 1px solid #dee2e6;">
                    آماده برای شروع تست...
                </div>
                
                <div id="testResults" style="
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 12px;
                ">
                    <!-- نتایج اینجا نمایش داده می‌شوند -->
                </div>
                
                <div style="padding: 12px; background: #f8f9fa; border-top: 1px solid #dee2e6;">
                    <button onclick="window.modelTester.testAllModels('simple')" 
                            style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; margin-right: 8px; cursor: pointer;">
                        تست ساده
                    </button>
                    <button onclick="window.modelTester.testAllModels('complex')" 
                            style="background: #ffc107; color: black; border: none; padding: 8px 12px; border-radius: 4px; margin-right: 8px; cursor: pointer;">
                        تست پیچیده
                    </button>
                    <button onclick="window.modelTester.exportResults()" 
                            style="background: #17a2b8; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                        Export
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(ui);
    }
    
    // به‌روزرسانی وضعیت تست
    updateTestUI(status) {
        const statusElement = document.getElementById('testStatus');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }
    
    // نمایش نتیجه یک مدل
    displayModelResult(model, result) {
        const resultsContainer = document.getElementById('testResults');
        if (!resultsContainer) return;
        
        const resultDiv = document.createElement('div');
        resultDiv.style.cssText = `
            margin-bottom: 12px;
            padding: 8px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background: ${result.success ? '#d4edda' : '#f8d7da'};
        `;
        
        if (result.success) {
            resultDiv.innerHTML = `
                <div style="font-weight: bold; color: #155724;">
                    ✅ ${model.display_name} (${model.provider.display_name})
                </div>
                <div style="font-size: 12px; color: #155724;">
                    📊 Quality: ${result.analysis.quality_score}/100 | 
                    ⏱️ Time: ${result.performance.response_time_seconds.toFixed(2)}s | 
                    📝 Length: ${result.response.length} chars
                </div>
                <div style="font-size: 11px; color: #6c757d; margin-top: 4px;">
                    ${result.response.content.substring(0, 100)}${result.response.content.length > 100 ? '...' : ''}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div style="font-weight: bold; color: #721c24;">
                    ❌ ${model.display_name} (${model.provider.display_name})
                </div>
                <div style="font-size: 12px; color: #721c24;">
                    Error: ${result.error_type || 'UNKNOWN'} | 
                    ⏱️ Time: ${result.performance.response_time_seconds.toFixed(2)}s
                </div>
                <div style="font-size: 11px; color: #6c757d; margin-top: 4px;">
                    ${result.error}
                </div>
            `;
        }
        
        resultsContainer.appendChild(resultDiv);
        
        // Scroll to bottom
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
    }
    
    // تولید گزارش نهایی
    generateReport() {
        const totalModels = Object.keys(this.testResults).length;
        const successfulModels = Object.values(this.testResults).filter(r => r.success).length;
        const failedModels = totalModels - successfulModels;
        
        console.log('\n🧪 ========== MODEL TEST REPORT ==========');
        console.log(`📊 Total Models Tested: ${totalModels}`);
        console.log(`✅ Successful: ${successfulModels}`);
        console.log(`❌ Failed: ${failedModels}`);
        console.log(`📈 Success Rate: ${((successfulModels / totalModels) * 100).toFixed(2)}%`);
        
        // گروه‌بندی بر اساس provider
        const byProvider = {};
        Object.values(this.testResults).forEach(result => {
            if (!byProvider[result.provider]) {
                byProvider[result.provider] = { total: 0, success: 0, failed: 0 };
            }
            byProvider[result.provider].total++;
            if (result.success) {
                byProvider[result.provider].success++;
            } else {
                byProvider[result.provider].failed++;
            }
        });
        
        console.log('\n📋 Results by Provider:');
        Object.keys(byProvider).forEach(provider => {
            const stats = byProvider[provider];
            console.log(`  ${provider}: ${stats.success}/${stats.total} (${((stats.success/stats.total)*100).toFixed(1)}%)`);
        });
        
        // نمایش خطاهای رایج
        const errorTypes = {};
        Object.values(this.testResults).forEach(result => {
            if (!result.success && result.error_type) {
                errorTypes[result.error_type] = (errorTypes[result.error_type] || 0) + 1;
            }
        });
        
        if (Object.keys(errorTypes).length > 0) {
            console.log('\n❌ Common Error Types:');
            Object.keys(errorTypes).forEach(errorType => {
                console.log(`  ${errorType}: ${errorTypes[errorType]} models`);
            });
        }
        
        console.log('\n🔍 Detailed Results:');
        console.table(this.testResults);
        
        this.updateTestUI(`✅ Test completed! ${successfulModels}/${totalModels} models successful`);
    }
    
    // Export نتایج
    exportResults() {
        const dataStr = JSON.stringify(this.testResults, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `model-test-results-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        console.log('📁 Test results exported!');
    }
    
    // Helper functions
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }
}

// Initialize
window.modelTester = new ModelTester();
console.log('🧪 Model Tester loaded! Use window.modelTester.testAllModels() to start testing.');