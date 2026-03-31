import { useNavigate } from 'react-router-dom'

const features = [
    {
        icon: 'co_present',
        title: 'Trợ lý Giáo viên',
        desc: 'Công cụ hỗ trợ soạn giáo án, chấm bài tự động và phân tích năng lực học sinh chuyên sâu.',
    },
    {
        icon: 'person_raised_hand',
        title: 'Gia sư Học sinh',
        desc: 'Người bạn đồng hành AI giúp giải đáp thắc mắc, gợi ý lập dàn ý và rèn luyện kỹ năng viết.',
    },
    {
        icon: 'library_books',
        title: 'Kho học liệu số',
        desc: 'Nền tảng tài liệu phong phú với các bài văn mẫu, tài liệu tham khảo chất lượng cao được AI phân loại.',
    },
]

export default function Home() {
    const navigate = useNavigate()

    return (
        <div className="h-full overflow-y-auto">
            {/* Hero */}
            <section
                className="relative flex min-h-[480px] items-center justify-center p-8 m-6 rounded-2xl overflow-hidden"
                style={{
                    backgroundImage:
                        'linear-gradient(to bottom right, rgba(26,43,60,0.92), rgba(13,148,136,0.82)), url("https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                <div className="z-10 flex flex-col items-center gap-5 text-center max-w-3xl">
                    <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-accent text-5xl">school</span>
                        <h1 className="font-handwriting text-white text-5xl font-bold uppercase tracking-widest drop-shadow-lg">
                            THPT KIM XUYÊN
                        </h1>
                    </div>
                    <h2 className="text-slate-200 text-xl font-normal leading-relaxed drop-shadow-md">
                        Kỷ Nguyên Mới Của Ngữ Văn AI — Nền tảng học và dạy Ngữ Văn ứng dụng trí tuệ nhân tạo dành cho học sinh và giáo viên THPT.
                    </h2>
                    <div className="flex flex-wrap gap-4 justify-center mt-2">
                        <button
                            onClick={() => navigate('/assistant')}
                            className="min-w-[150px] h-12 px-6 rounded-lg bg-accent text-white text-base font-bold shadow-lg hover:bg-accent-hover transition-all hover:-translate-y-0.5"
                        >
                            Bắt đầu miễn phí
                        </button>
                        <button
                            onClick={() => navigate('/assessment')}
                            className="min-w-[150px] h-12 px-6 rounded-lg bg-white text-primary text-base font-bold shadow-lg hover:bg-slate-50 transition-all hover:-translate-y-0.5"
                        >
                            Đánh giá năng lực
                        </button>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="px-6 py-10">
                <div className="text-center mb-8">
                    <h2 className="text-primary dark:text-white text-3xl font-black tracking-tight">Tính năng nổi bật</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-base mt-2">
                        Giải pháp toàn diện kết hợp AI cho việc dạy và học Ngữ Văn
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {features.map((f) => (
                        <div
                            key={f.title}
                            className="flex flex-col gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                        >
                            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent">
                                <span className="material-symbols-outlined text-[28px]">{f.icon}</span>
                            </div>
                            <div>
                                <h3 className="text-primary dark:text-white text-xl font-bold mb-1">{f.title}</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer style={{ background: 'linear-gradient(135deg, #0b131e 0%, #133a36 100%)', borderTop: 'none', marginTop: 0 }}>
                {/* Top accent line */}
                <div style={{ height: 3, background: 'linear-gradient(90deg, #0d9488, #2563eb, #7c3aed)' }} />

                <div className="max-w-6xl mx-auto px-8 py-12">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

                        {/* Brand column */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-3">
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #0d9488, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(13,148,136,0.3)' }}>
                                    <span className="material-symbols-outlined text-white text-xl">school</span>
                                </div>
                                <div>
                                    <p style={{ color: 'white', fontWeight: 800, fontSize: 16, letterSpacing: '0.05em' }}>THPT KIM XUYÊN</p>
                                    <p style={{ color: '#2dd4bf', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nền tảng Ngữ Văn AI</p>
                                </div>
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
                                Ứng dụng trí tuệ nhân tạo vào dạy và học Ngữ Văn THPT — hỗ trợ học sinh và giáo viên đạt kết quả tối ưu.
                            </p>
                            {/* Social icons */}
                            <div className="flex gap-3 mt-1">
                                {[
                                    { icon: 'language', label: 'Website' },
                                    { icon: 'mail', label: 'Email' },
                                    { icon: 'groups', label: 'Cộng đồng' },
                                ].map(s => (
                                    <button key={s.label} title={s.label} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(13,148,136,0.2)'; e.currentTarget.style.color = '#2dd4bf'; e.currentTarget.style.borderColor = 'rgba(13,148,136,0.3)' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)' }}
                                    >
                                        <span className="material-symbols-outlined text-sm">{s.icon}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quick links */}
                        <div>
                            <p style={{ color: 'white', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Khám phá</p>
                            <div className="flex flex-col gap-3">
                                {[
                                    { label: 'Trợ lý Giáo viên', icon: 'co_present', path: '/teacher' },
                                    { label: 'Gia sư Học sinh', icon: 'person_raised_hand', path: '/assistant' },
                                    { label: 'Bảng xếp hạng', icon: 'trophy', path: '/ranking' },
                                    { label: 'Đánh giá năng lực', icon: 'quiz', path: '/assessment' },
                                ].map(link => (
                                    <a key={link.label} href={link.path} style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s', fontWeight: 500 }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#2dd4bf'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{link.icon}</span>
                                        {link.label}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Legal + info */}
                        <div>
                            <p style={{ color: 'white', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Hỗ trợ</p>
                            <div className="flex flex-col gap-3">
                                {['Điều khoản sử dụng', 'Chính sách bảo mật', 'Trợ giúp & FAQ', 'Liên hệ chúng tôi'].map(item => (
                                    <a key={item} href="#" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none', transition: 'color 0.2s', fontWeight: 500 }}
                                        onMouseEnter={e => e.currentTarget.style.color = '#2dd4bf'}
                                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                    >
                                        {item}
                                    </a>
                                ))}
                            </div>

                            {/* Status badge */}
                            <div style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '4px 12px' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }} />
                                <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em' }}>Hệ thống đang hoạt động</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom bar */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 40, paddingTop: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <p style={{ color: '#64748b', fontSize: 12 }}>© 2026 <span style={{ color: '#cbd5e1', fontWeight: 600 }}>THPT KIM XUYÊN</span>. All rights reserved.</p>
                        <p style={{ color: '#64748b', fontSize: 11 }}>
                            Làm bởi <span style={{ color: '#2dd4bf', fontWeight: 700 }}>Khổng Quang Huy 12C9</span>
                            <span style={{ margin: '0 8px', opacity: 0.3 }}>|</span>
                            Made with <span style={{ color: '#f43f5e' }}>❤</span> for Vietnam
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
