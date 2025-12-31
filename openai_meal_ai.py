import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def recommend_meals(profile):
    prompt = f"""
You are a nutrition assistant.

Recommend:
- Breakfast
- Lunch
- Dinner
- Snack

Rules:
- ONLY food names
- NO calories
- NO nutrition numbers
- Foods must match common food database names

User profile:
Age: {profile['age']}
Gender: {profile['gender']}
Weight: {profile['weight']} kg
Height: {profile['height']} cm
Activity: {profile['activity']}
Preferences: {", ".join(profile['preferences'])}

Return JSON exactly:
{{
  "breakfast": ["food1", "food2"],
  "lunch": ["food1", "food2"],
  "dinner": ["food1", "food2"],
  "snack": ["food1"]
}}
"""

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6
    )

    return eval(res.choices[0].message.content)
