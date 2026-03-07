# 📚 THPT KIM XUYÊN - TRỢ LÝ HỌC VĂN AI

Hệ thống đánh giá năng lực Ngữ văn thông minh dành cho học sinh THPT, tích hợp AI chấm điểm và lưu trữ đám mây.

---

## ✅ ĐÃ HOÀN THÀNH (Accomplishments)

### 1. Hệ thống Định danh (Auth)
*   [x] Phân loại người dùng: **Học sinh** và **Giáo viên**.
*   [x] Giao diện **Login Modal** phong cách Glassmorphism hiện đại.
*   [x] Lưu thông tin phiên đăng nhập tại `localStorage`.
*   [x] Tích hợp nút **Đổi tài khoản/Đăng xuất** ngay trên giao diện sidebar.

### 2. Trợ lý Luyện tập (AI Assistant)
*   [x] Tích hợp **Gemini API** để chấm điểm tự động.
*   [x] Chế độ luyện tập: **Đoạn văn 200 chữ** và **Bài văn 600 chữ**.
*   [x] Tiêu chí chấm điểm chi tiết: Ngôn ngữ, Tư duy, Cấu trúc, Diễn đạt.
*   [x] Biểu đồ **Radar Chart** trực quan hóa điểm số.

### 3. Lộ trình Học tập (Roadmap)
*   [x] Thuật toán đề xuất lộ trình dựa trên **Điểm hiện tại** và **Điểm mục tiêu**.
*   [x] Phân bổ khối lượng kiến thức cần học theo từng cấp độ.

### 4. Lưu trữ & Xếp hạng (Cloud & Ranking)
*   [x] **Cloud Backend:** Tích hợp với Google Sheets thông qua Google Apps Script.
*   [x] **Vercel Proxy Service:** Giải quyết triệt để lỗi CORS khi gửi/nhận dữ liệu.
*   [x] **Bảng xếp hạng (Leaderboard):** Tự động sắp xếp, phân loại "Giỏi/Khá/Trung bình".
*   [x] Chế độ **Mock Data** khi chạy ở local để thuận tiện phát triển.

---

## ⏳ CHƯA LÀM ĐƯỢC / PHÁT TRIỂN THÊM (To-Do)

*   [ ] **Phân vai giáo viên:** Tạo trang quản lý riêng cho giáo viên (xem tất cả bài làm của học sinh).
*   [ ] **Lịch sử chi tiết:** Lưu lại toàn bộ nội dung bài viết cũ của học sinh (hiện tại chỉ lưu điểm và nhận xét).
*   [ ] **Chia sẻ thành tích:** Nút chia sẻ kết quả chấm điểm hoặc bảng xếp hạng lên mạng xã hội.
*   [ ] **Mở rộng môn học:** Áp dụng hệ thống cho các môn khác (Toán, Anh, Lý...).

---

## 🐛 BÁO CÁO BUG / VẤN ĐỀ HIỆN TẠI (Known Issues)

| Vấn đề | Chi tiết | Trạng thái |
| :--- | :--- | :--- |
| **Trắng trang với `vercel dev`** | Do xung đột giữa Vite và SPA Rewrites của Vercel khi chạy local. | 🛠️ Đã có workaround: Dùng `dev.bat` (chuyển về `npm run dev`). |
| **Local Ranking** | Trang Xếp hạng ở máy local chỉ hiện dữ liệu demo (do không gọi được API nội bộ). | 💡 Chấp nhận được: Sẽ chạy thật khi Deploy. |
| **API Gemini Rate Limit** | Đôi khi Gemini trả về 404 hoặc 503 nếu gọi quá nhanh trong thời gian ngắn. | ⏳ Cần thêm cơ chế Retry. |
| **CORS Google Script** | Trình duyệt chặn gửi điểm trực tiếp từ web lên Sheet. | ✅ Đã fix bằng `api/sheet.js` (Proxy). |

---

## 🚀 HƯỚNG DẪN CƠ BẢN
*   **Chạy thử nghiệm (Local):** Double-click `dev.bat`.
*   **Đưa lên mạng (Deploy):** Double-click `deploy.bat`.
*   **Cấu hình biến môi trường:** Điền API Key và Link Sheet vào file `.env`.
