from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI()

def analyze_food_image(base64_image: str) -> str:
    """
    base64_image: PURE base64 (tanpa data:image/... prefix)
    """

    data_url = f"data:image/jpeg;base64,{base64_image}"

    response = client.responses.create(
        model="gpt-4.1-mini",
        input=[{
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": (
                        "Identify the food in this image as a SINGLE specific food name "
                        "commonly used in nutrition databases. "
                        "Return ONLY the food name."
                    )
                },
                {
                    "type": "input_image",
                    "image_url": data_url,
                    "detail": "low"
                }
            ]
        }]
    )

    return response.output_text.strip().lower()
