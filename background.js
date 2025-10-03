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
        const startTime = Date.now();
        console.log('Starting PaddleOCR processing for image:', imageData.width, 'x', imageData.height);
        
        try {
            console.log('Sending image to PaddleOCR server at:', this.ocrServerUrl);
            
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
            
            if (!result.success) {
                throw new Error(result.error || 'OCR processing failed');
            }
            
            const processingTime = Date.now() - startTime;
            
            // Combine all text from lines
            const fullText = result.lines.map(line => line.text).join('\n');
            
            // Calculate average confidence
            const avgConfidence = result.lines.length > 0
                ? result.lines.reduce((sum, line) => sum + line.confidence, 0) / result.lines.length * 100
                : 0;
            
            console.log('PaddleOCR completed successfully:', {
                linesDetected: result.lines.length,
                avgConfidence: avgConfidence.toFixed(2) + '%',
                processingTime: processingTime + 'ms',
                serverProcessingTime: result.processing_time + 'ms'
            });
            
            return {
                success: true,
                text: fullText,
                confidence: Math.round(avgConfidence * 100) / 100,
                processingTime: processingTime,
                linesDetected: result.lines.length,
                detailedResults: result.lines // Include line-by-line details with confidence
            };
            
        } catch (error) {
            console.error('OCR processing failed:', error);
            
            // Provide helpful error messages
            let errorMessage = error.message;
            
            if (error.message.includes('Failed to fetch') || 
                error.message.includes('NetworkError') ||
                error.message.includes('fetch')) {
                errorMessage = 'Cannot connect to PaddleOCR server.\n\nPlease ensure:\n1. Flask server is running (python server.py)\n2. Server is accessible at http://localhost:5000\n3. No firewall is blocking the connection';
            }
            
            return {
                success: false,
                error: errorMessage,
                processingTime: Date.now() - startTime
            };
        }
    }
}

console.log('About to create BackgroundProcessor instance');
const processor = new BackgroundProcessor();
console.log('BackgroundProcessor instance created');