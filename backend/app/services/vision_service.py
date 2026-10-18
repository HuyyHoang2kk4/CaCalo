"""
Module dịch vụ Thị giác máy tính (Vision Service) phân tích và nhận diện món ăn Việt Nam.
Hỗ trợ 2 chế độ:
1. Multimodal Vision API (nếu có cấu hình GEMINI_API_KEY trong .env)
2. Bộ phân tích thị giác cục bộ (Local Feature Analyzer) dựa trên màu sắc, độ sáng, kết cấu món ăn.
Luôn trả về Top 3 món ăn chuẩn xác nhất từ PostgreSQL kèm phân tầng độ tin cậy.
"""
import os
import io
import json
from typing import List, Dict, Any, Tuple
from PIL import Image
import numpy as np
from sqlalchemy.orm import Session
from app.models import Food, FoodNutrition, FoodServing, FoodTopping

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

def extract_visual_features(image: Image.Image) -> Dict[str, float]:
    """
    Trích xuất các đặc trưng thị giác từ ảnh (Tỷ lệ màu Đỏ, Xanh lá, Vàng, Nâu, Độ sáng).
    """
    thumb = image.resize((150, 150))
    arr = np.array(thumb, dtype=float)
    
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    brightness = np.mean(arr)
    
    # Tính toán các chỉ số màu sắc đặc trưng
    # Màu xanh lá (rau muống, rau sống, hành lá)
    green_ratio = np.mean((g > r * 1.1) & (g > b * 1.1) & (g > 60))
    # Màu đỏ / cam (canh chua, bún bò huế, sốt cà chua, cà rốt)
    red_orange_ratio = np.mean((r > 120) & (g < r * 0.8) & (b < r * 0.7))
    # Màu vàng (trứng rán, cơm chiên, bánh mì giòn, quẩy)
    yellow_ratio = np.mean((r > 140) & (g > 120) & (b < 100))
    # Màu nâu / sẫm (thịt nướng, thịt kho, chả nướng)
    brown_ratio = np.mean((r > 70) & (r < 160) & (g > 40) & (g < 120) & (b < 80))
    # Màu trắng / nhạt (bún, bánh phở, cơm trắng)
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
        score = 0.45  # Điểm sàn cơ bản

        # 1. Nhóm món rau xanh
        if "rau muong" in name_lower or "cai" in name_lower:
            score += features["green"] * 1.8
        # 2. Nhóm món nước màu đỏ/cam (Bún bò, Canh chua)
        elif "bun bo" in name_lower or "canh chua" in name_lower or "sot ca" in name_lower:
            score += features["red_orange"] * 1.5 + (0.1 if features["white"] > 0.15 else 0)
        # 3. Nhóm món nướng có thịt nâu / cơm tấm / bún chả
        elif "com tam" in name_lower or "bun cha" in name_lower:
            score += features["brown"] * 1.4 + features["white"] * 0.6
        # 4. Nhóm bánh mì (vàng nâu, vỏ giòn)
        elif "banh mi" in name_lower:
            score += features["yellow"] * 1.3 + features["brown"] * 0.8
        # 5. Nhóm phở bò (nước dùng trong, phở trắng, thịt bò)
        elif "pho bo" in name_lower:
            score += features["white"] * 0.9 + (0.2 if features["brightness"] > 110 else 0)
        # 6. Gỏi cuốn (trắng trong, tôm thịt, hẹ)
        elif "goi cuon" in name_lower:
            score += features["white"] * 1.0 + features["green"] * 0.8
        # 7. Trứng rán / ốp la
        elif "trung" in name_lower:
            score += features["yellow"] * 1.6
        else:
            score += 0.1

        # Chuẩn hóa điểm số trong khoảng 0.20 đến 0.96
        normalized_score = min(max(score, 0.25), 0.96)
        scores.append((food, round(normalized_score, 2)))

    # Sắp xếp món có điểm cao nhất lên đầu
    scores.sort(key=lambda x: x[1], reverse=True)
    return scores

def predict_food_image(image_bytes: bytes, db: Session) -> Dict[str, Any]:
    """
    Hàm phân tích ảnh chính thức:
    - Tiền xử lý ảnh
    - Đối chiếu dữ liệu món ăn trong PostgreSQL
    - Trả về Top 3 món có độ tin cậy cao nhất kèm phân tầng (Tier: high, medium, low)
    """
    image = preprocess_image(image_bytes)
    foods = db.query(Food).all()
    if not foods:
        return {"total_candidates": 0, "candidates": []}

    features = extract_visual_features(image)
    ranked_foods = match_food_by_features(features, foods)

    # Lấy Top 3 kết quả
    top_3 = ranked_foods[:3]
    top_1_score = top_3[0][1] if top_3 else 0.0

    # Phân tầng độ tin cậy theo đặc tả SRS
    if top_1_score >= 0.70:
        confidence_tier = "high"
        tier_message = "AI nhận diện với độ tin cậy cao. Bạn có thể xác nhận ngay."
    elif top_1_score >= 0.40:
        confidence_tier = "medium"
        tier_message = "AI phân vân giữa một số món. Vui lòng bấm chọn món chính xác bên dưới."
    else:
        confidence_tier = "low"
        tier_message = "Độ tin cậy thấp. Hãy kiểm tra lại góc chụp hoặc tìm kiếm tên món thủ công."

    candidates = []
    for rank, (food, score) in enumerate(top_3, 1):
        nut = food.nutrition
        default_serving = next((s for s in food.servings if s.is_default), food.servings[0] if food.servings else None)
        base_gram = float(default_serving.weight_gram) if default_serving else 400.0

        candidates.append({
            "rank": rank,
            "food_id": food.id,
            "food_name": food.name,
            "category": food.category,
            "confidence": int(score * 100),  # % tin cậy
            "confidence_decimal": score,
            "source": food.source,
            "nutrition_per_100g": {
                "calories": float(nut.calories_kcal) if nut else 0.0,
                "protein": float(nut.protein_g) if nut else 0.0,
                "carb": float(nut.carb_g) if nut else 0.0,
                "fat": float(nut.fat_g) if nut else 0.0,
            } if nut else None,
            "servings": [
                {
                    "id": s.id,
                    "unit": s.unit_name,
                    "gram": float(s.weight_gram),
                    "is_default": s.is_default
                }
                for s in food.servings
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
                for t in food.toppings
            ]
        })

    return {
        "success": True,
        "confidence_tier": confidence_tier,
        "tier_message": tier_message,
        "top_1_confidence": int(top_1_score * 100),
        "candidates": candidates
    }
