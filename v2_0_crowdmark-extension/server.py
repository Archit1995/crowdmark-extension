import cv2
import numpy as np
from PIL import Image
from optimum.onnxruntime import ORTModelForVision2Seq
from flask import Flask, request, jsonify
from transformers import TrOCRProcessor, logging
import time
import re,io
from flask_cors import CORS
import base64

logging.set_verbosity_error()
app=Flask(__name__)
CORS(app)

# Load the ONNX model and processor once at startup
processor = TrOCRProcessor.from_pretrained("/home/archit/blackwell_TrOCR/trocr_onnx/", use_fast=True)
model = ORTModelForVision2Seq.from_pretrained("/home/archit/blackwell_TrOCR/trocr_onnx/", provider="CUDAExecutionProvider")




def detect_text_regions(image: Image.Image) -> list[Image.Image]:
    img_cv = np.array(image)
    gray = cv2.cvtColor(img_cv, cv2.COLOR_RGB2GRAY)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    # Dilate horizontally to merge characters into lines
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 5))
    dilated = cv2.dilate(binary, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    regions = []
    for cnt in sorted(contours, key=lambda c: cv2.boundingRect(c)[1]):
        x, y, w, h = cv2.boundingRect(cnt)

        # Filter noise — too small
        if w < 50 or h < 10:
            continue

        # Filter very tall regions — likely images not text
        if h > 150:
            continue
        region_np = img_cv[y:y+h, x:x+w]
        regions.append(image.crop((x, y, x + w, y + h)))

    return regions


# Common OCR confusions for digits
CHAR_CORRECTIONS = {
    'S': '5', 's': '5',
    'O': '0', 'o': '0',
    'I': '1', 'l': '1', 'i': '1',
    'Z': '2',
    'B': '8',
    'G': '6',
    'T': '7',
}

def correct_digit_string(text: str) -> str:
    """Fix common character misrecognitions in digit sequences."""
    text = text.replace(" ", "")# Remove spaces
    corrected = ''
    for char in text:
        corrected += CHAR_CORRECTIONS.get(char, char)
    # Strip anything that's still not a digit

    digits_only= re.sub(r'\D', '', corrected)
    if len(digits_only) >= 3:
        digits_only = '301' + digits_only[3:]
    return digits_only


def ocr_single_line(image: Image.Image) -> str:
    pixel_values = processor(images=image.convert("RGB"), return_tensors="pt").pixel_values.to("cuda")
    generated_ids = model.generate(pixel_values)
    return processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

@app.route('/ocr', methods=['POST'])#accept POST request as input at /ocr endpoint
def process_ocr():
    start_time = time.time()
    
    try:
        data = request.json # parse the incoming JSON data
        if not data or 'image' not in data:
            return jsonify({'success': False, 'error': 'No image data provided'}), 400

        image_data = data['image']
        if ',' in image_data:
            image_data = image_data.split(',')[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

        print(f"Processing image size: {image.size}")

        start = time.time()
        regions = detect_text_regions(image)
        print(f"Found {len(regions)} text regions")

        results = []

        results = []
        for i, region in enumerate(regions):
            text = correct_digit_string(ocr_single_line(region).strip())
            if text:
                print(f"Line {i+1}: {text}")
                results.append(text)

        print(f"Total time: {time.time() - start:.2f}s")
        return jsonify({
            'success': True,
            'results': results,
            'processing_time': round((time.time() - start_time) * 1000, 2)
        })
    
        # extracted_data = {'success': True,'lines': [],'processing_time': round((time.time() - start_time) * 1000, 2)}
        # for i, region in enumerate(regions):
        #     text = correct_digit_string(ocr_single_line(region).strip())
        #     if text:
        #         print(f"Line {i+1}: {text}")
        #         extracted_data['lines'].append({'text': text})

        # print(f"Total time: {time.time() - start:.2f}s")
        # print("returning ",jsonify(extracted_data))
        # return jsonify(extracted_data)

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    

if __name__ == "__main__":
    app.run(host='localhost', port=5000,debug=False)
    

