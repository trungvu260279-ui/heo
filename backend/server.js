const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();

const User = require('./models/User');

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
app.use(express.json());

// Initialize data directory
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));

const getDbFilePath = () => DB_FILE;

app.get('/', (req, res) => {
    res.json({ 
        status: "Online", 
        db: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
        mode: "Full API" 
    });
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log("Successfully connected to MongoDB Atlas"))
        .catch(err => console.error("MongoDB connection error:", err));
} else {
    console.warn("MONGODB_URI not found in environment variables. Database features will be disabled.");
}

// --- USER MANAGEMENT API ---
app.post('/api/user/sync', async (req, res) => {
    try {
        const { email, name, role, grade, school, password, phone, bio } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        // Tìm user theo email
        let user = await User.findOne({ email });

        if (user) {
            // Nếu là user bình thường (không phải Google Auth) thì mới bắt check password
            if (user.password !== 'GOOGLE_AUTH_USER') {
                // Nếu có gửi password mới thì check, nếu không gửi (trường hợp update profile) thì bỏ qua nếu tin tưởng session
                // Tuy nhiên hiện tại chúng ta chưa có JWT nên tạm thời vẫn bắt check nếu user.password tồn tại
                if (!password) return res.status(400).json({ error: "Mật khẩu là bắt buộc để cập nhật tài khoản này!" });
                
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.status(401).json({ error: "Mật khẩu không chính xác!" });
                }
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
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: "Token is required" });

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        let user = await User.findOne({ email });
        let needsSetup = false;

        if (user) {
            // Nếu user đã có nhưng thiếu thông tin (tên/grade) thì vẫn báo needsSetup
            if (!user.name || !user.grade) {
                needsSetup = true;
            }
            user.lastLogin = new Date();
            await user.save();
        } else {
            // Tạo user mới từ Google (chưa có tên/grade chính thức)
            user = new User({
                email,
                name: name, // Dùng tên từ google làm tạm thời
                password: 'GOOGLE_AUTH_USER', // Đánh dấu không dùng mật khẩu
                role: 'student',
                isVerified: true,
                averageScore: 0,
                totalExams: 0
            });
            await user.save();
            user.studentId = 'VANS-' + user._id.toString().slice(-6).toUpperCase();
            await user.save();
            needsSetup = true;
        }

        res.json({ success: true, user, needsSetup });
    } catch (e) {
        console.error("Google Auth Error:", e);
        res.status(401).json({ error: "Invalid Google Token" });
    }
});

// Update score API
app.post('/api/user/sync-score', async (req, res) => {
    try {
        const { studentId, score } = req.body;
        if (!studentId) return res.status(400).json({ error: "StudentId is required" });

        const user = await User.findOne({ studentId });
        if (!user) return res.status(404).json({ error: "User not found" });

        // Tính toán điểm trung bình mới
        const totalScore = (user.averageScore * user.totalExams) + score;
        user.totalExams += 1;
        user.averageScore = totalScore / user.totalExams;
        
        await user.save();
        res.json({ success: true, averageScore: user.averageScore, totalExams: user.totalExams });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/api/rankings', async (req, res) => {
    try {
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

app.get('/api/sheet', (req, res) => {
    try {
        const raw = fs.readFileSync(getDbFilePath(), 'utf-8');
        res.json(JSON.parse(raw));
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sheet', (req, res) => {
    try {
        const { email, name, role, score, exercise, date } = req.body;
        const raw = fs.readFileSync(getDbFilePath(), 'utf-8');
        const data = JSON.parse(raw);
        data.push({ email, name, role, score, exercise, date });
        fs.writeFileSync(getDbFilePath(), JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Archive Exam Data
app.post('/api/archive-exam', (req, res) => {
    try {
        if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
        const data = req.body;
        console.log("[Backend] Archiving exam data, size:", JSON.stringify(data).length);
        const id = 'VANS-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const filePath = path.join(ARCHIVE_DIR, `${id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log("[Backend] Exam archived successfully with ID:", id);
        res.json({ id });
    } catch(e) {
        console.error("[Backend] Archive Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/archive-exam/:id', (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(ARCHIVE_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
        const raw = fs.readFileSync(filePath, 'utf-8');
        res.json(JSON.parse(raw));
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

const HTMLtoDOCX = require('html-to-docx');

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
