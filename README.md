# 📚 THPT Kim Xuyên — Nền tảng Ngữ văn AI

> Ứng dụng web hỗ trợ giảng dạy và học tập Ngữ văn tại THPT Kim Xuyên, tích hợp trí tuệ nhân tạo, đánh giá năng lực và quản lý nội dung học liệu.

---

## 🛠 Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | React 18 + Vite 5 |
| Styling | TailwindCSS 3 |
| Routing | React Router DOM v6 |
| Animation | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React + Material Symbols |
| AI | Gemini API |

---

## ✅ Chức năng hiện tại

### 🏠 Trang chủ (`/home`)
- Giao diện chính của ứng dụng
- Điều hướng đến các tính năng khác
- Sidebar với thông tin giáo viên, nút nâng cấp Pro

### 📊 Đánh giá Năng lực (`/assessment`)
- **Biểu đồ Radar SVG** hiển thị 4 trục kỹ năng:
  - Năng lực Ngôn ngữ
  - Tư duy Phản biện
  - Năng lực Số
  - Viết Sáng tạo
- **Thống kê tổng hợp**: điểm trung bình, xếp loại, thứ hạng khối, số bài đã làm
- **AI Gợi ý Cải thiện**: phân tích điểm yếu và thế mạnh của học sinh
- **Lịch sử Đánh giá**: timeline các bài kiểm tra với điểm số và xu hướng thay đổi

### 🤖 Student AI Assistant (`/student-chat`)
- **Gia sư Ngữ văn chuyên sâu**: Tích hợp hệ thống Prompt học thuật (Scaffolding).
- **Đa phương tiện**: Phân tích trực tiếp từ ảnh chụp bài làm, tệp PDF, Word.
- **Công cụ bồi dưỡng**: Tích hợp thanh toolbar (Phân tích phong cách, Tìm dẫn chứng, Trích dẫn).
- **Streaming & Fallback**: Hỗ trợ streaming real-time với cơ chế fallback local-first cho môi trường DEV.

### 🤖 Trợ lý AI Cũ (`/assistant`)
- Chat AI hỗ trợ giải đáp câu hỏi Ngữ văn cơ bản.

### 🏆 Xếp hạng Học sinh (`/ranking`)
- **Podium Top 3** — bục vàng/bạc/đồng có spring animation, crown 👑
- **4 Stat Cards**: GPA cao nhất, Điểm TB toàn trường, Tỉ lệ đạt, Tổng học sinh
- **Biểu đồ cột** điểm TB từng môn theo lớp (Recharts, màu động theo mức điểm)
- **Bảng xếp hạng** đầy đủ với:
  - Huy hiệu hạng 🥇🥈🥉 + số cho các hạng tiếp theo
  - Avatar initials màu riêng từng học sinh
  - Mini score bars cho 4 môn chính
  - Badge xếp loại (Xuất sắc / Giỏi / Khá / Trung bình)
  - Xu hướng ↑↓ so với kỳ trước
- **Modal chi tiết học sinh**: bar chart 8 môn + 8 score cards khi click
- **Tìm kiếm** theo tên học sinh
- **Lọc** theo lớp (10A1, 10A2, 11B1, 11B2, 12C1)
- **Xuất CSV** danh sách học sinh hiện tại

#### Dữ liệu mẫu hiện tại
- 20 học sinh, 5 lớp, 8 môn học (Toán, Văn, Anh, Lý, Hóa, Sinh, Sử, Địa)

### 🎨 Hệ thống giao diện
- **Dark mode** toàn bộ ứng dụng (`bg-[#0d0d1a]`)
- **Glassmorphism** (`bg-white/5`, `backdrop-blur`, `border-white/10`)
- **Gradient tím–xanh** làm accent chính
- Sidebar cố định với nav items + user profile
- Responsive layout

---

## 📁 Cấu trúc thư mục

```
app/
├── src/
│   ├── components/
│   │   └── Layout.jsx          # Sidebar + nav chính
│   ├── data/
│   │   └── students.js         # Mock data 20 học sinh
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Assessment.jsx      # Đánh giá năng lực
│   │   ├── Assistant.jsx       # Trợ lý AI
│   │   └── Ranking.jsx         # Dashboard xếp hạng
│   ├── App.jsx                 # Router
│   ├── main.jsx
│   └── index.css
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## 🚀 Khởi động

```bash
cd app
npm install
npm run dev
# → http://localhost:5173
```

---

## 💡 Ý tưởng tương lai

### 🔌 Backend & Dữ liệu thực
- [ ] Kết nối với database thực (PostgreSQL / Supabase) thay cho mock data
- [ ] API quản lý học sinh: thêm, sửa, xóa, import từ Excel
- [ ] Authentication: đăng nhập giáo viên / học sinh / admin
- [ ] Phân quyền: giáo viên xem lớp mình, admin xem toàn trường

### 📈 Dashboard Xếp hạng (mở rộng)
- [ ] So sánh xếp hạng giữa các kỳ học (kỳ 1 vs kỳ 2)
- [ ] Biểu đồ đường xu hướng GPA theo thời gian từng học sinh
- [ ] Heatmap điểm số các môn theo lớp
- [ ] Lọc thêm: theo môn học, theo xếp loại, theo xu hướng
- [ ] In bảng xếp hạng (PDF)
- [ ] Thông báo/email tự động cho phụ huynh

### 📊 Đánh giá Năng lực (nâng cao)
- [ ] Biểu đồ radar động (thay SVG tĩnh bằng Recharts RadarChart)
- [ ] Lịch sử đánh giá thực từ database
- [ ] AI phân tích lộ trình học tập cá nhân hoá bằng Gemini API
- [ ] So sánh năng lực với trung bình khối / toàn trường

### 🤖 Student AI (Chiến lược phát triển)
- [ ] **Luyện đề → Phân tích sâu**: Kết nối trực tiếp phần Luyện đề (`Exams`) với Chat. Sau khi làm bài, học sinh có thể đẩy bài làm vào Chat để AI mổ xẻ, chấm chữa và gợi ý hướng phát triển.
- [ ] **Tối ưu hóa Context**: Cải thiện thuật toán "quét" file để lọc nhiễu, tiết kiệm Token và tăng độ chính xác khi phân tích văn bản dài.
- [ ] **Exclusion**: Tạm thời cô lập dữ liệu với phần Giáo viên để đảm bảo tính riêng tư và chuyên biệt của công cụ học tập.

### 📚 Thư viện & Đề thi
- [ ] Quản lý kho bài giảng / video / tài liệu
- [ ] Hệ thống đề thi online với timer
- [ ] Chấm bài trắc nghiệm tự động
- [ ] Ngân hàng câu hỏi theo chủ đề, mức độ

### 🔔 Tiện ích khác
- [ ] Thông báo real-time (kết quả mới, lịch thi)
- [ ] Lịch học / lịch thi tích hợp
- [ ] Mode sáng (light mode) cho giao diện
- [ ] PWA (Progressive Web App) — dùng được offline
- [ ] App mobile (React Native)

---

## 📝 Changelog

| Ngày | Thay đổi |
|---|---|
| 10/03/2026 | Triển khai **Student AI** (Scholar Mode): Hỗ trợ đa phương tiện, Streaming API, Toolbar học thuật |
| 10/03/2026 | Tối ưu hóa giao diện: Gỡ bỏ Language Selector, thêm Custom Scrollbar, fix UI Border |
| 05/03/2026 | Thêm trang Xếp hạng học sinh (`/ranking`) với podium, leaderboard, biểu đồ, modal |
| 01/03/2026 | Tính năng export CSV, bảo mật video YouTube |
| 01/03/2026 | Sửa lỗi export crash & YouTube embed error |
| 01/03/2026 | Thêm bảo mật video: anti-click, IFrame API controls |
| 01/03/2026 | Bulk move & cut/paste cho quản lý nội dung |

---

*Dự án phát triển nội bộ — THPT Kim Xuyên*
