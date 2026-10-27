"""
Module dịch vụ Thị giác máy tính (Vision Service) — Kiến trúc Hybrid (Google Gemini Flash + PostgreSQL).
Chế độ hoạt động:
1. Google Gemini Flash Vision API (Chính thức, Miễn phí): Bóc tách đa thành phần món ăn từ ảnh, ước lượng gram.
2. Local Feature Analyzer (Dự phòng): Phân tích màu sắc/kết cấu nếu mất mạng hoặc chưa có API Key.
Sau khi nhận diện, đối chiếu với PostgreSQL để tính Calo chuẩn xác từ bảng food_nutritions.
"""
import os
import sys
import io
import re
import json
import base64
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image
import numpy as np
import requests
from sqlalchemy.orm import Session

# Tự động nạp thư mục backend vào sys.path
_backend_dir = str(Path(__file__).resolve().parent.parent.parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

try:
    from app.models import Food, FoodNutrition, FoodServing, FoodTopping
except ImportError:
    from models import Food, FoodNutrition, FoodServing, FoodTopping

logger = logging.getLogger(__name__)


# ============================================================
# 1. TIỀN XỬ LÝ ẢNH
# ============================================================

def preprocess_image(image_bytes: bytes) -> Image.Image:
    """
    Tiền xử lý ảnh: Kiểm tra tính hợp lệ, chuyển sang RGB và giới hạn kích thước tối đa 1280px.
    """
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")

    max_dim = 1280
    if max(image.size) > max_dim:
        image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    return image


def image_to_base64(image: Image.Image, quality: int = 80) -> str:
    """
    Chuyển đổi ảnh PIL thành chuỗi Base64 (JPEG) để gửi cho Gemini Vision API.
    """
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


# ============================================================
# 2. GỌI GOOGLE GEMINI FLASH VISION API
# ============================================================

def build_vision_prompt(db: Session) -> str:
    """
    Xây dựng Vision Prompt với danh sách tên món ăn CHUẨN từ DB.
    AI bắt buộc phải chọn tên từ danh sách này thay vì tự đặt tên tùy ý.
    Đây là cơ chế 'Constrained AI' — giải quyết vấn đề non-deterministic tên món.
    """
    all_foods = db.query(Food).all()
    food_name_list = "\n".join(f"- {f.name}" for f in all_foods)

    return f"""Bạn là chuyên gia dinh dưỡng ẩm thực Việt Nam hàng đầu.
Nhiệm vụ: Phân tích ảnh chụp bữa ăn/món ăn và trả về kết quả JSON thuần túy.

DANH SÁCH TÊN MÓN HỢP LỆ (BẮT BUỘC dùng đúng tên trong danh sách này):
{food_name_list}

QUY TẮC NHẬN DIỆN & ĐỐI CHIẾU CƠ SỞ DỮ LIỆU:
1. Liệt kê TẤT CẢ các thành phần/món ăn nhìn thấy trong ảnh.
2. Với mỗi thành phần:
   - ƯU TIÊN CAO NHẤT: Nếu món khớp hoặc tương đương món trong "DANH SÁCH TÊN MÓN HỢP LỆ" ở trên → BẮT BUỘC dùng chính xác tên đó để hệ thống tra cứu CSDL Viện Dinh Dưỡng.
   - TRƯỜNG HỢP MÓN NGOẠI LỆ (món mới, món Tây, món tự nấu đặc thù chưa có trong danh sách) → Giữ tên gọi chính xác thực tế của món đó, ước tính dinh dưỡng sơ bộ (Calo, P, C, F) và ghi chú: "Chưa có trong DB chuẩn".
3. Ước lượng khối lượng (gram) thực tế từ ảnh — đây là ước tính quan trọng nhất từ AI thị giác.
4. Điền sơ bộ Calo, Protein, Carb, Fat (nếu món có trong DB, backend sẽ tự động ghi đè bằng số chuẩn).
5. Trả về DUY NHẤT một chuỗi JSON hợp lệ, KHÔNG thêm markdown code block hay lời giải thích.

ĐỊNH DẠNG JSON BẮT BUỘC:
{{
  "mon_an": [
    {{
      "ten": "Tên CHÍNH XÁC từ danh sách hợp lệ",
      "uoc_luong_gram": 150,
      "calo": 195,
      "protein": 3.5,
      "carb": 42.0,
      "fat": 0.5,
      "ghi_chu": "Ghi chú về khẩu phần hoặc lý do chọn tên này"
    }}
  ],
  "tong_calo": 480,
  "nhan_xet": "Nhận xét ngắn gọn về bữa ăn"
}}"""


def call_gemini_vision(image_base64: str, system_prompt: str) -> Optional[Dict[str, Any]]:
    """
    Gửi ảnh đến Google Gemini Flash Vision API và parse kết quả JSON.
    Nhận system_prompt đã được inject danh sách tên món từ DB (Constrained AI).
    AI bị ràng buộc phải chọn tên từ danh sách hợp lệ — tăng match rate lên ~95%.
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_key or gemini_key.startswith("your-"):
        logger.warning("GEMINI_API_KEY chưa được cấu hình trong .env.")
        return None

    try:
        from google import genai
        from google.genai import types

        # Cấu hình timeout 12s cho mỗi model để không bị treo
        client = genai.Client(
            api_key=gemini_key,
            http_options=types.HttpOptions(timeout=12000)
        )
        img_bytes = base64.b64decode(image_base64)
        user_instruction = "Hãy phân tích ảnh món ăn này và xuất đúng định dạng JSON yêu cầu. Nhớ dùng tên chính xác từ danh sách hợp lệ."

        # Ưu tiên flash-lite: Tốc độ cực nhanh (~1.5s - 4s), nhẹ và ít bị nghẽn mạng
        models = [
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.7-flash",
            "gemini-flash-lite-latest",
        ]
        for model_name in models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[
                        types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                        user_instruction
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        temperature=0.1   # Giảm xuống 0.1 để tên món ổn định hơn
                    )
                )

                raw_text = response.text.strip()
                if raw_text.startswith("```"):
                    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
                    raw_text = re.sub(r"\s*```$", "", raw_text)

                parsed = json.loads(raw_text)
                parsed["_model_used"] = model_name
                logger.info(
                    f"Google Gemini ({model_name}) Vision thành công: {len(parsed.get('mon_an', []))} món."
                )
                return parsed
            except Exception as model_err:
                logger.warning(f"Thử nghiệm Gemini model {model_name} thất bại hoặc timeout: {model_err}")

    except Exception as e:
        logger.error(f"Lỗi gọi Google Gemini Vision API: {e}")

    return None


# ============================================================
# 3. ĐỐI CHIẾU VỚI CSDL POSTGRESQL (Fuzzy Matching)
# ============================================================

def remove_vietnamese_accent(text: str) -> str:
    """Chuyển chuỗi tiếng Việt có dấu sang không dấu để so khớp."""
    patterns = {
        '[àáảãạăằắẳẵặâầấẩẫậ]': 'a', '[èéẻẽẹêềếểễệ]': 'e',
        '[ìíỉĩị]': 'i', '[òóỏõọôồốổỗộơờớởỡợ]': 'o',
        '[ùúủũụưừứửữự]': 'u', '[ỳýỷỹỵ]': 'y', '[đ]': 'd',
        '[ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ]': 'A', '[ÈÉẺẼẸÊỀẾỂỄỆ]': 'E',
        '[ÌÍỈĨỊ]': 'I', '[ÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ]': 'O',
        '[ÙÚỦŨỤƯỪỨỬỮỰ]': 'U', '[ỲÝỶỸỴ]': 'Y', '[Đ]': 'D',
    }
    result = text
    for pattern, replacement in patterns.items():
        result = re.sub(pattern, replacement, result)
    return result.lower().strip()


def calculate_string_similarity(s1: str, s2: str) -> float:
    """Tính độ tương đồng đơn giản giữa 2 chuỗi (Jaccard similarity trên tập từ)."""
    w1 = set(s1.split())
    w2 = set(s2.split())
    if not w1 or not w2:
        return 0.0
    intersection = w1.intersection(w2)
    union = w1.union(w2)
    return len(intersection) / len(union)


def match_item_with_db(ai_name: str, ai_gram: float, db: Session) -> Dict[str, Any]:
    """
    Đối chiếu món ăn bóc tách từ Gemini với bảng `foods` trong PostgreSQL:
    1. So khớp chính xác tên (case-insensitive).
    2. So khớp không dấu.
    3. So khớp từ khóa / tương đồng chuỗi.
    Nếu tìm thấy món trong DB:
    - Lấy thông số dinh dưỡng từ bảng `food_nutritions` (trên 100g chuẩn).
    - Tính Calo, Protein, Carb, Fat chuẩn theo số gram thực tế do AI ước tính.
    """
    clean_ai_name = ai_name.strip()
    ai_unaccent = remove_vietnamese_accent(clean_ai_name)

    all_foods = db.query(Food).all()

    best_match = None
    best_score = 0.0

    for food in all_foods:
        food_name = food.name.strip()
        food_unaccent = remove_vietnamese_accent(food_name)

        # 1. So khớp chính xác
        if clean_ai_name.lower() == food_name.lower():
            best_match = food
            best_score = 1.0
            break

        # 2. So khớp không dấu chính xác
        if ai_unaccent == food_unaccent:
            best_match = food
            best_score = 0.95
            break

        # 3. Một chuỗi chứa chuỗi kia
        if ai_unaccent in food_unaccent or food_unaccent in ai_unaccent:
            score = 0.8
            if score > best_score:
                best_score = score
                best_match = food
            continue

        # 4. Độ tương đồng từ khóa
        score = calculate_string_similarity(ai_unaccent, food_unaccent)
        if score > best_score and score >= 0.4:
            best_score = score
            best_match = food

    if best_match:
        nutrition = best_match.nutrition
        ratio = ai_gram / 100.0

        if nutrition:
            cal_db = round(float(nutrition.calories_kcal) * ratio)
            pro_db = round(float(nutrition.protein_g) * ratio, 1)
            carb_db = round(float(nutrition.carb_g) * ratio, 1)
            fat_db = round(float(nutrition.fat_g) * ratio, 1)
        else:
            cal_db = 0
            pro_db = 0.0
            carb_db = 0.0
            fat_db = 0.0

        servings = [
            {
                "id": s.id, "name": s.unit_name,
                "gram": float(s.weight_gram),
                "is_default": s.is_default
            }
            for s in best_match.servings
        ]

        toppings = [
            {
                "id": t.id, "name": t.name,
                "gram": float(t.weight_gram),
                "calories": float(t.calories_kcal),
                "protein": float(t.protein_g),
                "carb": float(t.carb_g),
                "fat": float(t.fat_g)
            }
            for t in best_match.toppings
        ]

        return {
            "matched": True,
            "food_id": best_match.id,
            "db_food_name": best_match.name,
            "confidence": round(best_score * 100, 1),
            "calo_db": cal_db,
            "protein_db": pro_db,
            "carb_db": carb_db,
            "fat_db": fat_db,
            "calo_per_100g": float(nutrition.calories_kcal) if nutrition else 0.0,
            "protein_per_100g": float(nutrition.protein_g) if nutrition else 0.0,
            "carb_per_100g": float(nutrition.carb_g) if nutrition else 0.0,
            "fat_per_100g": float(nutrition.fat_g) if nutrition else 0.0,
            "data_source": best_match.source or "CSDL CaCalo",
            "servings": servings,
            "toppings": toppings
        }

    return {
        "matched": False,
        "food_id": None,
        "db_food_name": None,
        "confidence": 0,
        "calo_db": 0,
        "protein_db": 0,
        "carb_db": 0,
        "fat_db": 0,
        "calo_per_100g": 0.0,
        "protein_per_100g": 0.0,
        "carb_per_100g": 0.0,
        "fat_per_100g": 0.0,
        "data_source": "Google Gemini AI ước lượng",
        "servings": [],
        "toppings": []
    }


# ============================================================
# 4. CHẾ ĐỘ DỰ PHÒNG CỤC BỘ (Local Fallback)
# ============================================================

def local_extract_features(image: Image.Image) -> Dict[str, float]:
    """Trích xuất dải màu sắc ảnh làm đặc trưng cơ bản."""
    img_small = image.resize((150, 150))
    arr = np.array(img_small, dtype=np.float32) / 255.0

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    diff = max_c - min_c

    s = np.where(max_c == 0, 0, diff / (max_c + 1e-6))
    v = max_c

    h = np.zeros_like(max_c)
    mask_r = (max_c == r) & (diff > 0)
    mask_g = (max_c == g) & (diff > 0)
    mask_b = (max_c == b) & (diff > 0)

    h[mask_r] = (60.0 * ((g[mask_r] - b[mask_r]) / diff[mask_r]) + 360.0) % 360.0
    h[mask_g] = (60.0 * ((b[mask_g] - r[mask_g]) / diff[mask_g]) + 120.0) % 360.0
    h[mask_b] = (60.0 * ((r[mask_b] - g[mask_b]) / diff[mask_b]) + 240.0) % 360.0

    yellow_score = float(np.mean((h >= 35) & (h <= 65) & (s > 0.25) & (v > 0.4)))
    green_score = float(np.mean((h >= 75) & (h <= 160) & (s > 0.2) & (v > 0.3)))
    red_score = float(np.mean(((h >= 340) | (h <= 20)) & (s > 0.3) & (v > 0.3)))
    brown_score = float(np.mean((h >= 15) & (h <= 40) & (s > 0.3) & (v < 0.6)))
    white_score = float(np.mean((s < 0.2) & (v > 0.75)))

    gray = 0.299 * r + 0.587 * g + 0.114 * b
    dx = np.diff(gray, axis=1)
    dy = np.diff(gray, axis=0)
    texture_score = float(np.mean(np.abs(dx)) + np.mean(np.abs(dy)))

    return {
        "yellow": yellow_score,
        "green": green_score,
        "red": red_score,
        "brown": brown_score,
        "white": white_score,
        "texture": texture_score
    }


def local_match_candidates(features: Dict[str, float], db: Session, top_k: int = 3) -> List[Tuple[Food, float]]:
    foods = db.query(Food).all()
    if not foods:
        return []

    scored_foods = []
    for food in foods:
        score = 0.3
        cat = food.category or ""
        fn = food.name.lower()

        if "pho" in fn or "phở" in fn or "bún" in fn:
            score += features["white"] * 0.4 + features["brown"] * 0.3
        elif "cơm" in fn or "com" in fn:
            score += features["white"] * 0.4 + features["yellow"] * 0.3
        elif "salad" in fn or "rau" in fn:
            score += features["green"] * 0.6
        elif "thịt" in fn or "sườn" in fn or "bò" in fn:
            score += features["red"] * 0.4 + features["brown"] * 0.3
        elif "trứng" in fn:
            score += features["yellow"] * 0.5 + features["white"] * 0.3

        if cat == "Món nước":
            score += features["white"] * 0.2
        elif cat == "Món chính":
            score += features["yellow"] * 0.2

        score = min(max(score, 0.05), 0.98)
        scored_foods.append((food, score))

    scored_foods.sort(key=lambda x: x[1], reverse=True)
    return scored_foods[:top_k]


def fallback_local_predict(image_bytes: bytes, db: Session) -> Dict[str, Any]:
    image = preprocess_image(image_bytes)
    features = local_extract_features(image)
    candidates = local_match_candidates(features, db, top_k=3)

    items = []
    total_calo = 0

    for food, conf in candidates:
        default_serving = next((s for s in food.servings if s.is_default), None)
        gram = float(default_serving.weight_gram) if default_serving else 100.0

        nutrition = food.nutrition
        ratio = gram / 100.0
        calo = round(float(nutrition.calories_kcal) * ratio) if nutrition else 200
        pro = round(float(nutrition.protein_g) * ratio, 1) if nutrition else 10.0
        carb = round(float(nutrition.carb_g) * ratio, 1) if nutrition else 25.0
        fat = round(float(nutrition.fat_g) * ratio, 1) if nutrition else 5.0
        total_calo += calo

        items.append({
            "ten": food.name,
            "uoc_luong_gram": gram,
            "calo_ai": calo,
            "protein_ai": pro,
            "carb_ai": carb,
            "fat_ai": fat,
            "ghi_chu": f"Khẩu phần chuẩn ({default_serving.unit_name if default_serving else 'Mặc định'})",
            "matched_food": {
                "matched": True,
                "food_id": food.id,
                "db_food_name": food.name,
                "confidence": round(conf * 100, 1),
                "calo_db": calo,
                "protein_db": pro,
                "carb_db": carb,
                "fat_db": fat,
                "calo_per_100g": float(nutrition.calories_kcal) if nutrition else (round(calo * 100.0 / gram, 1) if gram else 200.0),
                "protein_per_100g": float(nutrition.protein_g) if nutrition else (round(pro * 100.0 / gram, 1) if gram else 10.0),
                "carb_per_100g": float(nutrition.carb_g) if nutrition else (round(carb * 100.0 / gram, 1) if gram else 25.0),
                "fat_per_100g": float(nutrition.fat_g) if nutrition else (round(fat * 100.0 / gram, 1) if gram else 5.0),
                "data_source": food.source or "CSDL CaCalo",
                "servings": [
                    {
                        "id": s.id, "name": s.unit_name,
                        "gram": float(s.weight_gram),
                        "is_default": s.is_default
                    }
                    for s in food.servings
                ],
                "toppings": [
                    {
                        "id": t.id, "name": t.name,
                        "gram": float(t.weight_gram),
                        "calories": float(t.calories_kcal),
                        "protein": float(t.protein_g),
                        "carb": float(t.carb_g),
                        "fat": float(t.fat_g)
                    }
                    for t in food.toppings
                ]
            }
        })

    return {
        "success": True,
        "ai_source": "local_fallback",
        "items": items,
        "tong_calo_ai": total_calo,
        "tong_calo_db": total_calo,
        "nhan_xet": f"Phân tích cục bộ (Gemini không khả dụng). Top 1: {items[0]['ten']} ({items[0].get('confidence', 0)}%)" if items else ""
    }


# ============================================================
# 5. HÀM CHÍNH — PREDICT FOOD IMAGE (Entry Point)
# ============================================================

def predict_food_image(image_bytes: bytes, db: Session) -> Dict[str, Any]:
    """
    Hàm phân tích ảnh 100% sử dụng Google Gemini Flash Vision API:
    1. Xây dựng prompt kèm danh sách món ăn từ DB để AI ưu tiên nhận diện chuẩn hóa.
    2. Gọi trực tiếp Gemini Vision (100% AI, không dùng local fallback).
    3. Nếu món khớp trong CSDL -> Lấy Calo & Macro chuẩn từ Viện Dinh Dưỡng.
       Nếu món mới ngoài DB -> Dùng trực tiếp số liệu do Gemini AI tính toán.
    4. Không bao giờ đoán mò bằng Local Fallback.
    """
    image = preprocess_image(image_bytes)
    image_b64 = image_to_base64(image)

    # 1. Xây dựng prompt với danh sách tên chuẩn từ DB (Constrained AI)
    vision_prompt = build_vision_prompt(db)

    # 2. Gọi Gemini với prompt đã inject DB food list
    ai_result = call_gemini_vision(image_b64, vision_prompt)

    if not ai_result or not isinstance(ai_result, dict):
        return {
            "success": False,
            "ai_source": "gemini-3.5-flash",
            "items": [],
            "tong_calo_ai": 0,
            "tong_calo_db": 0,
            "error": "Không thể kết nối đến Google Gemini AI Vision. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau vài giây.",
            "nhan_xet": "Lỗi kết nối AI"
        }

    raw_items = ai_result.get("mon_an", [])
    if not raw_items:
        return {
            "success": False,
            "ai_source": "gemini-3.5-flash",
            "items": [],
            "tong_calo_ai": 0,
            "tong_calo_db": 0,
            "error": "Google Gemini AI không tìm thấy món ăn nào trong ảnh. Vui lòng chụp rõ món ăn hơn.",
            "nhan_xet": ai_result.get("nhan_xet", "Không nhận diện được món ăn.")
        }

    # 3. Bóc tách và đối chiếu CSDL PostgreSQL
    items = []
    tong_calo_ai = 0
    tong_calo_db = 0

    for mon in raw_items:
        ten = str(mon.get("ten", "Không rõ")).strip()
        try:
            gram = float(mon.get("uoc_luong_gram", 200))
        except (ValueError, TypeError):
            gram = 200.0

        try:
            calo_ai = round(float(mon.get("calo", 0)))
        except (ValueError, TypeError):
            calo_ai = 200

        try:
            protein_ai = round(float(mon.get("protein", 0)), 1)
        except (ValueError, TypeError):
            protein_ai = 10.0

        try:
            carb_ai = round(float(mon.get("carb", 0)), 1)
        except (ValueError, TypeError):
            carb_ai = 25.0

        try:
            fat_ai = round(float(mon.get("fat", 0)), 1)
        except (ValueError, TypeError):
            fat_ai = 5.0

        ghi_chu = mon.get("ghi_chu", "")
        tong_calo_ai += calo_ai

        # Đối chiếu với DB
        matched = match_item_with_db(ten, gram, db)

        if matched.get("matched"):
            tong_calo_db += matched["calo_db"]
        else:
            tong_calo_db += calo_ai
            matched["calo_db"] = calo_ai
            matched["protein_db"] = protein_ai
            matched["carb_db"] = carb_ai
            matched["fat_db"] = fat_ai
            matched["calo_per_100g"] = round((calo_ai * 100.0 / gram), 1) if gram > 0 else 200.0
            matched["protein_per_100g"] = round((protein_ai * 100.0 / gram), 1) if gram > 0 else 10.0
            matched["carb_per_100g"] = round((carb_ai * 100.0 / gram), 1) if gram > 0 else 25.0
            matched["fat_per_100g"] = round((fat_ai * 100.0 / gram), 1) if gram > 0 else 5.0
            logger.info(f"Món ăn ngoài DB: '{ten}' — tính theo số liệu Gemini AI ({calo_ai} kcal)")

        items.append({
            "ten": ten,
            "uoc_luong_gram": gram,
            "calo_ai": calo_ai,
            "protein_ai": protein_ai,
            "carb_ai": carb_ai,
            "fat_ai": fat_ai,
            "ghi_chu": ghi_chu,
            "matched_food": matched
        })

    return {
        "success": True,
        "ai_source": "gemini-3.5-flash",
        "items": items,
        "tong_calo_ai": tong_calo_ai,
        "tong_calo_db": tong_calo_db,
        "nhan_xet": ai_result.get("nhan_xet", "Bữa ăn cân đối dinh dưỡng."),
        "raw_ai_response": ai_result
    }
