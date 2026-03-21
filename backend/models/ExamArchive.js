const mongoose = require('mongoose');

const examArchiveSchema = new mongoose.Schema({
    archiveId: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

module.exports = mongoose.model('ExamArchive', examArchiveSchema);
