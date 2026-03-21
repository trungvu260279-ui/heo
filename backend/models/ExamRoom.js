const mongoose = require('mongoose');

const examRoomSchema = new mongoose.Schema({
    roomCode: { type: String, required: true, unique: true },
    examId: { type: String, required: true },
    createdBy: { type: String, required: true },
    participants: [{
        name: String,
        score: Number,
        submittedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('ExamRoom', examRoomSchema);
