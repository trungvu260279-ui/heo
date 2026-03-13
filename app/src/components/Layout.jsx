import { NavLink, Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LoginModal from './LoginModal'
import { getAuthUser, logout } from '../hooks/useAuth'

const navItems = [
    { to: '/home', icon: 'home', label: 'Trang chủ' },
    { to: '/ranking', icon: 'military_tech', label: 'Xếp hạng' },
    { to: '/assessment', icon: 'insights', label: 'Đánh giá năng lực' },
    { to: '/assistant', icon: 'smart_toy', label: 'Trợ lý AI' },
    { to: '/exams', icon: 'menu_book', label: 'Thư viện Đề thi' },
    { to: '/student-chat', icon: 'auto_stories', label: 'Gia sư Văn học' },
    { to: '/teacher-assistant', icon: 'person_search', label: 'Trợ lý Giáo viên', role: 'teacher' },
]

export default function Layout() {
    const [user, setUser] = useState(() => getAuthUser())
    const [showLogin, setShowLogin] = useState(!user)
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        const handleAuthUpdate = () => {
            const current = getAuthUser()
            setUser(current)
            setShowLogin(!current)
        }
        window.addEventListener('van_auth_update', handleAuthUpdate)
        return () => window.removeEventListener('van_auth_update', handleAuthUpdate)
    }, [])

    return (
        <div className="flex h-screen w-full overflow-hidden bg-bg-light dark:bg-bg-dark">
            <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />

            {/* Mobile Header (Sticky on small screens) */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-40 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center rounded-lg bg-primary/10 size-8">
                        <span className="material-symbols-outlined text-primary text-lg">school</span>
                    </div>
                    <span className="font-handwriting font-bold text-slate-800 dark:text-white uppercase tracking-tight text-sm">Kim Xuyên AI</span>
                </div>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
            </header>

            {/* Sidebar Overlay (Mobile) */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <aside className={clsx(
                "fixed inset-y-0 left-0 z-[60] flex h-full w-72 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl lg:shadow-none transition-transform duration-300 lg:static lg:translate-x-0 lg:w-64 flex-shrink-0",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                {/* Brand */}
                <div className="flex flex-col gap-6 p-4">
                    <div className="flex items-center justify-between lg:justify-start gap-3 px-2 py-2">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 size-11 flex-shrink-0">
                                <span className="material-symbols-outlined text-primary dark:text-accent text-2xl">school</span>
                            </div>
                            <div>
                                <h1 className="font-handwriting text-primary dark:text-white text-xl font-bold leading-tight uppercase tracking-wide">
                                    THPT KIM XUYÊN
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Nền tảng Ngữ văn AI</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Nav */}
                    <nav className="flex flex-col gap-1">
                        {navItems.filter(item => !item.role || item.role === user?.role).map((item) => (
                            <NavLink
                                key={item.label}
                                to={item.to}
                                onClick={() => setIsSidebarOpen(false)}
                                className={({ isActive }) =>
                                    clsx(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                        isActive && item.to !== '#'
                                            ? 'bg-accent/10 dark:bg-accent/20 text-accent dark:text-accent font-semibold'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    )
                                }
                            >
                                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* User Profile */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => { setShowLogin(true); setIsSidebarOpen(false); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group text-left"
                    >
                        <div className="rounded-full size-10 bg-gradient-to-tr from-primary to-accent flex-shrink-0 flex items-center justify-center font-black text-white text-sm shadow-md">
                            {user?.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{user?.name || 'Chưa đăng nhập'}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[10px] truncate">
                                {user?.role === 'teacher' ? '👨‍🏫 Giáo viên' : '🎓 Học sinh'}
                            </p>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-[18px]">edit</span>
                    </button>
                    <button
                        onClick={logout}
                        className="w-full mt-2 rounded-xl h-8 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-red-500/10 hover:text-red-500 text-slate-400 text-[10px] font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-[13px]">logout</span>
                        Đăng xuất
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col overflow-hidden pt-16 lg:pt-0">
                <Outlet />
            </main>
        </div>
    )
}
