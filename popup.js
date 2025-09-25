// Popup script
class PopupController {
    constructor() {
        this.init();
    }
    
    async init() {
        this.processBtn = document.getElementById('processBtn');
        this.extractBtn = document.getElementById('extractBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.resultsDiv = document.getElementById('results');
        this.resultsContent = document.getElementById('resultsContent');
        
        // Set up event listeners
        this.processBtn.addEventListener('click', () => this.processDocument());
        this.extractBtn.addEventListener('click', () => this.extractImage());
        
        // Check if we're on a valid page
        await this.checkPageStatus();
    }
    
    async checkPageStatus() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('app.crowdmark.com')) {
                this.updateStatus('Not on Crowdmark page', 'error');
                return;
            }
            
            // Send message to content script to get page info
            const response = await this.sendMessageToTab({ action: 'getPageInfo' });
            
            if (response && response.hasImage) {
                this.updateStatus(`Ready - Document #${response.documentNumber}`, 'ready');
                this.processBtn.disabled = false;
                this.extractBtn.disabled = false;
            } else {
                this.updateStatus('No document image found', 'error');
            }
            
        } catch (error) {
            this.updateStatus('Extension not loaded on page', 'error');
        }
    }
    
    async processDocument() {
        try {
            this.updateStatus('Processing document...', 'processing');
            this.processBtn.disabled = true;
            this.extractBtn.disabled = true;
            this.resultsDiv.style.display = 'none';
            
            const response = await this.sendMessageToTab({ 
                action: 'processCurrentDocument' 
            });
            
            if (response && response.success) {
                this.updateStatus('Document processed successfully!', 'ready');
                this.showResults(response);
            } else {
                throw new Error(response ? response.error : 'Unknown error');
            }
            
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.processBtn.disabled = false;
            this.extractBtn.disabled = false;
        }
    }
    
    async extractImage() {
        try {
            this.updateStatus('Extracting image...', 'processing');
            this.extractBtn.disabled = true;
            
            const response = await this.sendMessageToTab({ 
                action: 'extractImage' 
            });
            
            if (response && response.success) {
                this.updateStatus('Image extracted successfully!', 'ready');
                this.showImageResults(response);
            } else {
                throw new Error(response ? response.error : 'Unknown error');
            }
            
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.extractBtn.disabled = false;
        }
    }
    
    showResults(data) {
        this.resultsContent.innerHTML = `
            <strong>Document #${data.documentNumber}</strong><br>
            <strong>Names:</strong> ${data.extractedData.names.join(', ') || 'None found'}<br>
            <strong>IDs:</strong> ${data.extractedData.ids.join(', ') || 'None found'}<br>
            <strong>OCR Confidence:</strong> ${data.ocrConfidence}%
        `;
        this.resultsDiv.style.display = 'block';
    }
    
    showImageResults(data) {
        this.resultsContent.innerHTML = `
            <strong>Image Extracted:</strong><br>
            <strong>Size:</strong> ${data.width} × ${data.height}<br>
            <strong>Document:</strong> #${data.documentNumber}<br>
            <strong>Status:</strong> Ready for OCR processing
        `;
        this.resultsDiv.style.display = 'block';
    }
    
    updateStatus(message, type = 'info') {
        this.statusIndicator.textContent = message;
        this.statusIndicator.className = `status-indicator ${type}`;
    }
    
    sendMessageToTab(message) {
        return new Promise(async (resolve, reject) => {
            try {
                // Send message through background script instead
                chrome.runtime.sendMessage({
                    action: 'forwardToTab',
                    tabMessage: message
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});