import { useState, useRef, useEffect } from 'react'
import RadarChart from '../components/RadarChart'
import { readStore, writeStore, addEvaluation, saveExamHistoryDetail } from '../hooks/useEvalStore'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthUser } from '../hooks/useAuth'

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL

// Hỗ trợ chạy local với .env (nếu không chạy vercel dev)
// Constants
const LOCAL_API_KEYS_TEXT = import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || ''
const LOCAL_API_KEYS = LOCAL_API_KEYS_TEXT.split(',').map(k => k.trim()).filter(Boolean)
const LOCAL_MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

async function callGeminiAPI(instruction) {
    // 1. Nếu đang ở môi trường dev và có key trong .env -> gọi thẳng (cho tiện)
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

    // 2. Mặc định: gọi qua Vercel Serverless Function (Bảo mật cho Production)
    const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: instruction })
    })
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'API request failed: ' + res.status)
    }
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    return data.text
}

// ─── Study plan data ────────────────────────────────────────────────────────

const SCORE_LEVELS = [
    { id: 'under5', label: 'Dưới 5', range: [0, 4.9] },
    { id: '5to6', label: '5 – 6', range: [5, 6] },
    { id: '6to7', label: '6 – 7', range: [6, 7] },
    { id: '7to8', label: '7 – 8', range: [7, 8] },
    { id: '8plus', label: '8 – 10', range: [8, 10] },
]
const LEVEL_ORDER = ['under5', '5to6', '6to7', '7to8', '8plus']
function getLevelIndex(id) { return LEVEL_ORDER.indexOf(id) }

const PLANS_MAP = {
    under5: {
        title: 'Kế hoạch đạt 5 điểm', color: 'emerald', icon: 'menu_book',
        focus: 'Tập trung luyện phần Đọc hiểu là đủ',
        schedule: '1 đề đọc hiểu / ngày · 1 tiếng mỗi ngày',
        sections: [
            { icon: 'find_in_page', title: 'Đọc hiểu (3 điểm)', items: ['Mỗi ngày luyện 1 đề đọc hiểu đầy đủ (5 câu)', 'Làm xong → tự chấm → làm lại để sửa lỗi', 'Ghi nhớ cách nhận dạng câu nhận biết (0.5đ) và thông hiểu (1đ)', 'Câu vận dụng (1đ) thử sức, không cần hoàn hảo ngay'] },
            { icon: 'schedule', title: 'Thời gian', items: ['Dành đúng 1 tiếng/ngày, không cần hơn', 'Chưa cần luyện phần làm văn – đọc hiểu là ưu tiên số 1'] },
        ],
        tip: 'Chỉ cần đạt 2.5/3 điểm đọc hiểu + ít nhất 1.5đ phần viết là đủ 5 điểm rồi!',
    },
    '5to6': {
        title: 'Kế hoạch đạt 5 – 6 điểm', color: 'emerald', icon: 'menu_book',
        focus: 'Đọc hiểu chắc + làm quen câu viết đoạn',
        schedule: '1 đề đọc hiểu / ngày + 1 đoạn văn / 2 ngày',
        sections: [
            { icon: 'find_in_page', title: 'Đọc hiểu (3 điểm)', items: ['Luyện 1 đề đọc hiểu mỗi ngày, làm đủ 5 câu', 'Tự chấm → phân tích sai → làm lại', 'Ưu tiên nắm chắc các câu nhận biết – thông hiểu trước'] },
            { icon: 'edit_note', title: 'Viết đoạn 200 chữ (2 điểm)', items: ['Luyện 1 đề viết đoạn mỗi 2 ngày', 'Viết xong tự đọc lại: sửa logic, lỗi diễn đạt, dùng từ', 'Học thuộc cấu trúc đoạn văn: mở đoạn – thân đoạn – kết đoạn'] },
        ],
        tip: 'Điểm đọc hiểu 2–2.5đ + câu viết đoạn 1–1.5đ = sát hoặc qua ngưỡng 5–6.',
    },
    '6to7': {
        title: 'Kế hoạch đạt 6 – 7 điểm', color: 'blue', icon: 'auto_stories',
        focus: 'Vững đọc hiểu + nắm khung bài viết 600 chữ',
        schedule: '1 đề đọc hiểu / ngày + luyện bài viết 600 chữ',
        sections: [
            { icon: 'find_in_page', title: 'Đọc hiểu (3 điểm)', items: ['Duy trì luyện 1 đề/ngày', 'Phân tích lỗi sai, tổng hợp các dạng câu hỏi thường gặp'] },
            { icon: 'edit_note', title: 'Viết đoạn 200 chữ (2 điểm)', items: ['Rèn viết đoạn 3–4 lần/tuần', 'Chú ý mạch lạc, đủ ý, không lạc đề'] },
            { icon: 'description', title: 'Bài viết 600 chữ (4 điểm)', items: ['Nắm chắc khung bài: Mở bài → Giới thiệu → Phân tích → Đánh giá → Kết bài', 'Viết đảm bảo đủ cấu trúc và các ý chính theo khung', 'Chưa cần diễn đạt hay, cần đủ ý trước'] },
        ],
        tip: 'Đọc hiểu 2–2.5đ + viết đoạn 1.5đ + bài viết 2–2.5đ = 6–7 điểm.',
    },
    '7to8': {
        title: 'Kế hoạch đạt 7 – 8 điểm', color: 'violet', icon: 'school',
        focus: 'Hoàn thiện cả 3 phần, rèn bài viết logic',
        schedule: 'Luyện tổng hợp cả 3 phần, ưu tiên bài viết 600 chữ',
        sections: [
            { icon: 'find_in_page', title: 'Đọc hiểu (3 điểm)', items: ['Luyện đạt điểm tối đa phần này (2.5–3đ)', 'Hạn chế mất điểm câu vận dụng'] },
            { icon: 'edit_note', title: 'Viết đoạn 200 chữ (2 điểm)', items: ['Rèn đến khi viết đoạn đủ ý, đúng cấu trúc một cách tự nhiên'] },
            { icon: 'description', title: 'Bài viết 600 chữ (4 điểm)', items: ['Luyện viết bài hoàn chỉnh theo khung chuẩn', 'Chú trọng diễn đạt đúng logic: luận điểm → luận cứ → dẫn chứng', 'Đọc lại bài, sửa câu văn rối, thiếu mạch lạc'] },
        ],
        tip: 'Ổn định điểm đọc hiểu + nâng bài viết lên 2.5–3đ là chìa khóa đạt 7–8.',
    },
    '8plus': {
        title: 'Kế hoạch đạt 8 điểm trở lên', color: 'amber', icon: 'emoji_events',
        focus: 'Nâng tầm diễn đạt, bổ sung lí luận và mở bài gián tiếp',
        schedule: 'Luyện chuyên sâu, chú trọng chất lượng từng câu văn',
        sections: [
            { icon: 'find_in_page', title: 'Đọc hiểu (3 điểm)', items: ['Giữ điểm tối đa', 'Trả lời câu vận dụng sắc sảo, có lập luận'] },
            { icon: 'edit_note', title: 'Viết đoạn 200 chữ (2 điểm)', items: ['Diễn đạt hay, có hình ảnh, bổ sung lí luận văn học ngắn gọn', 'Liên hệ mở rộng phù hợp, trình bày đẹp và đúng trọng tâm'] },
            { icon: 'description', title: 'Bài viết 600 chữ (4 điểm)', items: ['Mở bài gián tiếp sáng tạo, cuốn hút', 'Diễn đạt hay, có chiều sâu cảm xúc và lí luận', 'Liên hệ mở rộng ở phần kết luận', 'Dẫn chứng chính xác, phân tích tinh tế'] },
        ],
        tip: 'Bài 8+ cần sự khác biệt trong diễn đạt. Đọc văn mẫu hay để học cách viết.',
    },
}

const colorMap = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300' },
    violet: { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-400', badge: 'bg-violet-100 dark:bg-violet-800 text-violet-700 dark:text-violet-300' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300' },
}

const STEPS = { INTRO: 'intro', CURRENT: 'current', TARGET: 'target', PLAN: 'plan' }

// ─── Exercise types ──────────────────────────────────────────────────────────

const EXERCISE_TYPES = [
    { id: 'para200', label: 'Viết đoạn 200 chữ', icon: 'edit_note', points: '2 điểm', duration: 25, color: 'violet' },
    { id: 'essay600', label: 'Viết bài 600 chữ', icon: 'description', points: '4 điểm', duration: 45, color: 'amber' },
]

// ─── Gemini helpers ──────────────────────────────────────────────────────────

async function generatePrompt(type) {
    const instruction = type === 'para200'
        ? `Tạo 1 câu hỏi viết đoạn văn nghị luận xã hội khoảng 200 chữ cho học sinh lớp 12 ôn thi tốt nghiệp THPT. Chỉ trả về câu hỏi, không giải thích. Câu hỏi bắt đầu bằng "Hãy viết đoạn văn (khoảng 200 chữ)..."`
        : `Tạo 1 câu hỏi phân tích tác phẩm văn học lớp 12 (bài viết khoảng 600 chữ) cho học sinh ôn thi tốt nghiệp THPT. Chỉ trả về câu hỏi, không giải thích. Câu hỏi bắt đầu bằng "Phân tích..."`

    try {
        const text = await callGeminiAPI(instruction)
        return text.trim()
    } catch (err) {
        console.error("Generate prompt error:", err)
        return type === 'para200'
            ? 'Hãy viết đoạn văn (khoảng 200 chữ) bàn về ý nghĩa của lòng kiên trì trong cuộc sống.'
            : 'Phân tích hình tượng người lính trong bài thơ "Tây Tiến" của Quang Dũng.'
    }
}

async function gradeEssay(prompt, answer, type) {
    if (!answer.trim()) {
        return {
            skills: [
                { label: 'Ngôn ngữ', value: 5 },
                { label: 'Tư duy PB', value: 5 },
                { label: 'Cấu trúc', value: 5 },
                { label: 'Diễn đạt', value: 5 },
            ],
            suggestions: [
                { type: 'warning', title: 'Bài làm trống', body: 'Bạn chưa nhập bài làm, điểm mặc định 5.0 cho tất cả tiêu chí.' },
            ],
            overall: 5.0,
            comment: 'Bài làm trống.',
        }
    }

    const instruction = `Bạn là giáo viên chấm thi Ngữ văn THPT. Đây là bài làm của học sinh.
Đề bài: ${prompt}
Bài làm: ${answer}

QUY TẮC ĐẶC BIỆT: Nếu bài làm của học sinh có nội dung vô nghĩa (ví dụ: "abcxyz", "12345"), xúc phạm, chửi thề, hoặc hoàn toàn không nghiêm túc, hãy cho TẤT CẢ các tiêu chí ĐÚNG 0.0 điểm. Tuyệt đối không cho điểm trung bình hoặc điểm liệt 1-2, phải là 0.0.

Hãy chấm bài theo 4 tiêu chí, mỗi tiêu chí cho điểm từ 0 đến 10 (số thực, 1 chữ số thập phân):
1. Năng lực Ngôn ngữ: vốn từ, ngữ pháp, chính tả
2. Tư duy Phản biện: lập luận, lý lẽ, dẫn chứng
3. Cấu trúc Bài viết: bố cục, mạch lạc, đủ ý
4. Diễn đạt & Sáng tạo: cách dùng từ hay, hình ảnh, sáng tạo

Trả lời ĐÚNG định dạng JSON sau, không thêm bất kỳ text nào khác:
{
  "ngon_ngu": 7.0,
  "tu_duy": 6.5,
  "cau_truc": 7.5,
  "dien_dat": 6.0,
  "overall": 6.8,
  "strength_title": "Tiêu đề điểm mạnh ngắn",
  "strength_body": "Nhận xét điểm mạnh 1-2 câu",
  "weak_title": "Tiêu đề điểm yếu ngắn",
  "weak_body": "Nhận xét điểm yếu và gợi ý cải thiện 1-2 câu"
}`

    try {
        const text = await callGeminiAPI(instruction)
        // Extract JSON from response
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('no json')
        const j = JSON.parse(match[0])
        return {
            skills: [
                { label: 'Ngôn ngữ', value: j.ngon_ngu ?? 5 },
                { label: 'Tư duy PB', value: j.tu_duy ?? 5 },
                { label: 'Cấu trúc', value: j.cau_truc ?? 5 },
                { label: 'Diễn đạt', value: j.dien_dat ?? 5 },
            ],
            suggestions: [
                { type: 'check', title: j.strength_title || 'Điểm mạnh', body: j.strength_body || '' },
                { type: 'warning', title: j.weak_title || 'Cần cải thiện', body: j.weak_body || '' },
            ],
            overall: j.overall ?? 5,
            comment: '',
        }
    } catch {
        return {
            skills: [
                { label: 'Ngôn ngữ', value: 5.5 },
                { label: 'Tư duy PB', value: 5.5 },
                { label: 'Cấu trúc', value: 5.5 },
                { label: 'Diễn đạt', value: 5.5 },
            ],
            suggestions: [{ type: 'check', title: 'Bài đã nộp', body: 'Không thể kết nối AI để chấm điểm. Điểm ước tính dựa trên độ dài bài viết.' }],
            overall: 5.5,
            comment: '',
        }
    }
}

async function saveScoreToGoogleSheet(data) {
    const user = getAuthUser();
    if (!user) return;

    try {
        await fetch('/api/sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                name: user.name,
                role: user.role,
                score: data.result.overall,
                exercise: data.exercise.label,
                type: 'SCORE_UPDATE'
            })
        });
    } catch (e) {
        console.error("Failed to sync score via proxy", e);
    }
}

// ─── Timer hook ──────────────────────────────────────────────────────────────

function useTimer(initialSeconds, onExpire) {
    const [secs, setSecs] = useState(initialSeconds)
    const ref = useRef(null)

    useEffect(() => {
        ref.current = setInterval(() => {
            setSecs(prev => {
                if (prev <= 1) {
                    clearInterval(ref.current)
                    onExpire?.()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(ref.current)
    }, [])

    const mm = String(Math.floor(secs / 60)).padStart(2, '0')
    const ss = String(secs % 60).padStart(2, '0')
    const pct = ((initialSeconds - secs) / initialSeconds) * 100
    const urgent = secs < 120
    return { display: `${mm}:${ss}`, pct, urgent, secs }
}

// ─── Word count ───────────────────────────────────────────────────────────────

function countWords(text) {
    return text.trim() ? text.trim().split(/\s+/).length : 0
}

// ─── Components ──────────────────────────────────────────────────────────────

function BotMessage({ children }) {
    return (
        <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0 border border-primary/20 mt-0.5">
                <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
            </div>
            <div className="max-w-[88%] bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-5 py-4 text-sm text-slate-800 dark:text-slate-200 leading-relaxed shadow-sm">
                {children}
            </div>
        </div>
    )
}

function UserBubble({ text }) {
    return (
        <div className="flex justify-end">
            <div className="max-w-[70%] bg-primary text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-sm text-sm leading-relaxed">
                {text}
            </div>
        </div>
    )
}

function ScoreGrid({ options, onSelect, selected }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
            {options.map(opt => (
                <button
                    key={opt.id}
                    onClick={() => onSelect(opt)}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200
                        ${selected?.id === opt.id
                            ? 'bg-primary text-white border-primary shadow-md scale-105'
                            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary dark:hover:border-accent dark:hover:text-accent'}`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}

function WarningBanner({ current, target }) {
    const diff = getLevelIndex(target.id) - getLevelIndex(current.id)
    if (diff <= 1) return null
    return (
        <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
            <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5">warning</span>
            <span>Mục tiêu khá xa so với thực lực hiện tại. Lộ trình học nên tăng dần từng bước!</span>
        </div>
    )
}

function StudyPlan({ plan, current, target }) {
    if (!plan) return null
    const c = colorMap[plan.color] || colorMap.emerald
    return (
        <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 space-y-5`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.badge}`}>
                    <span className="material-symbols-outlined text-[22px]">{plan.icon}</span>
                </div>
                <div>
                    <h3 className={`font-bold text-base ${c.text}`}>{plan.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Từ {current.label} → {target.label}</p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/70 dark:bg-slate-900/50 rounded-xl p-3 border border-white/80 dark:border-slate-700/50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Trọng tâm</p>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{plan.focus}</p>
                </div>
                <div className="bg-white/70 dark:bg-slate-900/50 rounded-xl p-3 border border-white/80 dark:border-slate-700/50">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Lịch luyện tập</p>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{plan.schedule}</p>
                </div>
            </div>
            <div className="space-y-3">
                {plan.sections.map((sec, i) => (
                    <div key={i} className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-4 border border-white dark:border-slate-700/40">
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`material-symbols-outlined text-[18px] ${c.text}`}>{sec.icon}</span>
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{sec.title}</h4>
                        </div>
                        <ul className="space-y-1.5 ml-1">
                            {sec.items.map((item, j) => (
                                <li key={j} className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex gap-2">
                                    <span className={`text-[10px] mt-1 flex-shrink-0 ${c.text}`}>▸</span>{item}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className={`flex items-start gap-2 px-4 py-3 rounded-xl ${c.badge} text-xs`}>
                <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5">lightbulb</span>
                <span>{plan.tip}</span>
            </div>
        </div>
    )
}

// ─── Exercise launcher buttons ────────────────────────────────────────────────

function ExerciseLauncher({ onOpen }) {
    return (
        <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3">Luyện tập ngay với đề bài AI tạo:</p>
            {EXERCISE_TYPES.map(ex => {
                const c = colorMap[ex.color]
                return (
                    <button
                        key={ex.id}
                        onClick={() => onOpen(ex)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border ${c.border} ${c.bg} hover:opacity-90 active:scale-[0.98] transition-all group`}
                    >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.badge} flex-shrink-0`}>
                            <span className="material-symbols-outlined text-[18px]">{ex.icon}</span>
                        </div>
                        <div className="flex-1 text-left">
                            <p className={`text-sm font-semibold ${c.text}`}>{ex.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{ex.points} · {ex.duration} phút</p>
                        </div>
                        <span className={`material-symbols-outlined text-[18px] ${c.text} group-hover:translate-x-0.5 transition-transform`}>arrow_forward</span>
                    </button>
                )
            })}
        </div>
    )
}

// ─── Exercise Modal (full-screen overlay) ─────────────────────────────────────

function ExerciseModal({ exercise, onClose, onSubmit }) {
    const [prompt, setPrompt] = useState(null)
    const [answer, setAnswer] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [expired, setExpired] = useState(false)
    const timer = useTimer(exercise.duration * 60, () => setExpired(true))
    const wordCount = countWords(answer)
    const target = exercise.id === 'para200' ? 200 : 600

    useEffect(() => {
        generatePrompt(exercise.id).then(p => { setPrompt(p); setLoading(false) })
    }, [])

    async function handleSubmit() {
        if (!answer.trim()) return
        setSubmitting(true)
        const result = await gradeEssay(prompt, answer, exercise.id)
        onSubmit({ exercise, prompt, answer, result })
    }

    const urgentClass = timer.urgent ? 'text-red-500 animate-pulse' : 'text-slate-700 dark:text-slate-200'

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-900">
            {/* Modal header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                    <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">{exercise.label}</h2>
                        <p className="text-xs text-slate-500">{exercise.points} · Làm bài trong {exercise.duration} phút</p>
                    </div>
                </div>
                {/* Timer */}
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                            <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                            <circle
                                cx="20" cy="20" r="16" fill="none"
                                stroke={timer.urgent ? '#ef4444' : '#0D9488'}
                                strokeWidth="3"
                                strokeDasharray={`${2 * Math.PI * 16}`}
                                strokeDashoffset={`${2 * Math.PI * 16 * (1 - timer.pct / 100)}`}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 1s linear' }}
                            />
                        </svg>
                        <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-[14px] text-slate-400">schedule</span>
                    </div>
                    <span className={`text-xl font-mono font-bold tabular-nums ${urgentClass}`}>{timer.display}</span>
                </div>
            </header>

            {/* Prompt area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <span className="text-sm">Đang tạo đề bài...</span>
                    </div>
                ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Prompt */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                            <div className="max-w-3xl mx-auto">
                                <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-2">Đề bài</p>
                                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">{prompt}</p>
                            </div>
                        </div>
                        {/* Answer area */}
                        <div className="flex-1 flex flex-col overflow-hidden px-6 py-4">
                            <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Bài làm của bạn</p>
                                    <p className={`text-xs font-mono tabular-nums ${wordCount >= target * 0.9 ? 'text-emerald-500' : wordCount >= target * 0.5 ? 'text-amber-500' : 'text-slate-400'}`}>
                                        {wordCount} / ~{target} chữ
                                    </p>
                                </div>
                                <textarea
                                    className="flex-1 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 p-4 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary leading-relaxed placeholder-slate-300 dark:placeholder-slate-600"
                                    placeholder={`Nhập bài làm của bạn tại đây... (khoảng ${target} chữ)`}
                                    value={answer}
                                    onChange={e => setAnswer(e.target.value)}
                                    disabled={expired}
                                />
                                {expired && (
                                    <div className="mt-2 flex items-center gap-2 text-red-500 text-xs font-medium">
                                        <span className="material-symbols-outlined text-[14px]">timer_off</span>
                                        Hết thời gian! Nhấn nộp bài để xem kết quả.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex justify-between items-center">
                <div className="max-w-3xl mx-auto w-full flex justify-between items-center">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                        Thoát không nộp
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!answer.trim() || submitting || loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                        {submitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Đang chấm bài...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[16px]">send</span>
                                Nộp bài
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Result card (in chat) ────────────────────────────────────────────────────

function ResultCard({ data }) {
    const { exercise, result } = data
    const avg = result.overall
    const label = avg >= 8 ? 'Giỏi' : avg >= 7 ? 'Khá' : avg >= 5 ? 'Trung bình' : 'Cần cố gắng'
    const labelColor = avg >= 8 ? 'text-amber-500' : avg >= 7 ? 'text-blue-500' : avg >= 5 ? 'text-emerald-500' : 'text-red-500'

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="font-semibold">📊 Kết quả bài: <span className="text-slate-600 dark:text-slate-300 font-normal">{exercise.label}</span></p>
                <span className={`text-2xl font-black tabular-nums ${labelColor}`}>{avg.toFixed(1)}</span>
            </div>
            <p className={`text-xs font-bold ${labelColor}`}>Xếp loại: {label}</p>

            {/* Radar chart */}
            <div className="flex justify-center py-2">
                <RadarChart skills={result.skills} size={220} color="#0D9488" />
            </div>

            {/* Skill bars */}
            <div className="space-y-2">
                {result.skills.map(sk => (
                    <div key={sk.label} className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 dark:text-slate-400 w-20 flex-shrink-0">{sk.label}</span>
                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-700"
                                style={{ width: `${sk.value * 10}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-8 text-right tabular-nums">{sk.value.toFixed(1)}</span>
                    </div>
                ))}
            </div>

            {/* AI suggestions */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                {result.suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60">
                        <span className={`material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5 ${s.type === 'check' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {s.type === 'check' ? 'check_circle' : 'warning'}
                        </span>
                        <div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{s.body}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Sidebar: Exam structure ──────────────────────────────────────────────────

function ExamStructure() {
    const parts = [
        { label: 'Đọc hiểu', total: '3đ', color: 'text-blue-600 dark:text-blue-400', items: ['2 câu Nhận biết × 0.5đ', '2 câu Thông hiểu × 1đ', '1 câu Vận dụng × 1đ'] },
        { label: 'Viết đoạn 200 chữ', total: '2đ', color: 'text-violet-600 dark:text-violet-400', items: ['Nghị luận xã hội hoặc văn học'] },
        { label: 'Viết bài 600 chữ', total: '4đ', color: 'text-amber-600 dark:text-amber-400', items: ['Phân tích tác phẩm / nhân vật', 'Cần đủ cấu trúc + ý chính'] },
    ]
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">quiz</span>
                    Cấu trúc đề thi Văn THPT
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Tổng 10 điểm</p>
            </div>
            <div className="p-4 space-y-3">
                {parts.map(p => (
                    <div key={p.label} className="flex gap-3">
                        <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <p className={`text-xs font-semibold ${p.color}`}>{p.label}</p>
                                <span className={`text-xs font-bold ${p.color}`}>{p.total}</span>
                            </div>
                            {p.items.map((it, i) => (
                                <p key={i} className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">• {it}</p>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function ScaleBar() {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary text-[18px]">track_changes</span>
                Mức điểm & thang điểm
            </h3>
            <div className="space-y-2.5">
                {[
                    { range: '8 – 10', label: 'Giỏi', color: 'bg-amber-400', width: 'w-full' },
                    { range: '7 – 8', label: 'Khá', color: 'bg-blue-400', width: 'w-4/5' },
                    { range: '6 – 7', label: 'TB khá', color: 'bg-violet-400', width: 'w-3/5' },
                    { range: '5 – 6', label: 'Trung bình', color: 'bg-emerald-400', width: 'w-2/5' },
                    { range: 'Dưới 5', label: 'Yếu', color: 'bg-slate-300 dark:bg-slate-600', width: 'w-1/4' },
                ].map(row => (
                    <div key={row.range} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-500 w-16 flex-shrink-0">{row.range}</span>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${row.color} ${row.width}`} />
                        </div>
                        <span className="text-xs text-slate-500 w-20 flex-shrink-0">{row.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Assistant() {
    const [step, setStep] = useState(STEPS.INTRO)
    const [currentLevel, setCurrentLevel] = useState(null)
    const [targetLevel, setTargetLevel] = useState(null)
    const [plan, setPlan] = useState(null)
    const [targetOptions, setTargetOptions] = useState([])

    // Exercise flow
    const [activeExercise, setActiveExercise] = useState(null)  // ExerciseTypes item
    const [results, setResults] = useState([])                  // completed exercise results

    const bottomRef = useRef(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [step, plan, results, activeExercise])

    function handleCurrentSelect(level) {
        setCurrentLevel(level)
        const idx = getLevelIndex(level.id)
        setTargetOptions(SCORE_LEVELS.filter((_, i) => i >= idx))
        setTargetLevel(null)
        setPlan(null)
        setStep(STEPS.TARGET)
    }

    function handleTargetSelect(level) {
        setTargetLevel(level)
        setPlan(null)
    }

    function handleConfirm() {
        if (!currentLevel || !targetLevel) return
        setPlan(PLANS_MAP[targetLevel.id] || null)
        setStep(STEPS.PLAN)
    }

    function handleReset() {
        setStep(STEPS.CURRENT)
        setCurrentLevel(null)
        setTargetLevel(null)
        setPlan(null)
        setTargetOptions([])
        setResults([])
        setActiveExercise(null)
    }

    function handleOpenExercise(ex) {
        setActiveExercise(ex)
    }

    function handleExerciseClose() {
        setActiveExercise(null)
    }

    function handleExerciseSubmit(data) {
        setActiveExercise(null)
        setResults(prev => [...prev, data])

        // Persist to localStorage for Assessment page
        addEvaluation(data.result, {
            icon: data.exercise.id === 'para200' ? 'edit_note' : 'description',
            title: data.exercise.label,
            type: data.exercise.id === 'para200' ? 'Viết đoạn 200 chữ' : 'Viết bài 600 chữ',
        })

        // Save detailed copy for review later
        saveExamHistoryDetail('assistant_' + Date.now(), {
            timestamp: Date.now(),
            examId: 'assistant_' + data.exercise.id,
            examTitle: data.exercise.label,
            prompt: data.prompt,
            answer: data.answer,
            result: data.result
        })

        // Sync to cloud (Google Sheets)
        saveScoreToGoogleSheet(data);
    }

    return (
        <div className="flex h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Exercise modal (portal) */}
            {activeExercise && (
                <ExerciseModal
                    exercise={activeExercise}
                    onClose={handleExerciseClose}
                    onSubmit={handleExerciseSubmit}
                />
            )}

            {/* Main chat */}
            <div className="flex flex-col flex-1 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">
                {/* Header */}
                <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Lộ trình Học Văn THPT</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Khảo sát → Kế hoạch → Luyện tập → Đánh giá</p>
                    </div>
                    {step !== STEPS.INTRO && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-primary hover:bg-primary/5 border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">refresh</span>
                            Làm lại
                        </button>
                    )}
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Step 1: current score */}
                    <BotMessage>
                        <p className="font-semibold mb-1">Xin chào! 👋</p>
                        <p>Mình sẽ giúp bạn xây dựng <strong>kế hoạch ôn thi Văn THPT</strong> phù hợp, sau đó luyện tập ngay với đề bài do AI tạo.</p>
                        <p className="mt-2">Đầu tiên – <strong>điểm văn hiện tại của bạn đang ở mức nào?</strong></p>
                        <ScoreGrid options={SCORE_LEVELS} onSelect={handleCurrentSelect} selected={currentLevel} />
                    </BotMessage>

                    {/* Echo current */}
                    {currentLevel && <UserBubble text={`Điểm của mình hiện tại: ${currentLevel.label}`} />}

                    {/* Step 2: target score */}
                    {(step === STEPS.TARGET || step === STEPS.PLAN) && currentLevel && (
                        <BotMessage>
                            <p>Được rồi! Với mức <strong>{currentLevel.label}</strong>, bạn muốn <strong>phấn đấu đạt mức nào?</strong></p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                                💡 Lộ trình học luôn tăng dần – nên chọn mục tiêu sát với thực lực để hiệu quả nhất.
                            </p>
                            <ScoreGrid options={targetOptions} onSelect={handleTargetSelect} selected={targetLevel} />
                            {targetLevel && currentLevel && (
                                <>
                                    <WarningBanner current={currentLevel} target={targetLevel} />
                                    {step !== STEPS.PLAN && (
                                        <button
                                            onClick={handleConfirm}
                                            className="mt-4 w-full py-2.5 px-4 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
                                        >
                                            Xem kế hoạch học tập →
                                        </button>
                                    )}
                                </>
                            )}
                        </BotMessage>
                    )}

                    {/* Echo target */}
                    {plan && targetLevel && <UserBubble text={`Mục tiêu của mình: ${targetLevel.label}`} />}

                    {/* Step 3: Plan + exercise launcher */}
                    {step === STEPS.PLAN && plan && (
                        <BotMessage>
                            <p className="font-semibold mb-3">✅ Đây là kế hoạch học tập dành riêng cho bạn:</p>
                            <StudyPlan plan={plan} current={currentLevel} target={targetLevel} />
                            <ExerciseLauncher onOpen={handleOpenExercise} />
                        </BotMessage>
                    )}

                    {/* Exercise results */}
                    {results.map((r, i) => (
                        <div key={i} className="space-y-4">
                            <UserBubble text={`Đã nộp bài: ${r.exercise.label}`} />
                            <BotMessage>
                                <ResultCard data={r} />
                                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Tiếp tục luyện tập:</p>
                                    <ExerciseLauncher onOpen={handleOpenExercise} />
                                </div>
                            </BotMessage>

                            {/* Prompt to check Assessment page */}
                            <BotMessage>
                                <div className="flex items-center gap-3 py-1">
                                    <span className="material-symbols-outlined text-primary text-[22px]">monitoring</span>
                                    <div>
                                        <p className="text-sm font-semibold">Biểu đồ kỹ năng đã được cập nhật!</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                            Xem biểu đồ radar và AI gợi ý chi tiết tại trang <strong>Đánh giá Năng lực</strong>.
                                        </p>
                                    </div>
                                </div>
                            </BotMessage>
                        </div>
                    ))}

                    <div ref={bottomRef} />
                </div>
            </div>

            {/* Right sidebar */}
            <aside className="hidden lg:flex w-80 flex-shrink-0 flex-col bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-700 p-5 gap-5 overflow-y-auto">
                <ExamStructure />
                <ScaleBar />
            </aside>
        </div>
    )
}
