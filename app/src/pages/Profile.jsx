import { useState } from 'react'
import { motion } from 'framer-motion'
import { getAuthUser, saveAuthUser } from '../hooks/useAuth'
import { clsx } from 'clsx'

const ROLES = [
    {
        value: 'student',
        label: 'Học sinh',
        desc: 'Ôn thi, làm bài, xem xếp hạng',
        icon: 'school',
        gradient: 'from-blue-500 to-cyan-400',
    },
    {
        value: 'teacher',
        label: 'Giáo viên',
        desc: 'Quản lý, chấm bài, thống kê lớp',
        icon: 'person_book',
        gradient: 'from-violet-500 to-indigo-400',
    },
]

export default function Profile() {
    const [user, setUser] = useState(() => getAuthUser())
    const [loading, setLoading] = useState(false)
    const [saved, setSaved] = useState(false)
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        bio: user?.bio || '',
        grade: user?.grade || '',
        school: user?.school || 'THPT Kim Xuyên',
        role: user?.role || 'student',
    })

    const handleSave = async (e) => {
        if (e) e.preventDefault()
        setLoading(true)
        try {
            // Lưu local ngay lập tức để app phản ánh thay đổi role
            const updated = { ...user, ...formData }
            saveAuthUser(updated)
            setUser(updated)

            // Sync lên server (best-effort)
            try {
                const res = await fetch('/api/user/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email, ...formData })
                })
                const data = await res.json()
                if (data.success && data.user) {
                    saveAuthUser({ ...updated, ...data.user })
                    setUser(prev => ({ ...prev, ...data.user }))
                }
            } catch (_) { /* server sync là optional */ }

            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
        } catch (err) {
            alert('Có lỗi xảy ra.')
        } finally {
            setLoading(false)
        }
    }

    if (!user) return <div className="p-10 text-center text-slate-500 font-bold">Vui lòng đăng nhập để xem hồ sơ.</div>

    const selectedRole = ROLES.find(r => r.value === formData.role)

    return (
        <div className="h-full overflow-y-auto px-4 py-8 md:py-12">
            <div className="max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-[32px] shadow-xl border border-slate-200 dark:border-slate-800 p-6 md:p-10"
            >
                {/* Header */}
                <header className="mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Cài đặt Hồ sơ</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Quản lý thông tin cá nhân và tài khoản của bạn tại THPT Kim Xuyên.</p>
                </header>

                <form className="space-y-8" onSubmit={handleSave}>

                    {/* Avatar */}
                    <section className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative group">
                            <div className={clsx(
                                "w-32 h-32 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-2xl border-4 border-white dark:border-slate-800 bg-gradient-to-tr",
                                formData.role === 'teacher' ? 'from-violet-500 to-indigo-400' : 'from-blue-500 to-cyan-400'
                            )}>
                                {formData.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                            </div>
                        </div>
                        <div className="text-center sm:text-left">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ảnh đại diện</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sử dụng chữ cái đầu của tên (Tải ảnh sắp ra mắt).</p>
                            <span className={clsx(
                                "inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold",
                                formData.role === 'teacher'
                                    ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300'
                                    : 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300'
                            )}>
                                <span className="material-symbols-outlined text-[14px]">
                                    {formData.role === 'teacher' ? 'person_book' : 'school'}
                                </span>
                                {formData.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
                            </span>
                        </div>
                    </section>

                    {/* ── VAI TRÒ ── */}
                    <section className="space-y-3">
                        <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Vai trò của bạn
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ROLES.map(r => {
                                const isSelected = formData.role === r.value
                                return (
                                    <button
                                        key={r.value}
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, role: r.value }))}
                                        className={clsx(
                                            "relative flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all overflow-hidden",
                                            isSelected
                                                ? "border-slate-200 dark:border-slate-700 shadow-lg"
                                                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
                                        )}
                                    >
                                        {/* Subtle gradient overlay when selected */}
                                        {isSelected && (
                                            <div className={clsx(
                                                "absolute inset-0 bg-gradient-to-br opacity-[0.08] dark:opacity-[0.15]",
                                                r.gradient
                                            )} />
                                        )}

                                        {/* Icon */}
                                        <div className={clsx(
                                            "relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all",
                                            isSelected
                                                ? `bg-gradient-to-br ${r.gradient} shadow-md`
                                                : "bg-slate-200 dark:bg-slate-700"
                                        )}>
                                            <span className={clsx(
                                                "material-symbols-outlined text-2xl",
                                                isSelected ? "text-white" : "text-slate-400"
                                            )}>{r.icon}</span>
                                        </div>

                                        {/* Text */}
                                        <div className="relative">
                                            <p className={clsx(
                                                "font-black text-base",
                                                isSelected ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"
                                            )}>{r.label}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                                        </div>

                                        {/* Checkmark */}
                                        {isSelected && (
                                            <div className="relative ml-auto shrink-0">
                                                <div className={clsx("w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br shadow", r.gradient)}>
                                                    <span className="material-symbols-outlined text-white text-sm font-bold">check</span>
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                        {formData.role !== user.role && (
                            <p className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                                <span className="material-symbols-outlined text-sm">info</span>
                                Thay đổi vai trò sẽ cập nhật giao diện sau khi bạn lưu.
                            </p>
                        )}
                    </section>

                    {/* Form Fields */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Full Name */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Họ và tên</label>
                            <input
                                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-all font-bold dark:text-white"
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                placeholder="Nhập họ và tên..."
                            />
                        </div>

                        {/* Email (Read-only) */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Email</label>
                            <div className="relative">
                                <input
                                    className="w-full h-12 px-4 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed font-medium"
                                    type="email"
                                    value={formData.email}
                                    readOnly
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-300">lock</span>
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="space-y-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Số điện thoại</label>
                            <input
                                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-all font-bold dark:text-white"
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                placeholder="0xxx xxx xxx"
                            />
                        </div>

                        {/* Grade — only for student */}
                        {formData.role === 'student' && (
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Khối lớp</label>
                                <div className="flex gap-2">
                                    {['10', '11', '12'].map(g => (
                                        <button
                                            key={g}
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, grade: g }))}
                                            className={clsx(
                                                "flex-1 h-12 rounded-xl font-bold transition-all border",
                                                formData.grade === g
                                                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                                    : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                                            )}
                                        >
                                            Khối {g}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* School */}
                        <div className={clsx("space-y-2", formData.role === 'student' ? "md:col-span-2" : "")}>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Trường học</label>
                            <input
                                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-all font-bold dark:text-white"
                                type="text"
                                value={formData.school}
                                onChange={e => setFormData(p => ({ ...p, school: e.target.value }))}
                                placeholder="Ví dụ: THPT Kim Xuyên"
                            />
                        </div>

                        {/* Bio */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Tiểu sử</label>
                            <textarea
                                className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-all font-bold dark:text-white resize-none"
                                rows="4"
                                value={formData.bio}
                                onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
                                placeholder="Giới thiệu ngắn gọn về bản thân bạn..."
                            />
                        </div>
                    </section>

                    {/* Save Button */}
                    <div className="flex items-center justify-end gap-4 pt-8 border-t border-slate-100 dark:border-slate-800">
                        <motion.button
                            type="submit"
                            disabled={loading}
                            whileTap={{ scale: 0.97 }}
                            className={clsx(
                                "px-10 h-14 text-white font-black rounded-2xl shadow-xl transition-all flex items-center gap-3 uppercase tracking-widest text-sm",
                                saved
                                    ? "bg-emerald-500 shadow-emerald-200 dark:shadow-emerald-900/40"
                                    : "bg-slate-900 dark:bg-indigo-600 shadow-slate-200 dark:shadow-indigo-900/40 hover:scale-105"
                            )}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : saved ? (
                                <>
                                    <span className="material-symbols-outlined">check_circle</span>
                                    Đã lưu!
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">save</span>
                                    Lưu thay đổi
                                </>
                            )}
                        </motion.button>
                    </div>
                </form>
            </motion.div>
            </div>
        </div>
    )
}
