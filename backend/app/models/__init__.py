"""
Tập hợp tất cả các Model để SQLAlchemy nhận diện khi khởi tạo Base.metadata.create_all().
"""
from app.models.user import User, UserProfile
from app.models.food import Food, FoodNutrition, FoodServing, FoodTopping
from app.models.recipe import Ingredient, Recipe, RecipeIngredient
from app.models.meal_log import MealLog, MealLogItem, AIFeedbackLog

__all__ = [
    "User",
    "UserProfile",
    "Food",
    "FoodNutrition",
    "FoodServing",
    "FoodTopping",
    "Ingredient",
    "Recipe",
    "RecipeIngredient",
    "MealLog",
    "MealLogItem",
    "AIFeedbackLog",
]
