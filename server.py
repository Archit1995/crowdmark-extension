from flask import Flask, request, jsonify
from flask_cors import CORS
from paddleocr import PaddleOCR
import base64
import io
from PIL import Image
import numpy as np
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

# Initialize PaddleOCR once at startup - minimal parameters like your working script
print("Initializing PaddleOCR...")
ocr = PaddleOCR(
    lang='en',
    device='gpu'
)
print("PaddleOCR initialized successfully!")

@app.route('/ocr', methods=['POST'])
def process_ocr():
    start_time = time.time()
    
    try:
        # Get base64 image from request
        data = request.json
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': 'No image data provided'}), 400
        
        image_data = data['image']
        
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        # Decode base64 image
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to numpy array
        img_array = np.array(image)
        
        print(f"Processing image: {img_array.shape}")
        
        # Run OCR using predict method like in fast_paddle.py
        result = ocr.predict(img_array)
        
        # Format output as JSON
        extracted_data = {
            'success': True,
            'lines': [],
            'processing_time': round((time.time() - start_time) * 1000, 2)
        }
        
        # Parse result based on fast_paddle.py format
        if isinstance(result, list) and len(result) > 0:
            for page in result:
                if isinstance(page, dict):
                    rec_texts = page.get('rec_texts', [])
                    rec_scores = page.get('rec_scores', [])
                    
                    for i, text in enumerate(rec_texts):
                        confidence = rec_scores[i] if i < len(rec_scores) else 0.0
                        extracted_data['lines'].append({
                            'text': text,
                            'confidence': float(confidence)
                        })
            
            print(f"OCR completed: {len(extracted_data['lines'])} lines detected")
        else:
            print("No text detected in image")
        
        return jsonify(extracted_data)
        
    except Exception as e:
        print(f"Error processing OCR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'processing_time': round((time.time() - start_time) * 1000, 2)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'ocr_ready': True})

if __name__ == '__main__':
    print("\n" + "="*50)
    print("PaddleOCR Server Starting...")
    print("Server will run on: http://localhost:5000")
    print("="*50 + "\n")
    app.run(host='localhost', port=5000, debug=False)