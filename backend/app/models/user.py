"""
Model định nghĩa Người dùng (User) và Hồ sơ thể trạng / Dinh dưỡng (UserProfile).
Tối ưu hóa cho PostgreSQL: JSONB cho danh sách dị ứng, Numeric cho các chỉ số cơ thể.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
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
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

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
    height_cm = Column(Numeric(5, 1), nullable=False, default=170.0)
    weight_kg = Column(Numeric(5, 1), nullable=False, default=65.0)
    activity_level = Column(Numeric(4, 3), default=1.375)  # 1.2, 1.375, 1.55, 1.725, 1.9
    goal = Column(String(20), default="maintain")  # 'lose_weight', 'maintain', 'gain_weight'
    diet_type = Column(String(30), default="normal")  # 'normal', 'vegetarian', 'vegan', 'lowcarb'

    # Ràng buộc an toàn: Dị ứng thực phẩm và nguyên liệu không thích (JSONB chuẩn PostgreSQL)
    allergies = Column(JSONB, default=list)  # Danh sách dị ứng: ["seafood", "peanut", "milk", ...]
    disliked_ingredients = Column(JSONB, default=list)  # Nguyên liệu ghét: ["hành lá", "mắm tôm", ...]

    # Chỉ số tính toán tự động
    bmi = Column(Numeric(4, 1), nullable=True)
    bmr = Column(Numeric(6, 1), nullable=True)
    tdee = Column(Numeric(6, 1), nullable=True)
    target_calories = Column(Numeric(6, 1), nullable=True)
    target_protein_g = Column(Numeric(6, 1), nullable=True)
    target_carb_g = Column(Numeric(6, 1), nullable=True)
    target_fat_g = Column(Numeric(6, 1), nullable=True)

    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Quan hệ ngược lại với User
    user = relationship("User", back_populates="profile")

