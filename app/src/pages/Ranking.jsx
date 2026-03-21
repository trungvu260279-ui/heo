import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
    Trophy, Search, Download, Users, Star, BarChart2, RefreshCw
} from 'lucide-react'


// ─── helpers ──────────────────────────────────────────────────────────────────
const gradeColor = {
    'Xuất sắc': 'text-violet-400 bg-violet-500/10',
    'Giỏi': 'text-blue-400 bg-blue-500/10',
    'Khá': 'text-emerald-400 bg-emerald-500/10',
    'Trung bình': 'text-amber-400 bg-amber-500/10',
    'Yếu': 'text-red-400 bg-red-500/10',
}

function getGrade(score) {
    if (score >= 9) return 'Xuất sắc'
    if (score >= 8) return 'Giỏi'
    if (score >= 6.5) return 'Khá'
    if (score >= 5) return 'Trung bình'
    return 'Yếu'
}

function getColor(name) {
    const colors = ['#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#0d9488']
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length]
}

function getInitials(name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0][0] || '?')
}

const scoreColor = (v, max = 10) => {
    const ratio = v / max
    if (ratio >= 0.85) return '#7c3aed'
    if (ratio >= 0.7) return '#2563eb'
    if (ratio >= 0.5) return '#0891b2'
    return '#ef4444'
}

function RankBadge({ rank }) {
    if (rank === 1) return <span className="text-xl">🥇</span>
    if (rank === 2) return <span className="text-xl">🥈</span>
    if (rank === 3) return <span className="text-xl">🥉</span>
    return (
        <span className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-slate-400 text-xs font-bold border border-white/10">
            {rank}
        </span>
    )
}

function Avatar({ student, size = 'md' }) {
    const sz = size === 'lg' ? 'w-14 h-14 text-xl' : size === 'xl' ? 'w-20 h-20 text-2xl' : 'w-9 h-9 text-sm'
    return (
        <div
            className={`${sz} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ring-2 ring-white/10 uppercase`}
            style={{ background: `linear-gradient(135deg, ${student.color}cc, ${student.color}66)` }}
        >
            {student.initials}
        </div>
    )
}

function StatCard({ icon: Icon, label, value, sub, gradient }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5"
        >
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 ${gradient}`} />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3`}
                style={{ background: 'rgba(255,255,255,0.07)' }}>
                <Icon size={20} className="text-white" />
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">{label}</p>
            {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
        </motion.div>
    )
}

const podiumOrder = [1, 0, 2]
const podiumHeights = ['h-24', 'h-36', 'h-16']
const podiumCrowns = ['🥈', '🥇', '🥉']

function Podium({ topThree }) {
    return (
        <div className="flex items-end justify-center gap-3 pt-6 pb-2">
            {podiumOrder.map((idx, pos) => {
                const student = topThree[idx]
                if (!student) return null
                return (
                    <motion.div
                        key={student.id}
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: pos * 0.15, type: 'spring', bounce: 0.4 }}
                        className="flex flex-col items-center gap-2"
                    >
                        <span className="text-2xl">{podiumCrowns[pos]}</span>
                        <div className="relative">
                            <Avatar student={student} size={pos === 1 ? 'xl' : 'lg'} />
                            {pos === 1 && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">👑</span>}
                        </div>
                        <div className="text-center">
                            <p className={`font-semibold text-white ${pos === 1 ? 'text-sm' : 'text-xs'}`}>
                                {student.name.split(' ').slice(-1)[0]}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold">{student.gpa.toFixed(1)}</p>
                        </div>
                        <div className={`w-20 ${podiumHeights[pos]} rounded-t-xl border border-white/10 bg-white/5 backdrop-blur-sm`} />
                    </motion.div>
                )
            })}
        </div>
    )
}

function exportCSV(data) {
    const header = ['Hạng', 'Họ tên', 'Email', 'Vai trò', 'Điểm Văn', 'Xếp loại']
    const rows = data.map(s => [s.rank, s.name, s.email, s.role === 'teacher' ? 'Giáo viên' : 'Học sinh', s.gpa, s.grade])
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'xephang_nguvan.csv'; a.click()
}

// ─── Parse dữ liệu từ Google Sheets ──────────────────────────────────────────
function parseSheetData(raw) {
    if (!Array.isArray(raw)) return []

    const map = {}
    for (const row of raw) {
        const { email, name, role, score, exercise, date } = row
        if (!email || !name) continue
        const s = parseFloat(score) || 0

        if (!map[email]) {
            map[email] = { email, name, role, exercise, date, scores: [] }
        }

        map[email].scores.push(s)

        // Giữ bài gần nhất (so sánh date)
        if (!map[email].date || new Date(date) > new Date(map[email].date)) {
            map[email].exercise = exercise
            map[email].date = date
        }
    }

    return Object.values(map)
        .filter(u => u.role !== 'teacher')
        .map(u => {
            const avg = u.scores.reduce((a, b) => a + b, 0) / u.scores.length
            return {
                ...u,
                id: u.email,
                gpa: Math.round(avg * 10) / 10, // làm tròn 1 chữ số thập phân
                grade: getGrade(avg),
                color: getColor(u.name),
                initials: getInitials(u.name),
            }
        })
        .sort((a, b) => b.gpa - a.gpa)
        .map((u, i) => ({ ...u, rank: i + 1 }))
}

export default function Ranking() {
    const [search, setSearch] = useState('')
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchRanking = async () => {
        setLoading(true)
        setError(null)
        try {
            // Fetch directly from our proxy/backend
            const res = await fetch('/api/sheet')
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const raw = await res.json()
            setStudents(parseSheetData(raw))
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchRanking() }, [])

    const filtered = useMemo(() =>
        students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
        , [search, students])

    const topThree = students.slice(0, 3)
    const totalStudents = students.length
    const avgVan = totalStudents ? (students.reduce((a, s) => a + s.gpa, 0) / totalStudents).toFixed(2) : '—'
    const passRate = totalStudents ? Math.round((students.filter(s => s.gpa >= 5).length / totalStudents) * 100) : 0

    return (
        <div className="flex-1 overflow-y-auto bg-[#0d0d1a] text-white" style={{ minHeight: 0 }}>
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Trophy size={22} className="text-yellow-400" />
                            <h1 className="text-2xl font-bold text-white">Bảng Xếp Hạng Ngữ Văn</h1>
                        </div>
                        <p className="text-slate-400 text-sm">THPT Kim Xuyên · Cập nhật tự động từ AI chấm điểm</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Tìm học sinh..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 w-44 transition-colors"
                            />
                        </div>
                        <button onClick={fetchRanking}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Cập nhật
                        </button>
                        <button onClick={() => exportCSV(filtered)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-colors">
                            <Download size={14} /> Xuất CSV
                        </button>
                    </div>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <div className="size-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                        <p className="text-slate-500 text-sm">Đang tải dữ liệu từ máy chủ...</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                        <span className="text-5xl">⚠️</span>
                        <p className="text-red-400 font-bold">{error}</p>
                        <p className="text-slate-500 text-xs">Kiểm tra lại VITE_GOOGLE_SCRIPT_URL trong file .env</p>
                        <button onClick={fetchRanking} className="mt-2 px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-600/30 transition-colors">
                            Thử lại
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && students.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                        <span className="text-6xl">🏆</span>
                        <p className="text-white font-bold text-lg">Chưa có học sinh nào!</p>
                        <p className="text-slate-500 text-sm max-w-xs">Hãy đăng nhập và hoàn thành bài luyện tập đầu tiên trên trang <strong className="text-slate-300">Trợ lý AI</strong> để lên bảng xếp hạng.</p>
                    </div>
                )}

                {/* Real data */}
                {!loading && !error && students.length > 0 && (<>
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon={Trophy} label="Top 1 Văn" value={topThree[0]?.name.split(' ').slice(-1)[0] || '—'} sub={`${topThree[0]?.gpa.toFixed(1)}đ`} gradient="bg-yellow-500" />
                        <StatCard icon={Star} label="Điểm TB Ngữ Văn" value={avgVan} gradient="bg-violet-500" />
                        <StatCard icon={BarChart2} label="Tỉ lệ đạt" value={`${passRate}%`} sub="≥ 5.0 điểm" gradient="bg-emerald-500" />
                        <StatCard icon={Users} label="Tổng học sinh" value={totalStudents} gradient="bg-blue-500" />
                    </div>

                    {/* Podium */}
                    {topThree.length >= 2 && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                            <Podium topThree={topThree} />
                        </div>
                    )}

                    {/* Table */}
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="text-left px-5 py-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider w-16">Hạng</th>
                                        <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Học sinh</th>
                                        <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider w-24">Điểm TB</th>
                                        <th className="text-left px-4 py-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider w-28">Xếp loại</th>
                                        <th className="text-center px-4 py-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider hidden md:table-cell w-24">Số bài làm</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((student) => (
                                        <motion.tr
                                            key={student.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <td className="px-5 py-3.5"><RankBadge rank={student.rank} /></td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <Avatar student={student} />
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{student.name}</p>
                                                        <p className="text-[10px] text-slate-500">{student.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className="text-sm font-bold" style={{ color: scoreColor(student.gpa) }}>
                                                    {student.gpa.toFixed(1)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gradeColor[student.grade]}`}>
                                                    {student.grade}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 hidden md:table-cell text-center">
                                                <span className="text-xs font-bold text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                                                    {student.scores?.length || 1}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>)}
            </div>
        </div>
    )
}
