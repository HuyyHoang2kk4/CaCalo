"""
Dịch vụ Xác thực & Cá nhân hóa Dinh dưỡng (Auth & Personalization Service).
Cung cấp:
- Băm và kiểm tra mật khẩu bằng PBKDF2-HMAC-SHA256 (chuẩn an toàn, không phụ thuộc C-lib).
- Tạo và xác minh Token người dùng.
- Công thức tính toán chỉ số sức khỏe tự động: BMI, BMR (Mifflin-St Jeor), TDEE, và Target Calo/Macro.
"""
import hmac
import hashlib
import secrets
import time
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.user import User, UserProfile

# Khóa bí mật ký token (trong môi trường thực tế đọc từ env)
SECRET_KEY = "cacalo-nutrition-ai-secret-key-salt-2026"

def hash_password(password: str) -> str:
    """Tạo chuỗi băm mật khẩu với salt ngẫu nhiên 16 bytes và 100,000 vòng lặp PBKDF2."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu nhập vào khớp với hash trong CSDL."""
    # Hỗ trợ mật khẩu demo ban đầu (123456 hoặc demo123)
    if hashed_password == "pbkdf2_demo_hashed_secret":
        return plain_password in ["123456", "demo123", "demo"]
    
    if "$" not in hashed_password:
        return plain_password == hashed_password
    
    try:
        salt, key = hashed_password.split("$", 1)
        new_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return hmac.compare_digest(new_key.hex(), key)
    except Exception:
        return False

def generate_token(user_id: str) -> str:
    """Tạo Bearer token an toàn gồm user_id, timestamp và chữ ký HMAC-SHA256."""
    ts = str(int(time.time()))
    payload = f"{user_id}:{ts}"
    signature = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"

def verify_token(token: str) -> Optional[str]:
    """Giải mã token và trả về user_id nếu chữ ký hợp lệ."""
    if not token or ":" not in token:
        return None
    try:
        parts = token.split(":")
        if len(parts) != 3:
            return None
        user_id, ts, signature = parts
        payload = f"{user_id}:{ts}"
        expected_sig = hmac.new(SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        return user_id
    except Exception:
        return None

def calculate_health_metrics(
    gender: str = "male",
    birth_year: int = 2000,
    height_cm: float = 170.0,
    weight_kg: float = 65.0,
    activity_level: float = 1.375,
    goal: str = "maintain",
    diet_type: str = "normal"
) -> Dict[str, Any]:
    """
    Tính toán tự động toàn diện các chỉ số thể trạng:
    - BMI & Đánh giá chuẩn WHO WPR cho người Châu Á
    - BMR theo phương trình Mifflin-St Jeor
    - TDEE = BMR * Hệ số vận động
    - Mục tiêu Calo hằng ngày (Target Calories) theo mục tiêu cân nặng
    - Phân bổ Macronutrients (Đạm, Tinh bột, Béo)
    """
    current_year = datetime.now().year
    age = max(10, current_year - birth_year)
    height_m = max(0.5, height_cm / 100.0)

    # 1. Tính chỉ số khối cơ thể (BMI)
    bmi = round(weight_kg / (height_m ** 2), 1)
    
    # Đánh giá BMI theo chuẩn Châu Á (WHO Asia-Pacific):
    # < 18.5: Thiếu cân | 18.5 - 22.9: Bình thường | 23.0 - 24.9: Tiền béo phì | >= 25.0: Béo phì
    if bmi < 18.5:
        bmi_status = "Gầy / Thiếu cân"
        bmi_color = "warning"
    elif bmi < 23.0:
        bmi_status = "Bình thường (Lý tưởng)"
        bmi_color = "success"
    elif bmi < 25.0:
        bmi_status = "Thừa cân (Tiền béo phì)"
        bmi_color = "warning"
    else:
        bmi_status = "Béo phì"
        bmi_color = "danger"

    # Cân nặng lý tưởng (dựa trên BMI 21.5)
    ideal_weight_kg = round(21.5 * (height_m ** 2), 1)

    # 2. Tính tỷ lệ trao đổi chất cơ bản (BMR) - Công thức Mifflin-St Jeor
    if gender.lower() == "female":
        bmr = round(10 * weight_kg + 6.25 * height_cm - 5 * age - 161, 1)
    else:
        bmr = round(10 * weight_kg + 6.25 * height_cm - 5 * age + 5, 1)

    # 3. Tính tổng năng lượng tiêu hao hằng ngày (TDEE)
    tdee = round(bmr * float(activity_level), 1)

    # 4. Tính Calo mục tiêu (Target Calories) theo mục tiêu giảm / giữ / tăng cân
    goal_lower = goal.lower()
    if goal_lower == "lose_weight":
        # Giảm 500 kcal/ngày (~ 0.5kg mỡ/tuần), không giảm dưới mức an toàn
        min_safe = 1200.0 if gender.lower() == "female" else 1500.0
        target_calories = max(min_safe, round(tdee - 500.0, 1))
    elif goal_lower == "gain_weight":
        # Thặng dư 400 - 500 kcal để tăng cơ
        target_calories = round(tdee + 450.0, 1)
    else:
        # Giữ cân
        target_calories = round(tdee, 1)

    # 5. Phân bổ dinh dưỡng Macro (Protein, Carb, Fat)
    # Tùy biến theo chế độ ăn (ví dụ lowcarb / keto sẽ giảm carb tăng đạm và béo)
    if diet_type == "lowcarb":
        pro_pct, carb_pct, fat_pct = 0.35, 0.20, 0.45
    elif diet_type == "keto":
        pro_pct, carb_pct, fat_pct = 0.25, 0.05, 0.70
    elif diet_type in ["vegetarian", "vegan"]:
        pro_pct, carb_pct, fat_pct = 0.20, 0.55, 0.25
    else: # normal
        pro_pct, carb_pct, fat_pct = 0.25, 0.50, 0.25

    target_protein_g = round((target_calories * pro_pct) / 4.0, 1)
    target_carb_g = round((target_calories * carb_pct) / 4.0, 1)
    target_fat_g = round((target_calories * fat_pct) / 9.0, 1)

    return {
        "age": age,
        "bmi": bmi,
        "bmi_status": bmi_status,
        "bmi_color": bmi_color,
        "ideal_weight_kg": ideal_weight_kg,
        "bmr": bmr,
        "tdee": tdee,
        "target_calories": target_calories,
        "target_protein_g": target_protein_g,
        "target_carb_g": target_carb_g,
        "target_fat_g": target_fat_g,
        "macro_ratio": {
            "protein_pct": int(pro_pct * 100),
            "carb_pct": int(carb_pct * 100),
            "fat_pct": int(fat_pct * 100)
        }
    }

def format_user_response(user: User, profile: Optional[UserProfile] = None) -> Dict[str, Any]:
    """Chuyển đổi User và UserProfile thành đối tượng JSON chuẩn trả về cho frontend."""
    profile_data = None
    if profile:
        calc = calculate_health_metrics(
            gender=profile.gender or "male",
            birth_year=profile.birth_year or 2000,
            height_cm=float(profile.height_cm or 170.0),
            weight_kg=float(profile.weight_kg or 65.0),
            activity_level=float(profile.activity_level or 1.375),
            goal=profile.goal or "maintain",
            diet_type=profile.diet_type or "normal"
        )
        profile_data = {
            "gender": profile.gender,
            "birth_year": profile.birth_year,
            "height_cm": float(profile.height_cm),
            "weight_kg": float(profile.weight_kg),
            "activity_level": float(profile.activity_level),
            "goal": profile.goal,
            "diet_type": profile.diet_type,
            "allergies": profile.allergies or [],
            "disliked_ingredients": profile.disliked_ingredients or [],
            # Các giá trị tính toán
            "age": calc["age"],
            "bmi": float(profile.bmi or calc["bmi"]),
            "bmi_status": calc["bmi_status"],
            "bmi_color": calc["bmi_color"],
            "ideal_weight_kg": calc["ideal_weight_kg"],
            "bmr": float(profile.bmr or calc["bmr"]),
            "tdee": float(profile.tdee or calc["tdee"]),
            "target_calories": float(profile.target_calories or calc["target_calories"]),
            "target_protein_g": float(profile.target_protein_g or calc["target_protein_g"]),
            "target_carb_g": float(profile.target_carb_g or calc["target_carb_g"]),
            "target_fat_g": float(profile.target_fat_g or calc["target_fat_g"]),
            "macro_ratio": calc["macro_ratio"]
        }

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "profile": profile_data
    }
