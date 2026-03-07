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
            <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-6 text-center">
                <div className="flex flex-wrap justify-center gap-6 mb-4">
                    {['Về chúng tôi', 'Tính năng', 'Điều khoản', 'Bảo mật', 'Trợ giúp'].map((item) => (
                        <a key={item} href="#" className="text-slate-500 hover:text-primary dark:hover:text-white text-sm transition-colors">
                            {item}
                        </a>
                    ))}
                </div>
                <p className="text-slate-400 text-xs">© 2024 THPT KIM XUYÊN. All rights reserved.</p>
            </footer>
        </div>
    )
}
