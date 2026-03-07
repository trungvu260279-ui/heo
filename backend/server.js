const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Đường dẫn lưu file json trên máy chủ Render.
// Nếu trên Render bạn có gắn Disk, bạn có thể trỏ DB_FILE tới '/data/rankings.json' 
// để dữ liệu không bị mất khi deploy lại web!
const DATA_DIR = process.env.DATA_DIR && process.env.DATA_DIR !== '/data' 
    ? process.env.DATA_DIR 
    : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'rankings.json');

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Khởi tạo thư mục và file database
try {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
} catch (error) {
    console.error("Failed to create data directory/file. Using __dirname fallback.", error);
    // Nếu lỗi tạo thư mục (ví dụ mount path /data bị cấm do không add disk), fallback về thư mục hiện tại
    const FALLBACK_DIR = path.join(__dirname, 'data');
    if (!fs.existsSync(FALLBACK_DIR)) fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    
    // Đổi lại hằng số DATA_DIR và DB_FILE theo fallback
    // (Bởi vì thư mục hiện tại chắc chắn có quyền ghi)
    process.env.DATA_DIR = FALLBACK_DIR;
    global.DB_FILE_PATH = path.join(FALLBACK_DIR, 'rankings.json');
    if (!fs.existsSync(global.DB_FILE_PATH)) fs.writeFileSync(global.DB_FILE_PATH, JSON.stringify([]));
}

// Hàm helper để luôn lấy đúng file DB
const getDbFilePath = () => global.DB_FILE_PATH || DB_FILE;

// ----------------------------------------------------
// 0. GET /
// Trả về câu chào mừng nếu có ai (vô tình) gõ base URL
// ----------------------------------------------------
app.get('/', (req, res) => {
    res.json({
        status: "Online",
        message: "VanPlatform Backend (Render) is running smoothly!",
        db_path: getDbFilePath(),
        docs: "/api/sheet"
    });
});

// ----------------------------------------------------
// 1. GET /api/sheet
// Khi User vào web -> Nạp Top Dashboard Ranking từ File JSON
// ----------------------------------------------------
app.get('/api/sheet', (req, res) => {
    try {
        const raw = fs.readFileSync(getDbFilePath(), 'utf-8');
        const data = JSON.parse(raw);
        
        // Front-end yêu cầu format dạng mảng 2 chiều theo Google Sheets cũ
        // index 0 là header: ['Email', 'Họ tên', 'Vai trò', 'Điểm', 'Bài làm', 'Ngày']
        const formattedData = [
            ['Email', 'Họ tên', 'Vai trò', 'Điểm', 'Bài làm', 'Ngày'],
            ...data.map(item => [
                item.email,
                item.name,
                item.role,
                item.score,
                item.exercise,
                item.date
            ])
        ];
        
        res.json(formattedData);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ----------------------------------------------------
// 2. POST /api/sheet
// Gửi điểm số mới vừa chấm xong xuống JSON -> Không cần Realtime Push Socket
// ----------------------------------------------------
app.post('/api/sheet', (req, res) => {
    try {
        const { email, name, role, score, exercise, date } = req.body;
        
        if (!email || !name) {
            return res.status(400).json({ error: "Missing identity" });
        }

        const raw = fs.readFileSync(getDbFilePath(), 'utf-8');
        const data = JSON.parse(raw);
        
        // Thêm bản ghi mới
        data.push({ 
            email, 
            name, 
            role: role || 'student', 
            score: parseFloat(score) || 0, 
            exercise: exercise || 'Luyện tập', 
            date: date || new Date().toLocaleDateString('vi-VN') 
        });
        
        // Lưu lại xuống Ổ cứng (Render disk)
        fs.writeFileSync(getDbFilePath(), JSON.stringify(data, null, 2));
        
        res.json({ success: true, message: "Score saved to Render Disk DB!" });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Rank/History Server running on port ${PORT}`);
    console.log(`Saving JSON DB to: ${getDbFilePath()}`);
});
