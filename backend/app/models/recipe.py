"""
Model định nghĩa Nguyên liệu tủ lạnh (Ingredient) và Công thức nấu ăn gợi ý (Recipe).
"""
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True, index=True)  # Có dấu: "Ức gà"
    name_unsigned = Column(String(100), nullable=False, index=True)  # Không dấu: "uc ga"
    category = Column(String(50), default="Rau củ")  # "Thịt cá", "Rau củ", "Trứng sữa", "Gia vị", "Tinh bột"
    calories_per_100g = Column(Float, default=100.0)
    allergen_tag = Column(String(50), nullable=True)  # "seafood", "peanut", "milk", "gluten", "soy" hoặc None

    recipes = relationship("RecipeIngredient", back_populates="ingredient")


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=False)  # JSON mảng các bước nấu: ["Bước 1: ...", "Bước 2: ..."]
    prep_time_minutes = Column(Integer, default=15)
    cook_time_minutes = Column(Integer, default=20)
    total_calories = Column(Float, nullable=False)
    protein_g = Column(Float, default=0.0)
    carb_g = Column(Float, default=0.0)
    fat_g = Column(Float, default=0.0)
    servings_yield = Column(Integer, default=1)  # Khẩu phần phục vụ cho mấy người

    # Quan hệ 1-N với bảng liên kết nguyên liệu
    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False)
    amount_gram = Column(Float, nullable=False)  # Định lượng tính bằng gram

    recipe = relationship("Recipe", back_populates="ingredients")
    ingredient = relationship("Ingredient", back_populates="recipes")
