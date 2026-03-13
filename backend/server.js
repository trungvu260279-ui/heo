const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

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
    res.json({ status: "Online", mode: "Chat Only" });
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

app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
