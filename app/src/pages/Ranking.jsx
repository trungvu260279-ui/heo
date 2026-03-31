import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Trophy, Search, Download, Users, Star, BarChart2, RefreshCw, X, PieChart
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell, PieChart as RechartsPie, Pie,
} from 'recharts'




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

const GRADE_CONFIG = [
    { key: 'Xuất sắc', label: 'Xuất sắc', emoji: '🌟', color: '#7c3aed', bg: 'bg-violet-500', threshold: '≥ 9.0đ', textColor: 'text-violet-400' },
    { key: 'Giỏi',     label: 'Giỏi',     emoji: '🏆', color: '#2563eb', bg: 'bg-blue-500',   threshold: '≥ 8.0đ', textColor: 'text-blue-400' },
    { key: 'Khá',      label: 'Khá',       emoji: '⭐', color: '#10b981', bg: 'bg-emerald-500', threshold: '≥ 6.5đ', textColor: 'text-emerald-400' },
    { key: 'Trung bình', label: 'Trung bình', emoji: '📘', color: '#f59e0b', bg: 'bg-amber-500', threshold: '≥ 5.0đ', textColor: 'text-amber-400' },
    { key: 'Yếu',      label: 'Chưa đạt', emoji: '❌', color: '#ef4444', bg: 'bg-red-500',    threshold: '< 5.0đ',  textColor: 'text-red-400' },
]

// Custom tooltip for bar chart
function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
        <div style={{
            background: 'rgba(15,12,35,0.97)', border: `1px solid ${d.color}44`,
            borderRadius: 16, padding: '12px 18px', boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${d.color}22`
        }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{d.emoji}</div>
            <div style={{ color: d.color, fontWeight: 900, fontSize: 22 }}>{d.count}</div>
            <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>{d.label} &middot; {d.pct}%</div>
            <div style={{ color: '#475569', fontSize: 11 }}>{d.threshold}</div>
        </div>
    )
}

// Custom tooltip for pie/donut chart
function CustomPieTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
        <div style={{
            background: 'rgba(10,8,28,0.98)',
            border: `1px solid ${d.color}55`,
            borderRadius: 14,
            padding: '14px 18px',
            boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${d.color}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
            minWidth: 140,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 26 }}>{d.emoji}</span>
                <span style={{ color: d.color, fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{d.pct}%</span>
            </div>
            <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{d.label}</div>
            <div style={{ color: '#64748b', fontSize: 12 }}>{d.count} học sinh · {d.threshold}</div>
        </div>
    )
}

// Custom bar shape with rounded top + gradient
function RoundedBar(props) {
    const { x, y, width, height, color } = props
    if (!height || height <= 0) return null
    const r = Math.min(10, width / 2)
    return (
        <g>
            <defs>
                <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.3} />
                </linearGradient>
            </defs>
            {/* Glow */}
            <rect x={x + 2} y={y} width={width - 4} height={height}
                rx={r} fill={color} opacity={0.15}
                filter="url(#glow)" />
            {/* Main bar */}
            <path
                d={`M${x + r},${y} h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${height - r} h${-width} v${-(height - r)} a${r},${r} 0 0 1 ${r},${-r} z`}
                fill={`url(#grad-${color.replace('#', '')})`}
            />
            {/* Top highlight line */}
            <rect x={x} y={y} width={width} height={3} rx={r} fill={color}
                style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        </g>
    )
}

function GradeDistributionChart({ students, onClose }) {
    const total = students.length
    if (total === 0) return null

    const data = GRADE_CONFIG.map(g => {
        const count = students.filter(s => s.grade === g.key).length
        return { ...g, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }
    })

    // Only include non-zero slices for donut, plus a placeholder if all zero
    const pieData = data.filter(g => g.count > 0).length > 0
        ? data.filter(g => g.count > 0)
        : [{ label: 'Chưa có dữ liệu', color: '#334155', count: 1, pct: 100 }]

    return (
        <div className="relative">
            {/* SVG filter for glow */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-6 border-b border-white/[0.06]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(124,58,237,0.18)', boxShadow: '0 0 24px rgba(124,58,237,0.35)' }}>
                        <BarChart2 size={24} className="text-violet-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Xếp hạng học sinh</h2>
                        <p className="text-sm text-slate-400 mt-0.5">
                            <span className="text-white font-bold">{total}</span> học sinh &middot; THPT Kim Xuyên
                        </p>
                    </div>
                </div>
                <button onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10">
                    <X size={18} />
                </button>
            </div>

            {/* Main content: BarChart + RadialBar side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0">

                {/* BarChart — 2/3 width */}
                <div className="sm:col-span-2 px-6 pt-8 pb-4">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 pl-2">Số học sinh theo xếp loại</p>
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barCategoryGap="30%">
                            <XAxis
                                dataKey="emoji"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 22, dy: 8 }}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#475569', fontSize: 11 }}
                                allowDecimals={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} />
                            <Bar dataKey="count" shape={<RoundedBar />} isAnimationActive animationDuration={900} animationEasing="ease-out">
                                {data.map((g) => (
                                    <Cell key={g.key} color={g.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* PieChart donut — 1/3 width */}
                <div className="flex flex-col items-center justify-center px-4 pt-8 pb-6 border-l border-white/[0.04]">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Tỉ lệ %</p>
                    <ResponsiveContainer width="100%" height={280}>
                        <RechartsPie>
                            <Pie
                                data={pieData}
                                cx="50%" cy="46%"
                                innerRadius="52%"
                                outerRadius="80%"
                                paddingAngle={pieData.length > 1 ? 3 : 0}
                                dataKey="count"
                                startAngle={90}
                                endAngle={-270}
                                isAnimationActive
                                animationDuration={900}
                                animationEasing="ease-out"
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, pct, emoji }) => {
                                    if (pct < 5) return null
                                    const RADIAN = Math.PI / 180
                                    const r = innerRadius + (outerRadius - innerRadius) * 1.45
                                    const x = cx + r * Math.cos(-midAngle * RADIAN)
                                    const y = cy + r * Math.sin(-midAngle * RADIAN)
                                    return <text x={x} y={y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 18 }}>{emoji}</text>
                                }}
                                labelLine={false}
                            >
                                {pieData.map((g, i) => (
                                    <Cell key={i} fill={g.color} stroke={g.color + '44'} strokeWidth={1} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomPieTooltip />} />
                        </RechartsPie>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div className="flex flex-col gap-2 w-full px-2">
                        {data.map(g => (
                            <div key={g.key} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color, boxShadow: g.count > 0 ? `0 0 6px ${g.color}` : 'none' }} />
                                <span className="text-xs flex-1 truncate" style={{ color: g.count > 0 ? '#cbd5e1' : '#475569' }}>{g.label}</span>
                                <span className="text-xs font-black" style={{ color: g.count > 0 ? g.color : '#475569' }}>
                                    {g.count > 0 ? `${g.pct}%` : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom stat cards */}
            <div className="grid grid-cols-5 gap-3 px-6 pb-8">
                {data.map((g, i) => (
                    <motion.div
                        key={g.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.06 }}
                        className="flex flex-col items-center gap-1.5 py-4 rounded-2xl"
                        style={{ background: g.color + '0d', border: `1px solid ${g.color}22` }}
                    >
                        <span className="text-2xl">{g.emoji}</span>
                        <span className="text-2xl font-black leading-none" style={{ color: g.color }}>{g.count}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{g.label}</span>
                        <div className="w-full px-3">
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                                <motion.div className="h-full rounded-full" style={{ background: g.color }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${g.pct}%` }}
                                    transition={{ duration: 0.9, delay: 0.4 + i * 0.06 }}
                                />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}


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
    const [showChart, setShowChart] = useState(false)

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

                    {/* Grade Distribution Chart — floating icon button + modal */}
                    {students.length > 0 && (
                        <>
                            {/* Floating trigger button */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setShowChart(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm font-medium hover:bg-violet-600/30 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-violet-500/10"
                                >
                                    <PieChart size={15} />
                                    <span>Xem phân bổ xếp loại</span>
                                    <span className="ml-1 text-[10px] bg-violet-500/20 px-1.5 py-0.5 rounded-md font-bold text-violet-200">
                                        {students.length} HS
                                    </span>
                                </button>
                            </div>

                            {/* Modal */}
                            <AnimatePresence>
                                {showChart && (
                                    <motion.div
                                        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowChart(false)}
                                    >
                                        {/* Backdrop */}
                                        <div className="absolute inset-0 bg-black/75 backdrop-blur-xl" />

                                        {/* Panel */}
                                        <motion.div
                                            className="relative w-full rounded-3xl border border-white/10 overflow-hidden flex flex-col"
                                            style={{
                                                maxWidth: '1100px',
                                                background: 'linear-gradient(160deg, #12102a 0%, #0d0d1a 50%, #0a0d1f 100%)',
                                                maxHeight: '96vh',
                                                boxShadow: '0 25px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(124,58,237,0.15)',
                                            }}
                                            initial={{ opacity: 0, scale: 0.9, y: 32 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.93, y: 20 }}
                                            transition={{ type: 'spring', bounce: 0.25, duration: 0.45 }}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {/* Decorative glows */}
                                            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/80 to-transparent" />
                                            <div className="absolute -top-32 left-1/4 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(124,58,237,0.12)' }} />
                                            <div className="absolute -top-20 right-1/4 w-48 h-48 rounded-full blur-3xl" style={{ background: 'rgba(16,185,129,0.08)' }} />

                                            <div className="overflow-y-auto flex-1" style={{ overscrollBehavior: 'contain' }}>
                                                <GradeDistributionChart students={students} onClose={() => setShowChart(false)} />
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
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
