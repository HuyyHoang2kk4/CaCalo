# QUY CHUẨN THIẾT KẾ UI/UX: PHONG CÁCH CHUYÊN GIA (ANTI-AI SLOP)

Khi viết code giao diện, bạn phải tuân thủ nghiêm ngặt các quy tắc thiết kế dưới đây để giao diện trông sắc nét, có chiều sâu và mang đậm dấu ấn thiết kế của con người. Các quy tắc được viết bằng **giá trị CSS thuần** để áp dụng được với mọi Tech Stack.

---

## PHẦN A: QUY TẮC BẮT BUỘC CHO MVP (Phải tuân thủ ngay từ đầu)

### 1. DANH SÁCH CẤM (Những dấu hiệu "rẻ tiền" của AI cần loại bỏ tuyệt đối)
- **CẤM lạm dụng dải màu chuyển sắc (Gradient) tím - xanh - hồng lòe loẹt** cho chữ, nút bấm hoặc nền nếu không được yêu cầu.
- **CẤM dùng Emoji (🚀, ✨, 💡, 🔥, 📊) làm biểu tượng giao diện.** Bắt buộc sử dụng bộ icon SVG đồng nhất (như `Lucide Icons`, `Heroicons`, hoặc `Phosphor Icons`) với độ dày nét (`stroke-width`) từ `1.5` đến `2`. Cách tải: Sử dụng CDN (VD: `https://unpkg.com/lucide@latest`) hoặc cài qua npm tùy theo Tech Stack. Kích thước icon chuẩn: `16px` (inline text), `20px` (nút bấm), `24px` (tiêu đề/menu).
- **CẤM đổ bóng quá đậm và nhòe** (bóng lớn hơn `0 1px 3px rgba(0,0,0,0.1)`, bóng màu neon phát sáng).
- **CẤM bố cục đối xứng nhàm chán:** Tránh kiểu mở đầu bằng dòng chữ căn giữa to đùng kèm 3 thẻ (card) giống hệt nhau nằm ngang bên dưới nếu đây là ứng dụng công cụ (Web App / Dashboard).
- **CẤM dùng màu đen tuyền (`#000000`) hoặc trắng lóa (`#FFFFFF`) kết hợp màu cơ bản chói mắt** (`red`, `blue`, `green` nguyên bản) mà không pha sắc độ trung tính.

### 2. Quy tắc Bảng màu & Độ tương phản (Color System 60-30-10)
- **60% Nền chủ đạo (Neutral Backgrounds):** Sử dụng tông xám ấm hoặc xám lạnh tinh tế.
  - *Light Mode:* Nền trang `#F8FAFC` hoặc `#FAFAFA`, nền thẻ (Card) `#FFFFFF`.
  - *Dark Mode (nếu có):* Nền trang `#09090B`, nền thẻ `#18181B`.
- **30% Cấu trúc & Viền (Borders & Surfaces):** Thay vì dùng bóng đổ (shadow) để tách biệt các khối, hãy dùng **viền mảnh 1px** (màu `rgba(0,0,0,0.08)` ở nền sáng hoặc `rgba(255,255,255,0.1)` ở nền tối) kết hợp bóng đổ siêu nhẹ (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)`).
- **10% Màu nhấn (Accent Color):** Chỉ chọn **1 màu chủ đạo duy nhất** cho các hành động chính (Primary CTA). Các nút phụ phải dùng tông màu trung tính (Ghost hoặc Outline button).
- **Contrast Ratio tối thiểu:** Chữ trên nền phải đạt tỷ lệ tương phản **4.5:1** (chuẩn WCAG AA). Dùng công cụ kiểm tra: https://webaim.org/resources/contrastchecker/

### 3. Quy tắc Chữ viết & Phân cấp thị giác (Typography & Hierarchy)
- **Phông chữ:** Sử dụng font không chân hiện đại (`Inter`, `Plus Jakarta Sans`, hoặc `Geist`) cho giao diện và font đơn cách (`JetBrains Mono` / `Fira Code`) cho con số, mã code, đồng hồ, tiền tệ. Tải từ Google Fonts bằng thẻ `<link>` trong HTML.
- **Tối ưu con số:** Mọi dữ liệu dạng số (giá tiền, bộ đếm giờ, phần trăm, bảng biểu) BẮT BUỘC phải có thuộc tính `font-variant-numeric: tabular-nums` để các chữ số thẳng hàng dọc và không bị giật khung khi số thay đổi.
- **Khoảng cách chữ:**
  - Tiêu đề lớn: `letter-spacing: -0.02em` và `font-weight: 600` (semi-bold).
  - Văn bản đọc dài: `line-height: 1.7` và màu chữ dịu hơn tiêu đề một bậc (VD: `#52525B` thay vì đen đặc).

### 4. Quy tắc Khoảng trắng & Bố cục (Spacing & Layout)
- Tuân thủ hệ thống lưới **4px / 8px** (mọi `padding`, `margin`, `gap` đều chia hết cho 4).
- **Nguyên tắc lồng góc bo (Nested Border Radius):** Nếu khung ngoài có `border-radius: 16px` và `padding: 8px`, thì khung bên trong phải có `border-radius: 8px` (= 16 - 8) để tạo độ đồng tâm hoàn hảo.
- Không để nội dung tràn sát mép màn hình; luôn giới hạn chiều rộng tối đa hợp lý (`max-width: 1024px` hoặc `1152px` căn giữa bằng `margin: 0 auto`) và chừa tối thiểu 25% diện tích màn hình làm khoảng thở (whitespace).
- **Responsive cơ bản:** Sử dụng `display: flex` hoặc `display: grid` cho mọi bố cục. Luôn test trên chiều ngang `375px` (điện thoại) và `1280px` (máy tính).

### 5. Trạng thái tương tác cơ bản (Interactive States)
Mọi thành phần tương tác (Nút bấm, Ô nhập liệu, Thẻ danh sách) bắt buộc phải có tối thiểu 3 trạng thái cho MVP:
1. **Default:** Trạng thái bình thường.
2. **Hover:** Đổi màu nền nhẹ kèm hiệu ứng chuyển mượt (`transition: background-color 0.15s ease-out`). **Lưu ý:** KHÔNG dùng `transition: all` vì gây hiệu suất kém — luôn chỉ định rõ thuộc tính cần chuyển đổi (`background-color`, `opacity`, `transform`...).
3. **Focus:** Có vòng viền rõ ràng khi dùng phím Tab (`outline: 2px solid [màu nhấn]; outline-offset: 2px`), hỗ trợ người dùng điều hướng bằng bàn phím.

### 6. Trợ năng cơ bản (Accessibility — Bắt buộc)
- Sử dụng **semantic HTML**: `<nav>` cho menu, `<main>` cho nội dung chính, `<aside>` cho sidebar, `<button>` cho nút bấm (không dùng `<div onclick>`), `<label>` cho nhãn ô nhập liệu.
- Mọi nút bấm chỉ có icon (không có chữ) phải có thuộc tính `aria-label="Mô tả hành động"`.
- Mọi hình ảnh phải có thuộc tính `alt` mô tả nội dung.
- Kích thước vùng chạm tối thiểu: `44px × 44px` cho các phần tử tương tác trên mobile.

---

## PHẦN B: QUY TẮC NÂNG CAO CHO PHASE 2 (Làm sau khi MVP ổn định)

### 7. Micro-interactions nâng cao (5 trạng thái đầy đủ)
Nâng cấp từ 3 trạng thái (MVP) lên đầy đủ 5 trạng thái cho mọi component:
1. **Default:** (Đã có từ MVP).
2. **Hover:** (Đã có từ MVP).
3. **Active/Pressed:** Thu nhỏ cực nhẹ khi bấm (`transform: scale(0.98)` kết hợp `transition: transform 0.1s`).
4. **Focus:** (Đã có từ MVP).
5. **Disabled & Empty State:** Nút bị khóa phải mờ đi (`opacity: 0.5; cursor: not-allowed; pointer-events: none`). Khi danh sách chưa có dữ liệu, phải thiết kế khung **Empty State** đẹp mắt có icon minh họa và dòng chữ hướng dẫn thao tác đầu tiên (tuyệt đối không để màn hình trắng trơn).

### 8. Dark Mode (Chế độ tối)
- Sử dụng **CSS Custom Properties (CSS Variables)** để quản lý bảng màu, giúp chuyển đổi Light/Dark dễ dàng:
  ```css
  :root {
    --bg-primary: #F8FAFC;
    --bg-card: #FFFFFF;
    --text-primary: #18181B;
    --text-secondary: #52525B;
    --border-color: rgba(0,0,0,0.08);
  }
  [data-theme="dark"] {
    --bg-primary: #09090B;
    --bg-card: #18181B;
    --text-primary: #FAFAFA;
    --text-secondary: #A1A1AA;
    --border-color: rgba(255,255,255,0.1);
  }
  ```
- Mặc định theo cài đặt hệ thống của người dùng (`prefers-color-scheme: dark`), kèm nút bấm cho phép chuyển đổi thủ công.

### 9. Animation nâng cao
- Hiệu ứng xuất hiện khi cuộn trang (scroll-reveal) cho các section.
- Skeleton loading thay vì spinner cho trạng thái đang tải.
- Chuyển cảnh mượt giữa các trạng thái dữ liệu (thêm/xóa item với animation).