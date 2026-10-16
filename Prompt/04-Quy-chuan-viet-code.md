# QUY CHUẨN VIẾT CODE: ĐẦY ĐỦ, CHUẨN THỰC TẾ & DỄ HỌC

Mục tiêu của tôi không chỉ là lấy code chạy được, mà còn **đọc hiểu được kiến trúc bên trong**. Hãy tuân thủ tuyệt đối các quy tắc kỹ thuật sau:

## 1. Quy tắc "Code Đầy Đủ - Không Lười Biếng" (Zero Lazy Placeholders)
- **TUYỆT ĐỐI CẤM** dùng các dòng bình luận cắt bớt code như: `// ... giữ nguyên code cũ`, `// ... viết tiếp ở đây`, `<!-- phần còn lại tương tự -->`.
- Nếu sửa **ít hơn 20% nội dung file**: Hãy xuất ra **trọn vẹn hàm (function) hoặc thành phần (component)** cần sửa, kèm theo chỉ dẫn cực kỳ rõ ràng: *"Tìm hàm tên là `X` (khoảng dòng...) và thay thế toàn bộ hàm đó bằng đoạn code dưới đây"*.
- Nếu sửa **nhiều hơn 20% nội dung file** hoặc file ngắn dưới 200 dòng: Hãy xuất ra **toàn bộ file hoàn chỉnh** để tôi có thể copy-paste chạy ngay.
- Không bao giờ sử dụng thư viện bên ngoài chưa được khai báo hoặc cài đặt. Nếu cần thêm thư viện mới, phải liệt kê rõ **tên thư viện, lệnh cài đặt, và lý do sử dụng**.

## 2. Cấu trúc Code chuẩn Thực tế (Separation of Concerns)
Dù viết trong 1 file hay nhiều file, code luôn phải được phân chia rạch ròi thành các vùng (hoặc module) theo đúng chuẩn công nghiệp:
1. **Constants & Config:** Nơi chứa các giá trị cố định, cấu hình, khóa lưu trữ (`STORAGE_KEY`), dữ liệu mẫu.
2. **State Management (Quản lý trạng thái):** Nơi tập trung toàn bộ dữ liệu đang thay đổi của ứng dụng (Single Source of Truth). Không lưu trữ dữ liệu lung tung trên giao diện DOM.
3. **Business Logic / Pure Functions (Hàm xử lý nghiệp vụ):** Các hàm tính toán, lọc, kiểm tra dữ liệu độc lập với giao diện.
4. **Storage / API Layer (Lớp dữ liệu):** Các hàm chuyên đọc/ghi dữ liệu vào `localStorage` hoặc gọi API (luôn bọc trong khối `try...catch` để chống sập ứng dụng).
5. **UI Rendering & Event Listeners (Giao diện & Sự kiện):** Các hàm cập nhật màn hình và lắng nghe thao tác bấm chuột/bàn phím của người dùng.

## 3. Quy tắc Đặt tên & Độ dài Hàm (Clean Code)
- **Đặt tên tiếng Anh tự mô tả (Self-documenting):**
  - Biến chứa dữ liệu: Dùng danh từ rõ nghĩa (`taskList`, `activeFilter` — KHÔNG đặt là `data`, `arr`, `temp`, `x`).
  - Biến đúng/sai (Boolean): Luôn bắt đầu bằng `is`, `has`, `should` (`isTimerRunning`, `hasError`).
  - Hàm (Function): Luôn bắt đầu bằng động từ (`createNewTask`, `saveTasksToStorage`, `renderTaskList`).
  - Hằng số (Constants): Viết HOA toàn bộ, phân cách bằng dấu gạch dưới (`MAX_ITEMS`, `STORAGE_KEY`, `API_BASE_URL`).
- **Quy tắc Đơn nhiệm (Single Responsibility):** Mỗi hàm chỉ làm **đúng 1 việc duy nhất** và không nên dài quá 30 dòng. Nếu một hàm vừa lấy dữ liệu từ ô input, vừa tính toán, vừa lưu vào bộ nhớ, vừa vẽ lại màn hình -> Hãy tách thành các hàm nhỏ gọi lẫn nhau.

## 4. Quy tắc Chú thích & Giảng giải cho Người mới (Educational Comments)
- Ngay phía trên mỗi hàm, hãy viết một khối chú thích ngắn bằng **Tiếng Việt** theo mẫu:
  ```javascript
  /**
   * MỤC ĐÍCH: [Hàm này làm nhiệm vụ gì?]
   * ĐẦU VÀO (Params): [Nhận vào dữ liệu gì?]
   * ĐẦU RA (Return): [Trả về kết quả gì hoặc thay đổi trạng thái nào?]
   * LƯU Ý KỸ THUẬT: [Giải thích ngắn gọn nếu có cú pháp nâng cao như map, filter, async/await]
   */
  ```
- Đối với các đoạn code phức tạp (regex, thuật toán, cú pháp nâng cao), thêm comment inline giải thích **tại sao** chứ không phải **cái gì** (VD: `// Dùng debounce 300ms để tránh gọi API mỗi lần gõ phím` thay vì `// gọi hàm debounce`).

## 5. Quy tắc Xử lý Lỗi (Error Handling)
- **Lớp Storage/API:** Luôn bọc trong `try...catch`. Khi bắt lỗi, log ra console với format rõ ràng:
  ```javascript
  try {
    // code đọc/ghi dữ liệu
  } catch (error) {
    console.error('[TÊN_MODULE] Mô tả lỗi:', error);
    // Hiển thị thông báo lỗi thân thiện cho người dùng
  }
  ```
- **Hiển thị lỗi cho người dùng:** Dùng thông báo dạng toast notification hoặc inline error message (chữ đỏ nhỏ dưới ô input) — KHÔNG dùng `alert()`.
- **Phân biệt lỗi:**
  - *Lỗi có thể phục hồi (Recoverable):* Mất kết nối, dữ liệu nhập sai → Hiển thị thông báo và cho phép thử lại.
  - *Lỗi nghiêm trọng (Fatal):* localStorage bị hỏng, data schema không hợp lệ → Khởi tạo dữ liệu mặc định an toàn và thông báo cho người dùng.

## 6. Quy tắc CSS & Styling
- **Đặt tên class CSS:** Sử dụng quy ước rõ ràng, dễ đọc. Ưu tiên đặt tên theo chức năng (`task-card`, `sidebar-nav`, `btn-primary`) thay vì theo giao diện (`red-box`, `big-text`).
- **Tổ chức file CSS:**
  - Phần 1: CSS Variables (Custom Properties) — bảng màu, font, spacing.
  - Phần 2: Reset & Base styles — normalize, typography mặc định.
  - Phần 3: Layout — header, sidebar, main content, footer.
  - Phần 4: Components — buttons, cards, forms, modals.
  - Phần 5: Utilities — helper classes (ẩn hiện, text alignment...).
- **Không viết inline style** trong HTML trừ khi là giá trị động (computed từ JavaScript). Mọi styling phải nằm trong file CSS.

## 7. Quy tắc Bảo mật cơ bản (Security)
- **KHÔNG dùng `innerHTML`** để hiển thị dữ liệu người dùng nhập vào. Luôn dùng `textContent` hoặc `createElement` để tránh tấn công XSS.
- **KHÔNG hardcode** API keys, mật khẩu, hoặc thông tin nhạy cảm trong code. Nếu cần, sử dụng biến môi trường (environment variables).
- **Luôn validate dữ liệu đầu vào** cả ở phía client (UX tốt) lẫn phía server (bảo mật thực sự) nếu có backend.
- **Escape output:** Khi hiển thị dữ liệu từ URL params hoặc bất kỳ nguồn bên ngoài nào, luôn sanitize trước khi render.