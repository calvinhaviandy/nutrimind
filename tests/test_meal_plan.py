import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from meal_engine import generate_meal_plan
from openai_meal_ai import MealPlanResponseError


PROFILE = {
    "age": 28,
    "gender": "female",
    "weight": 62,
    "height": 168,
    "activity": "moderately active",
    "preferences": ["Indonesian meals"],
}
KNOWN_MEALS = {
    "breakfast": ["oats", "greek yogurt", "banana"],
    "lunch": ["white rice cooked", "chicken breast cooked", "broccoli cooked"],
    "dinner": ["quinoa cooked", "coho salmon cooked", "spinach cooked"],
    "snack": ["apple", "almonds roasted"],
}
UNKNOWN_MEALS = {meal: ["nasi putih"] for meal in KNOWN_MEALS}


def completion(meals):
    return SimpleNamespace(choices=[SimpleNamespace(
        message=SimpleNamespace(content=json.dumps(meals))
    )])


class MealPlanTests(unittest.TestCase):
    @patch("openai_meal_ai.OpenAI")
    def test_exact_catalog_foods_produce_visible_plan_with_dataset_nutrition(self, openai):
        openai.return_value.chat.completions.create.return_value = completion(KNOWN_MEALS)

        plan = generate_meal_plan(PROFILE)

        self.assertEqual(len(plan["meals"]), 4)
        self.assertTrue(all(meal["items"] and meal["calories"] > 0 for meal in plan["meals"]))
        self.assertEqual(plan["summary"]["calories"], sum(meal["calories"] for meal in plan["meals"]))
        self.assertGreater(plan["summary"]["protein"], 0)
        self.assertGreater(plan["summary"]["carbs"], 0)
        self.assertGreater(plan["summary"]["fat"], 0)

    @patch("openai_meal_ai.OpenAI")
    def test_unknown_food_retries_then_recovers(self, openai):
        create = openai.return_value.chat.completions.create
        create.side_effect = [completion(UNKNOWN_MEALS), completion(KNOWN_MEALS)]

        plan = generate_meal_plan(PROFILE)

        self.assertEqual(create.call_count, 2)
        self.assertTrue(all(meal["items"] for meal in plan["meals"]))

    @patch("openai_meal_ai.OpenAI")
    def test_unknown_food_never_returns_empty_success(self, openai):
        openai.return_value.chat.completions.create.return_value = completion(UNKNOWN_MEALS)

        with self.assertRaises(MealPlanResponseError):
            generate_meal_plan(PROFILE)


if __name__ == "__main__":
    unittest.main()
