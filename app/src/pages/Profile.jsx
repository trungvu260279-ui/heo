import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { getAuthUser, saveAuthUser } from '../hooks/useAuth'
import { clsx } from 'clsx'

export default function Profile() {
    const [user, setUser] = useState(() => getAuthUser())
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        bio: user?.bio || '',
        grade: user?.grade || '',
        school: user?.school || 'THPT Kim Xuyên'
    })

    const handleSave = async (e) => {
        if (e) e.preventDefault()
        setLoading(true)
        try {
            const res = await fetch('/api/user/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    ...formData
                })
            })
            const data = await res.json()
            if (data.success) {
                saveAuthUser(data.user)
                setUser(data.user)
                alert('Đã cập nhật thông tin thành công! ✨')
            } else {
                alert('Lỗi: ' + data.error)
            }
        } catch (err) {
            console.error(err)
            alert('Có lỗi xảy ra khi kết nối máy chủ.')
        } finally {
            setLoading(false)
        }
    }

    if (!user) return <div className="p-10 text-center text-slate-500 font-bold">Vui lòng đăng nhập để xem hồ sơ.</div>

    return (
        <div className="h-full overflow-y-auto px-4 py-8 md:py-12">
            <div className="max-w-4xl mx-auto">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-[32px] shadow-xl border border-slate-200 dark:border-slate-800 p-6 md:p-10"
            >
                {/* Header Section */}
                <header className="mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight">Cài đặt Hồ sơ</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Quản lý thông tin cá nhân và tài khoản của bạn tại THPT Kim Xuyên.</p>
                </header>

                <form className="space-y-8" onSubmit={handleSave}>
                    {/* Avatar Section */}
                    <section className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-4xl font-black text-white shadow-2xl border-4 border-white dark:border-slate-800">
                                {formData.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
                            </div>
                        </div>
                        <div className="text-center sm:text-left">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ảnh đại diện</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sử dụng chữ cái đầu của tên hoặc tải ảnh lên (Sắp ra mắt).</p>
                        </div>
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

                        {/* Phone Number */}
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

                         {/* Grade Selection */}
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

                        {/* School */}
                        <div className="space-y-2 md:col-span-2">
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

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-4 pt-8 border-t border-slate-100 dark:border-slate-800">
                        <button 
                            type="submit"
                            disabled={loading}
                            className="px-10 h-14 bg-slate-900 dark:bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-slate-200 dark:shadow-indigo-900/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 uppercase tracking-widest text-sm"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">save</span>
                                    Lưu thay đổi
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
            </div>
        </div>
    )
}
