console.log("[Backend] Server script starting...");
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const User = require('./models/User');
const RankingLog = require('./models/RankingLog');
const ExamArchive = require('./models/ExamArchive');
const ExamRoom = require('./models/ExamRoom');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const app = express();
const PORT = process.env.PORT || 10000;

// Database fallback logic
const DATA_DIR = process.env.DATA_DIR && process.env.DATA_DIR !== '/data' 
    ? process.env.DATA_DIR 
    : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'rankings.json');
const ARCHIVE_DIR = path.join(DATA_DIR, 'archives');

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Resolve Cross-Origin-Opener-Policy warning
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

// Initialize data directory (Skip on Vercel or read-only environments)
const isVercel = process.env.VERCEL === '1' || !!process.env.NOW_REGION;
if (!isVercel) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
        if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
        console.log("[Backend] Local data storage initialized at:", DATA_DIR);
    } catch (e) {
        console.warn("[Backend] Could not initialize local filesystem:", e.message);
    }
} else {
    console.log("[Backend] Running on Vercel, skipping local filesystem initialization.");
}

const getDbFilePath = () => DB_FILE;

app.get(['/', '/api'], (req, res) => {
    res.json({ 
        status: "Online", 
        db: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
        mode: "Full API (Vercel Ready)" 
    });
});

// MongoDB Connection logic for Serverless
const MONGODB_URI = process.env.MONGODB_URI;
let cachedConnection = null;

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    if (!MONGODB_URI) {
        console.warn("MONGODB_URI not found");
        return;
    }
    if (!cachedConnection) {
        console.log("[Backend] Connecting to MongoDB Atlas...");
        cachedConnection = mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
        }).then(m => {
            console.log("Connected to MongoDB!");
            return m;
        }).catch(err => {
            cachedConnection = null;
            console.error("MongoDB Connection Error:", err.message);
            throw err;
        });
    }
    return cachedConnection;
};

// Initial trigger (Keep-alive locally)
if (!process.env.VERCEL) connectDB();

// --- USER MANAGEMENT API ---
app.post('/api/user/sync', async (req, res) => {
    try {
        await connectDB();
        const { email, name, role, grade, school, password, phone, bio } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        // Tìm user theo email
        let user = await User.findOne({ email });

        if (user) {
            // Nếu là tài khoản Google Auth, KHÔNG cho phép đồng bộ qua form mật khẩu thông thường
            // để tránh việc ai đó biết email rồi vào "nhận vơ" hoặc ghi đè thông tin.
            if (user.password === 'GOOGLE_AUTH_USER') {
                return res.status(403).json({ 
                    error: "Email này đã được đăng ký bằng Google. Vui lòng sử dụng 'Đăng nhập Google'!" 
                });
            }

            // Nếu là user bình thường, bắt buộc check password để cập nhật
            if (!password) return res.status(400).json({ error: "Mật khẩu là bắt buộc để cập nhật tài khoản này!" });
            
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: "Mật khẩu không chính xác!" });
            }
            
            // Cập nhật thông tin khác
            user.name = name || user.name;
            user.grade = grade || user.grade;
            user.school = school || user.school;
            user.phone = phone !== undefined ? phone : user.phone;
            user.bio = bio !== undefined ? bio : user.bio;
            user.lastLogin = new Date();
            await user.save();
        } else {
            // Tạo user mới (cần password)
            if (!password) return res.status(400).json({ error: "Password is required for new accounts" });
            
            const hashedPassword = await bcrypt.hash(password, 10);
            user = new User({
                email,
                password: hashedPassword,
                name,
                role,
                grade,
                school,
                phone: phone || '',
                bio: bio || '',
                averageScore: 0,
                totalExams: 0,
                isVerified: true
            });
            await user.save();
            
            user.studentId = 'VANS-' + user._id.toString().slice(-6).toUpperCase();
            await user.save();
        }

        res.json({ success: true, user });
    } catch (e) {
        console.error("User Sync Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/user/google-auth', async (req, res) => {
    try {
        await connectDB();
        const { token } = req.body;
        console.log("[Backend] Google Auth attempt received");
        if (!token) return res.status(400).json({ error: "Token is required" });

        console.log("[Backend] Verifying Google token...");
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;
        console.log(`[Backend] Google token verified for: ${email}`);

        let user = await User.findOne({ email });
        let needsSetup = false;

        if (user) {
            console.log(`[Backend] Existing user found: ${user.studentId}`);
            if (!user.name || !user.grade) {
                needsSetup = true;
                console.log("[Backend] User needs setup info (name/grade missing)");
            }
            user.lastLogin = new Date();
            await user.save();
        } else {
            console.log("[Backend] Creating new user from Google Auth");
            user = new User({
                email,
                name: name,
                password: 'GOOGLE_AUTH_USER',
                role: 'student',
                isVerified: true,
                averageScore: 0,
                totalExams: 0
            });
            await user.save();
            user.studentId = 'VANS-' + user._id.toString().slice(-6).toUpperCase();
            await user.save();
            needsSetup = true;
            console.log(`[Backend] New user created: ${user.studentId}`);
        }

        res.json({ success: true, user, needsSetup });
    } catch (e) {
        console.error("[Backend] Google Auth Fatal Error:", e);
        // Trả về lỗi chi tiết hơn ngay cả trong production để chúng ta gỡ rối
        res.status(500).json({ 
            success: false,
            error: "Internal Server Error during Google Auth", 
            message: e.message,
            phase: "verification_or_db",
            stack: e.stack // Sẽ giúp xác định chính xác dòng lỗi
        });
    }
});

// Update score API
app.post('/api/user/sync-score', async (req, res) => {
    try {
        await connectDB();
        const { studentId, score, examId } = req.body;
        if (!studentId) return res.status(400).json({ error: "StudentId is required" });

        const user = await User.findOne({ studentId });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Tính toán điểm trung bình mới
        const totalScore = (user.averageScore * user.totalExams) + score;
        user.totalExams += 1;
        user.averageScore = totalScore / user.totalExams;
        
        // Lưu ID đề thi đã hoàn thành để khóa thi lại sau này
        if (examId && !user.completedExams.includes(examId)) {
            user.completedExams.push(examId);
        }
        
        await user.save();
        res.json({ 
            success: true, 
            averageScore: user.averageScore, 
            totalExams: user.totalExams,
            completedExams: user.completedExams 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/rankings', async (req, res) => {
    try {
        await connectDB();
        const { grade } = req.query;
        let query = { role: 'student' };
        if (grade) query.grade = grade;

        const rankings = await User.find(query)
            .sort({ averageScore: -1, totalExams: -1 })
            .limit(50)
            .select('name grade averageScore totalExams school');

        res.json(rankings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/sheet', async (req, res) => {
    try {
        await connectDB();
        const logs = await RankingLog.find({}).sort({ createdAt: -1 }).limit(1000);
        
        // Merge with local data IF not on Vercel (for development consistency)
        if (!isVercel) {
            try {
                const raw = fs.readFileSync(getDbFilePath(), 'utf-8');
                const localData = JSON.parse(raw);
                // Simple merge for local dev
                return res.json([...localData, ...logs].slice(-1000));
            } catch (e) { console.warn("Local sync failed", e.message); }
        }

        res.json(logs);
    } catch(e) {
        console.error("Sheet Fetch Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sheet', async (req, res) => {
    try {
        await connectDB();
        const { email, name, role, score, exercise, date } = req.body;
        
        // MongoDB Save (Vercel Ready)
        const newLog = new RankingLog({ email, name, role, score, exercise, date });
        await newLog.save();

        // Local Sync (Fallback for local dev if needed)
        if (!isVercel) {
            try {
                const raw = fs.readFileSync(getDbFilePath(), 'utf-8');
                const data = JSON.parse(raw);
                data.push({ email, name, role, score, exercise, date });
                fs.writeFileSync(getDbFilePath(), JSON.stringify(data, null, 2));
            } catch (e) { console.warn("Local sync failed", e.message); }
        }

        res.json({ success: true });
    } catch(e) {
        console.error("Sheet Sync Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Archive Exam Data (MongoDB Ready)
app.post('/api/archive-exam', async (req, res) => {
    try {
        await connectDB();
        const data = req.body;
        const id = 'VANS-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        // MongoDB Save
        const archive = new ExamArchive({ archiveId: id, data });
        await archive.save();

        // Local Fallback
        if (!isVercel) {
            try {
                if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
                fs.writeFileSync(path.join(ARCHIVE_DIR, `${id}.json`), JSON.stringify(data, null, 2));
            } catch (e) { }
        }

        res.json({ id });
    } catch(e) {
        console.error("Archive Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/archive-exam/:id', async (req, res) => {
    try {
        await connectDB();
        const { id } = req.params;
        
        // Try MongoDB first
        const archive = await ExamArchive.findOne({ archiveId: id });
        if (archive) return res.json(archive.data);

        // Fallback to local
        if (!isVercel) {
            const filePath = path.join(ARCHIVE_DIR, `${id}.json`);
            if (fs.existsSync(filePath)) {
                return res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
            }
        }

        res.status(404).json({ error: "Not found" });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

const HTMLtoDOCX = require('html-to-docx');

// --- EXAM ROOM API ---
app.post('/api/room', async (req, res) => {
    try {
        await connectDB();
        const { roomCode, examId, createdBy } = req.body;
        const newRoom = new ExamRoom({ roomCode, examId, createdBy });
        await newRoom.save();
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/room/:code', async (req, res) => {
    try {
        await connectDB();
        const room = await ExamRoom.findOne({ roomCode: req.params.code });
        if (!room) return res.status(404).json({ error: "Room not found" });
        res.json(room);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/room/:code/ranking', async (req, res) => {
    try {
        await connectDB();
        const room = await ExamRoom.findOne({ roomCode: req.params.code });
        if (!room) return res.status(404).json({ error: "Room not found" });
        // Sắp xếp các thí sinh theo điểm cao nhất
        const ranking = [...room.participants].sort((a, b) => (b.score || 0) - (a.score || 0));
        res.json(ranking);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Nộp bài vào phòng thi
app.post('/api/room/:code/score', async (req, res) => {
    try {
        await connectDB();
        const { name, score } = req.body;
        const room = await ExamRoom.findOne({ roomCode: req.params.code });
        if (!room) return res.status(404).json({ error: "Room not found" });

        // Tìm xem học sinh đã nộp chưa
        const idx = room.participants.findIndex(p => p.name === name);
        if (idx !== -1) {
            // Chỉ cập nhật nếu điểm cao hơn (tùy nhu cầu, ở đây cập nhật mọi bài nộp gần nhất)
            room.participants[idx].score = score;
            room.participants[idx].submittedAt = new Date();
        } else {
            room.participants.push({ name, score, submittedAt: new Date() });
        }

        await room.save();
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/gemini-stream', async (req, res) => {
    const { prompt, history = [] } = req.body;
    
    // Set headers for SSE-like response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const keysText = process.env.VITE_GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
        const keys = keysText.split(',').map(k => k.trim()).filter(Boolean);
        
        if (keys.length === 0) throw new Error("Missing Gemini API Key");

        console.log(`[Backend] Streaming request started. Keys available: ${keys.length}`);
        let success = false;
        let lastError = null;

        for (let i = 0; i < keys.length; i++) {
            try {
                const genAI = new GoogleGenerativeAI(keys[i]);
                const model = genAI.getGenerativeModel({ model: process.env.VITE_GEMINI_MODEL || "gemini-2.5-flash" });
                const chat = model.startChat({ history });
                const result = await chat.sendMessageStream(prompt);

                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
                }
                res.write('data: [DONE]\n\n');
                res.end();
                success = true;
                break;
            } catch (err) {
                console.error(`Backend Stream Attempt ${i} failed:`, err.message);
                lastError = err;
            }
        }

        if (!success) {
            throw lastError || new Error("All API keys failed");
        }
    } catch (error) {
        console.error("Gemini Stream Final Error:", error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

app.post('/api/gemini', async (req, res) => {
    const { prompt } = req.body;
    try {
        const keysText = process.env.VITE_GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
        const keys = keysText.split(',').map(k => k.trim()).filter(Boolean);
        
        if (keys.length === 0) throw new Error("Missing Gemini API Key");

        let success = false;
        let lastError = null;

        for (let i = 0; i < keys.length; i++) {
            try {
                const genAI = new GoogleGenerativeAI(keys[i]);
                const model = genAI.getGenerativeModel({ model: process.env.VITE_GEMINI_MODEL || "gemini-2.5-flash" });
                const result = await model.generateContent(prompt);
                const text = result.response.text();
                res.json({ text });
                success = true;
                break;
            } catch (err) {
                console.error(`Backend API Attempt ${i} failed:`, err.message);
                lastError = err;
            }
        }

        if (!success) {
            throw lastError || new Error("All API keys failed");
        }
    } catch (error) {
        console.error("Gemini API Final Error:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/export-docx', async (req, res) => {
    try {
        const { html, filename = 'Giao-An.docx' } = req.body;
        
        // Wrap with basic HTML structure if needed
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
        
        const fileBuffer = await HTMLtoDOCX(fullHtml, null, {
            table: { row: { cantSplit: true } },
            footer: true,
            pageNumber: true,
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
        res.send(fileBuffer);
    } catch (e) {
        console.error("Export Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Export for Vercel
module.exports = app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Backend Server running on port ${PORT}`);
    });
}
