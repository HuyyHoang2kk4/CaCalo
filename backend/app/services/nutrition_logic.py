"""
Module Nutrition Logic — Reference Logic Layer (CaCalo).
Chứa toàn bộ quy tắc tính toán dinh dưỡng xác định (deterministic):
  - Tính Calo/Macro từ DB theo gram thực tế
  - Tính BMI, phân loại thể trạng
  - Tính BMR theo Mifflin-St Jeor
  - Tính TDEE và mục tiêu Calo/Macro theo mục tiêu
  - Đánh giá cân đối bữa ăn (meal balance score)
  - Format context cho AI prompt (RAG reference)

NGUYÊN TẮC QUAN TRỌNG:
  Tất cả số liệu Calo, Protein, Carb, Fat đều tính từ DB (deterministic).
  AI chỉ được phép đọc context từ module này và diễn đạt câu trả lời.
  AI tuyệt đối không tự suy diễn hay tự bịa số dinh dưỡng.
"""
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session


# ============================================================
# 1. TÍNH DINH DƯỠNG THEO KHẨU PHẦN (từ DB)
# ============================================================

def calc_nutrition_by_gram(
    calories_per_100g: float,
    protein_per_100g: float,
    carb_per_100g: float,
    fat_per_100g: float,
    actual_gram: float
) -> Dict[str, float]:
    """
    Công thức cốt lõi: Giá trị = (gram / 100) × Giá_trị_100g
    Đây là phép tính duy nhất được phép dùng để tính dinh dưỡng — không dùng AI.
    """
    ratio = actual_gram / 100.0
    return {
        "calories": round(calories_per_100g * ratio, 1),
        "protein": round(protein_per_100g * ratio, 1),
        "carb": round(carb_per_100g * ratio, 1),
        "fat": round(fat_per_100g * ratio, 1),
        "actual_gram": actual_gram,
    }


def get_serving_gram(food, portion_size: str = "M", custom_gram: Optional[float] = None) -> tuple:
    """
    Xác định gram thực tế và hệ số nhân dựa trên khẩu phần chọn.
    Trả về (actual_gram, multiplier, serving_label).
    """
    default_serving = next((s for s in food.servings if s.is_default), food.servings[0] if food.servings else None)
    base_gram = float(default_serving.weight_gram) if default_serving else 300.0
    base_label = default_serving.unit_name if default_serving else "Phần tiêu chuẩn"

    size_upper = (portion_size or "M").upper()
    if size_upper == "CUSTOM" and custom_gram and custom_gram > 0:
        actual_gram = float(custom_gram)
        multiplier = round(actual_gram / base_gram, 2)
        label = f"Tùy chỉnh ({actual_gram:.0f}g)"
    else:
        multiplier_map = {"S": 0.75, "M": 1.0, "L": 1.25}
        multiplier = multiplier_map.get(size_upper, 1.0)
        actual_gram = round(base_gram * multiplier, 1)
        size_label = {"S": "Nhỏ (S)", "M": "Vừa (M)", "L": "Lớn (L)"}.get(size_upper, "Vừa (M)")
        label = f"{size_label} — {base_label}"

    return actual_gram, multiplier, label


# ============================================================
# 2. TÍNH BMI, BMR, TDEE
# ============================================================

BMI_CATEGORIES = [
    (0,    18.5, "Thiếu cân",  "Bạn đang thiếu cân. Cần tăng cường dinh dưỡng."),
    (18.5, 23.0, "Bình thường","Thể trạng lý tưởng — tiếp tục duy trì!"),
    (23.0, 27.5, "Thừa cân",   "Cần chú ý kiểm soát khẩu phần và tăng vận động."),
    (27.5, 32.5, "Béo phì độ I","Khuyến nghị tham khảo chuyên gia dinh dưỡng."),
    (32.5, 999,  "Béo phì độ II","Cần can thiệp y tế — tham khảo bác sĩ."),
]

ACTIVITY_LABELS = {
    1.2:   "Ít vận động (ngồi nhiều)",
    1.375: "Nhẹ (1–3 buổi/tuần)",
    1.55:  "Vừa phải (3–5 buổi/tuần)",
    1.725: "Năng động (6–7 buổi/tuần)",
    1.9:   "Rất năng động (vận động nặng)",
}

GOAL_LABELS = {
    "lose":     "Giảm cân",
    "maintain": "Giữ cân",
    "gain":     "Tăng cân / Tăng cơ",
}

GOAL_CALORIE_DELTA = {
    "lose":     -500,  # Thâm hụt 500 kcal/ngày → giảm ~0.45kg/tuần
    "maintain":    0,
    "gain":     +300,  # Thặng dư 300 kcal/ngày → tăng cơ an toàn
}

# Tỷ lệ Macro chuẩn theo mục tiêu (protein_pct, carb_pct, fat_pct)
GOAL_MACRO_RATIO = {
    "lose":     (0.35, 0.40, 0.25),
    "maintain": (0.25, 0.50, 0.25),
    "gain":     (0.30, 0.45, 0.25),
}


def calc_bmi(height_cm: float, weight_kg: float) -> Dict[str, Any]:
    """Tính BMI và phân loại thể trạng theo chuẩn WHO cho người châu Á."""
    if height_cm <= 0 or weight_kg <= 0:
        return {"bmi": 0, "category": "Không xác định", "note": ""}
    bmi = round(weight_kg / ((height_cm / 100) ** 2), 1)
    category, note = "Không xác định", ""
    for lo, hi, cat, nt in BMI_CATEGORIES:
        if lo <= bmi < hi:
            category, note = cat, nt
            break
    return {"bmi": bmi, "category": category, "note": note}


def calc_bmr(gender: str, weight_kg: float, height_cm: float, birth_year: int) -> float:
    """
    Công thức Mifflin-St Jeor (2005) — chuẩn xác nhất hiện tại.
    Nam: BMR = 10×W + 6.25×H − 5×A + 5
    Nữ: BMR = 10×W + 6.25×H − 5×A − 161
    """
    from datetime import datetime
    age = datetime.now().year - birth_year
    age = max(1, min(age, 120))
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    bmr = base + 5 if gender == "male" else base - 161
    return round(bmr, 1)


def calc_tdee(bmr: float, activity_level: float) -> float:
    """TDEE = BMR × Hệ số vận động."""
    return round(bmr * activity_level, 1)


def calc_targets(tdee: float, goal: str, weight_kg: float) -> Dict[str, float]:
    """
    Tính mục tiêu Calo, Protein, Carb, Fat theo ngày dựa trên TDEE và mục tiêu.
    Protein tối thiểu 1.6g/kg cân nặng để bảo vệ cơ bắp.
    """
    goal = goal or "maintain"
    target_cal = max(1200, tdee + GOAL_CALORIE_DELTA.get(goal, 0))

    pro_pct, carb_pct, fat_pct = GOAL_MACRO_RATIO.get(goal, (0.25, 0.50, 0.25))
    protein_g = max(round(weight_kg * 1.6, 1), round(target_cal * pro_pct / 4, 1))
    carb_g = round(target_cal * carb_pct / 4, 1)
    fat_g = round(target_cal * fat_pct / 9, 1)

    return {
        "target_calories": round(target_cal, 1),
        "target_protein_g": protein_g,
        "target_carb_g": carb_g,
        "target_fat_g": fat_g,
        "goal_label": GOAL_LABELS.get(goal, goal),
    }


def calc_full_metrics(
    gender: str, birth_year: int, height_cm: float,
    weight_kg: float, activity_level: float, goal: str
) -> Dict[str, Any]:
    """Hàm tổng hợp tính đầy đủ BMI, BMR, TDEE và mục tiêu dinh dưỡng."""
    bmi_data = calc_bmi(height_cm, weight_kg)
    bmr = calc_bmr(gender, weight_kg, height_cm, birth_year)
    tdee = calc_tdee(bmr, activity_level)
    targets = calc_targets(tdee, goal, weight_kg)

    return {
        **bmi_data,
        "bmr": bmr,
        "tdee": tdee,
        "activity_label": ACTIVITY_LABELS.get(activity_level, ""),
        **targets,
    }


# ============================================================
# 3. ĐÁNH GIÁ BỮA ĂN
# ============================================================

def evaluate_meal_balance(
    calories: float,
    protein_g: float,
    carb_g: float,
    fat_g: float,
    target_calories: float = 2000.0
) -> Dict[str, Any]:
    """
    Đánh giá cân đối macro của bữa ăn theo tỷ lệ chuẩn.
    Trả về nhận xét xác định (deterministic) — không phụ thuộc AI.
    """
    total_macro_cal = protein_g * 4 + carb_g * 4 + fat_g * 9
    if total_macro_cal == 0:
        return {"balance": "unknown", "notes": [], "score": 0}

    pct_pro = (protein_g * 4 / total_macro_cal) * 100
    pct_carb = (carb_g * 4 / total_macro_cal) * 100
    pct_fat = (fat_g * 9 / total_macro_cal) * 100
    pct_of_daily = round((calories / target_calories) * 100, 1) if target_calories > 0 else 0

    notes = []
    if pct_pro < 15:
        notes.append("⚠️ Ít đạm — thêm thịt, cá, trứng, đậu phụ để tăng đạm.")
    elif pct_pro > 40:
        notes.append("ℹ️ Nhiều đạm — phù hợp cho tăng cơ, cần uống đủ nước.")

    if pct_carb > 65:
        notes.append("⚠️ Nhiều tinh bột — có thể giảm cơm/bún và thêm rau.")
    elif pct_carb < 30:
        notes.append("ℹ️ Ít tinh bột — phù hợp cho chế độ Low-carb/Keto.")

    if pct_fat > 40:
        notes.append("⚠️ Nhiều chất béo — hạn chế đồ chiên và nước béo.")

    if not notes:
        notes.append("✅ Bữa ăn cân đối — tỷ lệ Đạm/Bột/Béo trong ngưỡng khuyến nghị.")

    return {
        "calories": round(calories, 1),
        "protein_g": round(protein_g, 1),
        "carb_g": round(carb_g, 1),
        "fat_g": round(fat_g, 1),
        "pct_protein": round(pct_pro, 1),
        "pct_carb": round(pct_carb, 1),
        "pct_fat": round(pct_fat, 1),
        "pct_of_daily_target": pct_of_daily,
        "notes": notes,
    }


# ============================================================
# 4. TẠO CONTEXT CHO AI PROMPT (RAG Reference)
# ============================================================

def build_food_catalog_context(db: Session) -> str:
    """
    Lấy toàn bộ danh sách món ăn từ DB và build chuỗi reference context
    để inject vào AI prompt — giúp AI chỉ nhận diện theo tên chuẩn trong DB.
    """
    try:
        from app.models import Food
    except ImportError:
        from models import Food

    foods = db.query(Food).all()
    if not foods:
        return "Danh sách món ăn đang trống."

    lines = []
    for f in foods:
        nut = f.nutrition
        default_serving = next((s for s in f.servings if s.is_default), f.servings[0] if f.servings else None)
        gram = float(default_serving.weight_gram) if default_serving else 300.0
        cal_serving = round(float(nut.calories_kcal) * gram / 100) if nut else "?"
        lines.append(
            f"- {f.name} | {f.category} | Khẩu phần chuẩn: {gram:.0f}g | "
            f"~{cal_serving} kcal/khẩu phần | {float(nut.calories_kcal):.0f} kcal/100g"
        )
    return "\n".join(lines)


def build_user_context(user_profile) -> str:
    """
    Build chuỗi mô tả thông tin người dùng để inject vào AI chatbot prompt.
    Đảm bảo AI biết ngân sách Calo, dị ứng và mục tiêu của người dùng.
    """
    if not user_profile:
        return "Chưa có hồ sơ người dùng."

    p = user_profile
    allergies_str = ", ".join(p.allergies) if p.allergies else "Không có"
    disliked_str = ", ".join(p.disliked_ingredients) if p.disliked_ingredients else "Không có"
    goal_label = GOAL_LABELS.get(p.goal or "maintain", p.goal or "maintain")
    activity_label = ACTIVITY_LABELS.get(float(p.activity_level or 1.375), "")

    return f"""=== HỒ SƠ NGƯỜI DÙNG ===
Mục tiêu: {goal_label}
TDEE: {float(p.tdee or 2000):.0f} kcal/ngày
Calo mục tiêu: {float(p.target_calories or 2000):.0f} kcal/ngày
Protein mục tiêu: {float(p.target_protein_g or 150):.0f}g/ngày
Carb mục tiêu: {float(p.target_carb_g or 225):.0f}g/ngày
Fat mục tiêu: {float(p.target_fat_g or 55):.0f}g/ngày
BMI: {float(p.bmi or 22):.1f}
Mức vận động: {activity_label}
Chế độ ăn: {p.diet_type or 'Thường'}
Dị ứng / không dùng: {allergies_str}
Không thích: {disliked_str}"""


def build_today_intake_context(today_logs: List[Dict]) -> str:
    """Build chuỗi tóm tắt lượng đã ăn hôm nay để AI tư vấn chính xác."""
    if not today_logs:
        return "Hôm nay chưa ghi nhận bữa ăn nào."

    total_cal = sum(item.get("calories", 0) for item in today_logs)
    total_pro = sum(item.get("protein", 0) for item in today_logs)
    lines = [f"=== ĐÃ ĂN HÔM NAY ({total_cal:.0f} kcal, {total_pro:.0f}g đạm) ==="]
    for item in today_logs:
        lines.append(
            f"- {item.get('meal_type','?').upper()}: {item.get('food_name','?')} "
            f"({item.get('calories', 0):.0f} kcal)"
        )
    return "\n".join(lines)
