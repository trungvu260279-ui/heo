import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import RadarChart from '../components/RadarChart'
import ProgressChart from '../components/ProgressChart'
import { readStore, getAllExamHistoryDetails } from '../hooks/useEvalStore'
import { motion, AnimatePresence } from 'framer-motion'
import dayjs from 'dayjs'

const DEFAULT_SKILLS = [
    { label: 'Ngôn ngữ', value: 0 },
    { label: 'Tư duy PB', value: 0 },
    { label: 'Cấu trúc', value: 0 },
    { label: 'Diễn đạt', value: 0 },
]

function classifyXepLoai(avg) {
    if (avg >= 8) return { label: 'Giỏi', color: 'text-amber-500' }
    if (avg >= 7) return { label: 'Khá', color: 'text-blue-500' }
    if (avg >= 5) return { label: 'Trung bình', color: 'text-emerald-500' }
    return { label: 'Cần cố gắng', color: 'text-red-500' }
}

export default function Assessment() {
    const [store, setStore] = useState(() => readStore())
    const navigate = useNavigate()

    // Listen for updates from Assistant (exercise submissions)
    useEffect(() => {
        function onUpdate() { setStore(readStore()) }
        window.addEventListener('van_eval_update', onUpdate)
        return () => window.removeEventListener('van_eval_update', onUpdate)
    }, [])

    const [detailedHistory, setDetailedHistory] = useState([])
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null)

    useEffect(() => {
        if (store.hasData) {
            getAllExamHistoryDetails().then(data => {
                setDetailedHistory(data)
            })
        }
    }, [store])

    const hasData = store.hasData
    const skills = hasData ? store.skills : DEFAULT_SKILLS
    const avg = hasData ? parseFloat((skills.reduce((s, k) => s + k.value, 0) / skills.length).toFixed(1)) : 0
    const xepLoai = classifyXepLoai(avg)
    const history = store.history || []

    return (
        <div className="h-full overflow-y-auto">
            {/* Header */}
            <header className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">Đánh giá Năng lực Ngữ văn</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                        {hasData
                            ? `Dựa trên ${history.length} bài luyện tập đã nộp`
                            : 'Hoàn thành bài luyện tập để xem biểu đồ kỹ năng'}
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                    bg-accent/10 dark:bg-accent/20 text-accent border border-accent/20">
                    <span className="material-symbols-outlined text-[16px]">
                        {hasData ? 'trending_up' : 'query_stats'}
                    </span>
                    {hasData ? `Điểm TB: ${avg}` : 'Chưa có dữ liệu'}
                </div>
            </header>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-[1400px] mx-auto w-full">

                {/* Left: Radar chart & Progress chart */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 overflow-hidden">
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Radar Chart section */}
                            <div className="flex-1">
                                <div className="mb-6">
                                    <h3 className="text-slate-900 dark:text-white text-lg font-bold flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[20px]">radar</span>
                                        Biểu đồ Kỹ năng Tổng quát
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">Phân bổ đều 4 tiêu chí Ngữ văn</p>
                                </div>

                                {hasData ? (
                                    <div className="relative w-full max-w-[240px] mx-auto flex items-center justify-center my-4">
                                        <RadarChart skills={skills} size={240} color="#0D9488" animated />
                                    </div>
                                ) : (
                                    <div className="relative w-full max-w-[200px] mx-auto opacity-20 my-4">
                                        <RadarChart skills={DEFAULT_SKILLS.map(s => ({ ...s, value: 5 }))} size={200} color="#94a3b8" />
                                    </div>
                                )}
                            </div>

                            {/* Progress Chart section */}
                            <div className="flex-1 flex flex-col border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-6 md:pt-0 md:pl-8">
                                <div className="mb-4">
                                    <h3 className="text-slate-900 dark:text-white text-lg font-bold flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[20px]">trending_up</span>
                                        Tiến độ Phát triển
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs text-wrap max-w-[200px]">Mức độ cải thiện điểm qua từng bài</p>
                                </div>

                                {hasData ? (
                                    <ProgressChart history={history} />
                                ) : (
                                    <div className="flex-1 flex items-center justify-center min-h-[160px] text-slate-300 dark:text-slate-700">
                                        <div className="text-center">
                                            <span className="material-symbols-outlined text-4xl mb-2">chart_data</span>
                                            <p className="text-xs">Chưa có dữ liệu tiến độ</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {hasData && (
                            <>
                                {/* Stats row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                                    {[
                                        { val: avg.toFixed(1), label: 'Điểm trung bình', color: 'text-slate-900 dark:text-white' },
                                        { val: xepLoai.label, label: 'Xếp loại', color: xepLoai.color },
                                        { val: `${history.length}`, label: 'Bài đã làm', color: 'text-slate-900 dark:text-white' },
                                        { val: `${Math.max(...skills.map(s => s.value)).toFixed(1)}`, label: 'Kỹ năng cao nhất', color: 'text-emerald-600' },
                                    ].map(s => (
                                        <div key={s.label} className="flex flex-col items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
                                            <p className={`text-2xl font-black tracking-tight ${s.color}`}>{s.val}</p>
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mt-1 text-center">{s.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Skill bars grid */}
                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 pt-6 border-t border-slate-50 dark:border-slate-800/50">
                                    {skills.map(sk => (
                                        <div key={sk.label} className="flex items-center gap-4">
                                            <div className="w-full">
                                                <div className="flex justify-between items-center mb-1.5 px-0.5">
                                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{sk.label}</span>
                                                    <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">{sk.value.toFixed(1)}</span>
                                                </div>
                                                <div className="h-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-full border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(13,148,136,0.3)]"
                                                        style={{ width: `${sk.value * 10}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {!hasData && (
                            /* Empty state details */
                            <div className="flex flex-col items-center justify-center py-8 text-center mt-4 border-t border-slate-50 dark:border-slate-800/50">
                                <p className="text-slate-400 dark:text-slate-500 text-xs leading-relaxed italic">
                                    "Học không biết chán, dạy không biết mệt."<br />
                                    Hãy hoàn thành bài luyện tập để bắt đầu theo dõi năng lực của mình bạn nhé!
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: AI insights + history */}
                <div className="flex flex-col gap-6">
                    {/* AI Recommendations */}
                    <div className="bg-gradient-to-br from-accent/5 to-white dark:from-accent/10 dark:to-slate-900 rounded-2xl border border-accent/20 dark:border-accent/30 shadow-sm p-6 relative overflow-hidden">
                        <span className="material-symbols-outlined absolute top-3 right-3 text-6xl text-accent opacity-10">auto_awesome</span>
                        <h3 className="flex items-center gap-2 text-accent text-base font-bold mb-4">
                            <span className="material-symbols-outlined">lightbulb</span>
                            AI Gợi ý Cải thiện
                        </h3>

                        {hasData && store.suggestions?.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {store.suggestions.map((s, i) => (
                                    <div key={i} className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-3 border border-accent/10">
                                        <div className="flex items-start gap-2">
                                            <span className={`material-symbols-outlined text-[18px] mt-0.5 ${s.type === 'check' ? 'text-accent' : 'text-amber-500'}`}>
                                                {s.type === 'check' ? 'check_circle' : 'warning'}
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{s.title}</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{s.body}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    onClick={() => navigate('/roadmap')}
                                    className="w-full py-2 px-4 bg-white dark:bg-slate-800 border border-accent/30 dark:border-accent/40 text-accent rounded-lg text-sm font-medium hover:bg-accent/5 transition-colors"
                                >
                                    Xem lộ trình học tập đề xuất
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-3 border border-accent/10">
                                    <div className="flex items-start gap-2">
                                        <span className="material-symbols-outlined text-slate-300 text-[18px] mt-0.5">info</span>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
                                            Gợi ý AI sẽ xuất hiện sau khi bạn nộp bài luyện tập đầu tiên.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/roadmap')}
                                    className="w-full py-2 px-4 bg-white dark:bg-slate-800 border border-accent/30 text-accent rounded-lg text-sm font-medium hover:bg-accent/5 transition-colors"
                                >
                                    Xem lộ trình học tập đề xuất
                                </button>
                            </div>
                        )}
                    </div>

                    {/* History */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex-1">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                            <h3 className="text-slate-900 dark:text-white text-sm font-bold">Lịch sử Đánh giá</h3>
                            <span className="text-xs text-slate-400">{history.length} bài</span>
                        </div>
                        <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                            {history.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-xs">
                                    Chưa có bài luyện tập nào được ghi lại.
                                </div>
                            ) : detailedHistory.length > 0 ? detailedHistory.map((h, i) => (
                                <div 
                                    key={i} 
                                    onClick={() => setSelectedHistoryItem(h)}
                                    className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-3 cursor-pointer group"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg size-9 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
                                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 group-hover:text-indigo-500 text-[18px]">
                                                {h.examId.startsWith('assistant_') ? 'edit_note' : 'school'}
                                            </span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{h.examTitle}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">
                                                {dayjs(h.timestamp).format('DD/MM/YYYY HH:mm')} · {h.examId.startsWith('assistant_') ? 'Luyện tập AI' : 'Thi chính thức'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{h.result.overall.toFixed(1)}</p>
                                        <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 -mr-2 -mt-1 vertical-middle inline-block">chevron_right</span>
                                    </div>
                                </div>
                            )) : history.map((h, i) => (
                                <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors gap-3 opacity-60 pointer-events-none">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-slate-100 dark:bg-slate-800 rounded-lg size-9 flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300 text-[18px]">{h.icon}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{h.title}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{h.date} · {h.type}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{typeof h.score === 'number' ? h.score.toFixed(1) : h.score}</p>
                                        <p className={`text-[10px] font-medium ${h.positive === true ? 'text-accent' : h.positive === false ? 'text-amber-500' : 'text-slate-400'}`}>
                                            {h.change}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* History Details Modal */}
            <AnimatePresence>
                {selectedHistoryItem && (
                    <HistoryDetailModal 
                        data={selectedHistoryItem} 
                        onClose={() => setSelectedHistoryItem(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function HistoryDetailModal({ data, onClose }) {
    const { result, examTitle, examId, prompt, answer, answers } = data
    const label = result.overall >= 8 ? 'Giỏi' : result.overall >= 7 ? 'Khá' : result.overall >= 5 ? 'Trung bình' : 'Cần cố gắng'
    const labelColor = result.overall >= 8 ? 'text-amber-500' : result.overall >= 7 ? 'text-blue-500' : result.overall >= 5 ? 'text-emerald-500' : 'text-red-500'
    const bgColor = result.overall >= 8 ? 'bg-amber-50' : result.overall >= 7 ? 'bg-blue-50' : result.overall >= 5 ? 'bg-emerald-50' : 'bg-red-50'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col"
            >
                <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-indigo-500">book</span>
                            {examTitle}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {dayjs(data.timestamp).format('DD/MM/YYYY HH:mm')} · {examId.startsWith('assistant_') ? 'Luyện tập với AI' : 'Thi sát hạch'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-slate-500">close</span>
                    </button>
                </div>

                <div className="p-6 md:p-8 space-y-8">
                    {/* Header Score */}
                    <div className={`p-8 rounded-3xl ${bgColor} dark:bg-slate-800/50 border border-current/10 flex flex-col items-center text-center relative overflow-hidden`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-current opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Tổng điểm bài thi</p>
                        <h2 className={`text-6xl font-black ${labelColor} tabular-nums mb-2`}>{result.overall.toFixed(1)}</h2>
                        <div className={`px-4 py-1 rounded-full ${labelColor} bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest shadow-sm border border-current/20`}>
                            Xếp loại: {label}
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Radar */}
                        <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2 self-start">
                                <span className="material-symbols-outlined text-indigo-500">analytics</span>
                                Chi tiết điểm số
                            </h3>
                            <div className="scale-90 transform-origin-top">
                                <RadarChart skills={result.skills} size={220} color="#6366f1" />
                            </div>
                        </div>

                        {/* AI Suggestions */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">verified</span>
                                Nhận xét của AI
                            </h3>
                            {result.suggestions?.map((s, i) => (
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

                    {/* Original Answer Content Context */}
                    {(prompt || answer || answers) && (
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400">inventory</span>
                                Lưu trữ nội dung bài làm
                            </h3>
                            
                            {prompt && (
                                <div className="mb-6">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-2">Đề bài</p>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700/50 whitespace-pre-wrap">
                                        {prompt}
                                    </div>
                                </div>
                            )}

                            {answer && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Bài nộp của bạn</p>
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                                        {answer || <span className="italic text-slate-400">Không có dữ liệu</span>}
                                    </div>
                                </div>
                            )}

                            {answers && (
                                <div className="space-y-4">
                                    {Object.entries(answers).map(([key, val]) => (
                                        <div key={key}>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">{key.replace('q_', 'Câu ')}</p>
                                            <div className="px-4 py-3 bg-white dark:bg-slate-900 rounded-xl text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner">
                                                {val || '(Để trống)'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all"
                    >
                        Đóng
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
