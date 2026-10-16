"""
Model định nghĩa Người dùng (User) và Hồ sơ thể trạng / Dinh dưỡng (UserProfile).
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), default="user")  # 'user' hoặc 'admin'
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Quan hệ 1-1 với Hồ sơ thể trạng
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    # Quan hệ 1-N với Nhật ký bữa ăn
    meal_logs = relationship("MealLog", back_populates="user", cascade="all, delete-orphan")
    # Quan hệ 1-N với Lịch sử sửa lỗi AI
    feedbacks = relationship("AIFeedbackLog", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    gender = Column(String(10), default="male")  # 'male' hoặc 'female'
    birth_year = Column(Integer, default=2000)
    height_cm = Column(Float, nullable=False, default=170.0)
    weight_kg = Column(Float, nullable=False, default=65.0)
    activity_level = Column(Float, default=1.375)  # 1.2: Ít vận động, 1.375: Nhẹ, 1.55: Vừa, 1.725: Nặng, 1.9: Rất nặng
    goal = Column(String(20), default="maintain")  # 'lose_weight', 'maintain', 'gain_weight'
    diet_type = Column(String(30), default="normal")  # 'normal', 'vegetarian', 'vegan', 'lowcarb'

    # Ràng buộc an toàn: Dị ứng thực phẩm và nguyên liệu không thích (lưu dạng chuỗi JSON)
    allergies = Column(Text, default="[]")  # Danh sách dị ứng: ["seafood", "peanut", "milk", ...]
    disliked_ingredients = Column(Text, default="[]")  # Nguyên liệu ghét: ["hành lá", "mắm tôm", ...]

    # Chỉ số tính toán tự động
    bmi = Column(Float, nullable=True)
    bmr = Column(Float, nullable=True)
    tdee = Column(Float, nullable=True)
    target_calories = Column(Float, nullable=True)
    target_protein_g = Column(Float, nullable=True)
    target_carb_g = Column(Float, nullable=True)
    target_fat_g = Column(Float, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Quan hệ ngược lại với User
    user = relationship("User", back_populates="profile")
