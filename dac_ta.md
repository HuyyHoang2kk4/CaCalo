# CaCalo — ĐẶC TẢ CHỨC NĂNG HỆ THỐNG (SRS)
**Đề tài:** Ứng dụng Web nhận diện món ăn ước lượng Calo kết hợp Trợ lý AI hỏi đáp dinh dưỡng và gợi ý món ăn từ nguyên liệu sẵn có.

---

## 1. Giới thiệu

**CaCalo** là ứng dụng Web (Responsive Web App hỗ trợ cả máy tính và trình duyệt điện thoại) giúp người dùng theo dõi chỉ số cơ thể ($\text{BMI}$, $\text{BMR}$, $\text{TDEE}$), biết lượng calo và dinh dưỡng của bữa ăn chỉ bằng một bức ảnh, đồng thời tích hợp Trợ lý AI để hỏi đáp dinh dưỡng và đề xuất món ăn nấu ngay từ những nguyên liệu sẵn có trong bếp.

Tài liệu này mô tả chi tiết các chức năng của hệ thống. Mỗi chức năng được xây dựng theo tiêu chuẩn nghiệm thu chặt chẽ gồm: **Mô tả, Luồng xử lý chính, Quy tắc & Ràng buộc, Trường hợp ngoại lệ** và **Tiêu chí nghiệm thu định lượng được**.

### 1.1. Tác nhân hệ thống (Actors)
* **Người dùng (User):** Sử dụng ứng dụng Web để tính chỉ số cơ thể ($\text{BMI}$, $\text{TDEE}$), tải/chụp ảnh món ăn tính calo, khai báo nguyên liệu đang có để nhận gợi ý món, trò chuyện với Chatbot dinh dưỡng và ghi nhật ký ăn uống.
* **Quản trị viên (Admin):** Quản lý cơ sở dữ liệu món ăn, nguyên liệu, bảng thành phần dinh dưỡng, duyệt công thức nấu ăn, duyệt dữ liệu người dùng sửa lỗi AI và theo dõi thống kê hệ thống.
* **Hệ thống (System):** Bao gồm các thành phần tự động:
  * *Mô hình Thị giác máy tính (Computer Vision):* Nhận diện món ăn từ ảnh.
  * *Bộ máy tính toán & Gợi ý (Calculation & Recommendation Engine):* Tính $\text{BMI/BMR/TDEE}$, tính Calo/Macro từ cơ sở dữ liệu và chấm điểm gợi ý món ăn.
  * *Mô hình Ngôn ngữ lớn (LLM / RAG):* Đóng vai trò Trợ lý AI giải đáp dinh dưỡng và hướng dẫn nấu ăn dựa trên dữ liệu chuẩn.

### 1.2. Quy ước chung áp dụng cho toàn hệ thống
1. **Phân loại mức độ ưu tiên (MoSCoW):**
   * **Bắt buộc (Must-have):** Chức năng cốt lõi phải hoàn thành để hệ thống chạy thông suốt từ đầu đến cuối (End-to-End MVP).
   * **Nên có (Should-have):** Chức năng gia tăng giá trị trải nghiệm và độ hoàn thiện của sản phẩm.
   * **Mở rộng (Could-have):** Chức năng nâng cao, thực hiện khi còn thời gian hoặc định hướng phát triển tiếp theo.
2. **Nguyên tắc minh bạch số liệu:** Mọi con số calo và dinh dưỡng hiển thị trên giao diện đều là giá trị ước lượng, bắt buộc phải gắn nhãn **"Ước lượng"** kèm **Nguồn dữ liệu** (ví dụ: *Bảng thành phần thực phẩm Việt Nam - Viện Dinh dưỡng*, *USDA*).
3. **Nguyên tắc kiểm soát AI (AI Guardrails - Chống ảo giác):**
   * Mọi con số về Calo, Protein, Carb, Fat, $\text{BMI}$, $\text{TDEE}$ **bắt buộc do hệ thống tính toán từ cơ sở dữ liệu dinh dưỡng chuẩn**.
   * Mô hình ngôn ngữ (LLM) chỉ làm nhiệm vụ phân tích ngữ cảnh, truy vấn dữ liệu (Function Calling / RAG) và diễn đạt câu trả lời tự nhiên; **tuyệt đối không để LLM tự suy diễn hoặc tự bịa ra con số calo**.
4. **Quyền kiểm soát của người dùng (Human-in-the-loop):** AI chỉ đóng vai trò đề xuất, người dùng luôn có quyền xác nhận hoặc chỉnh sửa (tên món, khẩu phần, nguyên liệu) trước khi lưu vào nhật ký.
5. **Ràng buộc an toàn thực phẩm & Dị ứng:** Dị ứng và chế độ ăn kiêng do người dùng khai báo là **ràng buộc cứng (Hard Constraint)** trong mọi thuật toán gợi ý món ăn và tư vấn của Chatbot.
6. **Miễn trừ trách nhiệm y tế:** Hệ thống chỉ mang tính chất tham khảo dinh dưỡng, không thay thế chẩn đoán hay chỉ định của bác sĩ/chuyên gia y tế.
7. **Chuẩn hóa đơn vị đo lường:** Mọi nguyên liệu và món ăn trong cơ sở dữ liệu đều lấy **Gram ($\text{g}$)** hoặc **Mililít ($\text{ml}$)** làm đơn vị gốc (`Base Unit`). Các đơn vị đời thường (bát, đĩa, quả, lát, muỗng...) đều phải thông qua bảng hệ số quy đổi chuẩn sang đơn vị gốc trước khi tính toán.

### 1.3. Luồng nghiệp vụ tổng thể (End-to-End Workflow)
1. **Thiết lập hồ sơ:** Người dùng đăng nhập $\rightarrow$ Nhập chiều cao, cân nặng, tuổi, giới tính, mức vận động $\rightarrow$ Hệ thống tính $\text{BMI}$ (phân loại thể trạng), $\text{BMR}$, $\text{TDEE}$ và ngân sách Calo/Macro mục tiêu mỗi ngày.
2. **Luồng 1 — Chụp ảnh tính Calo:** Người dùng chụp hoặc tải ảnh món ăn lên Web $\rightarrow$ AI nhận diện tên món $\rightarrow$ Người dùng chọn kích cỡ khẩu phần (Nhỏ/Vừa/Lớn hoặc nhập gram) và chỉnh sửa nếu cần $\rightarrow$ Hệ thống tính Calo & Macro chuẩn $\rightarrow$ Lưu vào Nhật ký bữa ăn.
3. **Luồng 2 — Hỏi đáp & Gợi ý món từ đồ trong tủ:** Người dùng nhập các nguyên liệu đang có sẵn trong tủ/bếp (hoặc gõ câu hỏi vào Chatbot) $\rightarrow$ Hệ thống đối chiếu với lượng Calo còn lại trong ngày, chỉ số $\text{BMI}$ và danh sách dị ứng $\rightarrow$ Đề xuất các món ăn phù hợp kèm công thức và định lượng calo chi tiết.
4. **Theo dõi & Cải thiện:** Dashboard cập nhật thanh tiến độ Calo trong ngày; các trường hợp người dùng sửa nhãn nhận diện sai của AI được ghi nhận để Admin duyệt và huấn luyện lại mô hình.

---

## 2. Tổng quan danh sách chức năng

Hệ thống gồm **22 chức năng** chia làm **5 Module**: **15 chức năng Bắt buộc**, **4 chức năng Nên có**, và **3 chức năng Mở rộng**.

| Mã | Tên chức năng | Ưu tiên | Module |
| :--- | :--- | :---: | :---: |
| **CC-1.1** | Đăng ký, đăng nhập, quên mật khẩu và quản lý tài khoản | Bắt buộc | M1 |
| **CC-1.2** | Tính toán chỉ số cơ thể ($\text{BMI}$, $\text{BMR}$, $\text{TDEE}$) và mục tiêu dinh dưỡng | Bắt buộc | M1 |
| **CC-1.3** | Thiết lập chế độ ăn, dị ứng và sở thích ẩm thực | Nên có | M1 |
| **CC-2.1** | Tải ảnh lên hoặc chụp ảnh món ăn trên Web | Bắt buộc | M2 |
| **CC-2.2** | Nhận diện món ăn bằng AI (Computer Vision) | Bắt buộc | M2 |
| **CC-2.3** | Ước lượng và tùy chỉnh khẩu phần ăn | Bắt buộc | M2 |
| **CC-2.4** | Tính toán Calo, Macro và chỉ số dinh dưỡng | Bắt buộc | M2 |
| **CC-2.5** | Chỉnh sửa kết quả nhận diện và thu thập phản hồi | Bắt buộc | M2 |
| **CC-2.6** | Nhận diện nhiều món trong cùng một bức ảnh (Mâm cơm) | Nên có | M2 |
| **CC-2.7** | Tìm kiếm và nhập tay món ăn | Bắt buộc | M2 |
| **CC-2.8** | Tự tạo món ăn cá nhân (Món tự nấu) | Mở rộng | M2 |
| **CC-3.1** | Khai báo nhanh nguyên liệu đang có trong tủ/bếp | Bắt buộc | M3 |
| **CC-3.2** | Đề xuất món ăn từ nguyên liệu sẵn có theo mục tiêu Calo | Bắt buộc | M3 |
| **CC-3.3** | Xem công thức nấu chi tiết và quy đổi dinh dưỡng theo phần | Bắt buộc | M3 |
| **CC-3.4** | Chatbot AI hỏi đáp dinh dưỡng cá nhân hóa | Bắt buộc | M3 |
| **CC-3.5** | Đề xuất món ăn/đồ uống thay thế lành mạnh hơn | Mở rộng | M3 |
| **CC-4.1** | Ghi nhật ký ăn uống theo bữa | Bắt buộc | M4 |
| **CC-4.2** | Bảng điều khiển (Dashboard) tổng quan dinh dưỡng trong ngày | Bắt buộc | M4 |
| **CC-4.3** | Biểu đồ lịch sử Calo, cân nặng và theo dõi $\text{BMI}$ | Nên có | M4 |
| **CC-5.1** | Quản lý cơ sở dữ liệu món ăn, nguyên liệu và dinh dưỡng | Bắt buộc | M5 |
| **CC-5.2** | Quản lý và kiểm duyệt công thức nấu ăn | Nên có | M5 |
| **CC-5.3** | Duyệt dữ liệu sửa lỗi AI và thống kê chất lượng mô hình | Mở rộng | M5 |

---

## 3. Đặc tả chi tiết từng chức năng

### Module 1. Tài khoản, Chỉ số cơ thể ($\text{BMI/TDEE}$) và Cá nhân hóa

#### CC-1.1 — Đăng ký, đăng nhập, quên mật khẩu và quản lý tài khoản `[Bắt buộc]`
* **Mô tả:** Người dùng tạo tài khoản bằng Email/Mật khẩu hoặc đăng nhập nhanh qua Google OAuth để lưu trữ hồ sơ $\text{BMI}$, lịch sử nhận diện và nhật ký ăn uống trên nền tảng Web.
* **Luồng chính:**
  1. Người dùng nhập Email và Mật khẩu tại trang Đăng ký (hoặc chọn Đăng nhập với Google).
  2. Hệ thống kiểm tra định dạng Email và độ mạnh của mật khẩu.
  3. Hệ thống gửi mã/liên kết xác minh qua Email.
  4. Sau khi xác minh và đăng nhập thành công, hệ thống cấp `Access Token` và `Refresh Token`, chuyển hướng người dùng vào trang thiết lập hồ sơ (nếu là lần đầu) hoặc Dashboard.
  5. Người dùng có thể đổi mật khẩu hoặc đăng xuất khỏi hệ thống bất kỳ lúc nào.
* **Quy tắc và ràng buộc:**
  * Mật khẩu tối thiểu 8 ký tự, bao gồm cả chữ cái và chữ số; bắt buộc băm bằng `bcrypt` hoặc `Argon2` trước khi lưu xuống cơ sở dữ liệu.
  * `Access Token` có hạn 24 giờ, `Refresh Token` có hạn 30 ngày.
  * Nhập sai mật khẩu 5 lần liên tiếp sẽ tạm khóa chức năng đăng nhập của tài khoản đó trong 15 phút.
* **Ngoại lệ:**
  * Email đã tồn tại: Hiển thị thông báo lỗi rõ ràng và gợi ý chuyển sang Đăng nhập hoặc Quên mật khẩu.
  * Token hết hạn: Trình duyệt tự động gọi API làm mới token; nếu `Refresh Token` cũng hết hạn thì yêu cầu đăng nhập lại.
* **Tiêu chí nghiệm thu:**
  * Đăng ký, đăng nhập và đồng bộ dữ liệu thành công giữa hai trình duyệt/thiết bị khác nhau.
  * Kiểm tra bảng `users` trong cơ sở dữ liệu: 100% mật khẩu được mã hóa băm.
  * Nhập sai mật khẩu lần thứ 5 bị chặn đăng nhập đúng 15 phút.

#### CC-1.2 — Tính toán chỉ số cơ thể ($\text{BMI}$, $\text{BMR}$, $\text{TDEE}$) và mục tiêu dinh dưỡng `[Bắt buộc]`
* **Mô tả:** Tính toán tự động các chỉ số sức khỏe cốt lõi của người dùng ($\text{BMI}$, $\text{BMR}$, $\text{TDEE}$), phân loại thể trạng và đề xuất lượng Calo cùng tỷ lệ Macro (Đạm - Bột đường - Béo) cần nạp mỗi ngày.
* **Luồng chính:**
  1. Người dùng nhập: Giới tính, Tuổi (hoặc Năm sinh), Chiều cao ($\text{cm}$), Cân nặng hiện tại ($\text{kg}$), Mức độ vận động (5 mức từ Ít vận động đến Vận động rất nặng) và Mục tiêu mong muốn (Giảm cân, Giữ cân, Tăng cân/Tăng cơ).
  2. Hệ thống tính chỉ số **$\text{BMI}$** và đưa ra nhận xét phân loại thể trạng.
  3. Hệ thống tính **$\text{BMR}$** (Tỷ lệ trao đổi chất cơ bản) và **$\text{TDEE}$** (Tổng năng lượng tiêu hao mỗi ngày).
  4. Dựa trên mục tiêu, hệ thống đề xuất **Calo mục tiêu hằng ngày** và chia tỷ lệ 3 nhóm chất đa lượng (**Protein - Carb - Fat**) quy đổi ra số gram cụ thể.
  5. Người dùng xác nhận lưu hồ sơ (hoặc tự tinh chỉnh con số mục tiêu nếu muốn).
* **Quy tắc và ràng buộc:**
  * **Công thức $\text{BMI}$:**
    $$\text{BMI} = \frac{\text{Cân nặng (kg)}}{(\text{Chiều cao (m)})^2}$$
    Hiển thị phân loại thể trạng (kèm thang chuẩn WHO / IDI & WPRO cho người châu Á): Thiếu cân ($< 18.5$), Bình thường ($18.5 - 22.9$), Thừa cân ($23.0 - 24.9$), Béo phì ($\ge 25.0$).
  * **Công thức $\text{BMR}$ (Mifflin-St Jeor):**
    * Nam: $\text{BMR} = 10 \times \text{Cân nặng (kg)} + 6.25 \times \text{Chiều cao (cm)} - 5 \times \text{Tuổi} + 5$
    * Nữ: $\text{BMR} = 10 \times \text{Cân nặng (kg)} + 6.25 \times \text{Chiều cao (cm)} - 5 \times \text{Tuổi} - 161$
  * **Công thức $\text{TDEE}$:** $\text{TDEE} = \text{BMR} \times R$, với hệ số vận động $R \in \{1.2; 1.375; 1.55; 1.725; 1.9\}$.
  * **Điều chỉnh theo mục tiêu:** Giảm cân lành mạnh ($\text{TDEE} - 300 \text{ đến } 500\text{ kcal/ngày}$, tốc độ thay đổi khuyến nghị không quá $0.5 - 1\text{ kg/tuần}$); Giữ cân ($= \text{TDEE}$); Tăng cân ($\text{TDEE} + 300 \text{ đến } 500\text{ kcal/ngày}$).
  * **Ngưỡng an toàn tối thiểu:** Không tự động đề xuất mức Calo mục tiêu thấp hơn $1200\text{ kcal}$ (đối với nữ) và $1500\text{ kcal}$ (đối với nam). Nếu người dùng tự chỉnh tay thấp hơn ngưỡng này, hệ thống phải hiện cảnh báo sức khỏe.
  * **Phân bổ ngân sách Calo theo bữa (mặc định dùng cho gợi ý món ăn):** Bữa sáng $30\%$ — Bữa trưa $35\%$ — Bữa tối $25\%$ — Bữa phụ $10\%$.
* **Ngoại lệ:**
  * Người dùng dưới 18 tuổi: Ẩn tùy chọn "Giảm cân" sâu, chỉ giữ chế độ dinh dưỡng cân bằng và hiển thị lưu ý dành cho lứa tuổi đang phát triển.
  * Nhập thông số phi thực tế (Chiều cao $< 100\text{ cm}$ hoặc $> 250\text{ cm}$; Cân nặng $< 20\text{ kg}$ hoặc $> 300\text{ kg}$; Tuổi $< 10$ hoặc $> 120$): Báo lỗi ngay trên form và chặn lưu.
  * Chưa thiết lập hồ sơ: Tạm áp dụng mức mặc định $2000\text{ kcal/ngày}$ và hiển thị banner nhắc cập nhật chỉ số $\text{BMI/TDEE}$.
* **Tiêu chí nghiệm thu:**
  * Kiểm thử trên 5 bộ hồ sơ mẫu: Kết quả $\text{BMI}$ đúng đến $0.1$, $\text{BMR}$ và $\text{TDEE}$ lệch không quá $1\text{ kcal}$ so với công thức toán học.
  * Khi người dùng cập nhật cân nặng mới, $\text{BMI}$ và $\text{TDEE}$ tự động tính toán lại ngay lập tức.

#### CC-1.3 — Thiết lập chế độ ăn, dị ứng và sở thích ẩm thực `[Nên có]`
* **Mô tả:** Cho phép người dùng khai báo các thực phẩm bị dị ứng, chế độ ăn kiêng và nguyên liệu không thích để cá nhân hóa hoàn toàn kết quả gợi ý món ăn và câu trả lời của Chatbot.
* **Luồng chính:**
  1. Người dùng chọn chế độ ăn hiện tại (Bình thường, Ăn chay, Thuần chay, Low-carb, Eat Clean, Giảm đường...).
  2. Chọn các nhóm thực phẩm dị ứng từ danh sách chuẩn (Hải sản giáp xác, Đậu phộng, Sữa/Lactose, Trứng, Gluten, Đậu nành...) và nhập các nguyên liệu bản thân ghét/không ăn được (ví dụ: hành lá, mắm tôm).
  3. Lưu cấu hình vào hồ sơ cá nhân.
* **Quy tắc và ràng buộc:**
  * **Dị ứng & Chế độ ăn chay** là **ràng buộc cứng**: Bất kỳ món ăn nào có chứa thành phần thuộc nhóm dị ứng đã chọn sẽ bị loại $100\%$ khỏi danh sách đề xuất.
  * **Nguyên liệu không thích** là **ràng buộc mềm**: Món ăn chứa nguyên liệu này bị trừ điểm ưu tiên hoặc gợi ý bỏ thành phần đó khi chế biến.
* **Ngoại lệ:**
  * Món ăn trong cơ sở dữ liệu chưa được gắn nhãn thành phần chi tiết: Tự động ẩn khỏi kết quả gợi ý đối với người dùng có khai báo dị ứng để đảm bảo an toàn.
* **Tiêu chí nghiệm thu:**
  * Khi bật dị ứng "Đậu phộng" hoặc chế độ "Ăn chay", thực hiện 30 lượt yêu cầu gợi ý món ăn liên tiếp: $0\%$ món trả về vi phạm ràng buộc.

---

### Module 2. Nhận diện món ăn qua ảnh và Tính toán Calo (Trụ cột 1)

#### CC-2.1 — Tải ảnh lên hoặc chụp ảnh món ăn trên Web `[Bắt buộc]`
* **Mô tả:** Cung cấp giao diện Web trực quan để người dùng kéo-thả ảnh, chọn ảnh từ máy tính/điện thoại hoặc mở trực tiếp Camera trên trình duyệt để chụp món ăn.
* **Luồng chính:**
  1. Người dùng bấm nút "Quét món ăn" $\rightarrow$ Chọn tải tệp ảnh từ thiết bị hoặc chụp qua WebRTC Camera.
  2. Trình duyệt (Client-side) kiểm tra định dạng tệp, dung lượng và tự động nén/resize ảnh về kích thước chuẩn.
  3. Ảnh được gửi lên máy chủ (Server-side); máy chủ kiểm tra chất lượng ảnh (độ sáng, độ mờ) và xác nhận có đối tượng thức ăn trước khi đưa vào mô hình nhận diện sâu.
* **Quy tắc và ràng buộc:**
  * Chỉ chấp nhận định dạng `JPG`, `PNG`, `WEBP`, `HEIC`; dung lượng gốc tối đa $10\text{ MB}$.
  * Client tự động nén ảnh về cạnh dài tối đa $1280\text{ px}$ trước khi tải lên nhằm tối ưu tốc độ mạng.
  * Hiển thị hướng dẫn trực quan: *"Chụp rõ toàn bộ bát/đĩa từ góc trên xuống hoặc góc nghiêng 45 độ, đủ ánh sáng"*.
* **Ngoại lệ:**
  * Tệp sai định dạng hoặc vượt quá $10\text{ MB}$: Chặn ngay tại trình duyệt và báo lỗi rõ ràng.
  * Ảnh quá tối hoặc quá mờ: Hiển thị cảnh báo khuyên người dùng chọn ảnh khác nhưng vẫn cho phép bấm "Tiếp tục thử nhận diện".
  * Ảnh không chứa đồ ăn (ví dụ: chụp phong cảnh, đồ vật khác): Hệ thống thông báo không phát hiện món ăn và chuyển hướng sang thanh Tìm kiếm thủ công (`CC-2.7`).
* **Tiêu chí nghiệm thu:**
  * Tổng thời gian từ lúc chọn ảnh hợp lệ đến khi hiển thị kết quả nhận diện không quá **5 giây** trên kết nối mạng ổn định.

#### CC-2.2 — Nhận diện món ăn bằng AI (Computer Vision) `[Bắt buộc]`
* **Mô tả:** Mô hình thị giác máy tính phân tích bức ảnh và dự đoán tên món ăn, tập trung tối ưu cho các món ăn phổ biến tại Việt Nam.
* **Luồng chính:**
  1. Máy chủ đưa ảnh qua mô hình AI phân loại/nhận diện món ăn.
  2. Mô hình trả về danh sách tối đa **Top 3 món ăn** có điểm tin cậy (`Confidence Score`) cao nhất kèm phần trăm tin cậy.
  3. Giao diện hiển thị món có điểm cao nhất làm mặc định, đồng thời hiển thị 2 gợi ý còn lại dưới dạng nút chọn nhanh để người dùng dễ dàng đổi nếu món đầu chưa chuẩn.
* **Quy tắc và ràng buộc:**
  * Phân tầng xử lý theo độ tin cậy (`Confidence Score`):
    * $\ge 0.70$: Tự động chọn món Top 1 và tính sẵn Calo.
    * Từ $0.40$ đến $< 0.70$: Hiển thị danh sách 3 món và yêu cầu người dùng bấm chọn xác nhận 1 trong 3 món.
    * $< 0.40$: Thông báo *"AI chưa chắc chắn về món ăn này"* và mở ngay ô tìm kiếm/nhập tay (`CC-2.7`).
  * Phạm vi dữ liệu huấn luyện ban đầu: Tối thiểu **30 – 50 món ăn Việt Nam phổ biến** (Phở bò, Phở gà, Bún chả, Cơm tấm sườn bì chả, Bánh mì thịt, Bún bò Huế, Cơm rang dưa bò, Trứng ốp la, Rau muống xào...).
* **Ngoại lệ:**
  * Món ăn nằm ngoài tập dữ liệu đã huấn luyện: Độ tin cậy thấp $\rightarrow$ Không ép gán bừa mà hướng dẫn người dùng tìm kiếm tên món.
  * Ảnh có nhiều món khác nhau trên mâm: Chuyển sang xử lý theo luồng `CC-2.6`.
* **Tiêu chí nghiệm thu:**
  * Độ chính xác **Top-1 đạt $\ge 75\%$** và **Top-3 đạt $\ge 90\%$** trên tập kiểm thử độc lập (Test set).
  * Xuất được Ma trận nhầm lẫn (Confusion Matrix) trong báo cáo đồ án để phân tích các cặp món dễ nhầm (ví dụ: Bún bò và Phở bò).

#### CC-2.3 — Ước lượng và tùy chỉnh khẩu phần ăn `[Bắt buộc]`
* **Mô tả:** Xác định khối lượng/khẩu phần của món ăn để tính đúng lượng calo thực tế nạp vào, giải quyết bài toán cùng một món nhưng tô lớn/nhỏ có calo khác nhau.
* **Luồng chính:**
  1. Ngay khi xác định được tên món, hệ thống lấy **Khẩu phần tiêu chuẩn (Mặc định - Cỡ Vừa $1.0\times$)** của món đó từ cơ sở dữ liệu (ví dụ: *1 tô phở tiêu chuẩn = $500\text{g}$*, *1 đĩa cơm tấm = $350\text{g}$*).
  2. Dựa trên tỷ lệ khung hình món ăn hoặc lựa chọn của người dùng, giao diện cung cấp thanh chọn nhanh kích cỡ khẩu phần:
     * **Nhỏ (S - $0.75\times$)** | **Vừa (M - $1.0\times$)** | **Lớn (L - $1.25\times$)**
  3. Ngoài ra, người dùng có thể nhập trực tiếp số lượng theo **Đơn vị quen thuộc** (số bát, đĩa, cái, quả, lát) hoặc nhập chính xác số **Gram ($\text{g}$)**.
* **Quy tắc và ràng buộc:**
  * Luôn hiển thị song song đơn vị tự nhiên và khối lượng quy đổi ra gram (ví dụ: *"1 tô vừa ($\approx 450\text{g}$)"*).
  * Mỗi món ăn trong cơ sở dữ liệu bắt buộc phải có bảng quy đổi từ đơn vị thông dụng sang `gram`.
  * Giới hạn kiểm tra hợp lý: Nếu người dùng nhập khối lượng $< 5\text{g}$ hoặc $> 3000\text{g}$ cho một món ăn đơn lẻ, hệ thống hiển thị cảnh báo xác nhận.
* **Ngoại lệ:**
  * Người dùng nhập số âm, chữ cái hoặc số $0$ vào ô khối lượng: Chặn nhập và báo lỗi định dạng.
* **Tiêu chí nghiệm thu:**
  * Khi người dùng chuyển đổi giữa các mức Nhỏ / Vừa / Lớn hoặc thay đổi số gram, toàn bộ chỉ số Calo và Macro trên màn hình phải được tính lại tức thời (dưới $200\text{ ms}$).

#### CC-2.4 — Tính toán Calo, Macro và chỉ số dinh dưỡng `[Bắt buộc]`
* **Mô tả:** Từ tên món ăn và khối lượng khẩu phần đã xác định, hệ thống tính toán chi tiết năng lượng (Calo) và các chất dinh dưỡng.
* **Luồng chính:**
  1. Hệ thống truy vấn bảng giá trị dinh dưỡng chuẩn trên $100\text{g}$ của món ăn (hoặc tổng hợp từ các thành phần cấu thành món ăn đó).
  2. Áp dụng công thức tính dinh dưỡng theo khối lượng thực tế:
     $$\text{Giá trị dinh dưỡng} = \frac{\text{Khối lượng khẩu phần (g)}}{100} \times \text{Giá trị dinh dưỡng trên } 100\text{g}$$
  3. Hiển thị trực quan bằng biểu đồ tròn/thanh: **Tổng Calo ($\text{kcal}$)**, **Chất đạm (Protein - $\text{g}$)**, **Chất bột đường (Carb - $\text{g}$)**, **Chất béo (Fat - $\text{g}$)**, cùng chất xơ và đường (nếu có).
  4. Hiển thị thêm dòng so sánh nhanh: *"Món này chiếm $X\%$ lượng Calo mục tiêu còn lại trong ngày của bạn"*.
* **Quy tắc và ràng buộc:**
  * Mọi kết quả đều phải đính kèm nhãn **"Ước lượng"** và tên **Nguồn dữ liệu** (ví dụ: *Viện Dinh dưỡng Quốc gia / USDA*).
  * Tuyệt đối tính bằng công thức toán học từ Database, không gọi LLM để tính toán số học.
* **Ngoại lệ:**
  * Món ăn chưa có đủ thông tin vi chất (đường, chất xơ): Hiển thị ký hiệu `"N/A"` hoặc `"Chưa có dữ liệu"`, không hiển thị là $0\text{g}$ để tránh hiểu lầm.
* **Tiêu chí nghiệm thu:**
  * Kết quả Calo, Protein, Carb, Fat hiển thị trên Web khớp 100% với phép tính từ cơ sở dữ liệu (sai số làm tròn không quá $1\text{ kcal}$ hoặc $0.1\text{g}$).

#### CC-2.5 — Chỉnh sửa kết quả nhận diện và thu thập phản hồi `[Bắt buộc]`
* **Mô tả:** Cho phép người dùng sửa lại tên món hoặc thêm/bớt thành phần phụ (topping) khi món ăn thực tế khác với mặc định, đồng thời lưu lại lịch sử sửa sai để cải thiện mô hình AI.
* **Luồng chính:**
  1. Tại màn hình kết quả nhận diện, người dùng có thể:
     * Đổi sang tên món khác nếu AI nhận diện sai.
     * Tick thêm hoặc bớt các thành phần phụ đi kèm (ví dụ: *+1 quả trứng chần*, *+1 đĩa quẩy*, *Bỏ nước béo*, *Ít cơm*).
  2. Hệ thống lập tức cộng/trừ Calo và Macro tương ứng của phần topping đó.
  3. Khi người dùng bấm Xác nhận/Lưu nhật ký, hệ thống lưu lại bản ghi kèm thông tin đối chiếu: `(Ảnh gốc, Nhãn AI dự đoán, Nhãn người dùng chốt cuối cùng)`.
* **Quy tắc và ràng buộc:**
  * Người dùng có tùy chọn bật/tắt quyền *"Cho phép sử dụng ảnh của tôi để cải thiện mô hình AI"* trong phần Cài đặt tài khoản.
* **Ngoại lệ:**
  * Người dùng bấm "Đặt lại (Reset)": Khôi phục về kết quả nhận diện ban đầu của AI.
* **Tiêu chí nghiệm thu:**
  * Thêm/bớt topping cập nhật lại tổng Calo ngay trên giao diện trong vòng $< 0.5$ giây.
  * Khi người dùng đổi tên món khác với dự đoán Top 1 của AI, hệ thống ghi nhận đúng cặp dữ liệu `(ai_predicted_label, user_corrected_label)` vào bảng log.

#### CC-2.6 — Nhận diện nhiều món trong cùng một bức ảnh (Mâm cơm) `[Nên có]`
* **Mô tả:** Hỗ trợ trường hợp người dùng chụp cả khay cơm văn phòng hoặc mâm cơm gia đình gồm nhiều món khác nhau trong một khung hình.
* **Luồng chính:**
  1. Mô hình phát hiện đối tượng (Object Detection - ví dụ: YOLO) khoanh vùng (Bounding Box) từng món ăn xuất hiện trong ảnh.
  2. Mỗi vùng khoanh hiển thị tên món, khẩu phần và lượng Calo riêng biệt.
  3. Người dùng có thể bấm vào từng món để sửa tên, chỉnh khẩu phần, xóa khung nhận diện thừa hoặc thêm món bị sót.
  4. Hệ thống cộng tổng Calo và Macro của tất cả các món trong ảnh thành một bữa ăn hoàn chỉnh.
* **Quy tắc và ràng buộc:**
  * Hỗ trợ tối đa 6 – 8 món ăn trong một bức ảnh.
* **Ngoại lệ:**
  * Các món xếp chồng chéo quá phức tạp khiến AI chỉ bắt được 1 phần: Cho phép người dùng bấm nút *"+ Thêm món vào bữa này"* để bổ sung nhanh.
* **Tiêu chí nghiệm thu:**
  * Tổng Calo của cả mâm cơm luôn bằng chính xác tổng Calo của từng món thành phần cộng lại sau khi chỉnh sửa.

#### CC-2.7 — Tìm kiếm và nhập tay món ăn `[Bắt buộc]`
* **Mô tả:** Phương án dự phòng thiết yếu khi người dùng không có ảnh chụp hoặc khi AI không nhận diện được món ăn lạ.
* **Luồng chính:**
  1. Người dùng nhập từ khóa tên món ăn vào thanh tìm kiếm trên Web.
  2. Hệ thống gợi ý danh sách các món ăn khớp từ khóa theo thời gian thực (Autocomplete), ưu tiên hiển thị các món người dùng từng ăn gần đây.
  3. Người dùng chọn món, điều chỉnh khẩu phần (`CC-2.3`), xem dinh dưỡng (`CC-2.4`) và lưu vào nhật ký.
* **Quy tắc và ràng buộc:**
  * Hỗ trợ tìm kiếm tiếng Việt **không dấu** và chịu lỗi chính tả nhẹ (ví dụ: gõ `"pho bo"`, `"bun cha"`, `"com tam"` vẫn trả về đúng kết quả có dấu).
* **Ngoại lệ:**
  * Không tìm thấy món trong cơ sở dữ liệu: Hiển thị nút gợi ý chuyển sang chức năng *"Tự tạo món ăn mới"* (`CC-2.8`) hoặc hỏi Trợ lý AI ước tính dựa trên nguyên liệu.
* **Tiêu chí nghiệm thu:**
  * Thử nghiệm 20 từ khóa tên món ăn gõ không dấu: $100\%$ trả về đúng món tương ứng trong thời gian $< 500\text{ ms}$.

#### CC-2.8 — Tự tạo món ăn cá nhân (Món tự nấu) `[Mở rộng]`
* **Mô tả:** Cho phép người dùng tự tạo một món ăn mới bằng cách liệt kê các nguyên liệu thành phần và khối lượng để dùng lại lâu dài.
* **Luồng chính:**
  1. Người dùng đặt tên món (ví dụ: *Salad ức gà tự trộn*), nhập số khẩu phần tạo ra.
  2. Chọn từng nguyên liệu từ cơ sở dữ liệu nguyên liệu kèm số gram (ví dụ: $150\text{g}$ ức gà, $100\text{g}$ xà lách, $10\text{g}$ dầu oliu).
  3. Hệ thống tự động cộng tổng Calo & Macro của các nguyên liệu rồi chia cho số khẩu phần và lưu vào danh mục *"Món của tôi"*.
* **Quy tắc và ràng buộc:**
  * Món tự tạo chỉ hiển thị riêng cho tài khoản của người dùng đó.
* **Ngoại lệ:**
  * Nhập tổng khối lượng nguyên liệu bằng $0$ hoặc không chọn nguyên liệu nào: Không cho phép lưu.
* **Tiêu chí nghiệm thu:**
  * Cal