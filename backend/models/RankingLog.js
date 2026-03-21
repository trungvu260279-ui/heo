const mongoose = require('mongoose');

const rankingLogSchema = new mongoose.Schema({
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'student' },
    score: { type: Number, required: true },
    exercise: { type: String },
    date: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('RankingLog', rankingLogSchema);
