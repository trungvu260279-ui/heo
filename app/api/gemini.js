import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt } = req.body;

        // Lấy danh sách keys từ môi trường
        const keysText = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
        const keys = keysText.split(',').map(k => k.trim()).filter(Boolean);

        if (keys.length === 0) {
            return res.status(500).json({ error: 'Server configuration error: No Gemini API keys found' });
        }

        // Danh sách các model để thử (từ mới đến cũ/ổn định)
        // Vì Gemini API đôi khi báo 404 cho 1.5-flash ở một số region/key nhất định
        const modelsToTry = [
            'gemini-2.5-flash'
        ];

        let lastError = null;
        let attemptLogs = [];

        // Vòng lặp các Key
        for (let i = 0; i < keys.length; i++) {
            const currentKey = keys[i];

            // Với mỗi Key, thử các Model trong danh sách
            for (const modelName of modelsToTry) {
                try {
                    const genAI = new GoogleGenerativeAI(currentKey);
                    const model = genAI.getGenerativeModel({ model: modelName });

                    const result = await model.generateContent(prompt);
                    const text = await result.response.text();

                    console.log(`Success: Key ${i}, Model ${modelName}`);
                    return res.status(200).json({
                        text,
                        usedKeyIndex: i,
                        modelUsed: modelName
                    });
                } catch (err) {
                    const errMsg = err.message || 'Unknown error';
                    console.error(`Attempt failed: Key ${i}, Model ${modelName} -> ${errMsg}`);
                    attemptLogs.push(`Key ${i} + ${modelName}: ${errMsg}`);
                    lastError = errMsg;

                    // Nếu lỗi là 404 (model not found), ta thử model tiếp theo của cùng key này
                    // Nếu lỗi là 429 (quota) hoặc 401 (invalid key), ta cũng thử tiếp
                }
            }
        }

        // Nếu tất cả hẹo
        return res.status(502).json({
            error: 'Tất cả API Keys và Models đều thất bại. Có thể do hết hạn mức hoặc Key không hợp lệ.',
            details: lastError,
            logs: attemptLogs.slice(-5) // Trả về 5 logs cuối để debug
        });

    } catch (err) {
        console.error('Core error:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
    }
}
