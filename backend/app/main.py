"""
Điểm khởi chạy chính của ứng dụng Backend CaCalo (FastAPI).
Cung cấp CORS middleware và các API endpoints: Món ăn, Ghi nhật ký bữa ăn, Nhận diện món & Thu thập phản hồi AI.
"""
from datetime import date, datetime, timezone
from typing import List, Optional, Any
from fastapi import FastAPI, Depends, HTTPException, Query, File, UploadFile, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import get_db
from app.models import (
    Food, FoodNutrition, FoodServing, FoodTopping,
    MealLog, MealLogItem, AIFeedbackLog, User, UserProfile
)
from app.services.auth_service import (
    hash_password, verify_password, generate_token, verify_token,
    calculate_health_metrics, format_user_response
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

from app.services.vision_service import predict_food_image
from app.services.chatbot_service import process_chat_message
from app.services.nutrition_logic import (
    calc_full_metrics,
    evaluate_meal_balance,
    get_serving_gram,
    calc_nutrition_by_gram,
)

# --- Pydantic Request/Response Models ---

class NutritionCalculateInput(BaseModel):
    food_id: int
    portion_size: str = "M"  # 'S', 'M', 'L', 'custom'
    custom_gram: Optional[float] = None
    topping_ids: List[int] = []

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

class ChatbotInput(BaseModel):
    message: str
    history: List[dict] = []  # [{"role": "user"|"assistant", "content": "..."}]

class EvaluateMealInput(BaseModel):
    calories: float
    protein_g: float
    carb_g: float
    fat_g: float
    target_calories: Optional[float] = 2000.0

class RegisterInput(BaseModel):
    email: str
    password: str
    full_name: str
    gender: Optional[str] = "male"
    birth_year: Optional[int] = 2000
    height_cm: Optional[float] = 170.0
    weight_kg: Optional[float] = 65.0
    activity_level: Optional[float] = 1.375
    goal: Optional[str] = "maintain"
    diet_type: Optional[str] = "normal"
    allergies: Optional[List[str]] = []
    disliked_ingredients: Optional[List[str]] = []

class LoginInput(BaseModel):
    email: str
    password: str

class UpdateProfileInput(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    birth_year: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    activity_level: Optional[float] = None
    goal: Optional[str] = None
    diet_type: Optional[str] = None
    allergies: Optional[List[str]] = None
    disliked_ingredients: Optional[List[str]] = None


# --- Phụ thuộc xác thực người dùng (Auth Dependencies) ---

def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Lấy người dùng hiện tại từ Bearer token (nếu có), hỗ trợ fallback mượt mà."""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    user_id = verify_token(token)
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()

def get_current_user_required(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Yêu cầu người dùng phải đăng nhập hợp lệ để tiếp tục thao tác."""
    user = get_current_user_optional(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập để tiếp tục")
    return user


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


# --- Nhóm API Xác thực & Cá nhân hóa ---

@app.post("/api/auth/register", tags=["Xác thực & Cá nhân hóa"])
def register(data: RegisterInput, db: Session = Depends(get_db)):
    """Đăng ký tài khoản người dùng mới và tự động khởi tạo Hồ sơ thể trạng / dinh dưỡng."""
    email_clean = data.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Địa chỉ email không hợp lệ")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu tối thiểu phải từ 6 ký tự")

    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email này đã được sử dụng. Vui lòng đăng nhập hoặc chọn email khác")

    user = User(
        email=email_clean,
        password_hash=hash_password(data.password),
        full_name=data.full_name.strip() or "Người dùng CaCalo",
        role="user"
    )
    db.add(user)
    db.flush()

    # Tính toán các chỉ số sức khỏe tự động
    calc = calculate_health_metrics(
        gender=data.gender or "male",
        birth_year=data.birth_year or 2000,
        height_cm=float(data.height_cm or 170.0),
        weight_kg=float(data.weight_kg or 65.0),
        activity_level=float(data.activity_level or 1.375),
        goal=data.goal or "maintain",
        diet_type=data.diet_type or "normal"
    )

    profile = UserProfile(
        user_id=user.id,
        gender=data.gender or "male",
        birth_year=data.birth_year or 2000,
        height_cm=float(data.height_cm or 170.0),
        weight_kg=float(data.weight_kg or 65.0),
        activity_level=float(data.activity_level or 1.375),
        goal=data.goal or "maintain",
        diet_type=data.diet_type or "normal",
        allergies=data.allergies or [],
        disliked_ingredients=data.disliked_ingredients or [],
        bmi=calc["bmi"],
        bmr=calc["bmr"],
        tdee=calc["tdee"],
        target_calories=calc["target_calories"],
        target_protein_g=calc["target_protein_g"],
        target_carb_g=calc["target_carb_g"],
        target_fat_g=calc["target_fat_g"]
    )
    db.add(profile)
    db.commit()

    token = generate_token(user.id)
    return {
        "success": True,
        "message": "Đăng ký tài khoản thành công!",
        "token": token,
        "user": format_user_response(user, profile)
    }


@app.post("/api/auth/login", tags=["Xác thực & Cá nhân hóa"])
def login(data: LoginInput, db: Session = Depends(get_db)):
    """Đăng nhập tài khoản bằng Email & Mật khẩu."""
    email_clean = data.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác")

    profile = user.profile
    token = generate_token(user.id)
    return {
        "success": True,
        "message": f"Chào mừng {user.full_name} quay trở lại!",
        "token": token,
        "user": format_user_response(user, profile)
    }


@app.get("/api/auth/me", tags=["Xác thực & Cá nhân hóa"])
def get_me(user: User = Depends(get_current_user_required)):
    """Lấy thông tin người dùng đang đăng nhập kèm hồ sơ thể trạng và dinh dưỡng."""
    return {
        "success": True,
        "user": format_user_response(user, user.profile)
    }


@app.get("/api/user/profile", tags=["Xác thực & Cá nhân hóa"])
def get_user_profile(
    user_opt: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Lấy hồ sơ thể trạng và chỉ số dinh dưỡng (tự động fallback về tài khoản mẫu nếu chưa đăng nhập)."""
    user = user_opt or db.query(User).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ người dùng")

    return {
        "success": True,
        "user": format_user_response(user, user.profile)
    }


@app.put("/api/user/profile", tags=["Xác thực & Cá nhân hóa"])
def update_user_profile(
    data: UpdateProfileInput,
    user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Cập nhật hồ sơ thể trạng, mục tiêu & sở thích, tự động tính lại BMI, BMR, TDEE, Calo mục tiêu."""
    if data.full_name is not None and data.full_name.strip():
        user.full_name = data.full_name.strip()

    profile = user.profile
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    if data.gender is not None:
        profile.gender = data.gender
    if data.birth_year is not None:
        profile.birth_year = data.birth_year
    if data.height_cm is not None:
        profile.height_cm = float(data.height_cm)
    if data.weight_kg is not None:
        profile.weight_kg = float(data.weight_kg)
    if data.activity_level is not None:
        profile.activity_level = float(data.activity_level)
    if data.goal is not None:
        profile.goal = data.goal
    if data.diet_type is not None:
        profile.diet_type = data.diet_type
    if data.allergies is not None:
        profile.allergies = data.allergies
    if data.disliked_ingredients is not None:
        profile.disliked_ingredients = data.disliked_ingredients

    # Tự động tính toán lại toàn bộ chỉ số dinh dưỡng mới
    calc = calculate_health_metrics(
        gender=profile.gender or "male",
        birth_year=profile.birth_year or 2000,
        height_cm=float(profile.height_cm or 170.0),
        weight_kg=float(profile.weight_kg or 65.0),
        activity_level=float(profile.activity_level or 1.375),
        goal=profile.goal or "maintain",
        diet_type=profile.diet_type or "normal"
    )

    profile.bmi = calc["bmi"]
    profile.bmr = calc["bmr"]
    profile.tdee = calc["tdee"]
    profile.target_calories = calc["target_calories"]
    profile.target_protein_g = calc["target_protein_g"]
    profile.target_carb_g = calc["target_carb_g"]
    profile.target_fat_g = calc["target_fat_g"]

    db.commit()
    db.refresh(user)
    db.refresh(profile)

    return {
        "success": True,
        "message": "Cập nhật hồ sơ cá nhân hóa thành công!",
        "user": format_user_response(user, profile)
    }


# --- Nhóm API Nhật ký bữa ăn ---

@app.post("/api/meal-logs", tags=["Nhật ký bữa ăn"])
def create_meal_log(
    data: CreateMealLogInput,
    user_opt: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Ghi nhận một bữa ăn vào PostgreSQL (bảng meal_logs & meal_log_items).
    Tự động gắn với người dùng đang đăng nhập hoặc tài khoản demo mặc định.
    """
    user = user_opt or db.query(User).first()
    if not user:
        raise HTTPException(status_code=400, detail="Chưa có tài khoản người dùng trong hệ thống")

    target_date = data.log_date or date.today()

    total_cal = sum(item.calories for item in data.items)
    total_pro = sum(item.protein for item in data.items)
    total_carb = sum(item.carb for item in data.items)
    total_fat = sum(item.fat for item in data.items)

    meal_log = MealLog(
        user_id=user.id,
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
def get_today_meal_logs(
    user_opt: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Lấy tổng hợp dinh dưỡng các bữa ăn hôm nay và mục tiêu dinh dưỡng cá nhân hóa."""
    user = user_opt or db.query(User).first()
    today = date.today()
    
    query = db.query(MealLog).filter(MealLog.log_date == today)
    if user:
        query = query.filter(MealLog.user_id == user.id)
    logs = query.all()

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

    user_profile_data = None
    if user and user.profile:
        user_profile_data = format_user_response(user, user.profile)["profile"]

    return {
        "date": str(today),
        "total_calories": round(total_cal, 1),
        "total_protein": round(total_pro, 1),
        "total_carb": round(total_carb, 1),
        "total_fat": round(total_fat, 1),
        "items": items_list,
        "user_profile": user_profile_data
    }


@app.post("/api/feedback/ai", tags=["Trợ lý AI"])
@app.post("/api/vision/feedback", tags=["Thị giác máy tính (Vision)"])
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


@app.post("/api/vision/predict", tags=["Thị giác máy tính (Vision)"])
async def predict_food(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Tiếp nhận ảnh chụp món ăn và phân tích bằng kiến trúc Hybrid:
    1. Ưu tiên Google Gemini Flash Vision API: Bóc tách đa thành phần, ước lượng gram.
    2. Đối chiếu với PostgreSQL: Tính Calo chuẩn xác từ bảng food_nutritions.
    3. Fallback sang Local Analyzer nếu Gemini không khả dụng.
    Trả về danh sách món ăn kèm dinh dưỡng và nguồn dữ liệu (DB ✅ / AI ước lượng).
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Tệp tải lên phải là hình ảnh (JPG, PNG, WebP)!")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Tệp ảnh tải lên bị rỗng!")

    try:
        prediction_result = predict_food_image(image_bytes, db)
        return prediction_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích hình ảnh: {str(e)}")


@app.post("/api/nutrition/calculate", tags=["Động cơ Dinh dưỡng"])
def calculate_nutrition(data: NutritionCalculateInput, db: Session = Depends(get_db)):
    """
    Tính toán Calo và Macro số học chuẩn xác từ CSDL PostgreSQL theo công thức SRS:
    Calo = (Khối lượng / 100) * Calo_100g + Tổng Calo Toppings.
    Đính kèm tỷ lệ % Macro (Đạm / Bột đường / Béo) và nhãn ước lượng minh bạch.
    """
    food = db.query(Food).filter(Food.id == data.food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Không tìm thấy món ăn trong cơ sở dữ liệu")

    # Xác định khẩu phần chuẩn mặc định
    default_serving = next((s for s in food.servings if s.is_default), food.servings[0] if food.servings else None)
    base_serving_gram = float(default_serving.weight_gram) if default_serving else 400.0

    # Xác định khối lượng thực tế và hệ số
    size_upper = data.portion_size.upper()
    if size_upper == "CUSTOM" and data.custom_gram and data.custom_gram > 0:
        actual_gram = float(data.custom_gram)
        multiplier = round(actual_gram / base_serving_gram, 2)
    else:
        multiplier_map = {"S": 0.75, "M": 1.0, "L": 1.25}
        multiplier = multiplier_map.get(size_upper, 1.0)
        actual_gram = round(base_serving_gram * multiplier, 1)

    # Dinh dưỡng món chính từ bảng food_nutritions
    nut = food.nutrition
    cal_100 = float(nut.calories_kcal) if nut else 0.0
    pro_100 = float(nut.protein_g) if nut else 0.0
    carb_100 = float(nut.carb_g) if nut else 0.0
    fat_100 = float(nut.fat_g) if nut else 0.0

    dish_cal = (cal_100 * actual_gram) / 100.0
    dish_pro = (pro_100 * actual_gram) / 100.0
    dish_carb = (carb_100 * actual_gram) / 100.0
    dish_fat = (fat_100 * actual_gram) / 100.0

    # Tính toán Toppings đi kèm
    toppings_applied = []
    top_cal, top_pro, top_carb, top_fat = 0.0, 0.0, 0.0, 0.0
    if data.topping_ids:
        selected_toppings = db.query(FoodTopping).filter(
            FoodTopping.id.in_(data.topping_ids),
            FoodTopping.food_id == food.id
        ).all()
        for t in selected_toppings:
            t_cal = float(t.calories_kcal)
            t_pro = float(t.protein_g)
            t_carb = float(t.carb_g)
            t_fat = float(t.fat_g)
            top_cal += t_cal
            top_pro += t_pro
            top_carb += t_carb
            top_fat += t_fat
            toppings_applied.append({
                "id": t.id,
                "name": t.name,
                "gram": float(t.weight_gram),
                "calories": t_cal,
                "protein": t_pro
            })

    total_cal = round(dish_cal + top_cal, 1)
    total_pro = round(dish_pro + top_pro, 1)
    total_carb = round(dish_carb + top_carb, 1)
    total_fat = round(dish_fat + top_fat, 1)

    # Phân bổ tỷ lệ % Macro
    total_macro = total_pro + total_carb + total_fat
    if total_macro > 0:
        pct_pro = round((total_pro / total_macro) * 100)
        pct_carb = round((total_carb / total_macro) * 100)
        pct_fat = max(0, 100 - pct_pro - pct_carb)
    else:
        pct_pro, pct_carb, pct_fat = 25, 55, 20

    return {
        "food_id": food.id,
        "food_name": food.name,
        "portion_size": data.portion_size,
        "portion_multiplier": multiplier,
        "actual_gram": actual_gram,
        "calories": total_cal,
        "total_calories": total_cal,
        "protein": total_pro,
        "carb": total_carb,
        "fat": total_fat,
        "macro_percentages": {
            "protein": pct_pro,
            "carb": pct_carb,
            "fat": pct_fat
        },
        "toppings_applied": toppings_applied,
        "source": food.source,
        "is_estimate": True
    }


@app.get("/api/foods/search", tags=["Món ăn"])
def search_foods(q: str = Query(..., min_length=1, description="Từ khóa tìm kiếm"), db: Session = Depends(get_db)):
    """Tìm kiếm nhanh món ăn trong PostgreSQL theo tên tiếng Việt có dấu hoặc không dấu."""
    keyword = q.strip().lower()
    foods = db.query(Food).filter(
        Food.name.ilike(f"%{keyword}%") | Food.name_unsigned.ilike(f"%{keyword}%")
    ).limit(10).all()

    result = []
    for f in foods:
        nut = f.nutrition
        default_serving = next((s for s in f.servings if s.is_default), f.servings[0] if f.servings else None)
        result.append({
            "id": f.id,
            "name": f.name,
            "category": f.category,
            "description": f.description,
            "calories_per_100g": float(nut.calories_kcal) if nut else 0.0,
            "default_serving_unit": default_serving.unit_name if default_serving else "Phần vừa",
            "default_serving_gram": float(default_serving.weight_gram) if default_serving else 400.0
        })
    return {"query": q, "total": len(result), "data": result}


# --- Nhom API Chatbot AI (CC-3.4) ---

@app.post("/api/chatbot", tags=["Tro ly AI"])
def chatbot(
    data: ChatbotInput,
    user_opt: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Tro ly AI hoi dap dinh duong - Kien truc RAG (Retrieval-Augmented Generation).
    AI duoc inject day du context tu DB: ho so nguoi dung, danh sach mon an,
    nhat ky hom nay, cong thuc. AI chi dien dat cau tra loi - khong tu tinh so.
    Rang buoc cung: di ung, muc tieu Calo cua nguoi dung.
    """
    user = user_opt or db.query(User).first()
    profile = user.profile if user else None

    from datetime import date as _date
    today = _date.today()
    logs_query = db.query(MealLog).filter(MealLog.log_date == today)
    if user:
        logs_query = logs_query.filter(MealLog.user_id == user.id)
    today_logs_raw = logs_query.all()

    today_logs = []
    for log in today_logs_raw:
        for item in log.items:
            today_logs.append({
                "meal_type": log.meal_type,
                "food_name": item.food_name,
                "calories": float(item.calories),
                "protein": float(item.protein),
                "carb": float(item.carb),
                "fat": float(item.fat),
            })

    result = process_chat_message(
        message=data.message,
        db=db,
        user_profile=profile,
        today_logs=today_logs,
        history=data.history,
    )
    return {"success": True, **result}


@app.post("/api/nutrition/evaluate", tags=["Dong co Dinh duong"])
def evaluate_nutrition(
    data: EvaluateMealInput,
    user_opt: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Danh gia can doi dinh duong bua an - hoan toan deterministic, khong dung AI.
    Tinh ty le phan tram Macro, so sanh voi muc tieu ca nhan, dua ra nhan xet co quy tac.
    """
    user = user_opt or db.query(User).first()
    target_cal = data.target_calories or 2000.0
    if user and user.profile and user.profile.target_calories:
        target_cal = float(user.profile.target_calories)

    balance = evaluate_meal_balance(
        calories=data.calories,
        protein_g=data.protein_g,
        carb_g=data.carb_g,
        fat_g=data.fat_g,
        target_calories=target_cal,
    )
    return {"success": True, "evaluation": balance}
