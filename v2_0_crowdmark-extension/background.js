// Background Service Worker - PaddleOCR Integration
console.log('=== BACKGROUND SCRIPT STARTING ===');

class BackgroundProcessor {
    constructor() {
        console.log('BackgroundProcessor constructor called');
        this.ocrServerUrl = 'http://localhost:5000/ocr';
        this.init();
    }
    
    init() {
        console.log('BackgroundProcessor init() called');
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep channel open for async responses
        });
        
        console.log('Background processor initialized');
    }
    
    async handleMessage(request, sender, sendResponse) {
        console.log('Background received:', request.action);
        
        try {
            if (request.action === 'forwardToTab') {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                console.log('Forwarding to tab:', tab.id, request.tabMessage);
                
                chrome.tabs.sendMessage(tab.id, request.tabMessage, (response) => {
                    console.log('Tab response:', response);
                    
                    if (chrome.runtime.lastError) {
                        console.error('Runtime error:', chrome.runtime.lastError);
                        sendResponse({ error: chrome.runtime.lastError.message });
                    } else {
                        sendResponse(response);
                    }
                });
                
            } else if (request.action === 'processOCR') {
                const result = await this.processOCR(request.data);
                sendResponse(result);
            }
        } catch (error) {
            console.error('Background error:', error);
            sendResponse({ error: error.message });
        }
    }
    
    async processOCR(imageData) {
        console.log(" in processOCR with imageData:");
        const startTime = Date.now();

        try {
            const response = await fetch(this.ocrServerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: imageData.dataURL
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            
            const result = await response.json();
            console.log('Raw server response:', JSON.stringify(result)); 
            
            if (!result.success) {
                throw new Error(result.error || 'OCR processing failed');
            }
            
            const processingTime = Date.now() - startTime;
        console.log('TrOCR completed:', result.results, processingTime + 'ms');
        
        return {
            success: true,
            results: result.results,  // pass through directly
            confidence: 100,
            processingTime: processingTime
        };
        
    } catch (error) {
        console.error('OCR processing failed:', error);
        return {
            success: false,
            error: error.message,
            processingTime: Date.now() - startTime
        };
    }
}
}

console.log('About to create BackgroundProcessor instance');
const processor = new BackgroundProcessor();
console.log('BackgroundProcessor instance created');