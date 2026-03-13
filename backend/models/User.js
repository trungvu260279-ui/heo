const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    studentId: { type: String, unique: true }, // Tự động tạo hoặc dùng _id
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Mật khẩu bảo mật
    name: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher'], default: 'student' },
    grade: { type: String, default: null },
    school: { type: String, default: 'THPT Kim Xuyên' },
    phone: { type: String, default: '' },
    bio: { type: String, default: '' },
    isVerified: { type: Boolean, default: false },
    averageScore: { type: Number, default: 0 }, // Điểm trung bình để xếp hạng
    totalExams: { type: Number, default: 0 },
    lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
