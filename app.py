from flask import Flask, render_template, request, jsonify
import requests
import base64
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze_image():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        image_data = data.get('image') # Base64 encoded image
        api_key = data.get('api_key')
        endpoint = data.get('endpoint')

        if not api_key or not endpoint:
            return jsonify({'error': 'Azure API key and endpoint are required'}), 400

        # Azure Computer Vision API
        headers = {
            'Ocp-Apim-Subscription-Key': api_key,
            'Content-Type': 'application/octet-stream'
        }
        
        # Ensure we have clean base64 data
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        try:
            binary_data = base64.b64decode(image_data)
        except Exception as e:
            return jsonify({'error': f'Invalid image data: {str(e)}'}), 400
        
        # Prepare Azure endpoint for description and face detection
        # If user provides a base endpoint, we append the necessary parameters
        azure_url = endpoint
        if '/vision/' not in azure_url:
            # Fallback for common base URL format
            azure_url = f"{endpoint.rstrip('/')}/vision/v3.2/analyze?visualFeatures=Description,Tags,Faces"
        elif 'visualFeatures' not in azure_url:
            separator = '&' if '?' in azure_url else '?'
            azure_url = f"{azure_url}{separator}visualFeatures=Description,Tags,Faces"
        else:
            # If visualFeatures is already present, ensure Faces is included
            if 'Faces' not in azure_url:
                azure_url = azure_url.replace('visualFeatures=', 'visualFeatures=Faces,')

        response = requests.post(azure_url, headers=headers, data=binary_data)
        
        if not response.ok:
            error_msg = response.text
            try:
                error_json = response.json()
                error_msg = error_json.get('error', {}).get('message', response.text)
            except:
                pass
            return jsonify({'error': f'Azure API Error: {error_msg}'}), response.status_code

        result = response.json()
        
        # Extract description from Azure response
        description = "No description found."
        if 'description' in result and 'captions' in result['description']:
            captions = result['description']['captions']
            if captions:
                description = captions[0].get('text', description)
        elif 'tags' in result:
            tags = [tag['name'] for tag in result['tags'][:5]]
            description = f"I see: {', '.join(tags)}"

        # Extract Face information
        faces = []
        if 'faces' in result:
            for face in result['faces']:
                faces.append({
                    'age': face.get('age', 'Unknown'),
                    'gender': face.get('gender', 'Unknown'),
                    'boundingBox': face.get('faceRectangle', {})
                })

        return jsonify({
            'description': description,
            'faces': faces
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
