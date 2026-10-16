"""
Điểm khởi chạy chính của ứng dụng Backend CaCalo (FastAPI).
Cung cấp CORS middleware và các API endpoints cơ sở.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.models import Food, FoodNutrition, FoodServing, FoodTopping

app = FastAPI(
    title="CaCalo API",
    description="Hệ thống Backend nhận diện món ăn tính Calo & Trợ lý Dinh dưỡng AI",
    version="1.0.0"
)

# Cấu hình CORS cho phép Frontend React gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Trong môi trường dev cho phép tất cả các nguồn
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health", tags=["Hệ thống"])
def health_check(db: Session = Depends(get_db)):
    """
    Kiểm tra trạng thái hoạt động của Backend và kết nối Cơ sở dữ liệu.
    """
    try:
        # Kiểm tra kết nối DB bằng câu truy vấn nhẹ
        db.execute(text("SELECT 1"))
        total_foods = db.query(Food).count()
        return {
            "status": "healthy",
            "message": "CaCalo Backend API đang hoạt động ổn định!",
            "database": "connected",
            "total_foods_in_db": total_foods
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Lỗi kết nối cơ sở dữ liệu: {str(e)}",
            "database": "disconnected"
        }

@app.get("/api/foods", tags=["Món ăn"])
def get_all_foods(db: Session = Depends(get_db)):
    """
    Lấy danh sách các món ăn kèm dinh dưỡng chuẩn trên 100g và khẩu phần.
    """
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
                "calories": nut.calories_kcal if nut else 0,
                "protein": nut.protein_g if nut else 0,
                "carb": nut.carb_g if nut else 0,
                "fat": nut.fat_g if nut else 0,
            } if nut else None,
            "servings": [
                {"unit": s.unit_name, "gram": s.weight_gram, "is_default": s.is_default}
                for s in f.servings
            ],
            "toppings": [
                {"name": t.name, "gram": t.weight_gram, "calories": t.calories_kcal}
                for t in f.toppings
            ]
        })
    return {"total": len(result), "data": result}
