"""
Model định nghĩa Nhật ký bữa ăn (MealLog, MealLogItem) và Bản ghi sửa lỗi AI (AIFeedbackLog).
"""
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class MealLog(Base):
    __tablename__ = "meal_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    log_date = Column(Date, default=date.today, nullable=False, index=True)
    meal_type = Column(String(20), nullable=False)  # 'breakfast', 'lunch', 'dinner', 'snack'

    total_calories = Column(Float, default=0.0)
    total_protein = Column(Float, default=0.0)
    total_carb = Column(Float, default=0.0)
    total_fat = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="meal_logs")
    items = relationship("MealLogItem", back_populates="meal_log", cascade="all, delete-orphan")


class MealLogItem(Base):
    __tablename__ = "meal_log_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meal_log_id = Column(Integer, ForeignKey("meal_logs.id", ondelete="CASCADE"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.id", ondelete="SET NULL"), nullable=True)

    food_name = Column(String(150), nullable=False)
    portion_size = Column(String(20), default="M (1.0x)")  # S, M, L hoặc số gram cụ thể
    actual_gram = Column(Float, nullable=False)

    calories = Column(Float, nullable=False)
    protein = Column(Float, default=0.0)
    carb = Column(Float, default=0.0)
    fat = Column(Float, default=0.0)

    # Danh sách toppings đã chọn (lưu dạng JSON string)
    toppings_applied = Column(Text, default="[]")
    image_proof_url = Column(String(500), nullable=True)

    meal_log = relationship("MealLog", back_populates="items")
    food = relationship("Food")


class AIFeedbackLog(Base):
    __tablename__ = "ai_feedback_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    original_image_url = Column(String(500), nullable=True)
    predicted_label = Column(String(150), nullable=False)  # Nhãn AI dự đoán
    confidence_score = Column(Float, nullable=True)  # Điểm tin cậy (0.0 - 1.0)
    user_corrected_label = Column(String(150), nullable=False)  # Nhãn người dùng chốt sửa lại

    status = Column(String(20), default="pending")  # 'pending', 'reviewed', 'approved'
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedbacks")
