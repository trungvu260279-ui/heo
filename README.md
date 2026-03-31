# VanPlatform — Nền tảng Ngữ văn AI (THPT Kim Xuyên)

> **Dành cho AI agent:** Đọc file này TRƯỚC khi đụng vào bất kỳ file nào khác. Mọi ngữ cảnh quan trọng đều ở đây.

---

## 🏗️ Kiến trúc tổng quan

```
Monorepo (npm workspaces)
├── app/          → Frontend: React + Vite + TailwindCSS  (chạy port 5173)
├── backend/      → Backend: Node.js + Express            (chạy port 10000)
├── api/          → Vercel serverless adapter             (proxy tới backend/)
├── vercel.json   → Config deploy: /api/* → backend, /* → app/dist
└── .env.local    → Biến môi trường dùng chung (KHÔNG commit)
```

**Deploy:** Vercel (frontend) + Render (backend cho production persistent connections)
- Frontend tự build → `app/dist/`
- Backend expose qua `api/index.js` (Vercel serverless) HOẶC chạy riêng trên Render
- MongoDB Atlas là DB chính; `backend/data/*.json` là fallback khi offline

---

## 📁 Cấu trúc chi tiết

### `/app` — Frontend (React 18 + Vite + TailwindCSS 3)

```
app/src/
├── main.jsx              → Entry point; bọc BrowserRouter + GoogleOAuthProvider
├── App.jsx               → Định nghĩa Routes (tất cả lazy-loaded)
├── index.css             → CSS global + Tailwind directives
│
├── components/           → Shared UI components
│   ├── Layout.jsx        → Shell chính: sidebar nav + header mobile + outlet
│   ├── LoginModal.jsx    → Modal đăng nhập/đăng ký (email+password & Google OAuth)
│   ├── ProgressChart.jsx → Line chart tiến trình học
│   ├── RadarChart.jsx    → Radar chart kỹ năng (Ngôn ngữ, Tư duy PB, Cấu trúc, Diễn đạt)
│   ├── TeacherDashboard.jsx  → Dashboard thống kê giáo viên (charts Recharts)
│   └── TeacherRoomHistory.jsx → Lịch sử & quản lý phòng thi của giáo viên
│
├── pages/                → Route-level components (lazy import trong App.jsx)
│   ├── Home.jsx          → Trang chủ/landing
│   ├── Assessment.jsx    → Đánh giá năng lực ngữ văn (AI chấm điểm)
│   ├── Assistant.jsx     → Trợ lý AI tổng quát (chat với Gemini)
│   ├── StudentAssistant.jsx → Gia sư Văn học cho học sinh (chat + suggestion chips)
│   ├── TeacherAssistant.jsx → Trợ lý Giáo viên: soạn giáo án, tạo đề, quản lý phòng thi, Google Search
│   ├── Exams.jsx         → Thư viện đề thi THPT (làm bài online, nộp điểm phòng thi)
│   ├── Ranking.jsx       → Bảng xếp hạng học sinh theo điểm TB
│   ├── Roadmap.jsx       → Lộ trình học tập
│   └── Profile.jsx       → Trang hồ sơ cá nhân
│
├── hooks/
│   ├── useAuth.js        → Auth store (localStorage key: 'van_auth_user')
│   │                        Exports: getAuthUser(), saveAuthUser(user), logout()
│   │                        User shape: { name, email, role, grade, studentId, school, isVerified }
│   │                        Events: 'van_auth_update', 'van_eval_update' (window events)
│   ├── useEvalStore.js   → Evaluation store (localStorage + localforage)
│   │                        Lưu kết quả đánh giá kỹ năng & lịch sử làm bài
│   │                        Key localStorage: 'van_eval_store_{email}'
│   │                        Key localforage: '{email}_exam_{timestamp}_{examId}'
│   └── useTeacherDashboard.js → Fetch dashboard data cho giáo viên
│
└── data/
    ├── exams.json        → ~470KB: toàn bộ đề thi THPT (nguồn tĩnh)
    ├── teacher_data_v2.json → ~117KB: dữ liệu mẫu giảng dạy
    └── students.js       → Dữ liệu học sinh mẫu (dùng local dev)
```

### `/backend` — Backend API (Node.js + Express + MongoDB)

```
backend/
├── server.js             → Main Express app (775 dòng); export module cho Vercel
├── models/
│   ├── User.js           → Schema: studentId, email, password, role, grade, school,
│   │                        phone, bio, averageScore, totalExams, completedExams[]
│   ├── ExamRoom.js       → Schema: roomCode, examId, createdBy, participants[]
│   ├── RankingLog.js     → Schema: email, name, role, score, exercise, date
│   └── ExamArchive.js    → Schema: archiveId, data (lưu đề thi đã xuất bản)
└── data/                 → JSON fallback (dùng khi develop local, không có MongoDB)
    ├── rankings.json
    ├── rooms.json
    └── archives/
```

### `/api` — Vercel Serverless Adapter

```
api/index.js              → Re-export backend/server.js dưới dạng serverless handler
```

---

## 🔌 API Endpoints (tất cả prefix `/api/`)

### Auth & User
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/user/sync` | Đăng ký / cập nhật user (email+password) |
| POST | `/api/user/google-auth` | Đăng nhập Google OAuth (verify token phía server) |
| POST | `/api/user/sync-score` | Cập nhật điểm TB sau khi nộp bài |

### Ranking
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/rankings?grade=12` | Lấy bảng xếp hạng (lọc theo lớp) |
| GET | `/api/sheet` | Lấy log điểm chi tiết |
| POST | `/api/sheet` | Lưu log điểm mới |

### Exam Room (Phòng thi real-time)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/room` | Tạo phòng thi mới |
| GET | `/api/room/:code` | Lấy thông tin phòng |
| DELETE | `/api/room/:code` | Xóa phòng |
| POST | `/api/room/:code/score` | Nộp điểm vào phòng |
| GET | `/api/room/:code/ranking` | Xếp hạng trong phòng |
| GET | `/api/teacher/dashboard/:email` | Dashboard thống kê giáo viên |

### AI & Export
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/gemini` | Gọi Gemini (non-streaming) |
| POST | `/api/gemini-stream` | Gọi Gemini (SSE streaming) — dùng chính |
| POST | `/api/export-docx` | Xuất HTML → file .docx |
| POST | `/api/archive-exam` | Lưu đề thi lên cloud |
| GET | `/api/archive-exam/:id` | Lấy đề thi đã lưu |

---

## 🔑 Biến môi trường

### Backend (`backend/.env` và `.env.local` gốc)
```
GEMINI_API_KEY=key1,key2,...    # Nhiều key, server tự retry key tiếp theo khi quota hết
GEMINI_API_KEYS=key1,key2,...   # Alias (cùng giá trị)
VITE_GEMINI_MODEL=gemini-2.5-flash  # Model mặc định
GOOGLE_CLIENT_ID=...            # Google OAuth client ID
MONGODB_URI=mongodb+srv://...   # MongoDB Atlas connection string
PORT=10000
```

### Frontend (`app/.env`)
```
VITE_BACKEND_URL=http://localhost:10000   # URL backend (local)
# Production: relative /api/... path (Vercel tự route)
```

---

## 🧩 Các pattern quan trọng

### 1. Gọi AI (Gemini)
**KHÔNG** gọi Gemini trực tiếp từ frontend. Tất cả AI calls đi qua backend:
```js
// Streaming (dùng SSE):
const res = await fetch('/api/gemini-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, history: [] })
})
// Đọc từng chunk: reader = res.body.getReader()

// Non-streaming:
const res = await fetch('/api/gemini', { method:'POST', body: JSON.stringify({ prompt }) })
```

### 2. Xác thực người dùng
- Auth state: `localStorage['van_auth_user']` (JSON object)
- Kiểm tra role: `user.role === 'teacher'` | `'student'`
- Sau login/logout: dispatch `window.dispatchEvent(new Event('van_auth_update'))`
- Teacher-only nav item: `TeacherAssistant` (ẩn với student)

### 3. Dual Storage (MongoDB + JSON fallback)
Backend tự detect môi trường:
```js
const isVercel = process.env.VERCEL === '1' || !!process.env.NOW_REGION;
// MongoDB Atlas: dùng khi online
// backend/data/*.json: fallback khi local dev không có MongoDB
```

### 4. Phòng thi (Exam Room)
- Giáo viên tạo phòng → nhận `roomCode` → share link `?room=CODE`
- Học sinh vào link → auto join phòng → làm bài `Exams.jsx` → nộp điểm `/api/room/:code/score`
- Giáo viên xem kết quả real-time qua `/api/room/:code/ranking`

### 5. Eval Store (điểm kỹ năng)
- 4 kỹ năng: `Ngôn ngữ`, `Tư duy PB`, `Cấu trúc`, `Diễn đạt` (thang 0-10)
- Tính trung bình lũy tiến qua nhiều lần làm bài
- Lưu vào `localStorage` (summary) + `localforage/IndexedDB` (chi tiết từng bài)

---

## 🚀 Chạy local

```bash
# Cài dependencies
npm install          # root workspace (cài cả app + backend)

# Chạy đồng thời (dùng start-all.bat)
# Terminal 1 - Frontend:
cd app && npm run dev       # → http://localhost:5173

# Terminal 2 - Backend:
cd backend && node server.js  # → http://localhost:10000
```

Hoặc dùng `start-all.bat` ở root.

---

## 📦 Deploy

```bash
# Deploy lên Vercel (tự động qua CI hoặc dùng script):
DEPLOY_TO_VERCEL.bat

# Build check:
npm run vercel-build    # = npm run build -w thpt-kim-xuyen
```

Vercel routing (`vercel.json`):
- `/api/*` → `api/index.js` (serverless backend)
- `/*` → `app/dist/index.html` (SPA fallback)

---

## ⚠️ Lưu ý cho AI Agent

1. **Không có file `.env` nào được commit** — nếu thiếu biến môi trường, check `.env.local` ở root
2. **Gemini API key là array** (nhiều key, phân tách bằng dấu phẩy) — backend tự failover
3. **`exams.json` (~470KB) KHÔNG được chỉnh tay** — file static lớn, chỉ update khi có yêu cầu rõ ràng
4. **Backend `server.js` dùng CommonJS (`require`)**, frontend dùng ESM (`import`)
5. **Mỗi khi thêm route mới vào App.jsx** thì phải lazy import và bọc `<Suspense>`
6. **`TeacherAssistant.jsx` là file lớn nhất (~57KB)** — tìm feature theo comment section trong file
7. **Google Search trong Teacher Assistant** dùng Gemini API với tool `googleSearch`, không phải fetch trực tiếp Google
8. **Dark mode** support: dùng Tailwind `dark:` prefix; toggle state lưu trong `localStorage['van_theme']`
