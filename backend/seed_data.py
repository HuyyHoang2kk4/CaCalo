"""
Script nạp dữ liệu chuẩn ban đầu vào Cơ sở dữ liệu:
- Danh mục 15 món ăn Việt Nam phổ biến kèm dinh dưỡng trên 100g, khẩu phần và toppings
- Danh mục nguyên liệu tủ lạnh phân loại nhóm
- Danh mục công thức nấu ăn gợi ý
- 1 Tài khoản mẫu (Demo User) kèm Hồ sơ thể trạng BMI / TDEE
Chạy script bằng lệnh: py seed_data.py
"""
import sys
import os
import json

# Đảm bảo UTF-8 trên Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import (
    User, UserProfile,
    Food, FoodNutrition, FoodServing, FoodTopping,
    Ingredient, Recipe, RecipeIngredient
)

def remove_vietnamese_accent(text: str) -> str:
    """Hàm chuyển chuỗi tiếng Việt có dấu sang không dấu để phục vụ tìm kiếm nhanh."""
    patterns = {
        '[àáảãạăằắẳẵặâầấẩẫậ]': 'a',
        '[èéẻẽẹêềếểễệ]': 'e',
        '[ìíỉĩị]': 'i',
        '[òóỏõọôồốổỗộơờớởỡợ]': 'o',
        '[ùúủũụưừứửữự]': 'u',
        '[ỳýỷỹỵ]': 'y',
        '[đ]': 'd',
        '[ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ]': 'a',
        '[ÈÉẺẼẸÊỀẾỂỄỆ]': 'e',
        '[ÌÍỈĨỊ]': 'i',
        '[ÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ]': 'o',
        '[ÙÚỦŨỤƯỪỨỬỮỰ]': 'u',
        '[ỲÝỶỸỴ]': 'y',
        '[Đ]': 'd'
    }
    import re
    result = text.lower()
    for pattern, replace_char in patterns.items():
        result = re.sub(pattern, replace_char, result)
    return result

def seed():
    # Đảm bảo các bảng đã tồn tại
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Kiểm tra xem dữ liệu món ăn đã tồn tại chưa
        existing_food = db.query(Food).first()
        if existing_food:
            print("⚠️ Dữ liệu món ăn đã tồn tại trong CSDL. Bỏ qua bước seed để tránh trùng lặp.")
            return

        print("🌱 Bắt đầu nạp dữ liệu chuẩn vào Database...")

        # 1. Danh sách món ăn Việt Nam chuẩn
        foods_data = [
            {
                "name": "Phở bò tái chín",
                "category": "Món nước",
                "description": "Món phở truyền thống gồm bánh phở, thịt bò tái và chín, nước dùng hầm xương thơm quế hồi.",
                "nutrition": {"cal": 110.0, "pro": 6.8, "carb": 15.2, "fat": 2.5, "fiber": 0.5, "sugar": 0.8, "sodium": 420.0},
                "servings": [
                    {"unit": "Tô nhỏ (S - 0.75x)", "gram": 375.0, "is_default": False},
                    {"unit": "Tô vừa tiêu chuẩn (M - 1.0x)", "gram": 500.0, "is_default": True},
                    {"unit": "Tô lớn (L - 1.25x)", "gram": 625.0, "is_default": False},
                ],
                "toppings": [
                    {"name": "+1 Quẩy giòn", "gram": 25.0, "cal": 115.0, "pro": 1.8, "carb": 12.0, "fat": 6.8},
                    {"name": "+1 Trứng chần", "gram": 45.0, "cal": 65.0, "pro": 5.5, "carb": 0.5, "fat": 4.5},
                    {"name": "+ Thêm thịt bò tái (50g)", "gram": 50.0, "cal": 105.0, "pro": 10.5, "carb": 0.0, "fat": 7.0},
                ]
            },
            {
                "name": "Cơm tấm sườn bì chả",
                "category": "Món chính",
                "description": "Đặc sản Sài Gòn gồm cơm gạo tấm, sườn nướng mỡ hành, bì heo thái sợi, chả trứng hấp và đồ chua.",
                "nutrition": {"cal": 194.0, "pro": 7.5, "carb": 24.8, "fat": 7.2, "fiber": 0.8, "sugar": 1.2, "sodium": 350.0},
                "servings": [
                    {"unit": "Dĩa vừa tiêu chuẩn (M - 1.0x)", "gram": 350.0, "is_default": True},
                    {"unit": "Dĩa lớn nhiều cơm (L - 1.25x)", "gram": 450.0, "is_default": False},
                ],
                "toppings": [
                    {"name": "+1 Trứng ốp la", "gram": 50.0, "cal": 90.0, "pro": 6.0, "carb": 0.5, "fat": 7.0},
                    {"name": "+ Thêm miếng sườn nướng", "gram": 100.0, "cal": 240.0, "pro": 18.0, "carb": 3.0, "fat": 17.0},
                ]
            },
            {
                "name": "Bún chả Hà Nội",
                "category": "Món chính",
                "description": "Bún tươi ăn kèm chả viên và chả miếng nướng than hoa, ngập trong bát nước chấm chua ngọt đu đủ cà rốt.",
                "nutrition": {"cal": 128.0, "pro": 6.2, "carb": 16.5, "fat": 4.1, "fiber": 0.7, "sugar": 2.5, "sodium": 380.0},
                "servings": [
                    {"unit": "Suất vừa tiêu chuẩn (M - 1.0x)", "gram": 420.0, "is_default": True},
                    {"unit": "Suất lớn (L - 1.25x)", "gram": 520.0, "is_default": False},
                ],
                "toppings": [
                    {"name": "+1 Nem cua bể / chả giò", "gram": 50.0, "cal": 130.0, "pro": 4.5, "carb": 9.0, "fat": 8.5},
                ]
            },
            {
                "name": "Bánh mì thịt pa-tê đầy đủ",
                "category": "Món chính",
                "description": "Ổ bánh mì giòn rụm kẹp pa-tê, bơ, chả lụa, thịt nguội, dưa leo, ngò rí và đồ chua.",
                "nutrition": {"cal": 235.0, "pro": 8.8, "carb": 30.5, "fat": 8.6, "fiber": 1.2, "sugar": 1.8, "sodium": 460.0},
                "servings": [
                    {"unit": "1 Ổ vừa tiêu chuẩn", "gram": 180.0, "is_default": True},
                ],
                "toppings": [
                    {"name": "+1 Trứng ốp la", "gram": 50.0, "cal": 90.0, "pro": 6.0, "carb": 0.5, "fat": 7.0},
                    {"name": "Thêm pa-tê", "gram": 20.0, "cal": 65.0, "pro": 2.5, "carb": 0.5, "fat": 6.0},
                ]
            },
            {
                "name": "Bún bò Huế",
                "category": "Món nước",
                "description": "Sợi bún to, nước dùng thơm nồng mùi sả và mắm ruốc, kèm thịt bò nạm, chả cua, tiết luộc.",
                "nutrition": {"cal": 125.0, "pro": 7.2, "carb": 14.8, "fat": 3.8, "fiber": 0.6, "sugar": 0.7, "sodium": 480.0},
                "servings": [
                    {"unit": "Tô vừa tiêu chuẩn (M - 1.0x)", "gram": 500.0, "is_default": True},
                    {"unit": "Tô lớn đặc biệt (L - 1.25x)", "gram": 650.0, "is_default": False},
                ],
                "toppings": [
                    {"name": "+1 Giò heo", "gram": 80.0, "cal": 180.0, "pro": 14.0, "carb": 0.0, "fat": 13.5},
                    {"name": "+1 Chả cua", "gram": 40.0, "cal": 70.0, "pro": 6.5, "carb": 1.5, "fat": 4.0},
                ]
            },
            {
                "name": "Gỏi cuốn tôm thịt",
                "category": "Món chính",
                "description": "Bánh tráng cuốn tôm tươi, thịt ba chỉ, bún tươi, hẹ và rau thơm, chấm tương đen đậu phộng.",
                "nutrition": {"cal": 133.0, "pro": 6.5, "carb": 20.5, "fat": 2.8, "fiber": 0.9, "sugar": 1.5, "sodium": 210.0},
                "servings": [
                    {"unit": "Đĩa 2 cuốn", "gram": 120.0, "is_default": True},
                    {"unit": "Đĩa 4 cuốn", "gram": 240.0, "is_default": False},
                ],
                "toppings": []
            },
            {
                "name": "Rau muống xào tỏi",
                "category": "Món xào",
                "description": "Rau muống non xanh mướt xào nhanh trên lửa lớn với tỏi thơm nức, giữ độ giòn ngọt.",
                "nutrition": {"cal": 65.0, "pro": 2.8, "carb": 4.2, "fat": 4.0, "fiber": 2.1, "sugar": 0.8, "sodium": 280.0},
                "servings": [
                    {"unit": "Đĩa vừa tiêu chuẩn", "gram": 200.0, "is_default": True},
                ],
                "toppings": []
            },
            {
                "name": "Trứng ốp la",
                "category": "Món chính",
                "description": "Trứng gà chiên lòng đào viền giòn rụm thơm ngon.",
                "nutrition": {"cal": 180.0, "pro": 12.0, "carb": 1.0, "fat": 14.0, "fiber": 0.0, "sugar": 0.2, "sodium": 140.0},
                "servings": [
                    {"unit": "1 Quả vừa", "gram": 50.0, "is_default": True},
                    {"unit": "2 Quả", "gram": 100.0, "is_default": False},
                ],
                "toppings": []
            },
            {
                "name": "Thịt kho tàu nước dừa",
                "category": "Món chính",
                "description": "Thịt ba chỉ kho mềm rục cùng trứng vịt trong nước dừa tươi ngọt thanh, màu cánh gián tự nhiên.",
                "nutrition": {"cal": 260.0, "pro": 13.5, "carb": 4.5, "fat": 21.0, "fiber": 0.0, "sugar": 3.8, "sodium": 420.0},
                "servings": [
                    {"unit": "Bát vừa (150g)", "gram": 150.0, "is_default": True},
                ],
                "toppings": []
            },
            {
                "name": "Canh chua cá lóc",
                "category": "Món nước",
                "description": "Món canh chua giải nhiệt đậm đà với cá lóc đồng, dứa, cà chua, đậu bắp, giá đỗ và ngò ôm.",
                "nutrition": {"cal": 48.0, "pro": 5.5, "carb": 3.8, "fat": 1.2, "fiber": 1.1, "sugar": 2.0, "sodium": 310.0},
                "servings": [
                    {"unit": "Tô vừa tiêu chuẩn", "gram": 300.0, "is_default": True},
                ],
                "toppings": []
            }
        ]

        for item in foods_data:
            food = Food(
                name=item["name"],
                name_unsigned=remove_vietnamese_accent(item["name"]),
                category=item["category"],
                description=item["description"],
                source="Bảng thành phần thực phẩm VN - Viện Dinh dưỡng QG"
            )
            db.add(food)
            db.flush()

            # Dinh dưỡng / 100g
            nut = item["nutrition"]
            food_nut = FoodNutrition(
                food_id=food.id,
                per_gram=100.0,
                calories_kcal=nut["cal"],
                protein_g=nut["pro"],
                carb_g=nut["carb"],
                fat_g=nut["fat"],
                fiber_g=nut.get("fiber", 0.0),
                sugar_g=nut.get("sugar", 0.0),
                sodium_mg=nut.get("sodium", 0.0)
            )
            db.add(food_nut)

            # Khẩu phần
            for s in item["servings"]:
                db.add(FoodServing(
                    food_id=food.id,
                    unit_name=s["unit"],
                    weight_gram=s["gram"],
                    is_default=s["is_default"]
                ))

            # Toppings
            for t in item["toppings"]:
                db.add(FoodTopping(
                    food_id=food.id,
                    name=t["name"],
                    weight_gram=t["gram"],
                    calories_kcal=t["cal"],
                    protein_g=t["pro"],
                    carb_g=t["carb"],
                    fat_g=t["fat"]
                ))

        print(f"  ✅ Đã nạp thành công {len(foods_data)} món ăn Việt Nam kèm khẩu phần và toppings.")

        # 2. Danh mục nguyên liệu trong tủ lạnh
        ingredients_data = [
            {"name": "Ức gà", "cat": "Thịt cá", "cal": 165.0, "allergen": None},
            {"name": "Trứng gà", "cat": "Trứng sữa", "cal": 143.0, "allergen": "egg"},
            {"name": "Cà chua", "cat": "Rau củ", "cal": 18.0, "allergen": None},
            {"name": "Bắp cải", "cat": "Rau củ", "cal": 25.0, "allergen": None},
            {"name": "Hành tây", "cat": "Rau củ", "cal": 40.0, "allergen": None},
            {"name": "Nấm đùi gà", "cat": "Rau củ", "cal": 35.0, "allergen": None},
            {"name": "Đậu phụ", "cat": "Trứng sữa", "cal": 76.0, "allergen": "soy"},
            {"name": "Cà rốt", "cat": "Rau củ", "cal": 41.0, "allergen": None},
            {"name": "Thịt bò nạc", "cat": "Thịt cá", "cal": 250.0, "allergen": None},
            {"name": "Tôm tươi", "cat": "Thịt cá", "cal": 99.0, "allergen": "seafood"},
        ]

        ingredient_objs = {}
        for ing in ingredients_data:
            ing_obj = Ingredient(
                name=ing["name"],
                name_unsigned=remove_vietnamese_accent(ing["name"]),
                category=ing["cat"],
                calories_per_100g=ing["cal"],
                allergen_tag=ing["allergen"]
            )
            db.add(ing_obj)
            db.flush()
            ingredient_objs[ing["name"]] = ing_obj

        print(f"  ✅ Đã nạp thành công {len(ingredients_data)} nguyên liệu tủ lạnh phổ biến.")

        # 3. Công thức gợi ý nấu ăn từ nguyên liệu
        recipes_data = [
            {
                "title": "Ức gà áp chảo sốt cà chua",
                "desc": "Món ăn giàu đạm, ít béo, vị chua ngọt thanh mát cực kỳ thích hợp cho người giảm cân.",
                "prep": 10, "cook": 15, "cal": 280.0, "pro": 35.0, "carb": 8.0, "fat": 9.5, "yield": 1,
                "steps": [
                    "Ức gà rửa sạch, khía nhẹ trên bề mặt, ướp chút muối tiêu 10 phút.",
                    "Cà chua thái hạt lựu, phi thơm với tỏi băm trên chảo nóng cùng 1 thìa dầu oliu.",
                    "Cho ức gà vào áp chảo vàng 2 mặt, hạ nhỏ lửa đun cùng sốt cà chua đến khi chín đều."
                ],
                "ings": [("Ức gà", 180.0), ("Cà chua", 100.0)]
            },
            {
                "title": "Canh đậu phụ nấm cà chua thanh đạm",
                "desc": "Món canh chay thanh mát, bổ dưỡng, cung cấp chất xơ và đạm thực vật lành mạnh.",
                "prep": 10, "cook": 10, "cal": 140.0, "pro": 9.5, "carb": 11.0, "fat": 5.0, "yield": 1,
                "steps": [
                    "Đậu phụ cắt miếng vuông vừa ăn. Nấm đùi gà ngâm nước muối rửa sạch thái lát.",
                    "Cà chua bổ múi cau xào nhẹ tạo màu nước dùng.",
                    "Thêm 400ml nước đun sôi, thả đậu phụ và nấm vào đun 5 phút, nêm nếm gia vị vừa miệng."
                ],
                "ings": [("Đậu phụ", 100.0), ("Nấm đùi gà", 80.0), ("Cà chua", 80.0)]
            }
        ]

        for rec in recipes_data:
            recipe = Recipe(
                title=rec["title"],
                description=rec["desc"],
                instructions=json.dumps(rec["steps"], ensure_ascii=False),
                prep_time_minutes=rec["prep"],
                cook_time_minutes=rec["cook"],
                total_calories=rec["cal"],
                protein_g=rec["pro"],
                carb_g=rec["carb"],
                fat_g=rec["fat"],
                servings_yield=rec["yield"]
            )
            db.add(recipe)
            db.flush()

            for ing_name, gram in rec["ings"]:
                if ing_name in ingredient_objs:
                    db.add(RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=ingredient_objs[ing_name].id,
                        amount_gram=gram
                    ))

        print(f"  ✅ Đã nạp thành công {len(recipes_data)} công thức nấu ăn gợi ý.")

        # 4. Tài khoản Demo mẫu kèm Hồ sơ thể trạng
        demo_user = User(
            email="demo@cacalo.vn",
            password_hash="pbkdf2_demo_hashed_secret",
            full_name="Nguyễn Văn CaCalo",
            role="user"
        )
        db.add(demo_user)
        db.flush()

        # Hồ sơ thể trạng: 175cm, 68kg -> BMI = 22.2 (Chuẩn), TDEE = 2150 kcal
        demo_profile = UserProfile(
            user_id=demo_user.id,
            gender="male",
            birth_year=1998,
            height_cm=175.0,
            weight_kg=68.0,
            activity_level=1.375,
            goal="maintain",
            diet_type="normal",
            allergies=json.dumps([]),
            disliked_ingredients=json.dumps(["hành lá"]),
            bmi=22.2,
            bmr=1640.0,
            tdee=2255.0,
            target_calories=2000.0,
            target_protein_g=150.0,
            target_carb_g=225.0,
            target_fat_g=55.0
        )
        db.add(demo_profile)
        print("  ✅ Đã tạo tài khoản mẫu: demo@cacalo.vn kèm hồ sơ thể trạng BMI chuẩn.")

        db.commit()
        print("=" * 60)
        print("🎉 NẠP DỮ LIỆU SEED HOÀN TẤT THÀNH CÔNG 100%!")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"❌ Lỗi trong quá trình seed dữ liệu: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed()
