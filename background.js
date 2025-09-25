// Background Service Worker
// Handles OCR processing and coordination

class BackgroundProcessor {
    constructor() {
        this.init();
    }
    
    init() {
        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
        
        console.log('Background processor initialized');
    }
    
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'processOCR':
                    const result = await this.processOCR(request.data);
                    sendResponse(result);
                    break;
                    
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background error:', error);
            sendResponse({ error: error.message });
        }
    }
    
    async processOCR(imageData) {
        try {
            // For now, we'll simulate OCR processing
            // In the next step, we'll integrate Tesseract.js
            
            console.log('Processing OCR for image:', imageData.width, 'x', imageData.height);
            
            // Simulate processing delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // TODO: Replace with actual Tesseract.js integration
            const simulatedText = `
            Crowdmark Document #${imageData.documentNumber}
            Student Information:
            Name: Sarah Johnson
            Student ID: 987654321
            Phone: (416) 555-0123
            
            Emergency Contact:
            Name: Mike Johnson
            ID: 123456789
            Phone: (416) 555-9876
            `;
            
            return {
                success: true,
                text: simulatedText,
                confidence: 85.5,
                processingTime: 2000
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Initialize background processor
new BackgroundProcessor();