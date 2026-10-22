import sys
import requests
import json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://127.0.0.1:8000/api'
report = []

def test(name, fn):
    try:
        res = fn()
        report.append(f"✅ {name}: {res}")
    except Exception as e:
        report.append(f"❌ {name}: {str(e)}")

# 1. Health check
def t_health():
    r = requests.get(f"{BASE}/health", timeout=5)
    assert r.status_code == 200 and r.json()['status'] == 'healthy'
    d = r.json()
    return f"Foods: {d['total_foods_in_db']}, Logs: {d['total_meal_logs']}"
test("1. Health Check", t_health)

# 2. Get foods & search
def t_foods():
    r = requests.get(f"{BASE}/foods", timeout=5)
    assert r.status_code == 200
    total = len(r.json()['data'])
    r2 = requests.get(f"{BASE}/foods/search", params={"q": "pho"}, timeout=5)
    return f"Total foods: {total}, Search 'pho': {len(r2.json()['data'])} kết quả"
test("2. Danh mục món ăn & Tìm kiếm", t_foods)

# 3. Auth Login Demo
token = None
def t_login():
    global token
    r = requests.post(f"{BASE}/auth/login", json={"email": "demo@cacalo.vn", "password": "demo"}, timeout=5)
    assert r.status_code == 200 and r.json()['success']
    token = r.json()['token']
    user = r.json()['user']
    return f"User: {user['full_name']}, Calo mục tiêu: {user['profile']['target_calories']}"
test("3. Đăng nhập Demo", t_login)

# 4. Auth Me
def t_me():
    r = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=5)
    assert r.status_code == 200
    return f"Xác thực hợp lệ: {r.json()['user']['email']}"
test("4. Xác thực Bearer Token (/auth/me)", t_me)

# 5. Update Profile
def t_update_profile():
    r = requests.put(f"{BASE}/user/profile", headers={"Authorization": f"Bearer {token}"}, json={
        "height_cm": 175,
        "weight_kg": 72,
        "activity_level": 1.55,
        "goal": "lose_weight",
        "diet_type": "lowcarb"
    }, timeout=5)
    assert r.status_code == 200
    p = r.json()['user']['profile']
    return f"BMI: {p['bmi']} ({p['bmi_status']}), Target Calo: {p['target_calories']} kcal, Pro: {p['target_protein_g']}g"
test("5. Cập nhật hồ sơ cá nhân hóa (BMI/TDEE/Macro)", t_update_profile)

# 6. Reset Profile Demo
def t_reset_profile():
    r = requests.put(f"{BASE}/user/profile", headers={"Authorization": f"Bearer {token}"}, json={
        "height_cm": 175,
        "weight_kg": 68,
        "activity_level": 1.375,
        "goal": "maintain",
        "diet_type": "normal"
    }, timeout=5)
    assert r.status_code == 200
    return "Đã hoàn nguyên hồ sơ demo chuẩn (68kg, duy trì)"
test("6. Hoàn nguyên Profile Demo", t_reset_profile)

# 7. Meal logs today
def t_meal_logs():
    r = requests.get(f"{BASE}/meal-logs/today", headers={"Authorization": f"Bearer {token}"}, timeout=5)
    assert r.status_code == 200
    d = r.json()
    return f"Hôm nay: {d['total_calories']} calo, Profile target: {d.get('user_profile', {}).get('target_calories')} calo"
test("7. Lấy nhật ký ăn uống hôm nay", t_meal_logs)

# 8. Test calculation engine
def t_calc():
    r = requests.post(f"{BASE}/nutrition/calculate", json={
        "food_id": 1,
        "portion_size": "M",
        "topping_ids": []
    }, timeout=5)
    assert r.status_code == 200
    return f"Tính toán món 1: {r.json().get('food_name')} -> {r.json().get('total_calories')} kcal"
test("8. Động cơ tính toán dinh dưỡng (/nutrition/calculate)", t_calc)

print("\n--- BÁO CÁO KIỂM THỬ BACKEND API ---")
for rep in report:
    print(rep)
