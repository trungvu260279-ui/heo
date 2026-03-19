try {
    const app = require('../backend/server');
    module.exports = app;
} catch (err) {
    console.error("[Vercel Startup Error]", err);
    // Trả về lỗi trực tiếp để debug trên trình duyệt
    const express = require('express');
    const app = express();
    app.all('*', (req, res) => {
        res.status(500).json({ 
            error: "Backend Startup Failed", 
            message: err.message, 
            stack: err.stack 
        });
    });
    module.exports = app;
}
