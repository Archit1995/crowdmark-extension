class PopupController {
    constructor() {
        this.init();
    }
    
    async init() {
        this.processFullBtn = document.getElementById('processFullBtn');
        this.processROIBtn = document.getElementById('processROIBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.resultsDiv = document.getElementById('results');
        this.resultsContent = document.getElementById('resultsContent');
        
        // Set up event listeners
        this.processFullBtn.addEventListener('click', () => this.processFullDocument());
        this.processROIBtn.addEventListener('click', () => this.processWithROI());
        
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
                this.processFullBtn.disabled = false;
                this.processROIBtn.disabled = false;
            } else {
                this.updateStatus('No document image found', 'error');
            }
            
        } catch (error) {
            this.updateStatus('Extension not loaded on page', 'error');
        }
    }
    
    async processFullDocument() {
        try {
            this.updateStatus('Extracting image...', 'processing');
            this.processFullBtn.disabled = true;
            this.processROIBtn.disabled = true;
            this.resultsDiv.style.display = 'none';
            
            const response = await this.sendMessageToTab({ 
                action: 'processFullDocument' 
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
            this.processFullBtn.disabled = false;
            this.processROIBtn.disabled = false;
        }
    }
    
    async processWithROI() {
        try {
            this.updateStatus('Select area to process...', 'processing');
            this.processFullBtn.disabled = true;
            this.processROIBtn.disabled = true;
            this.resultsDiv.style.display = 'none';
            
            const response = await this.sendMessageToTab({ 
                action: 'processWithROI' 
            });
            
            if (response && response.success) {
                this.updateStatus('Selected area processed successfully!', 'ready');
                this.showResults(response);
            } else if (response && response.cancelled) {
                this.updateStatus('Selection cancelled', 'ready');
            } else {
                throw new Error(response ? response.error : 'Unknown error');
            }
            
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.processFullBtn.disabled = false;
            this.processROIBtn.disabled = false;
        }
    }
    
    showResults(data) {
        const { extractedData } = data;
        
        this.resultsContent.innerHTML = `
            <strong>Document #${data.documentNumber}</strong><br>
            <strong>Processing Type:</strong> ${data.processingType}<br>
            <strong>OCR Confidence:</strong> ${data.ocrConfidence}%<br>
            <br>
            <strong>Names Found:</strong><br>
            ${extractedData.names.length > 0 ? 
                extractedData.names.map(name => `• ${name}`).join('<br>') : 
                'None detected'}<br>
            <br>
            <strong>IDs Found:</strong><br>
            ${extractedData.ids.length > 0 ? 
                extractedData.ids.map(id => `• ${id}`).join('<br>') : 
                'None detected'}<br>
            <br>
            <strong>Phones Found:</strong><br>
            ${extractedData.phones.length > 0 ? 
                extractedData.phones.map(phone => `• ${phone}`).join('<br>') : 
                'None detected'}<br>
            <br>
            <strong>Raw Text:</strong><br>
            <pre style="font-size: 11px; background: #f5f5f5; padding: 8px; border-radius: 4px; max-height: 150px; overflow-y: auto;">${extractedData.rawText}</pre>
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
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});