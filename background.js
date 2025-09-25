// Background Service Worker - Message Router
console.log('=== BACKGROUND SCRIPT STARTING ===');
class BackgroundProcessor {
    constructor() {
        console.log('BackgroundProcessor constructor called');
        this.init();
    }
    
    init() {
        console.log('BackgroundProcessor init() called');
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true;
        });
        
        console.log('Background processor initialized');
    }
    
    async handleMessage(request, sender, sendResponse) {
        try {
            if (request.action === 'forwardToTab') {
                // Forward message from popup to content script
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                
                chrome.tabs.sendMessage(tab.id, request.tabMessage, (response) => {
                    if (chrome.runtime.lastError) {
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
        // OCR processing (same as before)
        console.log('Processing OCR for image:', imageData.width, 'x', imageData.height);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const simulatedText = `
        Crowdmark Document #${imageData.documentNumber}
        Name: Sarah Johnson
        Student ID: 987654321
        Phone: (416) 555-0123
        `;
        
        return {
            success: true,
            text: simulatedText,
            confidence: 85.5,
            processingTime: 2000
        };
    }
}
console.log('About to create BackgroundProcessor instance');
new BackgroundProcessor();
console.log('BackgroundProcessor instance created');