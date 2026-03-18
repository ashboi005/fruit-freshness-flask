import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv

PUBLIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public"))
ENV_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".env"))

# Load environment variables from api/.env if it exists
load_dotenv(ENV_FILE)

app = Flask(__name__)
CORS(app)

def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set")
    return Groq(api_key=api_key)


@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_frontend(path):
    if path.startswith('api/'):
        return jsonify({"error": "Not Found"}), 404

    file_path = os.path.join(PUBLIC_DIR, path)
    if os.path.isfile(file_path):
        return send_from_directory(PUBLIC_DIR, path)
    return send_from_directory(PUBLIC_DIR, 'index.html')

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        client = get_groq_client()

        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({"error": "No image provided"}), 400

        base64_image = data['image']
        
        if ',' in base64_image:
            base64_image = base64_image.split(',')[1]

        messages = [
            {
                "role": "system",
                "content": "You are an expert agricultural AI. Analyze the image of the fruit for blemishes, mold, or discoloration. You must respond strictly in valid JSON format: {\"status\": \"Fresh\" | \"Rotten\", \"confidence\": <number between 0-100>, \"reason\": \"<1-2 sentence explanation>\"}."
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Analyze this fruit and return the JSON response."
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ]

        chat_completion = client.chat.completions.create(
            messages=messages,
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            response_format={"type": "json_object"},
            temperature=0.1
        )

        response_content = chat_completion.choices[0].message.content
        result = json.loads(response_content)
        
        return jsonify(result), 200

    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        err_text = str(e)
        if "invalid_api_key" in err_text or "Error code: 401" in err_text:
            return jsonify({"error": "Groq rejected the API key. Recheck GROQ_API_KEY in api/.env."}), 401
        print(f"Error: {err_text}")
        return jsonify({"error": "Failed to analyze image", "details": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=8080)
