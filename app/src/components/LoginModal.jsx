import { useState } from 'react';
import { saveAuthUser } from '../hooks/useAuth';

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

export default function LoginModal({ isOpen, onClose }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('student');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!name) return alert("Vui lòng nhập tên của bạn nhé!");

        setLoading(true);
        // Lưu local để duy trì phiên
        const dummyEmail = `${name.toLowerCase().replace(/\s/g, '')}@kimxuyen.edu`;
        saveAuthUser({ name, email: dummyEmail, role });

        // Ghi log "thành viên mới" lên Google Sheet thông qua proxy
        try {
            await fetch('/api/sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: dummyEmail, name, role,
                    score: 0,
                    exercise: 'Gia nhập hệ thống',
                    type: 'LOG_JOIN'
                })
            });
        } catch (err) {
            console.warn("Cloud log via proxy failed", err);
        }

        setLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Overlay kính mờ xịn xò */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-700" />

            <div className="relative bg-white/90 dark:bg-slate-900/90 w-full max-w-[480px] rounded-[48px] shadow-[0_48px_96px_-16px_rgba(0,0,0,0.5)] border border-white/20 dark:border-slate-700/50 overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-12 duration-500">
                <div className="p-12">
                    <div className="flex justify-center mb-10">
                        <div className="size-24 rounded-[32px] bg-gradient-to-tr from-primary via-accent to-primary p-0.5 shadow-2xl shadow-primary/30">
                            <div className="w-full h-full rounded-[30px] bg-white dark:bg-slate-900 flex items-center justify-center">
                                <span className="material-symbols-outlined text-5xl bg-gradient-to-tr from-primary to-accent bg-clip-text text-transparent">school</span>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-4xl font-black text-center text-slate-900 dark:text-white mb-3 tracking-tighter uppercase italic">THPT KIM XUYÊN</h2>
                    <p className="text-center text-slate-500 dark:text-slate-400 text-xs mb-10 font-bold uppercase tracking-[0.3em]">Hệ thống Đánh giá Năng lực</p>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="group">
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Họ và tên của bạn"
                                className="w-full h-16 px-8 rounded-3xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all text-base font-bold dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-primary/10"
                            />
                        </div>

                        <div className="flex p-2 bg-slate-100 dark:bg-slate-800/80 rounded-3xl border border-slate-200/50 dark:border-slate-700/50">
                            <button
                                type="button"
                                onClick={() => setRole('student')}
                                className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-3 transition-all text-sm font-black tracking-wide ${role === 'student' ? 'bg-white dark:bg-slate-700 text-primary dark:text-accent shadow-xl ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            >
                                <span className="material-symbols-outlined text-2xl">person</span>
                                HỌC SINH
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole('teacher')}
                                className={`flex-1 h-14 rounded-2xl flex items-center justify-center gap-3 transition-all text-sm font-black tracking-wide ${role === 'teacher' ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-xl ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            >
                                <span className="material-symbols-outlined text-2xl">history_edu</span>
                                GIÁO VIÊN
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-16 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-black rounded-3xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center uppercase tracking-[0.4em] text-base"
                        >
                            {loading ? (
                                <div className="size-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                "START"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
