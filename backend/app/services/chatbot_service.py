"""
Module dịch vụ Chatbot AI (CaCalo) — Kiến trúc RAG (Retrieval-Augmented Generation).

NGUYÊN TẮC THIẾT KẾ (theo CC-3.4 & AI Guardrails §1.2.3):
  - AI (Gemini) CHỈ làm nhiệm vụ: hiểu ngôn ngữ tự nhiên, diễn đạt câu trả lời.
  - TOÀN BỘ số liệu Calo, Protein, Carb, Fat, BMI, TDEE được lấy từ DB hoặc
    tính bằng nutrition_logic.py — AI không được tự suy diễn hay bịa số.
  - Prompt luôn được inject: [1] Hồ sơ người dùng, [2] Danh sách món ăn DB,
    [3] Nhật ký ăn hôm nay, [4] Quy tắc ràng buộc cứng (dị ứng, dị ứng thực phẩm).
  - Nếu người dùng hỏi về món cụ thể trong DB → trả về food_id để frontend
    tính toán deterministic; AI không tự tính.
"""
import os
import re
import json
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

try:
    from app.services.nutrition_logic import (
        build_food_catalog_context,
        build_user_context,
        build_today_intake_context,
        evaluate_meal_balance,
    )
    from app.models import Food, Recipe, RecipeIngredient, Ingredient
except ImportError:
    from services.nutrition_logic import (
        build_food_catalog_context,
        build_user_context,
        build_today_intake_context,
        evaluate_meal_balance,
    )
    from models import Food, Recipe, RecipeIngredient, Ingredient

logger = logging.getLogger(__name__)


# ============================================================
# 1. XÂY DỰNG SYSTEM PROMPT (RAG Context Injection)
# ============================================================

RAG_SYSTEM_PROMPT_TEMPLATE = """\
Bạn là CaCalo AI — Trợ lý dinh dưỡng thông minh của ứng dụng CaCalo Việt Nam.

=== QUY TẮC BẮT BUỘC ===
1. Phạm vi tư vấn: Chỉ tư vấn về dinh dưỡng, tính calo, món ăn, sức khỏe ăn uống và lối sống lành mạnh.
2. NGUYÊN TẮC SỐ LIỆU DINH DƯỠNG:
   - Với các món CÓ trong "DANH SÁCH MÓN ĂN TRONG HỆ THỐNG": BẮT BUỘC dùng chính xác số liệu Calo/Macro từ danh sách (đây là số chuẩn từ Viện Dinh Dưỡng).
   - Với các món CHƯA CÓ trong danh sách: Được phép ước tính sơ bộ dựa trên kiến thức ẩm thực tổng quát, NHƯNG BẮT BUỘC phải kèm ghi chú: "(⚠️ Món này chưa có trong CSDL chuẩn của CaCalo, số liệu mang tính tham khảo)" và có thể gợi ý người dùng chia nhỏ nguyên liệu để kiểm tra chuẩn hơn.
3. Khi đề xuất món ăn/thực đơn: ƯU TIÊN các món có trong "DANH SÁCH MÓN ĂN" hoặc "DANH SÁCH CÔNG THỨC" bên dưới để người dùng dễ ghi vào nhật ký.
4. Dị ứng và không thích là RÀNG BUỘC CỨNG — tuyệt đối không gợi ý các món chứa thành phần bị dị ứng.
5. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn (3–6 câu), không lặp lại câu hỏi.
6. Nếu câu hỏi nằm ngoài phạm vi dinh dưỡng/ẩm thực, lịch sự từ chối và hướng dẫn đúng chủ đề.
7. Kết thúc câu trả lời bằng một câu gợi ý hành động cụ thể (ví dụ: "Bạn có muốn tôi ghi bữa này vào nhật ký không?").

{user_context}

{today_context}

=== DANH SÁCH MÓN ĂN TRONG HỆ THỐNG (tham chiếu bắt buộc) ===
{food_catalog}

=== DANH SÁCH CÔNG THỨC NẤU ĂN ===
{recipe_catalog}
"""


def _build_recipe_catalog(db: Session) -> str:
    """Lấy danh sách công thức từ DB để inject vào prompt."""
    try:
        recipes = db.query(Recipe).all()
        if not recipes:
            return "Chưa có công thức nào trong hệ thống."
        lines = []
        for r in recipes:
            lines.append(
                f"- {r.title} | {r.total_calories:.0f} kcal | "
                f"Đạm: {r.protein_g:.0f}g | "
                f"Nấu ~{(r.prep_time_minutes or 0) + (r.cook_time_minutes or 0)} phút"
            )
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"Không thể tải recipe catalog: {e}")
        return "Chưa có công thức."


def build_rag_system_prompt(
    db: Session,
    user_profile=None,
    today_logs: Optional[List[Dict]] = None
) -> str:
    """
    Xây dựng system prompt đầy đủ với context từ DB.
    Đây là trái tim của kiến trúc RAG — đảm bảo AI chỉ trả lời
    dựa trên dữ liệu đã được kiểm soát.
    """
    food_catalog = build_food_catalog_context(db)
    recipe_catalog = _build_recipe_catalog(db)
    user_ctx = build_user_context(user_profile)
    today_ctx = build_today_intake_context(today_logs or [])

    return RAG_SYSTEM_PROMPT_TEMPLATE.format(
        user_context=user_ctx,
        today_context=today_ctx,
        food_catalog=food_catalog,
        recipe_catalog=recipe_catalog,
    )


# ============================================================
# 2. TRÍCH XUẤT Ý ĐỊNH NGƯỜI DÙNG (Intent Detection)
# ============================================================

def detect_intent(message: str) -> str:
    """
    Phân loại ý định câu hỏi để xử lý phù hợp.
    Deterministic — không dùng AI để phân loại.
    """
    msg_lower = message.lower()

    if any(kw in msg_lower for kw in ["nấu", "nấu gì", "nguyên liệu", "trong tủ", "có sẵn", "bếp"]):
        return "suggest_recipe"

    if any(kw in msg_lower for kw in ["calo", "kcal", "dinh dưỡng", "protein", "đạm", "carb", "béo"]):
        return "nutrition_query"

    if any(kw in msg_lower for kw in ["hôm nay ăn", "còn lại", "ngân sách", "đã ăn", "bao nhiêu calo"]):
        return "today_summary"

    if any(kw in msg_lower for kw in ["giảm cân", "tăng cân", "tăng cơ", "giữ cân", "ăn gì", "nên ăn"]):
        return "diet_advice"

    if any(kw in msg_lower for kw in ["bmi", "tdee", "bmr", "chỉ số", "thể trạng"]):
        return "health_metric"

    return "general"


# ============================================================
# 3. XỬ LÝ CÁC INTENT ĐẶC BIỆT (Deterministic Handlers)
# ============================================================

def handle_today_summary(user_profile, today_logs: List[Dict]) -> Optional[Dict]:
    """
    Trả lời câu hỏi 'Hôm nay tôi đã ăn bao nhiêu calo?' — hoàn toàn từ DB, không cần AI.
    """
    if not today_logs:
        return {
            "reply": "Hôm nay bạn chưa ghi nhận bữa ăn nào trong nhật ký CaCalo. "
                     "Hãy chụp ảnh món ăn hoặc tìm kiếm để bắt đầu theo dõi nhé!",
            "intent": "today_summary",
            "data": {"logged": False}
        }

    total_cal = sum(item.get("calories", 0) for item in today_logs)
    total_pro = sum(item.get("protein", 0) for item in today_logs)
    total_carb = sum(item.get("carb", 0) for item in today_logs if "carb" in item)
    total_fat = sum(item.get("fat", 0) for item in today_logs if "fat" in item)

    target = float(getattr(user_profile, "target_calories", 2000) or 2000) if user_profile else 2000.0
    remaining = target - total_cal

    balance = evaluate_meal_balance(total_cal, total_pro, total_carb, total_fat, target)
    balance_note = " ".join(balance.get("notes", []))

    reply = (
        f"Hôm nay bạn đã nạp **{total_cal:.0f} kcal** "
        f"(còn lại {max(0, remaining):.0f} kcal trong ngân sách {target:.0f} kcal). "
        f"Đạm: {total_pro:.0f}g. {balance_note}"
    )

    if remaining < 0:
        reply += f" ⚠️ Bạn đã vượt ngân sách {abs(remaining):.0f} kcal — nên tránh ăn nhẹ tối nay."
    elif remaining < 300:
        reply += " Ngân sách còn rất ít — chỉ nên ăn nhẹ (trái cây, sữa chua)."

    return {
        "reply": reply,
        "intent": "today_summary",
        "data": {
            "total_calories": round(total_cal, 1),
            "remaining_calories": round(remaining, 1),
            "target_calories": target,
            "balance": balance,
        }
    }


def handle_health_metric(user_profile) -> Optional[Dict]:
    """Trả lời câu hỏi về BMI, TDEE từ hồ sơ — không cần AI."""
    if not user_profile:
        return {
            "reply": "Vui lòng cập nhật hồ sơ thể trạng (chiều cao, cân nặng, mục tiêu) trong mục Hồ sơ để tôi tính chỉ số cho bạn.",
            "intent": "health_metric",
            "data": {}
        }
    p = user_profile
    from app.services.nutrition_logic import BMI_CATEGORIES, GOAL_LABELS
    bmi = float(p.bmi or 0)
    bmi_cat = next((cat for lo, hi, cat, _ in BMI_CATEGORIES if lo <= bmi < hi), "Không xác định")
    goal_label = GOAL_LABELS.get(p.goal or "maintain", p.goal or "")

    reply = (
        f"Chỉ số của bạn: **BMI = {bmi:.1f}** ({bmi_cat}), "
        f"BMR = {float(p.bmr or 0):.0f} kcal, TDEE = {float(p.tdee or 0):.0f} kcal/ngày. "
        f"Mục tiêu '{goal_label}' → Calo mục tiêu: **{float(p.target_calories or 0):.0f} kcal/ngày** "
        f"({float(p.target_protein_g or 0):.0f}g đạm | {float(p.target_carb_g or 0):.0f}g tinh bột | {float(p.target_fat_g or 0):.0f}g béo)."
    )
    return {
        "reply": reply,
        "intent": "health_metric",
        "data": {
            "bmi": bmi, "bmi_category": bmi_cat,
            "bmr": float(p.bmr or 0), "tdee": float(p.tdee or 0),
            "target_calories": float(p.target_calories or 0),
        }
    }


# ============================================================
# 4. GỌI GEMINI VỚI RAG PROMPT
# ============================================================

def call_gemini_chat(system_prompt: str, user_message: str, history: List[Dict]) -> Optional[str]:
    """
    Gọi Gemini API với system prompt đã inject đầy đủ context từ DB.
    AI chỉ nhận context + câu hỏi và trả lời tự nhiên — không tự tính số.
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_key or gemini_key.startswith("your-"):
        return None

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_key)

        # Build conversation history
        contents = []
        for msg in history[-6:]:  # Giữ tối đa 6 lượt để tránh vượt context
            role = msg.get("role", "user")
            text = msg.get("content", "")
            if role == "assistant":
                role = "model"
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))

        # Thêm tin nhắn mới của user
        contents.append(types.Content(role="user", parts=[types.Part(text=user_message)]))

        models = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"]
        for model_name in models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.3,      # Thấp để ổn định hơn
                        max_output_tokens=512,
                    )
                )
                return response.text.strip()
            except Exception as model_err:
                logger.warning(f"Gemini model {model_name} thất bại: {model_err}")

    except Exception as e:
        logger.error(f"Lỗi gọi Gemini Chatbot: {e}")

    return None


# ============================================================
# 5. HÀM CHÍNH — CHAT ENTRY POINT
# ============================================================

def process_chat_message(
    message: str,
    db: Session,
    user_profile=None,
    today_logs: Optional[List[Dict]] = None,
    history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:
    """
    Xử lý tin nhắn chatbot theo kiến trúc RAG:
    1. Phát hiện ý định (deterministic)
    2. Nếu có thể trả lời từ DB → trả về ngay, không cần AI
    3. Nếu cần AI → inject đầy đủ context từ DB vào prompt → gọi Gemini
    4. AI chỉ diễn đạt, số liệu luôn từ DB
    """
    message = message.strip()
    if not message:
        return {"reply": "Bạn muốn hỏi gì về dinh dưỡng hoặc món ăn?", "intent": "empty"}

    intent = detect_intent(message)
    history = history or []

    # Xử lý deterministic (không cần AI)
    if intent == "today_summary":
        result = handle_today_summary(user_profile, today_logs or [])
        if result:
            return result

    if intent == "health_metric":
        result = handle_health_metric(user_profile)
        if result:
            return result

    # Xây dựng RAG system prompt với đầy đủ context từ DB
    system_prompt = build_rag_system_prompt(db, user_profile, today_logs)

    # Gọi Gemini với context đã inject
    ai_reply = call_gemini_chat(system_prompt, message, history)

    if ai_reply:
        return {
            "reply": ai_reply,
            "intent": intent,
            "ai_source": "gemini-rag",
            "data": {}
        }

    # Fallback nếu Gemini không khả dụng
    fallback_replies = {
        "suggest_recipe": "Dựa trên nguyên liệu bạn có, hãy vào tab 🍳 Tủ lạnh để xem gợi ý món ăn cụ thể từ hệ thống nhé!",
        "nutrition_query": "Để xem thông tin dinh dưỡng chính xác, hãy tìm kiếm món ăn trong tab 🔍 Quét món ăn hoặc tab Dashboard.",
        "diet_advice": "Hãy cập nhật hồ sơ thể trạng trong tab 👤 Hồ sơ để tôi tư vấn chế độ ăn phù hợp mục tiêu của bạn.",
        "general": "Tôi có thể giúp bạn theo dõi calo, gợi ý món ăn và tư vấn dinh dưỡng. Hãy thử hỏi về bữa ăn hôm nay!",
    }

    return {
        "reply": fallback_replies.get(intent, fallback_replies["general"]),
        "intent": intent,
        "ai_source": "fallback",
        "data": {}
    }
