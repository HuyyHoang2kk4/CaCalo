"""
Model định nghĩa Nhật ký bữa ăn (MealLog, MealLogItem) và Bản ghi sửa lỗi AI (AIFeedbackLog).
Tối ưu hóa chuyên biệt cho PostgreSQL: Sử dụng JSONB, Numeric và lưu trữ MLOps metadata.
"""
from datetime import datetime, date, timezone
from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class MealLog(Base):
    __tablename__ = "meal_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    log_date = Column(Date, default=date.today, nullable=False, index=True)
    meal_type = Column(String(20), nullable=False)  # 'breakfast', 'lunch', 'dinner', 'snack'

    # Sử dụng Numeric để triệt tiêu sai số làm tròn thập phân trong pgAdmin
    total_calories = Column(Numeric(7, 1), default=0.0)
    total_protein = Column(Numeric(6, 1), default=0.0)
    total_carb = Column(Numeric(6, 1), default=0.0)
    total_fat = Column(Numeric(6, 1), default=0.0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="meal_logs")
    items = relationship("MealLogItem", back_populates="meal_log", cascade="all, delete-orphan")


class MealLogItem(Base):
    __tablename__ = "meal_log_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meal_log_id = Column(Integer, ForeignKey("meal_logs.id", ondelete="CASCADE"), nullable=False)
    food_id = Column(Integer, ForeignKey("foods.id", ondelete="SET NULL"), nullable=True)
    serving_id = Column(Integer, ForeignKey("food_servings.id", ondelete="SET NULL"), nullable=True)

    food_name = Column(String(150), nullable=False)
    portion_size = Column(String(50), default="M (1.0x)")  # Nhãn khẩu phần (S, M, L)
    portion_multiplier = Column(Numeric(4, 2), default=1.0)  # Hệ số nhân tính toán (0.75, 1.0, 1.25)
    actual_gram = Column(Numeric(6, 1), nullable=False)

    calories = Column(Numeric(7, 1), nullable=False)
    protein = Column(Numeric(6, 1), default=0.0)
    carb = Column(Numeric(6, 1), default=0.0)
    fat = Column(Numeric(6, 1), default=0.0)

    # Danh sách toppings đã chọn (sử dụng JSONB chuẩn PostgreSQL)
    toppings_applied = Column(JSONB, default=list)
    image_proof_url = Column(String(500), nullable=True)

    meal_log = relationship("MealLog", back_populates="items")
    food = relationship("Food")
    serving = relationship("FoodServing")


class AIFeedbackLog(Base):
    __tablename__ = "ai_feedback_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    original_image_url = Column(String(500), nullable=True)
    model_version = Column(String(50), default="gemini-1.5-flash-vision")  # Phiên bản mô hình AI

    # Lưu trữ toàn bộ kết quả Top-K AI dự đoán dạng JSONB: [{"label": "Phở bò", "score": 0.88}, ...]
    raw_predictions = Column(JSONB, default=list, nullable=False)
    predicted_label = Column(String(150), nullable=False)  # Nhãn AI dự đoán cao nhất
    confidence_score = Column(Numeric(4, 3), nullable=True)  # Điểm tin cậy (0.000 - 1.000)
    
    # Nhãn chuẩn do người dùng sửa lại
    user_corrected_label = Column(String(150), nullable=False)
    corrected_food_id = Column(Integer, ForeignKey("foods.id", ondelete="SET NULL"), nullable=True)

    status = Column(String(50), default="pending", index=True)  # 'pending', 'approved_for_training', 'rejected'
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="feedbacks")
    corrected_food = relationship("Food")

    __table_args__ = (
        Index("idx_ai_feedback_status_created", "status", "created_at"),
    )

