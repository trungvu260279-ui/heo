import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        const { prompt, history } = req.body;

        // Lấy keys tương tự gemini.js
        const keysText = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
        const keys = keysText.split(',').map(k => k.trim()).filter(Boolean);

        if (keys.length === 0) {
            res.write(`data: ${JSON.stringify({ error: 'Server configuration error: No Gemini API keys found' })}\n\n`);
            res.end();
            return;
        }

        const modelsToTry = [
            'gemini-2.5-flash'
        ];

        let success = false;
        let lastError = null;

        // Try keys
        for (let i = 0; i < keys.length && !success; i++) {
            const currentKey = keys[i];
            const genAI = new GoogleGenerativeAI(currentKey);

            // Try models
            for (const modelName of modelsToTry) {
                try {
                    const model = genAI.getGenerativeModel({ model: modelName });
                    
                    // Khởi tạo chat với history
                    // filter history để đảm bảo đúng định dạng
                    const chat = model.startChat({
                        history: history.map(h => ({
                            role: h.role,
                            parts: h.parts.map(p => {
                                if (p.text) return { text: p.text };
                                if (p.inlineData) return { inlineData: p.inlineData };
                                return p;
                            })
                        }))
                    });

                    // prompt có thể chứa inlineData (ảnh), nên ta truyền nguyên bản nếu nó là array
                    const result = await chat.sendMessageStream(prompt);

                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
                        }
                    }

                    res.write('data: [DONE]\n\n');
                    success = true;
                    break; 
                } catch (err) {
                    lastError = err.message;
                    console.error(`Attempt failed: Key ${i}, Model ${modelName} -> ${err.message}`);
                }
            }
        }

        if (!success) {
            res.write(`data: ${JSON.stringify({ error: 'Tất cả API Keys đều thất bại.', details: lastError })}\n\n`);
        }
        
        res.end();

    } catch (err) {
        console.error('Core error:', err);
        res.write(`data: ${JSON.stringify({ error: 'Internal server error', details: err.message })}\n\n`);
        res.end();
    }
}
