// Crowdmark Document Processor - Content Script

// SnippingTool class - handles ROI selection
class SnippingTool {
    constructor() {
        this.overlay = null;
        this.isSelecting = false;
        this.startPoint = null;
        this.endPoint = null;
        this.imageElement = null;
        this.callback = null;
        this.instructions = null;
    }
    
    activate(imageElement, callback) {
        console.log('SnippingTool activated');
        this.imageElement = imageElement;
        this.callback = callback;
        this.createOverlay();
        this.attachEventListeners();
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'snippet-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 99999;
            cursor: crosshair;
        `;
        
        this.instructions = document.createElement('div');
        this.instructions.style.cssText = `
            position: fixed;
            top: 352px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 20px 30px;
            border-radius: 8px;
            z-index: 100000;
            font-weight: bold;
            color: black;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            transition: opacity 0.3s ease;
            pointer-events: auto;
        `;
        this.instructions.innerHTML = 'Draw a box around the area to extract. Press ESC to cancel.';
        
        this.instructions.addEventListener('mouseenter', () => {
            this.instructions.style.opacity = '0.1';
        });
        
        this.instructions.addEventListener('mouseleave', () => {
            this.instructions.style.opacity = '1';
        });
        
        this.overlay.appendChild(this.instructions);
        document.body.appendChild(this.overlay);
    }
    
    attachEventListeners() {
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        this.overlay.addEventListener('mousedown', this.handleMouseDown);
        this.overlay.addEventListener('mousemove', this.handleMouseMove);
        this.overlay.addEventListener('mouseup', this.handleMouseUp);
        document.addEventListener('keydown', this.handleKeyDown);
    }
    
    handleMouseDown(e) {
        if (e.target === this.instructions) return;
        
        this.isSelecting = true;
        this.startPoint = { x: e.clientX, y: e.clientY };
        this.endPoint = { x: e.clientX, y: e.clientY };
        
        if (this.instructions) {
            this.instructions.style.display = 'none';
        }
    }
    
    handleMouseMove(e) {
        if (!this.isSelecting) return;
        this.endPoint = { x: e.clientX, y: e.clientY };
        this.drawSelection();
    }
    
    handleMouseUp(e) {
        if (!this.isSelecting) return;
        
        this.isSelecting = false;
        this.endPoint = { x: e.clientX, y: e.clientY };
        
        const imageRect = this.imageElement.getBoundingClientRect();
        const scaleX = this.imageElement.naturalWidth / imageRect.width;
        const scaleY = this.imageElement.naturalHeight / imageRect.height;
        
        const x1 = Math.min(this.startPoint.x, this.endPoint.x);
        const y1 = Math.min(this.startPoint.y, this.endPoint.y);
        const x2 = Math.max(this.startPoint.x, this.endPoint.x);
        const y2 = Math.max(this.startPoint.y, this.endPoint.y);
        
        const coords = {
            x: Math.round((x1 - imageRect.left) * scaleX),
            y: Math.round((y1 - imageRect.top) * scaleY),
            width: Math.round((x2 - x1) * scaleX),
            height: Math.round((y2 - y1) * scaleY)
        };
        
        this.cleanup();
        if (this.callback) {
            this.callback(coords);
        }
    }
    
    drawSelection() {
        if (!this.startPoint || !this.endPoint) return;
        
        let selectionBox = document.getElementById('roi-selection-box');
        if (!selectionBox) {
            selectionBox = document.createElement('div');
            selectionBox.id = 'roi-selection-box';
            selectionBox.style.cssText = `
                position: fixed;
                border: 2px solid #00ff00;
                background: rgba(0, 255, 0, 0.1);
                pointer-events: none;
                z-index: 100001;
            `;
            this.overlay.appendChild(selectionBox);
        }
        
        const x = Math.min(this.startPoint.x, this.endPoint.x);
        const y = Math.min(this.startPoint.y, this.endPoint.y);
        const width = Math.abs(this.endPoint.x - this.startPoint.x);
        const height = Math.abs(this.endPoint.y - this.startPoint.y);
        
        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
    }
    
    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.cleanup();
            if (this.callback) {
                this.callback(null);
            }
        }
    }
    
    cleanup() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        this.instructions = null;
        document.removeEventListener('keydown', this.handleKeyDown);
    }
}

// Main CrowdmarkProcessor class
class CrowdmarkProcessor {
    constructor() {
        this.imageSelector = '.cover-page__image';
        this.isProcessing = false;
        this.init();
    }
    
    init() {
        console.log('Crowdmark processor initialized');
        this.addStatusIndicator();
        
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                console.log('Content script received:', request);
                this.handleMessage(request, sender, sendResponse);
                return true;
            });
        }
    }
    
    addStatusIndicator() {
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
        console.log('Content script received message:', request.action);
        
        try {
            switch (request.action) {
                case 'processFullDocument':
                    const fullResult = await this.processFullDocument();
                    sendResponse(fullResult);
                    break;
                    
                case 'processWithROI':
                    this.processWithROI().then(result => {
                        sendResponse(result);
                    }).catch(error => {
                        sendResponse({ error: error.message });
                    });
                    return true;
                    
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
    
    async processFullDocument() {
        if (this.isProcessing) {
            throw new Error('Already processing a document');
        }
        
        this.isProcessing = true;
        this.updateStatus('Processing entire document...');
        
        try {
            const imageData = await this.extractDocumentImage();
            this.updateStatus('Image extracted, running OCR...');
            
            const ocrResult = await this.sendToBackground('processOCR', imageData);
            
            if (!ocrResult.success) {
                throw new Error('OCR processing failed');
            }
            
            this.updateStatus('OCR complete, parsing data...');
            const parsedData = this.parseDocumentText(ocrResult.text);
            
            let matchResults = null;
            if (parsedData.ids.length > 0) {
                this.updateStatus('Auto-matching students...');
                matchResults = await this.autoMatchStudents(parsedData.ids);
            }
            
            this.updateStatus('Document processed successfully!');
            
            return {
                success: true,
                documentNumber: this.getCurrentDocumentNumber(),
                extractedData: parsedData,
                ocrConfidence: ocrResult.confidence,
                processingType: 'Full Document',
                matchResults: matchResults
            };
            
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
            throw error;
        } finally {
            this.isProcessing = false;
            setTimeout(() => this.updateStatus('Ready'), 3000);
        }
    }
    
    async processWithROI() {
        if (this.isProcessing) {
            throw new Error('Already processing a document');
        }
        
        const imgElement = document.querySelector(this.imageSelector);
        if (!imgElement) {
            throw new Error('No image found');
        }
        
        return new Promise((resolve) => {
            const snippingTool = new SnippingTool();
            
            snippingTool.activate(imgElement, async (coords) => {
                if (!coords) {
                    resolve({ cancelled: true });
                    return;
                }
                
                this.isProcessing = true;
                this.updateStatus('Processing selected area...');
                
                try {
                    const imageData = await this.extractWithROI(coords);
                    this.updateStatus('ROI extracted, running OCR...');
                    
                    const ocrResult = await this.sendToBackground('processOCR', imageData);
                    
                    if (!ocrResult.success) {
                        throw new Error('OCR processing failed');
                    }
                    
                    this.updateStatus('OCR complete, parsing data...');
                    const parsedData = this.parseDocumentText(ocrResult.text);
                    
                    let matchResults = null;
                    if (parsedData.ids.length > 0) {
                        this.updateStatus('Auto-matching students...');
                        matchResults = await this.autoMatchStudents(parsedData.ids);
                    }
                    
                    this.updateStatus('Processing complete!');
                    
                    resolve({
                        success: true,
                        documentNumber: this.getCurrentDocumentNumber(),
                        extractedData: parsedData,
                        ocrConfidence: ocrResult.confidence,
                        processingType: 'Selected Area',
                        matchResults: matchResults
                    });
                    
                } catch (error) {
                    this.updateStatus(`Error: ${error.message}`, 'error');
                    resolve({ error: error.message });
                } finally {
                    this.isProcessing = false;
                    setTimeout(() => this.updateStatus('Ready'), 3000);
                }
            });
        });
    }
    
    async autoMatchStudents(ids) {
        console.log('Starting auto-match for IDs:', ids);
        
        const results = {
            matched: [],
            failed: [],
            total: ids.length
        };
        
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            this.updateStatus(`Matching ${i + 1}/${ids.length}: ${id}`);
            
            try {
                const success = await this.matchSingleStudent(id);
                if (success) {
                    results.matched.push(id);
                } else {
                    results.failed.push(id);
                }
                
                await this.delay(500);
                
            } catch (error) {
                console.error(`Failed to match ${id}:`, error);
                results.failed.push(id);
            }
        }
        
        console.log('Auto-match results:', results);
        return results;
    }
    
async matchSingleStudent(studentId) {
    // Use the specific ID selector we found
    const searchInput = document.querySelector('#input--student-finder');
    
    if (!searchInput) {
        console.error('Search input not found');
        return false;
    }
    
    // Clear existing search
    searchInput.value = '';
    searchInput.focus();
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    await this.delay(300);
    
    // Enter the student ID
    searchInput.value = studentId;
    searchInput.focus();
    
    // Trigger multiple events to ensure Ember framework picks it up
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    
    // Wait for search results
    await this.delay(1200);
    
    // Find the checkbox for the matching student
    // Look for checkboxes that have the student ID in nearby text
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    
    for (const checkbox of allCheckboxes) {
        // Get the parent container (could be a div, li, or other element)
        const container = checkbox.closest('div, li, tr, label');
        
        if (container) {
            const containerText = container.textContent.trim();
            
            // Check if this container has the student ID
            if (containerText.includes(studentId)) {
                if (!checkbox.checked) {
                    console.log(`Found matching student: ${studentId}, clicking checkbox`);
                    checkbox.click();
                    await this.delay(400);
                    return true;
                } else {
                    console.log(`Student ${studentId} already matched`);
                    return true;
                }
            }
        }
    }
    
    console.log(`No checkbox found for student: ${studentId}`);
    return false;
}
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async extractWithROI(roiCoords) {
        const imgElement = document.querySelector(this.imageSelector);
        if (!imgElement) {
            throw new Error('Document image not found');
        }
        
        if (!imgElement.complete) {
            await this.waitForImageLoad(imgElement);
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = roiCoords.width;
        canvas.height = roiCoords.height;
        
        try {
            const corsImage = new Image();
            corsImage.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                corsImage.onload = resolve;
                corsImage.onerror = reject;
                corsImage.src = imgElement.src;
            });
            
            ctx.drawImage(
                corsImage,
                roiCoords.x, roiCoords.y, roiCoords.width, roiCoords.height,
                0, 0, roiCoords.width, roiCoords.height
            );
            
            return {
                success: true,
                dataURL: canvas.toDataURL('image/png'),
                width: roiCoords.width,
                height: roiCoords.height,
                documentNumber: this.getCurrentDocumentNumber(),
                timestamp: Date.now()
            };
            
        } catch (error) {
            throw new Error(`ROI extraction failed: ${error.message}`);
        }
    }
    
    async extractDocumentImage() {
        const imgElement = document.querySelector(this.imageSelector);
        
        if (!imgElement) {
            throw new Error('Document image not found');
        }
        
        if (!imgElement.complete) {
            await this.waitForImageLoad(imgElement);
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        try {
            canvas.width = imgElement.naturalWidth;
            canvas.height = imgElement.naturalHeight;
            
            const corsImage = new Image();
            corsImage.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                corsImage.onload = resolve;
                corsImage.onerror = reject;
                corsImage.src = imgElement.src;
            });
            
            ctx.drawImage(corsImage, 0, 0);
            
            ctx.filter = 'contrast(130%) brightness(110%) saturate(0%)';
            ctx.drawImage(corsImage, 0, 0);
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
            throw new Error(`Canvas extraction failed: ${error.message}`);
        }
    }
    
    waitForImageLoad(imgElement) {
        return new Promise((resolve, reject) => {
            if (imgElement.complete) {
                resolve();
            } else {
                imgElement.onload = () => resolve();
                imgElement.onerror = () => reject(new Error('Image failed to load'));
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
    
    parseDocumentText(text) {
        console.log('Parsing OCR text:', text);
        
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        const parsed = {
            names: [],
            ids: [],
            phones: [],
            rawText: text
        };
        
        const patterns = {
            name: /(?:name|student|contact)\s*:?\s*([a-zA-Z\s]{2,30})/gi,
            id: /(?:id|student\s*id|number)\s*:?\s*([0-9]{6,12})/gi,
            phone: /(?:phone|tel|telephone)\s*:?\s*([\(\)\-\s0-9]{10,20})/gi,
            nameAlt: /([A-Z][a-z]+\s+[A-Z][a-z]+)(?=\s|$)/g,
            idAlt: /\b([0-9]{8,12})\b/g
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            let match = patterns.name.exec(line);
            if (match) {
                const name = match[1].trim();
                if (name.length > 2 && name.includes(' ')) {
                    parsed.names.push(name);
                    continue;
                }
            }
            
            match = patterns.id.exec(line);
            if (match) {
                parsed.ids.push(match[1].trim());
                continue;
            }
            
            match = patterns.phone.exec(line);
            if (match) {
                parsed.phones.push(match[1].trim());
                continue;
            }
        }
        
        if (parsed.names.length === 0) {
            const nameMatches = text.match(patterns.nameAlt);
            if (nameMatches) {
                parsed.names = nameMatches.slice(0, 5);
            }
        }
        
        if (parsed.ids.length === 0) {
            const idMatches = text.match(patterns.idAlt);
            if (idMatches) {
                parsed.ids = idMatches.slice(0, 5);
            }
        }
        
        console.log('Parsed data:', parsed);
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CrowdmarkProcessor();
    });
} else {
    new CrowdmarkProcessor();
}