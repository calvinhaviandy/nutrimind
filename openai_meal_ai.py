import json

from openai import OpenAI
from config import OPENAI_MODEL

from nutrition_csv import get_food_exact


class MealPlanResponseError(ValueError):
    """The AI response did not contain a usable meal plan."""


# Each name is a real row in the bundled food dataset. Values in the generated
# plan come from those rows, whose serving sizes vary by food.
MEAL_FOODS = (
    "oats", "oat bran cooked", "scrambled eggs", "poached egg", "egg boiled",
    "greek yogurt", "yogurt", "soymilk", "banana", "apple", "pear",
    "blueberries", "orange", "whole wheat bread", "peanut butter",
    "almonds roasted", "avocado", "brown rice cooked", "white rice cooked",
    "quinoa cooked", "sweet potato baked", "baked potato", "chickpeas cooked",
    "lentils cooked", "black beans cooked", "chicken breast cooked",
    "coho salmon cooked", "tuna canned", "ground beef cooked", "tofu raw",
    "tempeh cooked", "broccoli cooked", "spinach cooked", "carrots cooked",
    "cauliflower cooked", "cucumber", "tomato cooked", "romaine lettuce",
    "olive oil",
)
MEAL_TYPES = ("breakfast", "lunch", "dinner", "snack")


def _catalog():
    catalog = {name: get_food_exact(name) for name in MEAL_FOODS}
    if any(data is None for data in catalog.values()):
        raise MealPlanResponseError("Database makanan untuk rencana makan belum lengkap.")
    return catalog


def _parse_meals(content, catalog):
    try:
        meals = json.loads(content)
    except (TypeError, json.JSONDecodeError) as exc:
        raise MealPlanResponseError("Rencana makan dari AI tidak valid. Silakan coba lagi.") from exc

    if not isinstance(meals, dict):
        raise MealPlanResponseError("Rencana makan dari AI tidak valid. Silakan coba lagi.")

    names = {name.casefold(): name for name in catalog}
    result = {}
    for meal_type in MEAL_TYPES:
        foods = meals.get(meal_type)
        if not isinstance(foods, list) or not foods:
            raise MealPlanResponseError("Rencana makan dari AI tidak lengkap. Silakan coba lagi.")
        result[meal_type] = []
        for food in foods:
            if not isinstance(food, str) or food.strip().casefold() not in names:
                raise MealPlanResponseError(
                    "AI memilih makanan di luar database nutrisi. Silakan coba lagi."
                )
            result[meal_type].append(names[food.strip().casefold()])
    return result


def recommend_meals(profile, target_calories):
    catalog = _catalog()
    food_options = "\n".join(
        f"- {name}: {round(data['caloric value'])} kcal per dataset serving"
        for name, data in catalog.items()
    )
    preferences = ", ".join(profile["preferences"]) or "none"
    prompt = f"""Create a one-day meal plan for this person:
Age: {profile['age']}
Gender: {profile['gender']}
Weight: {profile['weight']} kg
Height: {profile['height']} cm
Activity: {profile['activity']}
Dietary preferences: {preferences}
Estimated daily energy target: {target_calories} kcal

Select ONLY exact food names from the following catalog. The calorie values
come from its recorded serving sizes; aim reasonably close to the target
without inventing quantities or nutrition numbers. Honor dietary preferences.
Choose 2-4 foods for breakfast, lunch and dinner, and 1-3 foods for snack.
Use a varied, practical combination of foods. Do not repeat a food within a meal.

Catalog:
{food_options}

Return a JSON object with exactly four keys: breakfast, lunch, dinner, snack.
Each value must be an array of catalog food names. No prose or extra keys."""
    messages = [
        {"role": "system", "content": "You are a nutrition assistant. Respond with valid JSON only."},
        {"role": "user", "content": prompt},
    ]

    for attempt in range(2):
        response = OpenAI().chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            reasoning_effort="low",
        )
        content = response.choices[0].message.content if response.choices else None
        try:
            return _parse_meals(content, catalog)
        except MealPlanResponseError:
            if attempt:
                raise
            if content:
                messages.append({"role": "assistant", "content": content})
            messages.append({
                "role": "user",
                "content": "Your previous plan used an invalid or missing catalog name. "
                "Try again and use only exact names from the catalog for all four meals. "
                "Return only a valid JSON object.",
            })
