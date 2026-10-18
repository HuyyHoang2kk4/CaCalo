"""
Model định nghĩa Món ăn (Food), Bảng dinh dưỡng chuẩn 100g (FoodNutrition),
Khẩu phần chuẩn (FoodServing), và Topping ăn kèm (FoodTopping).
Tối ưu hóa cho PostgreSQL: Sử dụng Numeric để đảm bảo độ chính xác tuyệt đối của dinh dưỡng.
"""
from sqlalchemy import Column, String, Integer, Numeric, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False, index=True)  # Có dấu: "Phở bò tái"
    name_unsigned = Column(String(150), nullable=False, index=True)  # Không dấu: "pho bo tai"
    category = Column(String(50), default="Món chính")  # "Món chính", "Món nước", "Món xào", "Đồ ăn vặt", "Đồ uống"
    image_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    source = Column(String(100), default="Viện Dinh dưỡng Quốc gia")  # Nguồn tham chiếu

    # Quan hệ 1-1 với Bảng thành phần dinh dưỡng chuẩn trên 100g
    nutrition = relationship("FoodNutrition", back_populates="food", uselist=False, cascade="all, delete-orphan")
    # Quan hệ 1-N với các Đơn vị khẩu phần (Tô vừa, Bát, Đĩa...)
    servings = relationship("FoodServing", back_populates="food", cascade="all, delete-orphan")
    # Quan hệ 1-N với Topping tùy chọn đi kèm
    toppings = relationship("FoodTopping", back_populates="food", cascade="all, delete-orphan")


class FoodNutrition(Base):
    __tablename__ = "food_nutritions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    food_id = Column(Integer, ForeignKey("foods.id", ondelete="CASCADE"), unique=True, nullable=False)

    per_gram = Column(Numeric(6, 1), default=100.0)  # Chuẩn hóa trên 100g
    calories_kcal = Column(Numeric(6, 1), nullable=False)
    protein_g = Column(Numeric(5, 1), nullable=False)
    carb_g = Column(Numeric(5, 1), nullable=False)
    fat_g = Column(Numeric(5, 1), nullable=False)
    fiber_g = Column(Numeric(5, 1), default=0.0)
    sugar_g = Column(Numeric(5, 1), default=0.0)
    sodium_mg = Column(Numeric(7, 1), default=0.0)

    food = relationship("Food", back_populates="nutrition")


class FoodServing(Base):
    __tablename__ = "food_servings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    food_id = Column(Integer, ForeignKey("foods.id", ondelete="CASCADE"), nullable=False)

    unit_name = Column(String(50), nullable=False)  # "Tô vừa", "Bát", "Đĩa", "Cái", "Gói"
    weight_gram = Column(Numeric(6, 1), nullable=False)  # Khối lượng quy đổi chuẩn ra gram
    is_default = Column(Boolean, default=False)  # Là khẩu phần chuẩn mặc định (Cỡ vừa 1.0x)

    food = relationship("Food", back_populates="servings")


class FoodTopping(Base):
    __tablename__ = "food_toppings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    food_id = Column(Integer, ForeignKey("foods.id", ondelete="CASCADE"), nullable=False)

    name = Column(String(100), nullable=False)  # "+1 Trứng chần", "+1 Quẩy giòn", "Bỏ nước béo"
    weight_gram = Column(Numeric(6, 1), default=0.0)
    calories_kcal = Column(Numeric(6, 1), default=0.0)
    protein_g = Column(Numeric(5, 1), default=0.0)
    carb_g = Column(Numeric(5, 1), default=0.0)
    fat_g = Column(Numeric(5, 1), default=0.0)

    food = relationship("Food", back_populates="toppings")

