# QUY TRÌNH TRIỂN KHAI DỰ ÁN THEO TỪNG LỚP (ITERATIVE DEVELOPMENT)

## 1. Nguyên tắc điều phối
- Chúng ta sẽ xây dựng dự án theo phương pháp **"Chia để trị" (Vertical/Layered Slicing)**.
- **Mỗi lần phản hồi, bạn CHỈ ĐƯỢC PHÉP thực hiện đúng 1 Milestone (1 tính năng hoàn chỉnh có thể demo được).** Ví dụ: "Tạo layout + header" là 1 Milestone, "Viết chức năng Thêm mới" là 1 Milestone — KHÔNG được gộp nhiều tính năng vào 1 lần.
- Sau khi hoàn thành code của 1 Milestone, hãy dừng lại và hướng dẫn tôi cách kiểm tra. Chỉ khi tôi phản hồi **"BƯỚC NÀY ĐÃ OK, TIẾP TỤC"** thì bạn mới được viết code cho bước tiếp theo.

## 2. Quy trình khi một bước BỊ LỖI
Nếu tôi phản hồi rằng bước hiện tại **bị lỗi hoặc chưa đạt**, bạn phải:
1. **Chẩn đoán:** Hỏi tôi mô tả lỗi chi tiết (dòng báo lỗi đỏ, ảnh chụp màn hình nếu có).
2. **Sửa chữa:** Chỉ sửa đúng phần gây lỗi, KHÔNG đụng vào phần đang chạy tốt.
3. **Hướng dẫn test lại:** Nêu các bước kiểm tra cụ thể.
4. **Lặp lại** cho đến khi tôi xác nhận OK, rồi mới chuyển sang bước tiếp theo.

## 3. Quy tắc Git — Lưu phiên bản sau mỗi Milestone
Sau mỗi Milestone được xác nhận **"ĐÃ OK"**, bạn phải hướng dẫn tôi lưu phiên bản:
```bash
git add .
git commit -m "Milestone X: [Mô tả ngắn gọn những gì đã hoàn thành]"
```
Mục đích: Nếu bước sau bị lỗi nặng, tôi có thể quay lại phiên bản đang chạy tốt bằng lệnh `git checkout`.

## 4. Lộ trình 6 Giai đoạn chuẩn cho mọi dự án
Hãy chia bản thiết kế đã chốt thành 6 giai đoạn nhỏ theo đúng thứ tự sau. Mỗi giai đoạn có thể gồm **nhiều Milestone nhỏ** — hãy liệt kê rõ danh sách Milestone ở đầu mỗi giai đoạn.

### Giai đoạn 1: Khởi tạo khung xương & Giao diện tĩnh (Static UI + Mock Data)
- Thiết lập cấu trúc file cơ bản, bảng màu, phông chữ và bố cục (Layout).
- Hiển thị giao diện hoàn chỉnh với **dữ liệu mẫu cố định (hardcoded mock data)**.
- **Bố cục phải responsive cơ bản ngay từ đầu** (sử dụng Flexbox/CSS Grid), không để dồn việc responsive đến cuối dự án.
- Chưa viết logic phức tạp; mục tiêu là nhìn thấy hình hài ứng dụng trên màn hình.

### Giai đoạn 2: Trạng thái & Logic cốt lõi số 1 (Core State & Read/Create)
- Biến dữ liệu tĩnh thành dữ liệu động (State).
- Viết chức năng hiển thị danh sách từ State và chức năng **Thêm mới / Tạo mới (Create)** kèm kiểm tra dữ liệu đầu vào (Validation).

### Giai đoạn 3: Logic tương tác hoàn chỉnh (Update / Delete / Filter)
- Viết các tính năng chỉnh sửa, xóa, chuyển đổi trạng thái, tìm kiếm hoặc lọc dữ liệu.
- Xử lý các hiệu ứng phản hồi trên giao diện (thông báo thành công, cảnh báo trước khi xóa).

### Giai đoạn 4: Lưu trữ bền vững & Kết nối dữ liệu (Persistence / API / LocalStorage)
- Lưu dữ liệu vào `localStorage`, `IndexedDB` hoặc kết nối Backend/Database để khi tải lại trang (F5) không bị mất dữ liệu.
- Xử lý trạng thái đang tải (Loading state) và trạng thái lỗi (Error state).

### Giai đoạn 5: Kiểm thử, Trợ năng & Tối ưu (QA, Accessibility & Optimization)
- Chạy toàn bộ checklist kiểm thử trong file `05-Kiem-thu-va-test-cases.md`.
- Rà soát Accessibility cơ bản: keyboard navigation, contrast ratio, semantic HTML.
- Kiểm tra hoạt động trên Chrome và Firefox phiên bản mới nhất.
- Dọn dẹp code thừa, tối ưu hiệu suất nếu cần (lazy loading, debounce cho search...).

### Giai đoạn 6: Triển khai lên Internet (Deployment)
- Hướng dẫn tôi đưa sản phẩm lên hosting miễn phí (Vercel, Netlify, hoặc GitHub Pages).
- Kiểm tra lần cuối trên môi trường thực tế (production).
- Cập nhật file `PROGRESS.md` với trạng thái "ĐÃ DEPLOY" và đường dẫn URL.

## 5. Khuôn mẫu phản hồi cho mỗi Milestone
Ở mỗi Milestone, câu trả lời của bạn phải tuân theo cấu trúc:
1. **Mục tiêu Milestone này:** (1-2 câu ngắn gọn).
2. **Tiêu chí hoàn thành (Acceptance Criteria):** (3-5 điều kiện cụ thể để biết Milestone này "xong").
3. **Các file sẽ tạo mới hoặc chỉnh sửa:** (Liệt kê tên file).
4. **Code chi tiết:** (Tuân thủ tuyệt đối file Quy chuẩn viết code).
5. **Hướng dẫn chạy thử & Kiểm tra:** (Nêu rõ 2-3 thao tác tôi cần bấm thử trên màn hình để xác nhận bước này thành công).
6. **Lệnh Git commit gợi ý:** (Sau khi tôi xác nhận OK).