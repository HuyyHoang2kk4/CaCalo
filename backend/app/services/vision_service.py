"""
Module dịch vụ Thị giác máy tính (Vision Service) — Kiến trúc Hybrid.
Hỗ trợ 2 chế độ:
1. GPT-4o-mini Vision API (Ưu tiên): Bóc tách đa thành phần món ăn từ ảnh, ước lượng gram.
2. Local Feature Analyzer (Fallback): Phân tích màu sắc/kết cấu nếu GPT không khả dụng.
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
from sqlalchemy.orm import Session

# Tự động thêm thư mục backend vào sys.path để tránh lỗi import trong mọi môi trường
_backend_dir = str(Path(__file__).resolve().parent.parent.parent)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

try:
    from app.models import Food, FoodNutrition, FoodServing, FoodTopping
except ImportError:
    from models import Food, FoodNutrition, FoodServing, FoodTopping

logger = logging.getLogger(__name__)


# ============================================================
# 1. TIỀN XỬ LÝ ẢNH (Dùng chung cho cả 2 chế độ)
# ============================================================

def preprocess_image(image_bytes: bytes) -> Image.Image:
    """
    Tiền xử lý ảnh: Kiểm tra tính hợp lệ, chuyển sang RGB và giới hạn kích thước tối đa 1280px.
    """
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode != "RGB":
        image = image.convert("RGB")

    # Giới hạn kích thước ảnh tối đa 1280px để tăng tốc độ phân tích
    max_dim = 1280
    if max(image.size) > max_dim:
        image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
    return image


def image_to_base64(image: Image.Image, quality: int = 80) -> str:
    """
    Chuyển đổi ảnh PIL thành chuỗi Base64 (JPEG) để gửi cho GPT Vision API.
    """
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=quality)
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")


# ============================================================
# 2. GỌI GPT-4o-mini VISION API (Chế độ chính)
# ============================================================

# System Prompt chuyên biệt cho GPT — Đây là "bộ não" của việc nhận diện
SYSTEM_PROMPT = """Bạn là chuyên gia dinh dưỡng Việt Nam. Nhiệm vụ: Phân tích ảnh món ăn và trả về JSON.

QUY TẮC BẮT BUỘC:
1. Liệt kê TẤT CẢ các thành phần/món ăn nhìn thấy trong ảnh (kể cả đồ ăn kèm như rau sống, nước chấm, quẩy...).
2. Với mỗi thành phần, ước lượng khối lượng (gram) dựa trên kích thước trực quan.
3. Ước tính calo và macro (protein, carb, fat) trên tổng gram đó.
4. Tên món PHẢI viết bằng tiếng Việt chuẩn có dấu (ví dụ: "Phở bò tái", "Cơm trắng", "Trứng ốp la").
5. Nếu không chắc chắn về một món, vẫn liệt kê với ghi chú "không chắc chắn".

CHỈ trả về JSON đúng định dạng sau, KHÔNG thêm markdown, KHÔNG thêm giải thích:
{
  "mon_an": [
    {
      "ten": "Tên món tiếng Việt có dấu",
      "uoc_luong_gram": 350,
      "calo": 480,
      "protein": 25.0,
      "carb": 55.0,
      "fat": 12.0,
      "ghi_chu": "1 tô vừa"
    }
  ],
  "tong_calo": 480,
  "nhan_xet": "Nhận xét ngắn gọn về bữa ăn"
}"""


def call_gpt_vision(image_base64: str) -> Optional[Dict[str, Any]]:
    """
    Gửi ảnh Base64 đến OpenAI GPT-4o-mini Vision API và parse kết quả JSON.
    Trả về None nếu API Key chưa cấu hình hoặc gọi thất bại.
    """
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key or api_key.startswith("sk-your"):
        logger.warning("OPENAI_API_KEY chưa được cấu hình. Chuyển sang chế độ Fallback.")
        return None

    if OpenAI is None:
        logger.warning("Thư viện 'openai' chưa được cài đặt. Chuyển sang chế độ Fallback.")
        return None

    try:
        client = OpenAI(api_key=api_key)

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Hãy phân tích ảnh món ăn này và trả về JSON theo đúng format yêu cầu."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}",
                                "detail": "low"  # Dùng "low" để tiết kiệm token & nhanh hơn
                            }
                        }
                    ]
                }
            ],
            max_tokens=1000,
            temperature=0.3,  # Giữ thấp để kết quả ổn định, ít bịa
            timeout=20  # Timeout 20 giây
        )

        # Trích xuất nội dung text từ response
        raw_text = response.choices[0].message.content.strip()

        # Loại bỏ markdown code block nếu GPT tự thêm (```json ... ```)
        if raw_text.startswith("```"):
            raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
            raw_text = re.sub(r"\s*```$", "", raw_text)

        parsed = json.loads(raw_text)
        logger.info(f"GPT Vision trả về thành công: {len(parsed.get('mon_an', []))} món ăn")
        return parsed

    except json.JSONDecodeError as e:
        logger.error(f"GPT trả về không phải JSON hợp lệ: {e}")
        return None
    except Exception as e:
        logger.error(f"Lỗi gọi OpenAI GPT Vision API: {e}")
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
    for pattern, replace_char in patterns.items():
        result = re.sub(pattern, replace_char, result)
    return result


def match_gpt_item_with_db(item_name: str, estimated_gram: float, db: Session) -> Dict[str, Any]:
    """
    Đối chiếu 1 món GPT nhận diện với bảng foods trong PostgreSQL.
    Ưu tiên: Tìm theo tên có dấu (ILIKE) → Tìm theo tên không dấu → Không khớp.
    Nếu khớp: Tính Calo = (gram / 100) × Calo_100g từ DB (chuẩn xác).
    """
    keyword = item_name.strip()
    keyword_unsigned = remove_vietnamese_accent(keyword).lower()

    # Tìm kiếm trong PostgreSQL: Ưu tiên tên có dấu, sau đó tên không dấu
    food = db.query(Food).filter(
        Food.name.ilike(f"%{keyword}%")
    ).first()

    if not food:
        food = db.query(Food).filter(
            Food.name_unsigned.ilike(f"%{keyword_unsigned}%")
        ).first()

    if not food:
        # Thử tìm bằng từng từ khóa chính (VD: "Phở bò tái chín" → tìm "Phở bò")
        words = keyword.split()
        if len(words) >= 2:
            short_keyword = " ".join(words[:2])
            food = db.query(Food).filter(
                Food.name.ilike(f"%{short_keyword}%")
            ).first()

    if food and food.nutrition:
        nut = food.nutrition
        cal_100 = float(nut.calories_kcal)
        pro_100 = float(nut.protein_g)
        carb_100 = float(nut.carb_g)
        fat_100 = float(nut.fat_g)

        # Tính dinh dưỡng chuẩn xác từ DB
        calo_db = round((cal_100 * estimated_gram) / 100, 1)
        protein_db = round((pro_100 * estimated_gram) / 100, 1)
        carb_db = round((carb_100 * estimated_gram) / 100, 1)
        fat_db = round((fat_100 * estimated_gram) / 100, 1)

        # Lấy serving mặc định
        default_serving = next(
            (s for s in food.servings if s.is_default),
            food.servings[0] if food.servings else None
        )

        return {
            "matched": True,
            "food_id": food.id,
            "food_name": food.name,
            "category": food.category,
            "calo_db": calo_db,
            "protein_db": protein_db,
            "carb_db": carb_db,
            "fat_db": fat_db,
            "calo_per_100g": cal_100,
            "source": food.source,
            "default_serving_gram": float(default_serving.weight_gram) if default_serving else None,
            "default_serving_unit": default_serving.unit_name if default_serving else None,
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
                for t in food.toppings
            ]
        }
    else:
        return {"matched": False}


# ============================================================
# 4. LOCAL FEATURE ANALYZER (Fallback — giữ nguyên logic cũ)
# ============================================================

def extract_visual_features(image: Image.Image) -> Dict[str, float]:
    """
    Trích xuất các đặc trưng thị giác từ ảnh (Tỷ lệ màu Đỏ, Xanh lá, Vàng, Nâu, Độ sáng).
    """
    thumb = image.resize((150, 150))
    arr = np.array(thumb, dtype=float)

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    brightness = np.mean(arr)

    green_ratio = np.mean((g > r * 1.1) & (g > b * 1.1) & (g > 60))
    red_orange_ratio = np.mean((r > 120) & (g < r * 0.8) & (b < r * 0.7))
    yellow_ratio = np.mean((r > 140) & (g > 120) & (b < 100))
    brown_ratio = np.mean((r > 70) & (r < 160) & (g > 40) & (g < 120) & (b < 80))
    white_ratio = np.mean((r > 180) & (g > 180) & (b > 180))

    return {
        "brightness": float(brightness),
        "green": float(green_ratio),
        "red_orange": float(red_orange_ratio),
        "yellow": float(yellow_ratio),
        "brown": float(brown_ratio),
        "white": float(white_ratio),
    }


def match_food_by_features(features: Dict[str, float], foods: List[Food]) -> List[Tuple[Food, float]]:
    """
    Chấm điểm độ tương đồng giữa đặc trưng ảnh và danh mục món ăn Việt Nam trong Database.
    Trả về danh sách sắp xếp theo điểm tin cậy giảm dần.
    """
    scores = []

    for food in foods:
        name_lower = food.name_unsigned.lower()
        score = 0.45

        if "rau muong" in name_lower or "cai" in name_lower:
            score += features["green"] * 1.8
        elif "bun bo" in name_lower or "canh chua" in name_lower or "sot ca" in name_lower:
            score += features["red_orange"] * 1.5 + (0.1 if features["white"] > 0.15 else 0)
        elif "com tam" in name_lower or "bun cha" in name_lower:
            score += features["brown"] * 1.4 + features["white"] * 0.6
        elif "banh mi" in name_lower:
            score += features["yellow"] * 1.3 + features["brown"] * 0.8
        elif "pho bo" in name_lower:
            score += features["white"] * 0.9 + (0.2 if features["brightness"] > 110 else 0)
        elif "goi cuon" in name_lower:
            score += features["white"] * 1.0 + features["green"] * 0.8
        elif "trung" in name_lower:
            score += features["yellow"] * 1.6
        else:
            score += 0.1

        normalized_score = min(max(score, 0.25), 0.96)
        scores.append((food, round(normalized_score, 2)))

    scores.sort(key=lambda x: x[1], reverse=True)
    return scores


def fallback_local_predict(image_bytes: bytes, db: Session) -> Dict[str, Any]:
    """
    Chế độ Fallback: Sử dụng bộ phân tích cục bộ (Local Feature Analyzer) khi GPT không khả dụng.
    Trả về Top 3 món có độ tin cậy cao nhất.
    """
    image = preprocess_image(image_bytes)
    foods = db.query(Food).all()
    if not foods:
        return {"success": False, "ai_source": "local", "items": [], "tong_calo_db": 0}

    features = extract_visual_features(image)
    ranked_foods = match_food_by_features(features, foods)

    top_3 = ranked_foods[:3]
    items = []
    total_calo = 0

    for rank, (food, score) in enumerate(top_3, 1):
        nut = food.nutrition
        default_serving = next(
            (s for s in food.servings if s.is_default),
            food.servings[0] if food.servings else None
        )
        base_gram = float(default_serving.weight_gram) if default_serving else 400.0
        calo = round((float(nut.calories_kcal) * base_gram) / 100, 1) if nut else 0

        if rank == 1:
            total_calo = calo

        items.append({
            "ten": food.name,
            "uoc_luong_gram": base_gram,
            "calo_ai": calo,
            "protein_ai": round((float(nut.protein_g) * base_gram) / 100, 1) if nut else 0,
            "carb_ai": round((float(nut.carb_g) * base_gram) / 100, 1) if nut else 0,
            "fat_ai": round((float(nut.fat_g) * base_gram) / 100, 1) if nut else 0,
            "ghi_chu": f"Khẩu phần chuẩn ({default_serving.unit_name})" if default_serving else "Ước lượng",
            "confidence": int(score * 100),
            "matched_food": {
                "matched": True,
                "food_id": food.id,
                "food_name": food.name,
                "category": food.category,
                "calo_db": calo,
                "protein_db": round((float(nut.protein_g) * base_gram) / 100, 1) if nut else 0,
                "carb_db": round((float(nut.carb_g) * base_gram) / 100, 1) if nut else 0,
                "fat_db": round((float(nut.fat_g) * base_gram) / 100, 1) if nut else 0,
                "calo_per_100g": float(nut.calories_kcal) if nut else 0,
                "source": food.source,
                "default_serving_gram": base_gram,
                "default_serving_unit": default_serving.unit_name if default_serving else None,
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
        "nhan_xet": f"Phân tích cục bộ (GPT không khả dụng). Top 1: {items[0]['ten']} ({items[0].get('confidence', 0)}%)" if items else ""
    }


# ============================================================
# 5. HÀM CHÍNH — PREDICT FOOD IMAGE (Entry Point)
# ============================================================

def predict_food_image(image_bytes: bytes, db: Session) -> Dict[str, Any]:
    """
    Hàm phân tích ảnh chính thức — Kiến trúc Hybrid:
    1. Ưu tiên gọi GPT-4o-mini Vision API để bóc tách thành phần món ăn.
    2. Đối chiếu từng món với PostgreSQL để tính Calo chuẩn xác.
    3. Nếu GPT không khả dụng → Fallback về Local Feature Analyzer.
    """
    # Tiền xử lý ảnh
    image = preprocess_image(image_bytes)
    image_b64 = image_to_base64(image)

    # Thử gọi GPT Vision API
    gpt_result = call_gpt_vision(image_b64)

    if gpt_result is None or "mon_an" not in gpt_result:
        # GPT không khả dụng → Fallback về Local Analyzer
        logger.info("Chuyển sang chế độ Fallback (Local Feature Analyzer)")
        return fallback_local_predict(image_bytes, db)

    # GPT trả về thành công → Đối chiếu với PostgreSQL
    items = []
    tong_calo_ai = 0
    tong_calo_db = 0

    for mon in gpt_result.get("mon_an", []):
        ten = mon.get("ten", "Không rõ")
        gram = mon.get("uoc_luong_gram", 200)
        calo_ai = mon.get("calo", 0)
        protein_ai = mon.get("protein", 0)
        carb_ai = mon.get("carb", 0)
        fat_ai = mon.get("fat", 0)
        ghi_chu = mon.get("ghi_chu", "")

        tong_calo_ai += calo_ai

        # Đối chiếu với CSDL PostgreSQL
        matched = match_gpt_item_with_db(ten, gram, db)

        # Nếu khớp DB → dùng Calo từ DB; không khớp → dùng Calo từ GPT
        if matched.get("matched"):
            tong_calo_db += matched["calo_db"]
        else:
            tong_calo_db += calo_ai

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
        "ai_source": "gpt-4o-mini",
        "items": items,
        "tong_calo_ai": round(tong_calo_ai, 1),
        "tong_calo_db": round(tong_calo_db, 1),
        "nhan_xet": gpt_result.get("nhan_xet", "")
    }
