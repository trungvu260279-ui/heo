import { useState, useEffect } from 'react';
import { saveAuthUser, getAuthUser } from '../hooks/useAuth';
import { GoogleLogin } from '@react-oauth/google';

export default function LoginModal({ isOpen, onClose }) {
    const existingUser = getAuthUser();
    const [name, setName] = useState(existingUser?.name || '');
    const [email, setEmail] = useState(existingUser?.email || '');
    const [role, setRole] = useState(existingUser?.role || 'student');
    const [grade, setGrade] = useState(existingUser?.grade || '11');
    const [password, setPassword] = useState('');
    const [school, setSchool] = useState(existingUser?.school || 'THPT Kim Xuyên');
    const [loading, setLoading] = useState(false);
    const [needsSetup, setNeedsSetup] = useState(false); // Trạng thái yêu cầu nhập tên/lớp sau Google Login

    useEffect(() => {
        if (isOpen && existingUser) {
            setName(existingUser.name || '');
            setEmail(existingUser.email || '');
            setRole(existingUser.role || 'student');
            setGrade(existingUser.grade || '11');
            setSchool(existingUser.school || 'THPT Kim Xuyên');
        }
    }, [isOpen, existingUser]);

    if (!isOpen) return null;

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        if (!name) return alert("Vui lòng nhập tên của bạn nhé!");
        
        // Không bắt nhập pass nếu là đăng nhập Google (needsSetup) hoặc đã đăng nhập rồi (chỉ cập nhật profile)
        if (!needsSetup && !password && !existingUser?.studentId?.startsWith('VANS-')) {
            return alert("Vui lòng nhập mật khẩu!");
        }

        setLoading(true);
        const namePrefix = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, '');
        const dummyEmail = email || `${namePrefix}@kimxuyen.edu`;
        
        const userData = { 
            name, 
            email: dummyEmail, 
            role, 
            grade: role === 'student' ? grade : null,
            password,
            school,
            isVerified: true
        };
        
        try {
            const syncRes = await fetch('/api/user/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            const syncData = await syncRes.json();
            
            if (syncRes.status === 401) {
                alert("Sai mật khẩu! Vui lòng kiểm tra lại nhé.");
                setLoading(false);
                return;
            }

            if (syncData.success) {
                saveAuthUser(syncData.user);
                onClose();
            } else {
                throw new Error(syncData.error);
            }
        } catch (err) {
            console.warn("Sync failed", err);
            alert("Đã có lỗi xảy ra: " + (err.message || "Không thể kết nối server"));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse) => {
        setLoading(true);
        try {
            const res = await fetch('/api/user/google-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: credentialResponse.credential })
            });
            const data = await res.json();
            
            if (data.success) {
                if (data.needsSetup) {
                    // Chuyển sang chế độ nhập Tên + Lớp
                    setName(data.user.name || '');
                    setEmail(data.user.email);
                    setNeedsSetup(true);
                } else {
                    saveAuthUser(data.user);
                    onClose();
                }
            } else {
                alert("Lỗi đăng nhập Google: " + data.error);
            }
        } catch (err) {
            console.error("Google verify error:", err);
            alert("Không thể kết nối server để xác thực Google. " + (err.message || ""));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-700" onClick={onClose} />

            <div className="relative bg-white/95 dark:bg-slate-900/95 w-full max-w-[520px] rounded-[40px] shadow-[0_48px_96px_-16px_rgba(0,0,0,0.5)] border border-white/20 dark:border-slate-700/50 overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in slide-in-from-bottom-12 duration-500 scrollbar-hide">
                <div className="p-8 md:p-10">
                    <div className="flex justify-center mb-6">
                        <div className="size-16 md:size-20 rounded-[24px] bg-gradient-to-tr from-primary via-accent to-primary p-0.5 shadow-xl shadow-primary/20">
                            <div className="w-full h-full rounded-[22px] bg-white dark:bg-slate-900 flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl md:text-4xl bg-gradient-to-tr from-primary to-accent bg-clip-text text-transparent">
                                    {needsSetup ? 'edit_note' : (existingUser ? 'person_edit' : 'school')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-2xl md:text-3xl font-black text-center text-slate-900 dark:text-white mb-2 tracking-[0.3em] uppercase font-['Patrick_Hand']">
                        {needsSetup ? 'HOÀN TẤT THÔNG TIN' : (existingUser ? 'THÔNG TIN CÁ NHÂN' : 'THPT KIM XUYÊN')}
                    </h2>
                    <p className="text-center text-slate-500 dark:text-slate-400 text-[10px] mb-8 font-bold uppercase tracking-[0.3em]">
                        {needsSetup ? 'Nhập tên và khối lớp để bắt đầu' : (existingUser ? 'Cập nhật danh tính của bạn' : 'Hệ thống Đánh giá Năng lực')}
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-3">
                            {/* Họ và tên */}
                            <div className="relative group">
                                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none group-focus-within:text-primary transition-colors">person</span>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Họ và tên của bạn"
                                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all text-sm font-bold dark:text-white placeholder-slate-400"
                                />
                            </div>

                            {!needsSetup && (
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none group-focus-within:text-primary transition-colors">lock</span>
                                    <input
                                        type="password"
                                        required={!existingUser}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder={existingUser ? "Mật khẩu (để trống nếu không đổi)" : "Nhập mật khẩu"}
                                        className="w-full h-14 pl-12 pr-6 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary focus:bg-white dark:focus:bg-slate-800 outline-none transition-all text-sm font-bold dark:text-white placeholder-slate-400"
                                    />
                                </div>
                            )}

                            {!needsSetup && (
                                <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                                    <button
                                        type="button"
                                        onClick={() => setRole('student')}
                                        className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-2 transition-all text-[11px] font-black tracking-wide ${role === 'student' ? 'bg-white dark:bg-slate-700 text-primary dark:text-accent shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                    >
                                        <span className="material-symbols-outlined text-xl">school</span>
                                        HỌC SINH
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('teacher')}
                                        className={`flex-1 h-11 rounded-xl flex items-center justify-center gap-2 transition-all text-[11px] font-black tracking-wide ${role === 'teacher' ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-md ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                    >
                                        <span className="material-symbols-outlined text-xl">history_edu</span>
                                        GIÁO VIÊN
                                    </button>
                                </div>
                            )}

                            {role === 'student' && (
                                <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-900/20">
                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest pl-1">Chọn khối lớp</p>
                                    <div className="flex gap-2">
                                        {['10', '11', '12'].map(g => (
                                            <button
                                                key={g}
                                                type="button"
                                                onClick={() => setGrade(g)}
                                                className={`flex-1 h-10 rounded-xl font-bold text-xs transition-all border ${grade === g ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.05]' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}
                                            >
                                                LỚP {g}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!needsSetup && (
                                <div className="relative group">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none group-focus-within:text-primary">domain</span>
                                    <input
                                        type="text"
                                        value={school}
                                        onChange={e => setSchool(e.target.value)}
                                        placeholder="Trường học (Ví dụ: THPT Kim Xuyên)"
                                        className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-primary outline-none transition-all text-sm font-bold dark:text-white"
                                    />
                                </div>
                            )}
                        </div>

                        {!existingUser && !needsSetup && (
                            <div className="flex flex-col items-center gap-3 pt-2">
                                <div className="w-full flex items-center gap-3 py-2">
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Đăng nhập nhanh</span>
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                                </div>
                                <div className="flex justify-center w-full">
                                    <GoogleLogin
                                        onSuccess={handleGoogleSuccess}
                                        onError={() => alert('Đăng nhập Google thất bại')}
                                        useOneTap
                                        type="icon"
                                        theme="filled_blue"
                                        shape="circle"
                                        size="large"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full h-14 text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center uppercase tracking-[0.3em] text-sm active:scale-[0.98] ${needsSetup ? 'bg-green-600 shadow-green-200' : (existingUser ? 'bg-indigo-600' : 'bg-primary')}`}
                        >
                            {loading ? (
                                <div className="size-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                needsSetup ? "XÁC NHẬN & VÀO HỌC" : (existingUser ? "CẬP NHẬT" : "VÀO HỌC NGAY")
                            )}
                        </button>

                        {!needsSetup && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full h-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-black uppercase tracking-widest transition-colors"
                            >
                                Để sau
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
