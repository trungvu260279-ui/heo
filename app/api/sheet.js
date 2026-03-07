// api/sheet.js — Proxy để lấy và gửi dữ liệu tới Google Sheets (tránh CORS)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') return res.status(200).end()

    const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL

    // GỬI DỮ LIỆU (POST)
    if (req.method === 'POST') {
        if (!SCRIPT_URL) return res.status(200).json({ success: true, message: 'Local mode: No upload' })

        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            })
            const result = await response.text()
            return res.status(200).json({ success: true, data: result })
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }

    // LẤY DỮ LIỆU (GET)
    if (req.method === 'GET') {
        // Demo data khi chưa có Google Sheets (để test local)
        if (!SCRIPT_URL) {
            return res.status(200).json([
                ['Email', 'Họ tên', 'Vai trò', 'Điểm', 'Bài làm', 'Ngày'],
                ['demo1@gmail.com', 'Nguyễn Quang Phi', 'student', 8.5, 'Viết bài 600 chữ', '05/03/2026'],
                ['demo2@gmail.com', 'Trần Thị Mỹ Linh', 'student', 7.8, 'Viết đoạn 200 chữ', '05/03/2026'],
                ['demo3@gmail.com', 'Lê Hoàng Nam', 'student', 6.2, 'Viết bài 600 chữ', '05/03/2026'],
                ['demo4@gmail.com', 'Phạm Bảo Châu', 'student', 5.5, 'Viết đoạn 200 chữ', '05/03/2026'],
            ])
        }

        try {
            const response = await fetch(SCRIPT_URL, { redirect: 'follow' })
            const text = await response.text()
            try {
                const data = JSON.parse(text)
                return res.status(200).json(data)
            } catch {
                return res.status(200).send(text)
            }
        } catch (err) {
            return res.status(500).json({ error: err.message })
        }
    }
}
