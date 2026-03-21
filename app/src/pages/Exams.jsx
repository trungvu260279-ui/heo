import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import examsData from '../data/exams.json'
import { motion, AnimatePresence } from 'framer-motion'
import RadarChart from '../components/RadarChart'
import { addEvaluation, saveExamHistoryDetail, getAllExamHistoryDetails } from '../hooks/useEvalStore'
import { getAuthUser } from '../hooks/useAuth'

const LOCAL_API_KEYS_TEXT = import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || ''
const LOCAL_API_KEYS = LOCAL_API_KEYS_TEXT.split(',').map(k => k.trim()).filter(Boolean)
const LOCAL_MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

// ─── Downloader (Word) ────────────────────────────────────────────────────────
async function downloadExamFile(exam) {
    if (!exam) return;
    try {
        const res = await fetch('/api/export-docx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: `
                    <h1 style="text-align: center;">KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG</h1>
                    <h2 style="text-align: center;">Bài thi: NGỮ VĂN</h2>
                    <h3 style="text-align: center;">Đề thi: ${exam.title}</h3>
                    <hr/>
                    <div style="white-space: pre-wrap; line-height: 1.6;">
                        ${normalizeVN(exam.sections.full_text)}
                    </div>
                `,
                filename: `${exam.title.replace(/\s+/g, '_')}.docx`
            })
        });

        if (!res.ok) throw new Error('Download failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exam.title.replace(/\s+/g, '_')}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download error:", e);
        alert("Có lỗi xảy ra khi tải đề thi. Vui lòng thử lại sau.");
    }
}

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
function ExamCard({ exam, active, onClick, bestScore }) {
    return (
        <motion.button
            layout
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            onClick={onClick}
            className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 group relative
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

            {bestScore !== null && (
                <div className={clsx(
                    "absolute top-3 right-3 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider",
                    active ? "bg-white/20 text-white" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
                )}>
                    {bestScore.toFixed(1)}
                </div>
            )}
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

// ─── Ranking Dashboard ──────────────────────────────────────────────────────────
function RankingDashboard() {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterGrade, setFilterGrade] = useState('');
    const user = getAuthUser();

    useEffect(() => {
        fetchRankings();
    }, [filterGrade]);

    const fetchRankings = async () => {
        setLoading(true);
        try {
            const url = filterGrade ? `/api/rankings?grade=${filterGrade}` : '/api/rankings';
            const res = await fetch(url);
            const data = await res.json();
            setRankings(data);
        } catch (e) {
            console.error("Failed to fetch rankings", e);
        } finally {
            setLoading(false);
        }
    };

    const schoolAverage = rankings.length > 0
        ? rankings.reduce((acc, curr) => acc + (curr.averageScore || 0), 0) / rankings.length
        : 0;

    const isDashboardLocked = schoolAverage < 6;

    return (
        <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase italic tracking-tight">BẢNG XẾP HẠNG NGỮ VĂN</h2>
                    <p className="text-slate-500 text-sm font-medium">THPT Kim Xuyên · Cập nhật tự động từ AI chấm điểm</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 self-start">
                    {['', '10', '11', '12'].map(g => (
                        <button
                            key={g}
                            onClick={() => setFilterGrade(g)}
                            className={clsx(
                                "px-5 py-2 rounded-xl text-xs font-black transition-all",
                                filterGrade === g
                                    ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-md ring-1 ring-black/5"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                        >
                            {g ? `KHỐI ${g}` : "TẤT CẢ"}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="size-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Đang tải bảng xếp hạng...</p>
                </div>
            ) : isDashboardLocked ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl">
                    <div className="size-20 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-amber-500">lock</span>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Bảng Xếp Hạng Đang Khóa</h3>
                        <p className="text-slate-500 text-sm max-w-md">
                            Bảng vinh danh chỉ hiển thị khi điểm trung bình tổng toàn trường đạt từ <strong>6.0</strong> trở lên.
                            Hãy cùng nhau nỗ lực học tập nhé!
                        </p>
                    </div>
                    <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-sm font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        Điểm trung bình hiện tại: <span className="text-indigo-600 dark:text-indigo-400">{schoolAverage.toFixed(2)}</span>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">#</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Học sinh</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Khối</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Số bài làm</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Điểm TB</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rankings.map((rk, idx) => (
                                    <tr
                                        key={idx}
                                        className={clsx(
                                            "group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                                            rk.name === user?.name && "bg-indigo-50/30 dark:bg-indigo-900/10"
                                        )}
                                    >
                                        <td className="px-6 py-5">
                                            <div className={clsx(
                                                "size-8 rounded-lg flex items-center justify-center font-black text-sm",
                                                idx === 0 ? "bg-amber-400 text-amber-900 shadow-lg shadow-amber-400/30" :
                                                    idx === 1 ? "bg-slate-300 text-slate-700 shadow-lg shadow-slate-300/30" :
                                                        idx === 2 ? "bg-orange-300 text-orange-900 shadow-lg shadow-orange-300/30" :
                                                            "text-slate-400"
                                            )}>
                                                {idx + 1}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
                                                    {rk.name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white text-sm">{rk.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{rk.school}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px]">
                                                {rk.grade}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center font-bold text-slate-400 text-sm tabular-nums">
                                            {rk.totalExams || 0}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                                {rk.averageScore?.toFixed(2) || "0.00"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Result Dashboard ────────────────────────────────────────────────────────
function ResultDashboard({ result, onBack, examTitle, answers, examData }) {
    const navigate = useNavigate();
    const { skills, overall, suggestions, commonErrors, comment, archiveId } = result;
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
                                    examData: examData,
                                    archiveId: archiveId
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

// ─── Room Modal (Tạo / Tham gia phòng thi) ───────────────────────────────────
function ExamRoomModal({ onClose, onJoin, examsData }) {
    const [tab, setTab] = useState('join')            // 'join' | 'create'
    const [code, setCode] = useState('')              // input khi join
    const [selectedExamId, setSelectedExamId] = useState(examsData[0]?.id || '')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    // Sau khi tạo phòng thành công, hiện màn share link
    const [createdRoom, setCreatedRoom] = useState(null)  // { roomCode, examId, link }
    const [copied, setCopied] = useState(false)
    const user = getAuthUser()

    function genCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let c = 'VAN-'
        for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)]
        return c
    }

    // Trích xuất mã phòng từ link hoặc chuỗi thô
    function extractCode(raw) {
        const s = raw.trim()
        // Nếu là URL, lấy query ?room=XXX hoặc path cuối /XXX
        try {
            const url = new URL(s)
            const roomParam = url.searchParams.get('room')
            if (roomParam) return roomParam.toUpperCase()
            // pathname cuối
            const parts = url.pathname.split('/').filter(Boolean)
            if (parts.length) return parts[parts.length - 1].toUpperCase()
        } catch { /* không phải URL, dùng thẳng */ }
        return s.toUpperCase()
    }

    function buildLink(roomCode) {
        return `${window.location.origin}/exams?room=${roomCode}`
    }

    async function handleCreate() {
        setLoading(true); setError('')
        const roomCode = genCode()
        try {
            await fetch('/api/room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomCode,
                    examId: selectedExamId,
                    createdBy: user?.name || 'Unknown',
                    createdAt: new Date().toISOString()
                })
            })
            setCreatedRoom({ roomCode, examId: selectedExamId, link: buildLink(roomCode) })
        } catch {
            setError('Không thể tạo phòng. Thử lại nhé.')
        } finally { setLoading(false) }
    }

    function handleCopyLink() {
        if (!createdRoom) return
        navigator.clipboard.writeText(createdRoom.link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    async function handleJoin() {
        const extracted = extractCode(code)
        if (!extracted) { setError('Nhập mã phòng hoặc dán link vào đây.'); return }
        setLoading(true); setError('')
        try {
            const res = await fetch(`/api/room/${extracted}`)
            if (!res.ok) throw new Error('not found')
            const room = await res.json()
            onJoin(room.roomCode, room.examId)
        } catch {
            setError('Mã phòng không tồn tại hoặc link không hợp lệ.')
        } finally { setLoading(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Phòng Thi</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {createdRoom ? 'Phòng đã tạo — chia sẻ link cho học sinh' : 'Tạo hoặc tham gia phòng thi có mã'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* ── Màn hình SHARE LINK sau khi tạo phòng ── */}
                {createdRoom ? (
                    <div className="px-6 pb-6 space-y-5">
                        {/* Room code display */}
                        <div className="flex flex-col items-center gap-2 py-5 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Mã phòng thi</p>
                            <p className="text-4xl font-black tracking-[0.2em] text-indigo-700 dark:text-indigo-300 font-mono">
                                {createdRoom.roomCode}
                            </p>
                            <p className="text-[10px] text-slate-400">Học sinh dùng mã này hoặc link bên dưới</p>
                        </div>

                        {/* Link to copy */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Link tham gia</p>
                            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">link</span>
                                <p className="flex-1 text-xs text-slate-600 dark:text-slate-300 font-mono truncate">
                                    {createdRoom.link}
                                </p>
                            </div>
                            <button
                                onClick={handleCopyLink}
                                className={`w-full py-3 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                                    copied
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">
                                    {copied ? 'check_circle' : 'content_copy'}
                                </span>
                                {copied ? 'Đã copy link!' : 'Copy link chia sẻ'}
                            </button>
                        </div>

                        {/* Enter as creator */}
                        <button
                            onClick={() => onJoin(createdRoom.roomCode, createdRoom.examId)}
                            className="w-full py-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-black text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">play_circle</span>
                            Vào phòng và bắt đầu làm bài
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="flex mx-6 mb-5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                            {[['join', 'Nhập mã / Link'], ['create', 'Tạo phòng mới']].map(([key, label]) => (
                                <button key={key} onClick={() => { setTab(key); setError('') }}
                                    className={clsx(
                                        'flex-1 py-2 rounded-xl text-xs font-black transition-all',
                                        tab === key
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                    )}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        <div className="px-6 pb-6 space-y-4">
                            {tab === 'join' ? (
                                <>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                                            Mã phòng hoặc link tham gia
                                        </label>
                                        <textarea
                                            value={code}
                                            onChange={e => setCode(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleJoin())}
                                            placeholder={"Dán link vào đây\nVD: https://app.../exams?room=VAN-4X2K\nhoặc nhập thẳng mã: VAN-4X2K"}
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition-all placeholder:font-sans placeholder:text-xs placeholder:tracking-normal placeholder:text-slate-400 resize-none"
                                        />
                                    </div>
                                    {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                                    <button onClick={handleJoin} disabled={loading}
                                        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40">
                                        {loading
                                            ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang kiểm tra...</>
                                            : <><span className="material-symbols-outlined text-[18px]">login</span> Vào phòng thi</>
                                        }
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Chọn đề thi</label>
                                        <select
                                            value={selectedExamId}
                                            onChange={e => setSelectedExamId(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                                        >
                                            {examsData.map(ex => (
                                                <option key={ex.id} value={ex.id}>{ex.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50">
                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                                            💡 Sau khi tạo, bạn sẽ nhận link để chia sẻ cho học sinh.
                                        </p>
                                    </div>
                                    {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                                    <button onClick={handleCreate} disabled={loading}
                                        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40">
                                        {loading
                                            ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang tạo...</>
                                            : <><span className="material-symbols-outlined text-[18px]">add_circle</span> Tạo phòng thi</>
                                        }
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    )
}

// ─── Room Ranking Modal (Popup BXH sau khi nộp bài) ──────────────────────────
const AVA_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']

function ScoreCounter({ target }) {
    const [displayed, setDisplayed] = useState(0)
    useEffect(() => {
        let n = 0; const steps = 18
        const iv = setInterval(() => {
            n++
            setDisplayed(parseFloat((target * n / steps).toFixed(1)))
            if (n >= steps) { setDisplayed(target); clearInterval(iv) }
        }, 28)
        return () => clearInterval(iv)
    }, [target])
    return <>{displayed.toFixed(1)}</>
}

function RoomRankingModal({ roomCode, currentUser, onClose, onContinue }) {
    const [rankings, setRankings] = useState([])
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        fetch(`/api/room/${roomCode}/ranking`)
            .then(r => r.json())
            .then(data => setRankings(Array.isArray(data) ? data : []))
            .catch(() => setRankings([]))
            .finally(() => setLoading(false))
    }, [roomCode])

    function copyCode() {
        const link = `${window.location.origin}/exams?room=${roomCode}`
        navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const myIdx = rankings.findIndex(r => r.name === currentUser?.name)
    const myRank = myIdx + 1

    function scoreClass(v) {
        return v >= 8 ? '#d97706' : v >= 6.5 ? '#4f46e5' : v >= 5 ? '#059669' : '#dc2626'
    }

    function rankBadge(i) {
        if (i === 0) return <span style={{fontSize:22}}>🥇</span>
        if (i === 1) return <span style={{fontSize:22}}>🥈</span>
        if (i === 2) return <span style={{fontSize:22}}>🥉</span>
        return (
            <div style={{
                width:28,height:28,borderRadius:8,background:'#f1f5f9',border:'1px solid #e2e8f0',
                fontSize:12,fontWeight:700,color:'#94a3b8',
                display:'flex',alignItems:'center',justifyContent:'center'
            }}>{i+1}</div>
        )
    }

    return (
        <div style={{
            position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',
            justifyContent:'center',padding:16,background:'rgba(0,0,0,.6)',backdropFilter:'blur(6px)'
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ type: 'spring', bounce: 0.28 }}
                style={{
                    width:'100%',maxWidth:540,
                    background:'#fff',borderRadius:24,border:'1px solid #e4e9f5',
                    boxShadow:'0 4px 40px rgba(99,120,220,.16)',overflow:'hidden',
                    fontFamily:"'Outfit', 'Inter', sans-serif"
                }}
            >
                {/* ── Header ── */}
                <div style={{
                    padding:'24px 28px 20px',
                    background:'linear-gradient(135deg,#eef2ff 0%,#f5f0ff 100%)',
                    borderBottom:'1px solid #e8ecf8',
                    display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12
                }}>
                    <div>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:'.14em',color:'#818cf8',textTransform:'uppercase',marginBottom:5}}>
                            Phòng thi · Kết quả
                        </div>
                        <div style={{fontSize:26,fontWeight:900,color:'#1e1b4b',letterSpacing:'-.01em',lineHeight:1}}>
                            Bảng xếp hạng
                        </div>
                        {myRank > 0 && (
                            <div style={{marginTop:6,fontSize:13,color:'#64748b',fontWeight:500}}>
                                Bạn xếp hạng <b style={{color:'#4f46e5',fontWeight:700}}>#{myRank}</b> trong phòng này
                            </div>
                        )}
                        {/* Code chip */}
                        <div
                            onClick={copyCode}
                            style={{
                                marginTop:14,display:'inline-flex',alignItems:'center',gap:8,
                                background: copied ? '#f0fdf4' : '#fff',
                                border: copied ? '1.5px solid #86efac' : '1.5px solid #c7d2fe',
                                borderRadius:10,padding:'7px 14px',cursor:'pointer',transition:'.15s',userSelect:'none'
                            }}
                        >
                            <span style={{fontSize:13,color: copied ? '#4ade80' : '#a5b4fc'}}>⊞</span>
                            <span style={{
                                fontFamily:'monospace',fontSize:15,fontWeight:800,
                                letterSpacing:'.18em',color: copied ? '#16a34a' : '#4f46e5'
                            }}>
                                {copied ? 'Đã copy link!' : roomCode}
                            </span>
                            <span style={{fontSize:13,color: copied ? '#4ade80' : '#a5b4fc'}}>
                                {copied ? '✓' : '⎘'}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        width:32,height:32,borderRadius:10,flexShrink:0,
                        background:'#fff',border:'1px solid #e2e8f0',
                        color:'#94a3b8',cursor:'pointer',fontSize:16,
                        display:'flex',alignItems:'center',justifyContent:'center'
                    }}>✕</button>
                </div>

                {/* ── Column headers ── */}
                <div style={{
                    display:'grid',gridTemplateColumns:'48px 1fr 72px',gap:'0 12px',
                    padding:'10px 28px 8px',borderBottom:'1px solid #f1f5f9'
                }}>
                    {['Hạng','Học sinh','Điểm'].map((h,i) => (
                        <div key={h} style={{
                            fontSize:10,fontWeight:700,letterSpacing:'.12em',
                            color:'#94a3b8',textTransform:'uppercase',
                            textAlign: i === 2 ? 'right' : 'left'
                        }}>{h}</div>
                    ))}
                </div>

                {/* ── List ── */}
                <div style={{maxHeight:300,overflowY:'auto'}}>
                    {loading ? (
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'64px 0',gap:12}}>
                            <div style={{width:40,height:40,border:'4px solid #e0e7ff',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin 1s linear infinite'}} />
                            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                            <p style={{fontSize:11,fontWeight:700,color:'#94a3b8',letterSpacing:'.12em',textTransform:'uppercase'}}>Đang tải...</p>
                        </div>
                    ) : rankings.length === 0 ? (
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'64px 0',gap:8,textAlign:'center'}}>
                            <span style={{fontSize:40}}>🏁</span>
                            <p style={{fontWeight:700,color:'#334155'}}>Bạn là người đầu tiên!</p>
                            <p style={{fontSize:12,color:'#94a3b8'}}>Share mã phòng để bạn bè cùng thi nào.</p>
                        </div>
                    ) : rankings.map((rk, idx) => {
                        const isMe = rk.name === currentUser?.name
                        const timeStr = rk.submittedAt
                            ? new Date(rk.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                            : ''
                        return (
                            <motion.div
                                key={rk.name}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.06 }}
                                style={{
                                    display:'grid',gridTemplateColumns:'48px 1fr 72px',
                                    alignItems:'center',gap:'0 12px',
                                    padding:'13px 28px',
                                    borderBottom: idx < rankings.length - 1 ? '1px solid #f8fafc' : 'none',
                                    background: isMe ? '#f5f3ff' : 'transparent',
                                    position:'relative',
                                }}
                            >
                                {isMe && <div style={{position:'absolute',left:0,top:0,bottom:0,width:3,background:'#6366f1',borderRadius:'0 2px 2px 0'}} />}

                                {/* Rank */}
                                <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                                    {rankBadge(idx)}
                                </div>

                                {/* Person */}
                                <div style={{display:'flex',alignItems:'center',gap:11,minWidth:0}}>
                                    <div style={{
                                        width:38,height:38,borderRadius:'50%',flexShrink:0,
                                        display:'flex',alignItems:'center',justifyContent:'center',
                                        fontSize:14,fontWeight:800,color:'#fff',
                                        background: AVA_COLORS[idx % AVA_COLORS.length],
                                        border: isMe ? '2px solid #a5b4fc' : '2px solid rgba(255,255,255,.6)',
                                        boxShadow: isMe ? '0 0 0 3px #c7d2fe' : 'none'
                                    }}>
                                        {(rk.name?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div style={{minWidth:0,flex:1}}>
                                        <div style={{
                                            fontSize:14,fontWeight:700,
                                            color: isMe ? '#4338ca' : '#1e293b',
                                            whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
                                            display:'flex',alignItems:'center',gap:6,lineHeight:1.2
                                        }}>
                                            {rk.name}
                                            {isMe && <span style={{
                                                fontSize:9,fontWeight:800,letterSpacing:'.08em',
                                                background:'#ede9fe',color:'#6d28d9',
                                                borderRadius:4,padding:'1px 6px',textTransform:'uppercase'
                                            }}>Bạn</span>}
                                        </div>
                                        {timeStr && <div style={{fontSize:11,color:'#94a3b8',fontWeight:500,marginTop:2}}>{timeStr}</div>}
                                    </div>
                                </div>

                                {/* Score */}
                                <div style={{textAlign:'right'}}>
                                    <div style={{
                                        fontSize:26,fontWeight:900,lineHeight:1,
                                        letterSpacing:'-.01em',color: scoreClass(rk.score)
                                    }}>
                                        <ScoreCounter target={rk.score || 0} />
                                    </div>
                                    <div style={{fontSize:10,fontWeight:600,color:'#cbd5e1',marginTop:1}}>/ 10.0</div>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>

                {/* ── Footer ── */}
                <div style={{
                    display:'flex',gap:10,padding:'16px 28px',
                    borderTop:'1px solid #f1f5f9',background:'#fafbff'
                }}>
                    <button onClick={onClose} style={{
                        flex:1,padding:'13px 0',borderRadius:12,
                        fontSize:13,fontWeight:700,cursor:'pointer',transition:'.15s',
                        background:'#fff',border:'1.5px solid #e2e8f0',color:'#64748b'
                    }}>Đóng</button>
                    <button onClick={onContinue} style={{
                        flex:1,padding:'13px 0',borderRadius:12,
                        fontSize:14,fontWeight:700,cursor:'pointer',transition:'.15s',
                        background:'#4f46e5',color:'#fff',border:'none',
                        boxShadow:'0 4px 14px rgba(79,70,229,.25)'
                    }}>✦ Phân tích AI chuyên sâu</button>
                </div>
            </motion.div>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Exams() {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedExam, setSelectedExam] = useState(null)
    const [showRankings, setShowRankings] = useState(false)
    const [isTakingExam, setIsTakingExam] = useState(false)
    const [answers, setAnswers] = useState({})
    const [history, setHistory] = useState([])
    const [showRoomModal, setShowRoomModal] = useState(false)
    const [activeRoomCode, setActiveRoomCode] = useState(null)      // mã phòng đang thi
    const [showRoomRanking, setShowRoomRanking] = useState(false)   // popup BXH

    const [searchParams, setSearchParams] = useSearchParams()

    useEffect(() => {
        refreshHistory();
    }, []);

    // Auto-join room nếu URL có ?room=XXX
    useEffect(() => {
        const roomParamCode = searchParams.get('room')
        if (!roomParamCode) return

        // Xoá param khỏi URL ngay để tránh re-trigger
        setSearchParams({}, { replace: true })

        // Fetch thông tin phòng rồi tự động join
        fetch(`/api/room/${roomParamCode.toUpperCase()}`)
            .then(r => {
                if (!r.ok) throw new Error('not found')
                return r.json()
            })
            .then(room => {
                handleJoinRoom(room.roomCode, room.examId)
            })
            .catch(() => {
                // Phòng không tồn tại → mở modal với mã đã điền sẵn
                setShowRoomModal(true)
            })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshHistory = async () => {
        const h = await getAllExamHistoryDetails();
        setHistory(h || []);
    };
    const [hints, setHints] = useState({})
    const [materialAnalysis, setMaterialAnalysis] = useState(null)
    const [gradingResult, setGradingResult] = useState(null)
    const [loadingHintFor, setLoadingHintFor] = useState(null)
    const [loadingAnalysis, setLoadingAnalysis] = useState(false)
    const [isGrading, setIsGrading] = useState(false)
    const [submitDone, setSubmitDone] = useState(false)
    const mainRef = useRef(null)

    // Anti-Copy, Anti-Paste, Anti-RightClick logic for Exam Security
    useEffect(() => {
        if (!isTakingExam) return;

        const handleSecurity = (e) => {
            e.preventDefault();
        };

        window.addEventListener('copy', handleSecurity);
        window.addEventListener('cut', handleSecurity);
        window.addEventListener('paste', handleSecurity);
        window.addEventListener('contextmenu', handleSecurity);

        return () => {
            window.removeEventListener('copy', handleSecurity);
            window.removeEventListener('cut', handleSecurity);
            window.removeEventListener('paste', handleSecurity);
            window.removeEventListener('contextmenu', handleSecurity);
        };
    }, [isTakingExam]);

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
            if (activeRoomCode) {
                setTimeout(() => setShowRoomRanking(true), 800) // delay 800ms để animation kết quả xong
            }

            // Session-based Archiving for Chat Synchronization (Token Saving & Automatic Deletion)
            let archiveId = null;
            try {
                archiveId = 'VANS-' + Math.random().toString(36).substring(2, 6).toUpperCase();
                const archiveData = {
                    title: selectedExam.title,
                    result: result,
                    answers: answers,
                    examData: selectedExam
                };

                // Save to sessionStorage (Temporary, auto-deletes when tab closes)
                sessionStorage.setItem(archiveId, JSON.stringify(archiveData));

                setGradingResult(prev => ({ ...prev, archiveId }));
                console.log("[Exams] Session archive created:", archiveId);
            } catch (e) {
                console.warn("Failed to create session archive", e);
            }

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

            // --- SYNC SCORE TO BACKEND (Optimized: Best Score Only & >= 5.0) ---
            const user = getAuthUser();
            if (user && user.studentId && result.overall >= 5) {
                // 1. Update Personal Progress (DB User)
                const examHistory = history.filter(h => h.examId === selectedExam.id);
                const prevBest = examHistory.length > 0 ? Math.max(...examHistory.map(h => h.score || 0)) : 0;

                if (result.overall > prevBest) {
                    try {
                        // Sync to MongoDB
                        await fetch('/api/user/sync-score', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                studentId: user.studentId,
                                studentName: user.name,
                                examId: selectedExam.id,
                                examTitle: selectedExam.title,
                                score: result.overall,
                                school: user.school,
                                grade: user.grade,
                                timestamp: Date.now()
                            })
                        });

                        // 2. Sync to Ranking (rankings.json / api/sheet)
                        await fetch('/api/sheet', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: user.email,
                                name: user.name,
                                role: 'student',
                                score: result.overall,
                                exercise: selectedExam.title,
                                date: new Date().toISOString()
                            })
                        });

                        console.log("New best score! Database and Ranking synchronized.");
                    } catch (e) {
                        console.warn("Failed to sync score to backend", e);
                    }
                } else {
                    console.log("Not a new best score for this paper. Skipping DB sync to avoid data overload.");
                }
            } else if (result.overall < 5) {
                console.log("Score below 5.0, skipping database sync.");
            }

            // Sync score vào room ranking nếu đang trong phòng thi
            if (activeRoomCode) {
                try {
                    await fetch(`/api/room/${activeRoomCode}/score`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: user?.name || 'Ẩn danh',
                            email: user?.email || '',
                            score: result.overall,
                            submittedAt: new Date().toISOString()
                        })
                    })
                } catch (e) {
                    console.warn('Room score sync failed', e)
                }
            }

            // Refresh history to update sidebar score
            await refreshHistory();
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

    function handleJoinRoom(roomCode, examId) {
        const exam = examsData.find(e => e.id === examId)
        if (!exam) return
        setActiveRoomCode(roomCode)
        setShowRoomModal(false)
        handleSelectExam(exam)
        // Delay nhỏ để state settle rồi mới startExam
        setTimeout(() => {
            setAnswers({})
            setHints({})
            setMaterialAnalysis(null)
            setGradingResult(null)
            setSubmitDone(false)
            setIsTakingExam(true)
        }, 50)
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">

            {/* ── Header ── */}
            <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 md:top-0 z-20 shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                    {(isTakingExam || selectedExam) && (
                        <button
                            onClick={() => {
                                if (isTakingExam) {
                                    setIsTakingExam(false);
                                    setSubmitDone(false);
                                } else {
                                    setSelectedExam(null);
                                }
                            }}
                            className="p-1.5 md:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </button>
                    )}
                    <div className="min-w-0">
                        <h2 className="text-base md:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate">
                            <span className="material-symbols-outlined text-indigo-500 text-[20px] md:text-[22px] shrink-0">
                                {isTakingExam ? 'edit_square' : (showRankings ? 'workspace_premium' : 'library_books')}
                            </span>
                            {isTakingExam ? 'Đang làm bài' : (showRankings ? 'Bảng Xếp Hạng Ngữ Văn' : 'Thư viện Đề thi')}
                        </h2>
                        {!isTakingExam && (
                            <p className="text-[10px] md:text-xs text-slate-400 truncate">
                                {showRankings ? 'Cập nhật tự động từ AI chấm điểm' : 'Học tập & luyện tập trực tiếp'}
                            </p>
                        )}
                    </div>
                </div>

                {!isTakingExam && !selectedExam && (
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={() => setShowRoomModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ring-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700 hover:ring-indigo-500"
                        >
                            <span className="material-symbols-outlined text-[18px]">meeting_room</span>
                            <span className="hidden sm:inline">Phòng thi</span>
                            {activeRoomCode && (
                                <span className="font-mono text-indigo-500 text-[10px]">{activeRoomCode}</span>
                            )}
                        </button>

                        <button
                            onClick={() => setShowRankings(!showRankings)}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ring-1",
                                showRankings
                                    ? "bg-indigo-600 text-white ring-indigo-500 shadow-lg shadow-indigo-500/20"
                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700 hover:ring-indigo-500"
                            )}
                        >
                            <span className="material-symbols-outlined text-[18px]">
                                {showRankings ? 'list_alt' : 'workspace_premium'}
                            </span>
                            <span className="hidden sm:inline">{showRankings ? 'Quay lại Đề thi' : 'Xếp hạng'}</span>
                        </button>
                        <div className="relative w-40 sm:w-80">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">search</span>
                            <input
                                type="text"
                                placeholder="Tìm kiếm..."
                                className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-lg text-xs md:text-sm
                                    focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700 outline-none transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </header>

            <div className="flex-1 flex overflow-hidden">

                {/* ── Sidebar ── */}
                {!isTakingExam && !showRankings && (
                    <aside className={clsx(
                        "w-full md:w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-4 space-y-2 bg-slate-50/60 dark:bg-slate-950 transition-all",
                        selectedExam ? "hidden md:block" : "block"
                    )}>
                        {filteredExams.length === 0
                            ? <p className="text-center text-sm text-slate-400 pt-10">Không tìm thấy đề nào.</p>
                            : filteredExams.map(ex => {
                                const examScores = history.filter(h => h.examId === ex.id).map(h => h.score || 0);
                                const bestScore = examScores.length > 0 ? Math.max(...examScores) : null;
                                return (
                                    <ExamCard
                                        key={ex.id}
                                        exam={ex}
                                        bestScore={bestScore}
                                        active={selectedExam?.id === ex.id}
                                        onClick={() => handleSelectExam(ex)}
                                    />
                                );
                            })
                        }
                    </aside>
                )}

                {/* ── Main Panel ── */}
                <main ref={mainRef} className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
                    <AnimatePresence mode="wait">
                        {showRankings ? (
                            <motion.div
                                key="rankings"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex-1"
                            >
                                <RankingDashboard />
                            </motion.div>
                        ) : !selectedExam ? (
                            <EmptyState key="empty" />
                        ) : isTakingExam ? (
                            /* ══ EXAM MODE ══════════════════════════════════════════ */
                            <motion.div
                                key="exam"
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -30, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="p-4 md:p-10 max-w-3xl mx-auto pb-20 space-y-6 md:space-y-10"
                            >
                                {/* Title */}
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Đang làm bài</p>
                                    <h1 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                                        {selectedExam.title}
                                    </h1>
                                </div>

                                <section className="space-y-6 md:space-y-8">
                                    {/* Reading passage */}
                                    <div className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 dark:bg-indigo-950/20 blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-indigo-100/50" />

                                        <div className="flex items-center justify-between mb-6 relative z-10">
                                            <div className="flex items-center gap-2">
                                                <span className="w-1 h-3 md:w-1.5 md:h-4 rounded-full bg-indigo-500 inline-block shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                                <h3 className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-indigo-500">
                                                    Phần Đọc hiểu — Ngữ liệu
                                                </h3>
                                            </div>
                                            <button
                                                onClick={analyzeMaterial}
                                                disabled={loadingAnalysis}
                                                className="flex items-center gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all border border-indigo-100 dark:border-indigo-800/50 disabled:opacity-50"
                                            >
                                                <span className="material-symbols-outlined text-sm md:text-[16px]">
                                                    {loadingAnalysis ? 'sync' : 'psychology'}
                                                </span>
                                                {loadingAnalysis ? 'Đang nghĩ...' : 'Phân tích sâu'}
                                            </button>
                                        </div>

                                        <div className="text-[13px] md:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-[1.8] md:leading-[2] font-serif relative z-10 bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-6 rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-800/50">
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
                                className="p-4 md:p-10 max-w-4xl mx-auto pb-16 space-y-6"
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
                                            onClick={() => downloadExamFile(selectedExam)}
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

        {/* Room Modal */}
        <AnimatePresence>
            {showRoomModal && (
                <ExamRoomModal
                    examsData={examsData}
                    onClose={() => setShowRoomModal(false)}
                    onJoin={handleJoinRoom}
                />
            )}
        </AnimatePresence>

        {/* Room Ranking Popup */}
        <AnimatePresence>
            {showRoomRanking && activeRoomCode && (
                <RoomRankingModal
                    roomCode={activeRoomCode}
                    currentUser={getAuthUser()}
                    onClose={() => setShowRoomRanking(false)}
                    onContinue={() => {
                        setShowRoomRanking(false)
                    }}
                />
            )}
        </AnimatePresence>
    </div>
    )
}