# 📋 KẾ HOẠCH TRIỂN KHAI TOÀN DIỆN HỆ THỐNG CACALO
> **Tài liệu đặc tả lộ trình kỹ thuật chi tiết toàn bộ 5 Module & 22 Chức năng**  
> **Kiến trúc:** Frontend (React + Vite) — Backend (Python FastAPI) — Database (PostgreSQL / SQLite) — AI (Computer Vision & LLM).

---

## 🏛️ 1. KIẾN TRÚC KỸ THUẬT TỔNG THỂ (SYSTEM ARCHITECTURE)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite SPA)                         │
│  • Giao diện Responsive (Desktop & Mobile) • WebRTC Camera • Canvas    │
│  • Quản lý trạng thái (React Context / Custom Hooks) • CSS Design System│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ (RESTful APIs / JSON / Multipart)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   BACKEND API (Python FastAPI)                          │
│  • Auth & User Management (JWT / OAuth2 / Bcrypt)                       │
│  • Health Engine (BMI, BMR, TDEE, Macro Allocation)                     │
│  • Vision Service (Xử lý ảnh, Image Preprocessing, AI Vision Client)   │
│  • Nutrition & Portion Engine (Quy đổi gram, tính calo, topping)        │
│  • Recipe Recommendation Engine (Thuật toán lọc nguyên liệu + calo)     │
│  • Nutrition Chatbot Service (LLM Prompting + Guardrails)               │
│  • Admin CRUD & Feedback Pipeline                                       │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
                    ▼                                 ▼
┌─────────────────────────────────────┐  ┌────────────────────────────────┐
│      DATABASE (PostgreSQL / SQLite) │  │       AI & VISION SERVICES     │
│  • Users & Profiles (BMI, Goals)    │  │  • Model Thị giác máy tính     │
│  • Foods & Nutrition Values (100g)  │  │    (Nhận diện món Việt Top-3)  │
│  • ServingUnits & Toppings          │  │  • Gemini Flash / OpenAI LLM   │
│  • Ingredients & Recipes            │  │    (Tư vấn & Gợi ý món ăn)     │
│  • DailyMealLogs & LogItems         │  │                                │
│  • AIFeedbackLogs (Sửa nhãn AI)     │  │                                │
└─────────────────────────────────────┘  └────────────────────────────────┘
```

---

## 🗄️ 2. THIẾT KẾ CƠ SỞ DỮ LIỆU CHI TIẾT (DATABASE SCHEMA)

Hệ thống sử dụng **SQLAlchemy ORM** với 8 bảng quan hệ chuẩn hóa:

1. **`users`**: `id` (PK, UUID), `email` (Unique), `password_hash`, `full_name`, `role` (`user` / `admin`), `avatar_url`, `created_at`.
2. **`user_profiles`**: `id` (PK), `user_id` (FK -> users), `gender`, `birth_year`, `height_cm`, `weight_kg`, `activity_level` (1.2 -> 1.9), `goal` (`lose_weight`, `maintain`, `gain_weight`), `diet_type` (`normal`, `vegetarian`, `vegan`, `lowcarb`), `allergies` (JSON list), `disliked_ingredients` (JSON list), `bmi`, `bmr`, `tdee`, `target_calories`, `target_protein_g`, `target_carb_g`, `target_fat_g`, `updated_at`.
3. **`foods`**: `id` (PK), `name` (Tiếng Việt có dấu), `name_unsigned` (Không dấu, index phục vụ search nhanh), `category` (Món chính, Món phụ, Nước...), `image_url`, `description`, `source` (Viện Dinh dưỡng QG / USDA).
4. **`food_nutritions`**: `id` (PK), `food_id` (FK -> foods, 1-1), `per_gram` (100), `calories_kcal`, `protein_g`, `carb_g`, `fat_g`, `fiber_g`, `sugar_g`, `sodium_mg`.
5. **`food_servings`**: `id` (PK), `food_id` (FK -> foods), `unit_name` (Tô, Đĩa, Bát, Quả, Cái...), `weight_gram`, `is_default` (bool).
6. **`food_toppings`**: `id` (PK), `food_id` (FK -> foods), `name`, `weight_gram`, `calories_kcal`, `protein_g`, `carb_g`, `fat_g`.
7. **`ingredients`**: `id` (PK), `name`, `name_unsigned`, `category` (Thịt, Rau củ, Gia vị, Trứng...), `calories_per_100g`, `allergen_tag`.
8. **`recipes`**: `id` (PK), `title`, `description`, `instructions` (JSON steps), `prep_time_minutes`, `cook_time_minutes`, `total_calories`, `protein_g`, `carb_g`, `fat_g`, `servings_yield`.
9. **`recipe_ingredients`**: `id` (PK), `recipe_id` (FK -> recipes), `ingredient_id` (FK -> ingredients), `amount_gram`.
10. **`meal_logs`**: `id` (PK), `user_id` (FK -> users), `log_date` (Date, Index), `meal_type` (`breakfast`, `lunch`, `dinner`, `snack`), `total_calories`, `total_protein`, `total_carb`, `total_fat`, `created_at`.
11. **`meal_log_items`**: `id` (PK), `meal_log_id` (FK -> meal_logs), `food_id` (FK -> foods), `food_name`, `portion_size` (S / M / L hoặc gram), `actual_gram`, `calories`, `protein`, `carb`, `fat`, `toppings_applied` (JSON), `image_proof_url`.
12. **`ai_feedback_logs`**: `id` (PK), `user_id` (FK), `original_image_url`, `predicted_label`, `confidence_score`, `user_corrected_label`, `status` (`pending`, `reviewed`, `approved`), `created_at`.

---

## 📑 3. DANH SÁCH CHI TIẾT CÁC GIAI ĐOẠN TRIỂN KHAI

---

### GIAI ĐOẠN 1: KHỞI TẠO CẤU TRÚC DỰ ÁN, CƠ SỞ DỮ LIỆU & GIAO DIỆN NỀN TẢNG
> **Mục tiêu:** Thiết lập đồng bộ cả Frontend, Backend và Database; tạo bảng, nạp dữ liệu mẫu ban đầu; dựng khung layout chuẩn responsive.

#### 🔸 Bước 1.1: Khởi tạo Backend FastAPI & Kết nối Database `[✅ ĐÃ HOÀN THÀNH]`
* **Nội dung công việc:**
  - [x] Cấu hình dự án Python FastAPI với cấu trúc chuẩn: `app/models/`, `app/database.py`, `app/main.py`.
  - [x] Định nghĩa đầy đủ 12 bảng CSDL chuẩn quan hệ qua SQLAlchemy ORM.
  - [x] Khởi tạo thành công 12 bảng trong SQLite (`cacalo.db`).
  - [x] Nạp thành công dữ liệu seed chuẩn (10 món ăn Việt Nam kèm khẩu phần và topping, 10 nguyên liệu tủ lạnh, 2 công thức nấu ăn, 1 tài khoản demo).
  - [x] Cấu hình CORS middleware cho phép Frontend kết nối.
* **API đã hoàn thành & kiểm thử:**
  - `GET /api/health` — Trạng thái hệ thống: Healthy, Database: Connected (10 món ăn).
  - `GET /api/foods` — Trả về danh sách món ăn kèm dinh dưỡng 100g, khẩu phần S/M/L và toppings.

#### 🔸 Bước 1.2: Khởi tạo Frontend React + Vite & Design System CSS `[✅ ĐÃ HOÀN THÀNH]`
* **Nội dung công việc:**
  - [x] Khởi tạo React + Vite, cài đặt `lucide-react` và `axios`.
  - [x] Xây dựng file `index.css` chuẩn Design System 60-30-10, Inter font, `tabular-nums`.
  - [x] Dựng xong khung Layout Responsive: Header cố định, Sidebar bên trái cho Desktop, Bottom Navigation Bar cho điện thoại (375px).
  - [x] Dựng xong 3 màn hình cốt lõi: Dashboard Dinh Dưỡng, Quét Món Ăn Tính Calo, Tủ Lạnh & Gợi Ý Nấu Ăn.
  - [x] Kết nối thành công Client - Server: Đèn tín hiệu PostgreSQL báo xanh `Online: 10 món`.
  - [x] Kiểm thử trực quan trên trình duyệt xác nhận giao diện hoạt động hoàn hảo.

---

### GIAI ĐOẠN 2: MODULE 1 — TÀI KHOẢN, CHỈ SỐ CƠ THỂ ($\text{BMI/TDEE}$) & CÁ NHÂN HÓA
> **Mục tiêu:** Hoàn thiện toàn bộ chức năng `CC-1.1`, `CC-1.2`, `CC-1.3` từ Backend API đến giao diện Frontend.

#### 🔸 Bước 2.1: Quản lý tài khoản & Xác thực JWT (`CC-1.1`)
* **Backend:**
  - Viết Router `/api/auth`: Đăng ký tài khoản, đăng nhập, cấp `access_token` (JWT) và `refresh_token`.
  - Mã hóa mật khẩu bằng `bcrypt`. Middleware `get_current_user` bảo vệ các endpoint riêng tư.
* **Frontend:**
  - Màn hình Đăng nhập / Đăng ký tài khoản (hỗ trợ chuyển đổi tab).
  - Tự động lưu Token vào storage và đính kèm vào Header `Authorization: Bearer <token>` ở mọi request tiếp theo.

#### 🔸 Bước 2.2: Tính toán chỉ số cơ thể $\text{BMI}, \text{BMR}, \text{TDEE}$ & Mục tiêu Calo (`CC-1.2`)
* **Backend:**
  - Module `health_engine.py`: 
    - Tính $\text{BMI} = \frac{\text{Cân nặng}}{(\text{Chiều cao})^2}$, phân loại theo chuẩn WHO Châu Á (Thiếu cân, Bình thường, Thừa cân, Béo phì).
    - Tính $\text{BMR}$ theo công thức Mifflin-St Jeor cho Nam và Nữ.
    - Tính $\text{TDEE} = \text{BMR} \times R$ ($R \in \{1.2; 1.375; 1.55; 1.725; 1.9\}$).
    - Đề xuất Calo mục tiêu theo mục tiêu (Giảm cân: $-400\text{ kcal}$, Tăng cân: $+400\text{ kcal}$, Giữ cân: $\text{TDEE}$) có cảnh báo an toàn sàn $1200\text{ kcal}$ (Nữ) và $1500\text{ kcal}$ (Nam).
    - Phân bổ Macro theo gram: Protein (25-30%), Carb (45-50%), Fat (20-25%).
  - API `POST /api/profile` và `GET /api/profile` — Lưu và cập nhật hồ sơ thể trạng.
* **Frontend:**
  - Màn hình Onboarding / Modal Hồ sơ sức khỏe: Người dùng nhập Giới tính, Chiều cao, Cân nặng, Tuổi, Mức vận động, Mục tiêu.
  - Hiển thị tức thì các kết quả $\text{BMI}$, $\text{BMR}$, $\text{TDEE}$ cùng khuyến nghị dinh dưỡng.

#### 🔸 Bước 2.3: Thiết lập dị ứng, chế độ ăn kiêng & sở thích (`CC-1.3`)
* **Backend:**
  - Lưu trữ danh sách dị ứng (Hải sản, Đậu phộng, Sữa, Trứng, Gluten, Đậu nành...) và Chế độ ăn (Bình thường, Ăn chay, Thuần chay, Low-carb).
  - API `PUT /api/profile/preferences` — Cập nhật ràng buộc dị ứng và nguyên liệu ghét.
* **Frontend:**
  - Giao diện chọn nhanh thẻ Dị ứng (Tag selector) và Chế độ ăn uống trong phần Cài đặt cá nhân.

---

### GIAI ĐOẠN 3: MODULE 2 — TRỤ CỘT 1: NHẬN DIỆN MÓN QUA ẢNH & TÍNH TOÁN CALO
> **Mục tiêu:** Hoàn thiện toàn bộ chức năng `CC-2.1`, `CC-2.2`, `CC-2.3`, `CC-2.4`, `CC-2.5`, `CC-2.7`.

#### 🔸 Bước 3.1: Tải ảnh, chụp ảnh WebRTC & Xử lý phía Client (`CC-2.1`)
* **Frontend:**
  - Component Khung chụp ảnh Camera WebRTC: Mở camera máy tính / điện thoại với khung ngắm chuẩn tỷ lệ.
  - Khung Dropzone hỗ trợ kéo thả hoặc chọn tệp ảnh (`JPG, PNG, WEBP, HEIC`).
  - Tiện ích nén ảnh Canvas: Tự động resize ảnh về cạnh dài tối đa $1280\text{px}$, nén chất lượng JPEG $0.8$ để dung lượng tải lên luôn $< 1\text{MB}$.

#### 🔸 Bước 3.2: Nhận diện món ăn AI & Phân tầng độ tin cậy (`CC-2.2`)
* **Backend:**
  - Router `POST /api/vision/predict`: Nhận file ảnh multipart từ client.
  - Tiền xử lý ảnh (OpenCV / PIL) và đưa qua mô hình Computer Vision / Vision API chuyên biệt món Việt.
  - Phân tầng kết quả: Trả về **Top 3 món ăn có độ tin cậy (`confidence`) cao nhất** kèm thông tin dinh dưỡng và khẩu phần chuẩn của từng món.
* **Frontend:**
  - Hiển thị kết quả nhận diện:
    - Nếu $\ge 70\%$: Chọn mặc định món Top 1.
    - Nếu $40\% - 70\%$: Hiển thị danh sách 3 món để người dùng bấm chọn xác nhận.
    - Nếu $< 40\%$: Thông báo AI chưa chắc chắn và mở thanh tìm kiếm thủ công.

#### 🔸 Bước 3.3: Ước lượng, tùy chỉnh khẩu phần & Tính toán Calo/Macro (`CC-2.3` & `CC-2.4`)
* **Backend:**
  - API `POST /api/nutrition/calculate`: Nhận `food_id`, `portion_size` (S: $0.75\times$, M: $1.0\times$, L: $1.25\times$ hoặc số gram tùy chỉnh) và danh sách `topping_ids`.
  - Tính toán số học chuẩn xác từ database:
    $$\text{Calo thực tế} = \frac{\text{Gram khẩu phần}}{100} \times \text{Calo trên 100g} + \sum \text{Calo Toppings}$$
  - Đính kèm nhãn **"Ước lượng"** và **Nguồn dữ liệu tham chiếu**.
* **Frontend:**
  - Thẻ kết quả dinh dưỡng tương tác: Thanh chọn nhanh size S / M / L hoặc ô nhập gram trực tiếp.
  - Danh sách checkbox Topping đi kèm (ví dụ: *+1 Trứng chần*, *+1 Quẩy*, *Ít bánh phở*).
  - Biểu đồ tròn Macro (Đạm - Bột đường - Béo) và số \% calo món ăn này chiếm trong ngày cập nhật tức thì khi đổi size.

#### 🔸 Bước 3.4: Chỉnh sửa nhãn AI & Thu thập dữ liệu phản hồi (`CC-2.5`)
* **Backend:**
  - API `POST /api/vision/feedback`: Lưu bản ghi `ai_feedback_logs` gồm `(image_url, predicted_label, user_corrected_label)`.
* **Frontend:**
  - Nút "Không phải món này? Sửa tên món" cho phép người dùng đổi sang món khác.
  - Lưu lại sự can thiệp của người dùng (Human-in-the-loop) để phục vụ huấn luyện mô hình.

#### 🔸 Bước 3.5: Tìm kiếm và nhập tay món ăn (`CC-2.7`)
* **Backend:**
  - API `GET /api/foods/search?q={keyword}`: Tìm kiếm món ăn theo tên tiếng Việt không dấu (loại bỏ dấu bằng thuật toán Unicode) và hỗ trợ tìm kiếm mờ (fuzzy search).
* **Frontend:**
  - Thanh tìm kiếm Autocomplete: Gõ `"pho bo"`, `"bun bo"` hiện ngay danh sách gợi ý kèm số calo tham khảo để chọn nhanh không cần chụp ảnh.

---

### GIAI ĐOẠN 4: MODULE 3 — TRỤ CỘT 2: TRỢ LÝ AI & GỢI Ý MÓN TỪ NGUYÊN LIỆU TỦ LẠNH
> **Mục tiêu:** Hoàn thiện toàn bộ chức năng `CC-3.1`, `CC-3.2`, `CC-3.3`, `CC-3.4`.

#### 🔸 Bước 4.1: Khai báo nhanh nguyên liệu trong tủ/bếp (`CC-3.1`)
* **Backend:**
  - Bảng danh mục `ingredients` phân theo nhóm (Thịt cá, Rau củ, Trứng sữa, Gia vị, Tinh bột).
  - API `GET /api/ingredients` lấy danh sách nguyên liệu phân nhóm.
* **Frontend:**
  - Giao diện chọn nhanh nguyên liệu: Ô tìm kiếm nguyên liệu và các thẻ tag bấm chọn (Ức gà, Trứng, Cà chua, Bắp cải, Hành tây...).
  - Quản lý danh sách nguyên liệu người dùng đã chọn.

#### 🔸 Bước 4.2: Thuật toán đề xuất món ăn theo Calo còn lại & Ràng buộc dị ứng (`CC-3.2`)
* **Backend:**
  - Engine gợi ý món ăn `recipe_recommender.py`:
    1. Nhận danh sách nguyên liệu người dùng có.
    2. Lấy ngân sách Calo còn lại trong ngày của người dùng: $\text{Calo còn lại} = \text{Calo mục tiêu} - \text{Calo đã nạp}$.
    3. **Ràng buộc cứng (Hard constraint):** Loại bỏ hoàn toàn $100\%$ công thức chứa nguyên liệu dị ứng của người dùng.
    4. Chấm điểm và sắp xếp công thức nấu ăn: Ưu tiên món sử dụng nhiều nguyên liệu có sẵn nhất và có mức Calo vừa vặn với bữa ăn tiếp theo (theo phân bổ $30\% - 35\% - 25\%$).
  - API `POST /api/recipes/recommend`: Trả về danh sách món gợi ý kèm tỷ lệ khớp nguyên liệu.
* **Frontend:**
  - Danh sách thẻ món ăn gợi ý: Hiển thị tên món, ảnh minh họa, thời gian nấu, lượng calo và số nguyên liệu bạn đang có / còn thiếu.

#### 🔸 Bước 4.3: Xem công thức nấu chi tiết & Quy đổi dinh dưỡng (`CC-3.3`)
* **Backend:**
  - API `GET /api/recipes/{id}`: Trả về chi tiết công thức nấu từng bước, định lượng từng nguyên liệu theo số người ăn và bảng dinh dưỡng tổng thể.
* **Frontend:**
  - Màn hình / Modal xem chi tiết công thức nấu ăn: Danh sách bước nấu rõ ràng, định lượng nguyên liệu, nút bấm "Tôi đã nấu món này -> Lưu vào nhật ký bữa ăn".

#### 🔸 Bước 4.4: Chatbot AI hỏi đáp dinh dưỡng cá nhân hóa (`CC-3.4`)
* **Backend:**
  - Router `POST /api/chat/nutrition`: Tích hợp mô hình LLM với cơ chế **AI Guardrails**:
    - Truyền ngữ cảnh thể trạng người dùng ($\text{BMI}$, Calo còn lại trong ngày, các dị ứng).
    - System Prompt nghiêm ngặt: Tuyệt đối không tự bịa số calo phi thực tế; luôn đối chiếu cơ sở dữ liệu dinh dưỡng; từ chối tư vấn đơn thuốc y tế.
* **Frontend:**
  - Khung chat Trợ lý dinh dưỡng nổi hoặc tab riêng: Người dùng có thể hỏi "Tối nay tôi nên ăn gì nhẹ bụng dưới 400 calo?", "Món phở gà có nhiều đạm không?", Chatbot trả lời ngắn gọn, có cấu trúc.

---

### GIAI ĐOẠN 5: MODULE 4 & 5 — NHẬT KÝ ĂN UỐNG, DASHBOARD TIẾN ĐỘ & QUẢN TRỊ ADMIN
> **Mục tiêu:** Hoàn thiện `CC-4.1`, `CC-4.2`, `CC-4.3` và các tính năng Quản trị CSDL `CC-5.1`, `CC-5.3`.

#### 🔸 Bước 5.1: Ghi nhật ký ăn uống theo bữa (`CC-4.1`)
* **Backend:**
  - API `POST /api/meals/log`: Lưu món ăn vào nhật ký theo bữa (Sáng / Trưa / Tối / Phụ).
  - API `DELETE /api/meals/items/{item_id}`: Xóa món ăn khỏi bữa ăn.
  - API `PUT /api/meals/items/{item_id}`: Sửa khẩu phần món đã ghi.
* **Frontend:**
  - Tương tác thêm món, đổi bữa ăn, xóa món có hộp thoại xác nhận. Cập nhật dữ liệu ngay lập tức.

#### 🔸 Bước 5.2: Bảng điều khiển (Dashboard) tổng quan ngày (`CC-4.2` & `CC-4.3`)
* **Backend:**
  - API `GET /api/dashboard/today`: Trả về tổng calo đã nạp, calo mục tiêu, calo còn lại, tổng Protein/Carb/Fat thực tế và danh sách chi tiết các món trong 4 bữa.
  - API `GET /api/dashboard/history?days=7`: Lịch sử calo và cân nặng 7 ngày qua.
* **Frontend:**
  - Vòng tiến độ Calo nổi bật: Hiển thị Calo đã ăn / Calo mục tiêu / Calo còn lại.
  - 3 thanh tiến độ Macro: Đạm (g), Tinh bột (g), Chất béo (g).
  - Danh sách 4 khối bữa ăn trong ngày kèm nút "+ Thêm món" cho từng bữa.
  - Biểu đồ đường mini hiển thị xu hướng Calo nạp 7 ngày gần nhất.

#### 🔸 Bước 5.3: Quản trị cơ sở dữ liệu món ăn & Duyệt phản hồi AI (`CC-5.1` & `CC-5.3`)
* **Backend:**
  - Middleware kiểm tra quyền `role == "admin"`.
  - CRUD API cho bảng món ăn, nguyên liệu, công thức nấu.
  - API xem danh sách các ảnh mà người dùng báo nhận diện sai để Admin kiểm tra và xuất tập dữ liệu đánh giá độ chính xác của AI.
* **Frontend:**
  - Giao diện Admin đơn giản: Bảng quản lý danh mục món ăn (thêm/sửa/xóa món) và Bảng duyệt các nhãn nhận diện sai của AI.

---

### GIAI ĐOẠN 6: KIỂM THỬ TOÀN DIỆN, TỐI ƯU HÓA & ĐÓNG GÓI TRIỂN KHAI
> **Mục tiêu:** Đảm bảo hệ thống vận hành trơn tru, không lỗi logic, bảo mật dữ liệu và triển khai lên môi trường Internet.

#### 🔸 Bước 6.1: Kiểm thử chức năng, Kiểm tra biên & Chống tấn công
* **Nội dung công việc:**
  - Chạy toàn bộ các ca kiểm thử: Giá trị chiều cao/cân nặng phi thực tế, kiểm tra số âm, kiểm tra dị ứng không bao giờ lọt vào kết quả gợi ý ($0\%$ vi phạm).
  - Kiểm tra bảo mật: Toàn bộ mật khẩu băm bcrypt, API private bắt buộc có JWT token, chống XSS trên frontend.
  - Tối ưu hóa truy vấn Database: Thêm Index cho `name_unsigned`, `log_date`, `user_id`.

#### 🔸 Bước 6.2: Đóng gói Docker & Triển khai thực tế
* **Nội dung công việc:**
  - Viết `Dockerfile` cho Backend FastAPI và `Dockerfile` cho Frontend React.
  - File `docker-compose.yml` khởi chạy toàn bộ hệ thống gồm Frontend, Backend và PostgreSQL chỉ bằng đúng 1 câu lệnh duy nhất:
    ```bash
    docker-compose up -d
    ```
  - Triển khai máy chủ cloud có HTTPS để camera hoạt động ổn định trên điện thoại thật.
