from nutrition_csv import match_food
from openai_meal_ai import recommend_meals

# BMR & TDEE
def calculate_bmr(gender, weight, height, age):
    if gender.lower() == "male":
        return 10 * weight + 6.25 * height - 5 * age + 5
    return 10 * weight + 6.25 * height - 5 * age - 161


def activity_multiplier(level):
    mapping = {
        "sedentary": 1.2,
        "lightly": 1.375,
        "moderately": 1.55,
        "very": 1.725
    }
    for k, v in mapping.items():
        if k in level.lower():
            return v
    return 1.2

def generate_title(items):
    """
    Generate short, natural meal title from main items
    """
    if not items:
        return "Healthy Meal"

    main_items = items[:2]
    title = " & ".join(main_items)
    return title.title()


def generate_desc(meal_type, items):
    """
    Generate concise, relevant description
    """
    base_desc = {
        "Breakfast": "Light and energizing meal to start your day.",
        "Lunch": "Balanced meal to keep you full and focused.",
        "Dinner": "Nourishing meal for recovery and satiety.",
        "Snack": "Simple snack to curb hunger between meals."
    }

    if not items:
        return base_desc.get(meal_type, "")

    key_food = items[0].lower()

    if any(x in key_food for x in ["chicken", "egg", "fish", "beef"]):
        focus = "High in protein"
    elif any(x in key_food for x in ["rice", "bread", "oats", "potato"]):
        focus = "Rich in carbohydrates"
    elif any(x in key_food for x in ["fruit", "vegetable", "salad"]):
        focus = "Rich in fiber and vitamins"
    else:
        focus = "Balanced nutrition"

    return f"{focus} for your {meal_type.lower()}."

# GENERATE MEAL PLAN
def generate_meal_plan(form):
    bmr = calculate_bmr(
        form["gender"],
        form["weight"],
        form["height"],
        form["age"]
    )

    tdee = int(bmr * activity_multiplier(form["activity"]))

    meals_ai = recommend_meals(form)

    summary = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    meals = []

    for meal_type, foods in meals_ai.items():
        meal_cal = 0
        items = []

        for food in foods:
            data = match_food(food)
            if not data:
                continue

            items.append(data["food"])

            meal_cal += data.get("caloric value", 0)
            summary["calories"] += data.get("caloric value", 0)
            summary["protein"] += data.get("protein", 0)
            summary["carbs"] += data.get("carbohydrates", 0)
            summary["fat"] += data.get("fat", 0)

        meal_type_cap = meal_type.capitalize()

        meals.append({
            "type": meal_type_cap,
            "title": generate_title(items),
            "desc": generate_desc(meal_type_cap, items),
            "calories": round(meal_cal),
            "items": items
        })

    return {
        "target_calories": tdee,
        "summary": {k: round(v) for k, v in summary.items()},
        "meals": meals
    }
