import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import examsData from '../data/exams.json'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { motion, AnimatePresence } from 'framer-motion'
import RadarChart from '../components/RadarChart'
import { addEvaluation, saveExamHistoryDetail } from '../hooks/useEvalStore'

const LOCAL_API_KEYS_TEXT = import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || ''
const LOCAL_API_KEYS = LOCAL_API_KEYS_TEXT.split(',').map(k => k.trim()).filter(Boolean)
const LOCAL_MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

// ─── Fix Vietnamese diacritics & OCR Spacing Bugs ─────────────────────────────
function normalizeVN(text) {
    if (!text) return ''
    return text
        // 1. Chuyển về NFD để tách hết chữ và dấu kết hợp ra cho dễ xử lý
        .normalize('NFD')

        // 2. Chuyển các dấu rời rạc thành dấu chuẩn (combining marks)
        .replace(/\u00B4|\u02B9/g, '\u0301') // Sắc
        .replace(/\u0060/g, '\u0300')       // Huyền
        .replace(/\u02BC/g, '\u0309')       // Hỏi
        .replace(/\u007E/g, '\u0303')       // Ngã

        // 3. Xóa khoảng trắng bị kẹt TRƯỚC dấu (VD: "o ´" -> "ó")
        .replace(/[ \t]+([\u0300-\u036f])/g, '$1')

        // 4. Khâu quan trọng nhất: Xóa khoảng trắng SAU dấu nếu bị rớt phụ âm/nguyên âm cuối
        // Fix dứt điểm lỗi: "bố c" -> bốc, "chiế n" -> chiến, "câ u" -> cầu, "Đâ t" -> Đất
        .replace(/([\u0300-\u036f])[ \t\u00A0]+(c|p|t|m|n|ng|nh|ch|u|i|y|o)(?=[\s.,;?!“"’'()\[\]\n]|$)/gi, '$1$2')

        // 5. Gom các khoảng trắng thừa dính liền nhau (giữ nguyên \n)
        .replace(/[ \t]{2,}/g, ' ')

        // 6. Đóng gói lại thành chuẩn NFC để render hiển thị mượt mà
        .normalize('NFC')
}

// ─── Gemini API call ──────────────────────────────────────────────────────────
async function callGeminiAPI(instruction) {
    // 1. Nếu đang ở môi trường dev có key trong .env -> gọi thẳng
    if (import.meta.env.DEV && LOCAL_API_KEYS.length > 0) {
        for (let i = 0; i < LOCAL_API_KEYS.length; i++) {
            try {
                const genAI = new GoogleGenerativeAI(LOCAL_API_KEYS[i])
                const model = genAI.getGenerativeModel({ model: LOCAL_MODEL_NAME })
                const result = await model.generateContent(instruction)
                return await result.response.text()
            } catch (err) {
                console.warn(`Local Gemini Key ${i} failed, trying next...`, err)
            }
        }
    }
    const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: instruction }),
    })
    if (!res.ok) throw new Error('API request failed')
    const data = await res.json()
    return data.text
}

// ─── Mini Markdown renderer ───────────────────────────────────────────────────
function formatMarkdown(text) {
    if (!text) return ''
    return text
        .replace(/^###\s+(.*$)/gim, '<h3 class="font-bold mt-3 mb-1 text-amber-700 dark:text-amber-400">$1</h3>')
        .replace(/^##\s+(.*$)/gim, '<h2 class="font-black mt-4 mb-2 text-amber-800 dark:text-amber-300 text-base">$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
        .replace(/^\-\s+(.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
        .replace(/^\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
        .replace(/\n\n/g, '<br/><br/>')
}

// ─── ExamCard ─────────────────────────────────────────────────────────────────
function ExamCard({ exam, active, onClick }) {
    return (
        <motion.button
            layout
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={onClick}
            className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 group
                ${active
                    ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 text-slate-700 dark:text-slate-300'
                }`}
        >
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                    ${active
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900 transition-colors'
                    }`}>
                    <span className="material-symbols-outlined text-[18px]">description</span>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold leading-snug line-clamp-2">{exam.title}</h3>
                    <p className={`text-[10px] mt-1 font-medium uppercase tracking-wider
                        ${active ? 'text-white/60' : 'text-slate-400'}`}>
                        Ngữ Văn · AI Enabled
                    </p>
                </div>
            </div>
        </motion.button>
    )
}

// ─── QuestionBlock ────────────────────────────────────────────────────────────
function QuestionBlock({ label, text, id, onHint, loadingHint, hint, answer, setAnswer, rows = 4 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
        >
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</h4>
                <button
                    onClick={onHint}
                    disabled={loadingHint}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shrink-0
                        bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400
                        border border-amber-200 dark:border-amber-800
                        hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-[14px]">
                        {loadingHint ? 'autorenew' : 'lightbulb'}
                    </span>
                    {loadingHint ? 'Đang nghĩ…' : 'Gợi ý cách làm'}
                </button>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                {normalizeVN(text)}
            </p>

            <AnimatePresence>
                {hint && (
                    <motion.div
                        key="hint-box"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="material-symbols-outlined text-amber-500 text-[16px]">tips_and_updates</span>
                                <span className="text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Gợi ý</span>
                            </div>
                            <div
                                className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed space-y-1"
                                dangerouslySetInnerHTML={{ __html: formatMarkdown(hint) }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <textarea
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800
                    bg-white dark:bg-slate-900 p-4 text-sm text-slate-800 dark:text-slate-200
                    focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none
                    transition-all placeholder-slate-300 dark:placeholder-slate-600 resize-y"
                placeholder="Nhập bài làm của bạn…"
                rows={rows}
                value={answer || ''}
                onChange={e => setAnswer(e.target.value)}
            />
        </motion.div>
    )
}

// ─── Result Dashboard ────────────────────────────────────────────────────────
function ResultDashboard({ result, onBack, examTitle, answers, examData }) {
    const navigate = useNavigate();
    const { skills, overall, suggestions, commonErrors, comment } = result;
    const label = overall >= 8 ? 'Giỏi' : overall >= 7 ? 'Khá' : overall >= 5 ? 'Trung bình' : 'Cần cố gắng';
    const labelColor = overall >= 8 ? 'text-amber-500' : overall >= 7 ? 'text-blue-500' : overall >= 5 ? 'text-emerald-500' : 'text-red-500';
    const bgColor = overall >= 8 ? 'bg-amber-50' : overall >= 7 ? 'bg-blue-50' : overall >= 5 ? 'bg-emerald-50' : 'bg-red-50';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8 pb-10"
        >
            {/* Header Score */}
            <div className={`p-8 rounded-3xl ${bgColor} dark:bg-slate-800/50 border border-current/10 flex flex-col items-center text-center relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-current opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Tổng điểm bài thi</p>
                <h2 className={`text-6xl font-black ${labelColor} tabular-nums mb-2`}>{overall.toFixed(1)}</h2>
                <div className={`px-4 py-1 rounded-full ${labelColor} bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest shadow-sm border border-current/20`}>
                    Xếp loại: {label}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Radar & Skills */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2 self-start">
                            <span className="material-symbols-outlined text-indigo-500">analytics</span>
                            Biểu đồ Năng lực
                        </h3>
                        <RadarChart skills={skills} size={240} color="#6366f1" />
                        
                        <div className="w-full space-y-3 mt-8">
                            {skills.map(sk => (
                                <div key={sk.label} className="space-y-1.5">
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="text-slate-500">{sk.label}</span>
                                        <span className="text-indigo-600 dark:text-indigo-400">{sk.value.toFixed(1)}</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${sk.value * 10}%` }}
                                            className="h-full bg-indigo-500 rounded-full"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Feedback & Errors */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500">verified</span>
                            Nhận xét từ AI Chuyên gia
                        </h3>
                        
                        <div className="space-y-4">
                            {suggestions.map((s, i) => (
                                <div key={i} className={`p-4 rounded-2xl border ${s.type === 'check' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900' : 'bg-amber-50/50 border-amber-100 text-amber-900'} dark:bg-slate-900/50 dark:border-slate-800`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="material-symbols-outlined text-[18px]">
                                            {s.type === 'check' ? 'check_circle' : 'tips_and_updates'}
                                        </span>
                                        <span className="text-[11px] font-black uppercase tracking-wider">{s.title}</span>
                                    </div>
                                    <p className="text-xs opacity-80 leading-relaxed dark:text-slate-300">{s.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-red-500">fmd_bad</span>
                            Lỗi thường mắc & Cần tránh
                        </h3>
                        <ul className="space-y-2.5">
                            {commonErrors.map((err, i) => (
                                <li key={i} className="flex gap-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                    <span className="text-red-400 font-bold shrink-0">•</span>
                                    {err}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
                <button
                    onClick={onBack}
                    className="w-full sm:w-auto px-8 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Quay lại Thư viện
                </button>
                <button
                    onClick={() => {
                        navigate('/student-chat', { 
                            state: { 
                                type: 'EXAM_ANALYSIS',
                                data: {
                                    title: examTitle,
                                    result: result,
                                    answers: answers,
                                    examData: examData
                                }
                            } 
                        });
                    }}
                    className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40"
                >
                    <span className="material-symbols-outlined text-[18px]">psychology</span>
                    Phân tích chuyên sâu với AI Chat
                </button>
            </div>
        </motion.div>
    )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center select-none"
        >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-indigo-950 dark:to-slate-800 flex items-center justify-center mb-5 shadow-inner">
                <span className="material-symbols-outlined text-4xl text-indigo-400">inventory_2</span>
            </div>
            <h2 className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-1">Chọn đề thi để bắt đầu</h2>
            <p className="text-sm max-w-xs text-slate-400">Phân tích chuyên sâu hoặc luyện tập trực tiếp với gợi ý từ AI.</p>
        </motion.div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Exams() {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedExam, setSelectedExam] = useState(null)
    const [isTakingExam, setIsTakingExam] = useState(false)
    const [answers, setAnswers] = useState({})
    const [hints, setHints] = useState({})
    const [materialAnalysis, setMaterialAnalysis] = useState(null)
    const [gradingResult, setGradingResult] = useState(null)
    const [loadingHintFor, setLoadingHintFor] = useState(null)
    const [loadingAnalysis, setLoadingAnalysis] = useState(false)
    const [isGrading, setIsGrading] = useState(false)
    const [submitDone, setSubmitDone] = useState(false)
    const mainRef = useRef(null)

    const filteredExams = useMemo(() =>
        examsData.filter(ex =>
            ex.title.toLowerCase().includes(searchTerm.toLowerCase())
        ), [searchTerm])

    async function getHint(qId, qLabel, qText, sectionName, exam) {
        setLoadingHintFor(qId)
        
        const cleanNgulieu = normalizeVN(exam.sections.doc_hieu)
        let contextPrompt = `Bạn là chuyên gia luyện thi Ngữ Văn THPT. 
Đang hỗ trợ học sinh làm bài trong đề thi: "${exam.title}".
Dưới đây là phần Ngữ liệu (đoạn trích) của đề bài để bạn tham chiếu:
---
${cleanNgulieu}
---
Câu hỏi học sinh cần hỗ trợ thuộc phần [${sectionName}]: "${qLabel}: ${qText}"
`

        if (sectionName === 'Nghị luận xã hội') {
            contextPrompt += `\nLưu ý: Đây là câu hỏi NLXH 200 chữ. Gợi ý cần bám sát vấn đề xã hội được gợi ra từ ngữ liệu, tránh nói đạo lý chung chung không liên quan đến ngữ cảnh của đề.`
        } else if (sectionName === 'Nghị luận văn học') {
            contextPrompt += `\nLưu ý: Đây là câu hỏi NLVH 600 chữ. Hãy gợi ý cách phân tích các chi tiết, hình ảnh trong ngữ liệu trên để làm nổi bật chủ đề và nghệ thuật của tác phẩm.`
        }

        const instruction = `${contextPrompt}
Hãy đưa ra gợi ý hỗ trợ học sinh theo các mục:
1. **Phân tích yêu cầu**: Giải thích ngắn gọn câu hỏi này yêu cầu điều gì (Tìm thông tin, phân tích tác dụng, hay bình luận...).
2. **Hướng triển khai**: Chỉ ra các ý chính cần có. Nếu là câu Đọc hiểu, hãy chỉ rõ nên tìm thông tin ở đoạn nào trong văn bản. Nếu là Nghị luận, hãy gợi ý các luận điểm then chốt.
3. **Từ khóa & Diễn đạt**: Đưa ra 3-5 từ khóa/thuật ngữ đắt giá bám sát nội dung.

Yêu cầu: 
- Viết ngắn gọn, súc tích, định dạng Markdown (dùng - hoặc số).
- KHÔNG giải hộ hoàn toàn, chỉ hướng dẫn tư duy.
- Không dùng dấu * ở đầu dòng.`

        try {
            const text = await callGeminiAPI(instruction)
            setHints(prev => ({ ...prev, [qId]: text }))
        } catch {
            setHints(prev => ({ ...prev, [qId]: 'Không thể lấy gợi ý lúc này do lỗi kết nối AI.' }))
        } finally {
            setLoadingHintFor(null)
        }
    }

    async function analyzeMaterial() {
        if (!selectedExam) return
        setLoadingAnalysis(true)
        const cleanText = normalizeVN(selectedExam.sections.doc_hieu)
        const instruction = `Bạn là chuyên gia phê bình văn học. Hãy phân tích sâu phần Ngữ liệu sau đây để giúp học sinh nắm vững nội dung trước khi làm bài:
---
${cleanText}
---
Yêu cầu phân tích:
1. **Về Nội dung**: Tóm tắt ngắn gọn chủ đề, thông điệp chính và cảm xúc chủ đạo.
2. **Về Nghệ thuật**: Chỉ ra 2-3 nét đặc sắc về nghệ thuật (biện pháp tu từ, hình ảnh, ngôn ngữ, giọng điệu...).
3. **Từ khóa gợi mở**: Những từ khóa quan trọng nhất để trả lời các câu hỏi liên quan.

Yêu cầu: Viết theo phong cách sư phạm, giàu sức gợi, định dạng Markdown rõ ràng. Không quá dài.`

        try {
            const text = await callGeminiAPI(instruction)
            setMaterialAnalysis(text)
        } catch {
            setMaterialAnalysis('Có lỗi xảy ra khi phân tích ngữ liệu.')
        } finally {
            setLoadingAnalysis(false)
        }
    }

    async function handleGradeExam() {
        if (!selectedExam) return
        setIsGrading(true)
        setSubmitDone(false)

        // Gather all answers
        let formattedAnswers = "";
        selectedExam.sections.doc_hieu_questions.forEach((q, idx) => {
            formattedAnswers += `Câu ${idx + 1} (${q.label}): ${q.text}\nBài làm: ${answers[`q_${idx}`] || "(Để trống)"}\n\n`;
        });
        formattedAnswers += `PHẦN NLXH: ${selectedExam.sections.nlxh}\nBài làm: ${answers.nlxh || "(Để trống)"}\n\n`;
        formattedAnswers += `PHẦN NLVH: ${selectedExam.sections.nlvh}\nBài làm: ${answers.nlvh || "(Để trống)"}\n\n`;

        const instruction = `Bạn là giáo viên Ngữ Văn THPT lão luyện. Hãy chấm điểm toàn bộ bài làm sau đây dựa trên đề thi "${selectedExam.title}".

BÀI LÀM CỦA HỌC SINH:
---
${formattedAnswers}
---

Yêu cầu chấm điểm nghiêm túc, khách quan theo 4 tiêu chí năng lực chính.
Nếu bài làm quá ngắn hoặc để trống nhiều, hãy mạnh dạn cho điểm liệt (0-1).

Trả về kết quả ĐÚNG định dạng JSON sau, không thêm bất kỳ text nào khác:
{
  "skills": [
    {"label": "Ngôn ngữ", "value": 7.5},
    {"label": "Tư duy PB", "value": 6.0},
    {"label": "Cấu trúc", "value": 8.0},
    {"label": "Diễn đạt", "value": 6.5}
  ],
  "overall": 7.0,
  "suggestions": [
    {"type": "check", "title": "Ưu điểm", "body": "Nhận xét ưu điểm..."},
    {"type": "warning", "title": "Hạn chế", "body": "Nhận xét hạn chế và cách khắc phục..."}
  ],
  "commonErrors": [
    "Lỗi 1: ...",
    "Lỗi 2: ..."
  ],
  "comment": "Nhận xét tổng quát cuối bài."
}

Lưu ý: "skills" bao gồm: Ngôn ngữ, Tư duy PB (phản biện), Cấu trúc, Diễn đạt. Giá trị từ 0-10.`

        try {
            const text = await callGeminiAPI(instruction)
            const match = text.match(/\{[\s\S]*\}/)
            if (!match) throw new Error('No JSON')
            const result = JSON.parse(match[0])
            setGradingResult(result)
            setSubmitDone(true)

            // Persist to evaluation store
            addEvaluation(result, {
                icon: 'school',
                title: selectedExam.title,
                type: 'Đề thi chính thức'
            })

            // Save detailed full copy to LocalForage (IndexedDB)
            saveExamHistoryDetail(selectedExam.id, {
                timestamp: Date.now(),
                examId: selectedExam.id,
                examTitle: selectedExam.title,
                result: result,
                answers: answers
            })
        } catch (err) {
            console.error("Grading failed", err)
            alert("Có lỗi xảy ra khi AI chấm bài. Vui lòng thử lại.")
        } finally {
            setIsGrading(false)
        }
    }

    const startExam = () => {
        setAnswers({})
        setHints({})
        setMaterialAnalysis(null)
        setGradingResult(null)
        setSubmitDone(false)
        setIsTakingExam(true)
        setTimeout(() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50)
    }

    const handleSelectExam = (ex) => {
        setSelectedExam(ex)
        setIsTakingExam(false)
        setAnswers({})
        setHints({})
        setMaterialAnalysis(null)
        setGradingResult(null)
        setSubmitDone(false)
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">

            {/* ── Header ── */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 shrink-0">
                <div className="flex items-center gap-3">
                    {isTakingExam && (
                        <button
                            onClick={() => { setIsTakingExam(false); setSubmitDone(false) }}
                            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    )}
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span className="material-symbols-outlined text-indigo-500 text-[22px]">
                                {isTakingExam ? 'edit_square' : 'library_books'}
                            </span>
                            {isTakingExam ? 'Đang làm bài' : 'Thư viện Đề thi'}
                        </h2>
                        {!isTakingExam && (
                            <p className="text-xs text-slate-400">Hỗ trợ phân tích & luyện tập trực tiếp</p>
                        )}
                    </div>
                </div>

                {!isTakingExam && (
                    <div className="relative w-64 sm:w-80">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">search</span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm đề thi…"
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-xl text-sm
                                focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                )}
            </header>

            <div className="flex-1 flex overflow-hidden">

                {/* ── Sidebar ── */}
                {!isTakingExam && (
                    <aside className="w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-4 space-y-2 bg-slate-50/60 dark:bg-slate-950">
                        {filteredExams.length === 0
                            ? <p className="text-center text-sm text-slate-400 pt-10">Không tìm thấy đề nào.</p>
                            : filteredExams.map(ex => (
                                <ExamCard
                                    key={ex.id}
                                    exam={ex}
                                    active={selectedExam?.id === ex.id}
                                    onClick={() => handleSelectExam(ex)}
                                />
                            ))
                        }
                    </aside>
                )}

                {/* ── Main Panel ── */}
                <main ref={mainRef} className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
                    <AnimatePresence mode="wait">

                        {/* No exam selected */}
                        {!selectedExam ? (
                            <EmptyState key="empty" />

                        ) : isTakingExam ? (
                            /* ══ EXAM MODE ══════════════════════════════════════════ */
                            <motion.div
                                key="exam"
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -30, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="p-6 md:p-10 max-w-3xl mx-auto pb-20 space-y-10"
                            >
                                {/* Title */}
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Đang làm bài</p>
                                    <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                        {selectedExam.title}
                                    </h1>
                                </div>

                                <section className="space-y-8">
                                    {/* Reading passage */}
                                    <div className="p-6 rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 dark:bg-indigo-950/20 blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-indigo-100/50" />
                                        
                                        <div className="flex items-center justify-between mb-6 relative z-10">
                                            <div className="flex items-center gap-2">
                                                <span className="w-1.5 h-4 rounded-full bg-indigo-500 inline-block shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                                <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-500">
                                                    Phần Đọc hiểu — Ngữ liệu
                                                </h3>
                                            </div>
                                            <button
                                                onClick={analyzeMaterial}
                                                disabled={loadingAnalysis}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all border border-indigo-100 dark:border-indigo-800/50 disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-[16px] animate-pulse">
                                                    {loadingAnalysis ? 'sync' : 'psychology'}
                                                </span>
                                                {loadingAnalysis ? 'Đang phân tích...' : 'Phân tích sâu ngữ liệu'}
                                            </button>
                                        </div>

                                        <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-[2] font-serif relative z-10 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                                            {normalizeVN(
                                                selectedExam.sections.doc_hieu
                                                    ? selectedExam.sections.doc_hieu.split(/Câu\s*\d+[\.\:\s]/i)[0]
                                                    : ''
                                            )}
                                        </div>

                                        <AnimatePresence>
                                            {materialAnalysis && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10"
                                                >
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="material-symbols-outlined text-indigo-500 text-[18px]">insights</span>
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">Góc nhìn AI Chuyên gia</span>
                                                    </div>
                                                    <div 
                                                        className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30"
                                                        dangerouslySetInnerHTML={{ __html: formatMarkdown(materialAnalysis) }}
                                                    />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Questions */}
                                    {Array.isArray(selectedExam.sections.doc_hieu_questions) &&
                                        selectedExam.sections.doc_hieu_questions.map((q, idx) => (
                                            <QuestionBlock
                                                key={idx}
                                                label={q.label}
                                                text={q.text}
                                                id={`q_${idx}`}
                                                onHint={() => getHint(`q_${idx}`, q.label, q.text, 'Đọc hiểu', selectedExam)}
                                                loadingHint={loadingHintFor === `q_${idx}`}
                                                hint={hints[`q_${idx}`]}
                                                answer={answers[`q_${idx}`]}
                                                setAnswer={v => setAnswers(p => ({ ...p, [`q_${idx}`]: v }))}
                                            />
                                        ))
                                    }

                                    <div className="h-px bg-slate-100 dark:bg-slate-800" />

                                    {/* NLXH */}
                                    {selectedExam.sections.nlxh && (
                                        <QuestionBlock
                                            label="Nghị luận xã hội"
                                            text={selectedExam.sections.nlxh}
                                            id="nlxh"
                                            onHint={() => getHint('nlxh', 'Nghị luận xã hội', selectedExam.sections.nlxh, 'Nghị luận xã hội', selectedExam)}
                                            loadingHint={loadingHintFor === 'nlxh'}
                                            hint={hints['nlxh']}
                                            answer={answers['nlxh']}
                                            setAnswer={v => setAnswers(p => ({ ...p, nlxh: v }))}
                                            rows={8}
                                        />
                                    )}

                                    {/* NLVH */}
                                    {selectedExam.sections.nlvh && (
                                        <QuestionBlock
                                            label="Nghị luận văn học"
                                            text={selectedExam.sections.nlvh}
                                            id="nlvh"
                                            onHint={() => getHint('nlvh', 'Nghị luận văn học', selectedExam.sections.nlvh, 'Nghị luận văn học', selectedExam)}
                                            loadingHint={loadingHintFor === 'nlvh'}
                                            hint={hints['nlvh']}
                                            answer={answers['nlvh']}
                                            setAnswer={v => setAnswers(p => ({ ...p, nlvh: v }))}
                                            rows={12}
                                        />
                                    )}
                                </section>

                                {/* Submit/Result area */}
                                <div className="flex justify-center pb-4">
                                    <AnimatePresence mode="wait">
                                        {submitDone && gradingResult ? (
                                            <ResultDashboard 
                                                result={gradingResult} 
                                                onBack={() => { setIsTakingExam(false); setSubmitDone(false); setGradingResult(null); }} 
                                                examTitle={selectedExam.title}
                                                answers={answers}
                                                examData={selectedExam}
                                            />
                                        ) : (
                                            <motion.button
                                                key="submit-btn"
                                                whileHover={{ scale: 1.04 }}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={handleGradeExam}
                                                disabled={isGrading}
                                                className={`px-10 py-4 text-white rounded-2xl font-black
                                                    shadow-xl transition-all flex items-center gap-2
                                                    ${isGrading ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-indigo-900/40'}`}
                                            >
                                                {isGrading ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        ĐANG CHẤM BÀI...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined text-[20px]">send</span>
                                                        NỘP BÀI CHẤM ĐIỂM
                                                    </>
                                                )}
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>

                        ) : (
                            /* ══ VIEW MODE ══════════════════════════════════════════ */
                            <motion.div
                                key="view"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="p-6 md:p-10 max-w-4xl mx-auto pb-16 space-y-6"
                            >
                                {/* Title row */}
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Đề thi</p>
                                        <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                                            {selectedExam.title}
                                        </h1>
                                    </div>
                                    <div className="flex gap-2 shrink-0 mt-1">
                                        <button
                                            onClick={() => downloadFakeFile(selectedExam.filename)}
                                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800
                                                hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                                            title="Tải đề thi (.docx)"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">download</span>
                                        </button>
                                        <motion.button
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            onClick={startExam}
                                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold
                                                flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                                            Bắt đầu làm bài
                                        </motion.button>
                                    </div>
                                </div>

                                {/* Paper preview */}
                                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
                                    {/* Paper header */}
                                    <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-10 py-8 text-center">
                                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.12em]">
                                            KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG
                                        </h2>
                                        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
                                            Bài thi: NGỮ VĂN
                                        </p>
                                        <div className="w-12 h-0.5 bg-indigo-400 mx-auto mt-4" />
                                    </div>

                                    {/* Paper body — KEY FIX: whitespace-pre-wrap + normalizeVN */}
                                    <div className="px-10 md:px-14 py-10 text-slate-800 dark:text-slate-200">
                                        <section className="whitespace-pre-wrap leading-[1.9] text-[15px] font-sans">
                                            {normalizeVN(selectedExam.sections.full_text) || 'Nội dung đang được cập nhật…'}
                                        </section>

                                        <div className="text-center mt-12 font-bold italic text-sm text-slate-400 select-none tracking-[0.2em]">
                                            ——— HẾT ———
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </main>
            </div>
        </div>
    )
}