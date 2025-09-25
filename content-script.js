// Crowdmark Document Processor - Content Script
// This script runs on the Crowdmark page

class CrowdmarkProcessor {
    constructor() {
        this.imageSelector = '.cover-page__image';
        this.isProcessing = false;
        this.init();
    }
    
    init() {
        // console.log('Crowdmark processor initialized');
        // this.addStatusIndicator();
        
        // // Listen for messages from popup
        // chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        //     this.handleMessage(request, sender, sendResponse);
        //     return true; // Keep message channel open for async response
        // });
    }
    
    addStatusIndicator() {
        // Add a visual indicator that the extension is active
        const indicator = document.createElement('div');
        indicator.id = 'crowdmark-processor-status';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 12px;
        `;
        indicator.textContent = '📄 Crowdmark Processor Ready';
        document.body.appendChild(indicator);
    }
    
    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'processCurrentDocument':
                    const result = await this.processCurrentDocument();
                    sendResponse(result);
                    break;
                    
                case 'extractImage':
                    const imageData = await this.extractDocumentImage();
                    sendResponse(imageData);
                    break;
                    
                case 'getPageInfo':
                    const pageInfo = this.getPageInfo();
                    sendResponse(pageInfo);
                    break;
                    
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }
    
    async extractDocumentImage() {
        const imgElement = document.querySelector(this.imageSelector);
        
        if (!imgElement) {
            throw new Error('Document image not found');
        }
        
        // Wait for image to load if not already loaded
        if (!imgElement.complete) {
            await this.waitForImageLoad(imgElement);
        }
        
        // Create canvas and extract image data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        try {
            // Set canvas size to match image
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            
            // Draw image to canvas
            ctx.drawImage(imgElement, 0, 0);
            
            // Apply OCR preprocessing
            ctx.filter = 'contrast(130%) brightness(110%) saturate(0%)';
            ctx.drawImage(imgElement, 0, 0);
            ctx.filter = 'none';
            
            return {
                success: true,
                dataURL: canvas.toDataURL('image/png'),
                width: canvas.width,
                height: canvas.height,
                documentNumber: this.getCurrentDocumentNumber(),
                timestamp: Date.now()
            };
            
        } catch (error) {
            throw new Error(`Image extraction failed: ${error.message}`);
        }
    }
    
    waitForImageLoad(imgElement) {
        return new Promise((resolve, reject) => {
            if (imgElement.complete) {
                resolve();
            } else {
                imgElement.onload = () => resolve();
                imgElement.onerror = () => reject(new Error('Image failed to load'));
                
                // Timeout after 5 seconds
                setTimeout(() => reject(new Error('Image load timeout')), 5000);
            }
        });
    }
    
    getCurrentDocumentNumber() {
        const urlParams = new URLSearchParams(window.location.search);
        return parseInt(urlParams.get('num')) || 1;
    }
    
    getPageInfo() {
        return {
            url: window.location.href,
            documentNumber: this.getCurrentDocumentNumber(),
            hasImage: !!document.querySelector(this.imageSelector),
            title: document.title
        };
    }
    
    async processCurrentDocument() {
        if (this.isProcessing) {
            throw new Error('Already processing a document');
        }
        
        this.isProcessing = true;
        this.updateStatus('Processing document...');
        
        try {
            // Step 1: Extract image
            const imageData = await this.extractDocumentImage();
            this.updateStatus('Image extracted, running OCR...');
            
            // Step 2: Send to background script for OCR processing
            const ocrResult = await this.sendToBackground('processOCR', imageData);
            
            if (!ocrResult.success) {
                throw new Error('OCR processing failed');
            }
            
            this.updateStatus('OCR complete, parsing data...');
            
            // Step 3: Parse extracted text
            const parsedData = this.parseDocumentText(ocrResult.text);
            
            // Step 4: TODO - Fill form fields (we'll implement this next)
            this.updateStatus('Document processed successfully!');
            
            return {
                success: true,
                documentNumber: this.getCurrentDocumentNumber(),
                extractedData: parsedData,
                ocrConfidence: ocrResult.confidence
            };
            
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
            throw error;
        } finally {
            this.isProcessing = false;
            setTimeout(() => this.updateStatus('Ready'), 3000);
        }
    }
    
    parseDocumentText(text) {
        // Basic text parsing - we'll improve this based on your actual documents
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const parsed = {
            names: [],
            ids: [],
            phones: []
        };
        
        // Look for patterns (adjust these based on your document structure)
        const namePattern = /(?:name|student):\s*([a-zA-Z\s]+)/gi;
        const idPattern = /(?:id|student\s*id):\s*([0-9]+)/gi;
        const phonePattern = /(?:phone):\s*([\(\)\-\s0-9]+)/gi;
        
        for (const line of lines) {
            const nameMatch = namePattern.exec(line);
            if (nameMatch) {
                parsed.names.push(nameMatch[1].trim());
            }
            
            const idMatch = idPattern.exec(line);
            if (idMatch) {
                parsed.ids.push(idMatch[1].trim());
            }
            
            const phoneMatch = phonePattern.exec(line);
            if (phoneMatch) {
                parsed.phones.push(phoneMatch[1].trim());
            }
        }
        
        return parsed;
    }
    
    updateStatus(message, type = 'info') {
        const indicator = document.getElementById('crowdmark-processor-status');
        if (indicator) {
            indicator.textContent = `📄 ${message}`;
            indicator.style.backgroundColor = type === 'error' ? '#dc3545' : '#28a745';
        }
    }
    
    sendToBackground(action, data) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action, data }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CrowdmarkProcessor();
    });
} else {
    new CrowdmarkProcessor();
}