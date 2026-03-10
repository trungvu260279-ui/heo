const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Database fallback logic
const DATA_DIR = process.env.DATA_DIR && process.env.DATA_DIR !== '/data' 
    ? process.env.DATA_DIR 
    : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'rankings.json');

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Initialize data directory
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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

const HTMLtoDOCX = require('html-to-docx');

const { GoogleGenerativeAI } = require("@google/generative-ai");

app.post('/api/gemini-stream', async (req, res) => {
    const { prompt, history = [] } = req.body;
    
    // Set headers for SSE-like response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing Gemini API Key");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: process.env.VITE_GEMINI_MODEL || "gemini-1.5-flash" });

        const chat = model.startChat({ history });
        
        // If prompt is an array (multimodal), it will work too
        const result = await chat.sendMessageStream(prompt);

        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            // Send chunk as SSE data
            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error("Gemini Stream Error:", error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
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
