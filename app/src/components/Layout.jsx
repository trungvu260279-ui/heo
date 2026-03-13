import { NavLink, Outlet, useNavigate } from 'react-router-dom'
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
    { to: '/profile', icon: 'account_circle', label: 'Hồ sơ cá nhân' },
    { to: '/teacher-assistant', icon: 'person_search', label: 'Trợ lý Giáo viên', role: 'teacher' },
]

export default function Layout() {
    const navigate = useNavigate()
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

    const [showScrollTop, setShowScrollTop] = useState(false)
    const [scrollProgress, setScrollProgress] = useState(0)

    useEffect(() => {
        const handleScroll = (e) => {
            const target = e.target
            if (target.tagName === 'MAIN' || target.classList.contains('overflow-y-auto')) {
                const scrolled = target.scrollTop
                const maxHeight = target.scrollHeight - target.clientHeight
                const progress = (scrolled / maxHeight) * 100
                setScrollProgress(progress)
                setShowScrollTop(scrolled > 300)
            }
        }
        window.addEventListener('scroll', handleScroll, true)
        return () => window.removeEventListener('scroll', handleScroll, true)
    }, [])

    const scrollToTop = () => {
        const scrollable = document.querySelector('.overflow-y-auto')
        if (scrollable) {
            scrollable.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-bg-light dark:bg-bg-dark">
            <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />

            {/* Scroll Progress Bar */}
            <div className="fixed top-0 left-0 lg:left-64 right-0 h-1 z-[70] pointer-events-none">
                <motion.div 
                    className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    style={{ width: `${scrollProgress}%` }}
                />
            </div>

            {/* Scroll to Top Button */}
            <AnimatePresence>
                {showScrollTop && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.5, y: 20 }}
                        onClick={scrollToTop}
                        className="fixed bottom-6 right-6 z-[70] size-12 rounded-2xl bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center hover:scale-110 active:scale-90 transition-all border border-indigo-400/30"
                    >
                        <span className="material-symbols-outlined text-2xl">arrow_upward</span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Mobile Header (Sticky on small screens) */}
            <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-40 flex items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center rounded-lg bg-primary/10 size-8">
                        <span className="material-symbols-outlined text-primary text-lg">school</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-handwriting font-bold text-slate-800 dark:text-white uppercase tracking-tight text-sm">Kim Xuyên AI</span>
                        {user && (
                            <span className="text-[9px] font-bold text-slate-400 -mt-1 uppercase tracking-wider">
                                {user.grade ? `Lớp ${user.grade}` : (user.role === 'teacher' ? 'Giáo viên' : 'Học sinh')}
                            </span>
                        )}
                    </div>
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
                        onClick={() => { 
                            if (!user) setShowLogin(true); 
                            else navigate('/profile');
                            setIsSidebarOpen(false); 
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group text-left border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                        <div className="relative">
                            <div className="rounded-full size-10 bg-gradient-to-tr from-primary to-accent flex-shrink-0 flex items-center justify-center font-black text-white text-sm shadow-md">
                                {user?.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            {user?.isVerified && (
                                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5">
                                    <span className="material-symbols-outlined text-blue-500 text-[14px]">verified</span>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-slate-900 dark:text-white text-sm font-bold truncate">{user?.name || 'Chưa đăng nhập'}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-[10px] truncate font-bold uppercase tracking-wider flex items-center gap-1.5">
                                {user?.studentId && <span className="text-indigo-500 font-black">#{user.studentId}</span>}
                                {user?.studentId && <span className="opacity-20 text-slate-300">|</span>}
                                {user?.role === 'teacher' ? '👨‍🏫 Giáo viên' : (user?.grade ? `🎓 Lớp ${user.grade}` : '🎓 Học sinh')}
                            </p>
                        </div>
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors text-[18px]">settings</span>
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
