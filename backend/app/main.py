"""
Điểm khởi chạy chính của ứng dụng Backend CaCalo (FastAPI).
Cung cấp CORS middleware và các API endpoints: Món ăn, Ghi nhật ký bữa ăn, Nhận diện món & Thu thập phản hồi AI.
"""
from datetime import date, datetime, timezone
from typing import List, Optional, Any
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.models import (
    Food, FoodNutrition, FoodServing, FoodTopping,
    MealLog, MealLogItem, AIFeedbackLog, User
)

app = FastAPI(
    title="CaCalo API",
    description="Hệ thống Backend nhận diện món ăn tính Calo & Trợ lý Dinh dưỡng AI kết nối PostgreSQL",
    version="1.0.0"
)

# Cấu hình CORS cho phép Frontend React gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Request/Response Models ---

class ToppingApplied(BaseModel):
    name: str
    gram: float = 0.0
    cal: float = 0.0
    pro: float = 0.0

class MealLogItemInput(BaseModel):
    food_id: Optional[int] = None
    serving_id: Optional[int] = None
    food_name: str
    portion_size: str = "M (1.0x)"
    portion_multiplier: float = 1.0
    actual_gram: float
    calories: float
    protein: float = 0.0
    carb: float = 0.0
    fat: float = 0.0
    toppings_applied: List[dict] = []
    image_proof_url: Optional[str] = None

class CreateMealLogInput(BaseModel):
    meal_type: str = "lunch"  # 'breakfast', 'lunch', 'dinner', 'snack'
    log_date: Optional[date] = None
    items: List[MealLogItemInput]

class AIFeedbackInput(BaseModel):
    original_image_url: Optional[str] = None
    model_version: str = "gemini-1.5-flash-vision"
    raw_predictions: List[dict] = []
    predicted_label: str
    confidence_score: Optional[float] = None
    user_corrected_label: str
    corrected_food_id: Optional[int] = None


# --- API Endpoints ---

@app.get("/api/health", tags=["Hệ thống"])
def health_check(db: Session = Depends(get_db)):
    """Kiểm tra trạng thái máy chủ FastAPI và kết nối PostgreSQL."""
    try:
        db.execute(text("SELECT 1"))
        total_foods = db.query(Food).count()
        total_logs = db.query(MealLog).count()
        return {
            "status": "healthy",
            "message": "CaCalo Backend API đang hoạt động ổn định trên PostgreSQL!",
            "database": "connected",
            "total_foods_in_db": total_foods,
            "total_meal_logs": total_logs
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Lỗi kết nối cơ sở dữ liệu: {str(e)}",
            "database": "disconnected"
        }


@app.get("/api/foods", tags=["Món ăn"])
def get_all_foods(db: Session = Depends(get_db)):
    """Lấy danh sách các món ăn kèm dinh dưỡng chuẩn trên 100g, khẩu phần và toppings từ PostgreSQL."""
    foods = db.query(Food).all()
    result = []
    for f in foods:
        nut = f.nutrition
        result.append({
            "id": f.id,
            "name": f.name,
            "name_unsigned": f.name_unsigned,
            "category": f.category,
            "description": f.description,
            "source": f.source,
            "nutrition_per_100g": {
                "calories": float(nut.calories_kcal) if nut else 0.0,
                "protein": float(nut.protein_g) if nut else 0.0,
                "carb": float(nut.carb_g) if nut else 0.0,
                "fat": float(nut.fat_g) if nut else 0.0,
                "fiber": float(nut.fiber_g) if nut else 0.0,
                "sugar": float(nut.sugar_g) if nut else 0.0,
                "sodium": float(nut.sodium_mg) if nut else 0.0,
            } if nut else None,
            "servings": [
                {
                    "id": s.id,
                    "unit": s.unit_name,
                    "gram": float(s.weight_gram),
                    "is_default": s.is_default
                }
                for s in f.servings
            ],
            "toppings": [
                {
                    "id": t.id,
                    "name": t.name,
                    "gram": float(t.weight_gram),
                    "calories": float(t.calories_kcal),
                    "protein": float(t.protein_g),
                    "carb": float(t.carb_g),
                    "fat": float(t.fat_g)
                }
                for t in f.toppings
            ]
        })
    return {"total": len(result), "data": result}


@app.post("/api/meal-logs", tags=["Nhật ký bữa ăn"])
def create_meal_log(data: CreateMealLogInput, db: Session = Depends(get_db)):
    """
    Ghi nhận một bữa ăn vào PostgreSQL (bảng meal_logs & meal_log_items).
    Tự động tính tổng calo và dinh dưỡng của toàn bữa ăn.
    """
    # Lấy tài khoản demo mặc định nếu chưa truyền user_id
    default_user = db.query(User).first()
    if not default_user:
        raise HTTPException(status_code=400, detail="Chưa có tài khoản người dùng trong hệ thống")

    target_date = data.log_date or date.today()

    total_cal = sum(item.calories for item in data.items)
    total_pro = sum(item.protein for item in data.items)
    total_carb = sum(item.carb for item in data.items)
    total_fat = sum(item.fat for item in data.items)

    meal_log = MealLog(
        user_id=default_user.id,
        log_date=target_date,
        meal_type=data.meal_type,
        total_calories=round(total_cal, 1),
        total_protein=round(total_pro, 1),
        total_carb=round(total_carb, 1),
        total_fat=round(total_fat, 1)
    )
    db.add(meal_log)
    db.flush()

    for item in data.items:
        log_item = MealLogItem(
            meal_log_id=meal_log.id,
            food_id=item.food_id,
            serving_id=item.serving_id,
            food_name=item.food_name,
            portion_size=item.portion_size,
            portion_multiplier=item.portion_multiplier,
            actual_gram=item.actual_gram,
            calories=round(item.calories, 1),
            protein=round(item.protein, 1),
            carb=round(item.carb, 1),
            fat=round(item.fat, 1),
            toppings_applied=item.toppings_applied,  # JSONB
            image_proof_url=item.image_proof_url
        )
        db.add(log_item)

    db.commit()
    return {
        "success": True,
        "message": f"Đã lưu thành công bữa {data.meal_type} vào PostgreSQL!",
        "meal_log_id": meal_log.id,
        "total_calories": float(meal_log.total_calories)
    }


@app.get("/api/meal-logs/today", tags=["Nhật ký bữa ăn"])
def get_today_meal_logs(db: Session = Depends(get_db)):
    """Lấy tổng hợp dinh dưỡng các bữa ăn hôm nay để hiển thị lên Dashboard."""
    today = date.today()
    logs = db.query(MealLog).filter(MealLog.log_date == today).all()

    total_cal = sum(float(l.total_calories) for l in logs)
    total_pro = sum(float(l.total_protein) for l in logs)
    total_carb = sum(float(l.total_carb) for l in logs)
    total_fat = sum(float(l.total_fat) for l in logs)

    items_list = []
    for l in logs:
        for it in l.items:
            items_list.append({
                "meal_type": l.meal_type,
                "food_name": it.food_name,
                "portion": it.portion_size,
                "calories": float(it.calories),
                "protein": float(it.protein),
                "toppings": it.toppings_applied
            })

    return {
        "date": str(today),
        "total_calories": round(total_cal, 1),
        "total_protein": round(total_pro, 1),
        "total_carb": round(total_carb, 1),
        "total_fat": round(total_fat, 1),
        "items": items_list
    }


@app.post("/api/feedback/ai", tags=["Trợ lý AI"])
def submit_ai_feedback(data: AIFeedbackInput, db: Session = Depends(get_db)):
    """
    Thu thập phản hồi khi người dùng sửa lỗi nhận diện của AI.
    Lưu trữ Top-K raw predictions (JSONB) vào PostgreSQL để phục vụ MLOps retraining.
    """
    default_user = db.query(User).first()
    feedback = AIFeedbackLog(
        user_id=default_user.id if default_user else None,
        original_image_url=data.original_image_url,
        model_version=data.model_version,
        raw_predictions=data.raw_predictions,  # JSONB
        predicted_label=data.predicted_label,
        confidence_score=data.confidence_score,
        user_corrected_label=data.user_corrected_label,
        corrected_food_id=data.corrected_food_id,
        status="pending"
    )
    db.add(feedback)
    db.commit()
    return {
        "success": True,
        "message": "Cảm ơn bạn! Đã ghi nhận phản hồi sửa lỗi AI vào cơ sở dữ liệu PostgreSQL.",
        "feedback_id": feedback.id
    }

