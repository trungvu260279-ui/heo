import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Route as RouteIcon, Target, BookOpen, AlertCircle,
    CheckCircle2, ChevronRight, ArrowRight, ClipboardList,
    Clock, RefreshCcw, LayoutDashboard
} from 'lucide-react'

const SCORE_LEVELS = [
    { id: 'under5', label: 'Dưới 5.0', range: [0, 5], color: 'border-red-500/50 bg-red-500/10 text-red-400' },
    { id: '5to6', label: '5.0 - 6.0', range: [5, 6], color: 'border-amber-500/50 bg-amber-500/10 text-amber-400' },
    { id: '6to7', label: '6.0 - 7.0', range: [6, 7], color: 'border-blue-500/50 bg-blue-500/10 text-blue-400' },
    { id: '7to8', label: '7.0 - 8.0', range: [7, 8], color: 'border-violet-500/50 bg-violet-500/10 text-violet-400' },
    { id: 'above8', label: 'Trên 8.0', range: [8, 10], color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' },
]

const EXAM_STRUCTURE = [
    { section: 'Phần I: Đọc hiểu', points: 4.0, details: ['2 câu nhận biết (0.5đ/câu)', '2 câu thông hiểu (1.0đ/câu)', '1 câu vận dụng (1.0đ/câu)'] },
    { section: 'Phần II: Làm văn', points: 6.0, details: ['Câu 1 (NLXH - 200 chữ): 2.0đ', 'Câu 2 (NLVH - 600 chữ): 4.0đ'] },
]

const PLANS = {
    under5: {
        focus: 'Tập trung luyện Đọc hiểu & Câu hỏi nhận biết',
        tasks: [
            'Dành 1 tiếng mỗi ngày cho môn Văn.',
            'Luyện 1 đề đọc hiểu mỗi ngày, tập trung tuyệt đối vào câu Nhận biết & Thông hiểu.',
            'Làm xong test kết quả ngay lập tức.',
            'Sai ở đâu, làm lại câu đó đến khi thuộc khung trả lời.',
        ],
        advice: 'Đừng quá lo lắng về bài viết dài, hãy nhặt nhạnh từng 0.5 điểm ở phần đọc hiểu trước.'
    },
    '5to6': {
        focus: 'Củng cố Đọc hiểu & Rèn luyện NLXH (200 chữ)',
        tasks: [
            'Luyện kĩ đọc hiểu như mức dưới 5đ.',
            'Rèn kĩ luyện đề NLXH: 1 đề / 2 ngày.',
            'Viết bài xong phải đọc lại để sửa lỗi logic và lỗi diễn đạt.',
            'Viết đi viết lại 1 đoạn văn nhiều lần đến khi trôi chảy.',
        ],
        advice: 'Câu 2đ là cứu cánh để bạn chạm mức 6, hãy học thuộc các mô-típ đoạn văn nghị luận.'
    },
    '6to7': {
        focus: 'Hoàn thiện khung bài NLVH (600 chữ)',
        tasks: [
            'Duy trì luyện Đọc hiểu và NLXH.',
            'Nắm chắc khung sườn bài NLVH (600 chữ).',
            'Luyện viết đảm bảo đủ cấu trúc bài văn (Mở - Thân - Kết).',
            'Đảm bảo đủ các ý chính theo khung đáp án của Bộ.',
        ],
        advice: 'Đừng viết lan man, hãy viết ĐÚNG và ĐỦ ý trước khi viết HAY.'
    },
    '7to8': {
        focus: 'Nâng cao tư duy logic & Diễn đạt bài viết',
        tasks: [
            'Luyện khung như mức 6-7đ.',
            'Tập trung rèn diễn đạt bài NLVH 600 chữ.',
            'Đảm bảo các luận điểm triển khai logic, có tính liên kết chặt chẽ.',
            'Bổ sung các dẫn chứng thực tế sắc bén cho phần NLXH.',
        ],
        advice: 'Sự khác biệt giữa 7 và 8 là tính logic và sự mượt mà trong cách nối đoạn.'
    },
    above8: {
        focus: 'Sáng tạo & Lí luận văn học chuyên sâu',
        tasks: [
            'Luyện tất cả các khung kỹ năng như mức 7-8đ.',
            'Bổ sung kiến thức lí luận văn học vào phần NLXH và NLVH.',
            'Sử dụng Mở bài gián tiếp sáng tạo, lôi cuốn.',
            'Thêm phần "Liên hệ mở rộng" (so sánh tác phẩm, tác giả) ở cuối bài viết.',
            'Diễn đạt giàu hình ảnh, có phong cách cá nhân.',
        ],
        advice: 'Để đạt điểm 9, bài viết của bạn cần có "hồn" và sự uyên bác của lí luận.'
    }
}

export default function Roadmap() {
    const [currentScore, setCurrentScore] = useState(null)
    const [targetScore, setTargetScore] = useState(null)
    const [step, setStep] = useState(1)

    const isUnrealistic = useMemo(() => {
        if (!currentScore || !targetScore) return false
        const currIdx = SCORE_LEVELS.findIndex(l => l.id === currentScore.id)
        const targetIdx = SCORE_LEVELS.findIndex(l => l.id === targetScore.id)
        return targetIdx - currIdx > 2 // Goal gap is more than 2 levels
    }, [currentScore, targetScore])

    const activePlan = targetScore ? PLANS[targetScore.id] : null

    return (
        <div className="flex-1 overflow-y-auto bg-[#0d0d1a] text-white p-6">
            <div className="max-w-4xl mx-auto space-y-8 pb-12">

                {/* Header */}
                <div className="text-center space-y-2">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="inline-flex p-3 rounded-2xl bg-primary/20 text-primary mb-2">
                        <RouteIcon size={32} />
                    </motion.div>
                    <h1 className="text-3xl font-black tracking-tight">Lộ Trình Chinh Phục Ngữ Văn</h1>
                    <p className="text-slate-400">Xây dựng kế hoạch học tập cá nhân hóa dựa trên thực lực của bạn</p>
                </div>

                {/* Survey Section */}
                <section className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <ClipboardList size={120} />
                    </div>

                    <div className="relative z-10 space-y-8">
                        <div className="flex items-center gap-4 justify-center">
                            {[1, 2].map(s => (
                                <div key={s} className="flex items-center gap-2">
                                    <div className={`size-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= s ? 'bg-primary text-white' : 'bg-white/10 text-slate-500'}`}>
                                        {s}
                                    </div>
                                    <div className={`h-1 w-12 rounded-full ${step > s ? 'bg-primary' : 'bg-white/10'}`} />
                                </div>
                            ))}
                        </div>

                        {step === 1 ? (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-xl font-bold">Điểm Văn hiện tại của bạn?</h2>
                                    <p className="text-sm text-slate-500 mt-1">Chọn mức điểm gần nhất với kết quả học kỳ vừa qua</p>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                    {SCORE_LEVELS.map(level => (
                                        <button
                                            key={level.id}
                                            onClick={() => { setCurrentScore(level); setStep(2) }}
                                            className={`p-4 rounded-2xl border transition-all text-sm font-bold ${currentScore?.id === level.id ? level.color : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'}`}
                                        >
                                            {level.label}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-xl font-bold">Mục tiêu bạn muốn hướng tới?</h2>
                                    <p className="text-sm text-slate-500 mt-1">Lưu ý: Lộ trình nên được xây dựng tăng dần theo thực lực</p>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                                    {SCORE_LEVELS.map(level => (
                                        <button
                                            key={level.id}
                                            onClick={() => setTargetScore(level)}
                                            className={`p-4 rounded-2xl border transition-all text-sm font-bold ${targetScore?.id === level.id ? level.color : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'}`}
                                        >
                                            {level.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex justify-between items-center pt-4">
                                    <button onClick={() => setStep(1)} className="text-sm text-slate-500 hover:text-white transition-colors flex items-center gap-1">
                                        <RefreshCcw size={14} /> Chọn lại điểm thực tại
                                    </button>
                                    {targetScore && (
                                        <button onClick={() => setStep(3)} className="bg-primary hover:bg-primary/80 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
                                            Xem lộ trình <ArrowRight size={16} />
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </section>

                {/* Validation Advice */}
                <AnimatePresence>
                    {isUnrealistic && step >= 2 && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex gap-4 items-start">
                            <AlertCircle className="text-amber-500 shrink-0 mt-1" size={20} />
                            <div>
                                <p className="text-amber-400 font-bold text-sm">Lời khuyên từ giáo viên:</p>
                                <p className="text-amber-500/80 text-xs mt-1 leading-relaxed">
                                    Mục tiêu bạn đặt ra đang khá xa so với thực lực hiện tại ({currentScore?.label} → {targetScore?.label}).
                                    Hãy cân nhắc đặt mục tiêu trung gian để không bị quá tải nhé!
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Result Roadmap */}
                {step === 3 && activePlan && (
                    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                        {/* Exam Structure Recap */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="flex items-center gap-2 text-primary font-bold mb-4">
                                    <BookOpen size={18} /> Cấu trúc đề thi
                                </h3>
                                <div className="space-y-4">
                                    {EXAM_STRUCTURE.map((s, i) => (
                                        <div key={i} className="space-y-2">
                                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                                <span className="text-xs font-bold text-slate-200">{s.section}</span>
                                                <span className="text-xs font-black text-primary">{s.points}đ</span>
                                            </div>
                                            <ul className="pl-4 space-y-1">
                                                {s.details.map((d, di) => <li key={di} className="text-[10px] text-slate-500">• {d}</li>)}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl p-6 relative overflow-hidden">
                                <Target className="absolute -bottom-4 -right-4 text-primary opacity-10" size={100} />
                                <h3 className="text-primary font-bold mb-2">Chiến lược trọng tâm</h3>
                                <p className="text-slate-300 font-bold text-sm mb-3 underline decoration-primary decoration-2 underline-offset-4">{activePlan.focus}</p>
                                <div className="bg-white/10 rounded-xl p-3 border border-white/10 text-xs text-slate-400 leading-relaxed italic">
                                    "{activePlan.advice}"
                                </div>
                            </div>
                        </div>

                        {/* Detailed Tasks */}
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <ClipboardList size={20} className="text-emerald-400" /> Kế hoạch hằng ngày
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                {activePlan.tasks.map((task, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="bg-white/5 border border-white/10 p-4 rounded-2xl flex gap-4 items-center group hover:bg-white/[0.08] transition-colors"
                                    >
                                        <div className="size-10 rounded-xl bg-slate-800 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-xl">task_alt</span>
                                        </div>
                                        <p className="text-sm text-slate-300 flex-1 font-medium">{task}</p>
                                        <ChevronRight className="text-slate-600 group-hover:text-primary" size={16} />
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setStep(2)} className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-bold text-sm hover:bg-white/10 transition-all">
                                Quay lại chỉnh mục tiêu
                            </button>
                            <button className="px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2">
                                <LayoutDashboard size={16} /> Lưu vào cá nhân
                            </button>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}
