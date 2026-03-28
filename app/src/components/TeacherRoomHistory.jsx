import { useState, useEffect } from 'react';
import { useTeacherDashboard } from '../hooks/useTeacherDashboard';

export default function TeacherRoomHistory({ user }) {
    const { rooms, isLoading: loading, refresh: fetchRooms, fetchRanking, deleteRoom, error } = useTeacherDashboard(user?.email || user?.name);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [rankingData, setRankingData] = useState([]);
    const [loadingRanking, setLoadingRanking] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null); // mã phòng đang chờ xóa

    const viewRanking = async (roomCode) => {
        setSelectedRoom(roomCode);
        setLoadingRanking(true);
        const data = await fetchRanking(roomCode);
        setRankingData(data);
        setLoadingRanking(false);
    };

    const copyLink = (code) => {
        const link = `${window.location.origin}/exams?room=${code}`;
        navigator.clipboard.writeText(link);
        setToast(`Đã sao chép link phòng: ${code}`);
        setTimeout(() => setToast(null), 3000);
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const code = confirmDelete;

        const success = await deleteRoom(code);
        if (success) {
            setToast(`Đã xóa phòng ${code}`);
            setConfirmDelete(null);
            if (selectedRoom === code) {
                setSelectedRoom(null);
                setRankingData([]);
            }
        } else {
            alert('Lỗi khi xóa phòng. Vui lòng thử lại.');
            setConfirmDelete(null);
        }
    };

    if (loading) return (
        <div className="p-20 text-center animate-pulse">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="material-symbols-outlined text-indigo-500 text-3xl animate-spin">sync</span>
            </div>
            <div className="opacity-50 font-mono text-xs tracking-widest uppercase dark:text-white">ĐANG TẢI DANH SÁCH PHÒNG THI...</div>
        </div>
    );

    if (error) return (
        <div className="p-20 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-4xl">warning</span>
            </div>
            <p className="text-red-500 font-bold mb-4">Lỗi: {error}</p>
            <button onClick={fetchRooms} className="px-6 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all font-bold text-sm shadow-lg shadow-red-500/20">Thử lại</button>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700 text-slate-900 dark:text-slate-100">
            {/* Header Card */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-[#131315] p-6 md:p-8 rounded-[32px] border border-black/5 dark:border-white/10 shadow-sm">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black mb-1 tracking-tight">Quản lý Phòng Thi</h2>
                    <p className="text-xs md:text-sm opacity-60 font-medium whitespace-pre-wrap">Xem chi tiết bảng điểm, thứ hạng và quản lý link chia sẻ cho từng phòng đã tạo.</p>
                </div>
                <button
                    onClick={fetchRooms}
                    className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 px-6 py-3 rounded-2xl text-xs font-bold transition-all shrink-0"
                >
                    <span className="material-symbols-outlined text-sm">refresh</span> Làm mới dữ liệu
                </button>
            </div>

            {toast && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 bg-indigo-600/95 backdrop-blur-md text-white rounded-full shadow-2xl shadow-indigo-600/40 animate-in slide-in-from-bottom-8 fade-in zoom-in-95 duration-400">
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                    <span className="text-sm font-bold tracking-wide">{toast}</span>
                </div>
            )}

            {/* Custom Confirm Modal */}
            {confirmDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setConfirmDelete(null)} />
                    <div className="relative bg-white dark:bg-[#131315] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border border-black/5 dark:border-white/10 p-8 animate-in zoom-in-95 fade-in duration-300">
                        <div className="size-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                            <span className="material-symbols-outlined text-rose-500 text-3xl">delete_sweep</span>
                        </div>
                        <h3 className="text-xl font-black text-center mb-2 italic">Xóa phòng #{confirmDelete}?</h3>
                        <p className="text-center text-sm opacity-60 font-medium mb-8 leading-relaxed">
                            Mọi dữ liệu bảng điểm và lịch sử thi sẽ bị xóa vĩnh viễn và không thể khôi phục. Bạn vẫn muốn tiếp tục chứ?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDelete}
                                className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-rose-500/20 active:scale-[0.98]"
                            >
                                XÁC NHẬN XÓA PHÒNG
                            </button>
                            <button
                                onClick={() => setConfirmDelete(null)}
                                className="w-full py-4 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                            >
                                HỦY BỎ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px]">
                {/* Left: Rooms List */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    {rooms.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white/40 dark:bg-[#131315]/40 rounded-[32px] border border-dashed border-black/10 dark:border-white/10 opacity-60">
                            <span className="material-symbols-outlined text-4xl mb-3 opacity-50">restore</span>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-center leading-relaxed">Chưa có phòng thi nào<br />được tạo.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
                            {rooms.map(room => (
                                <button
                                    key={room.roomCode}
                                    onClick={() => viewRanking(room.roomCode)}
                                    className={`w-full text-left p-6 rounded-[28px] border transition-all duration-500 overflow-hidden relative group ${selectedRoom === room.roomCode
                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl shadow-indigo-600/30 scale-[1.02] z-10'
                                            : 'bg-white dark:bg-[#131315] border-black/5 dark:border-white/10 hover:border-indigo-500/50 hover:shadow-xl'
                                        }`}
                                >
                                    {selectedRoom === room.roomCode && (
                                        <div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-1/4 -translate-y-1/4">
                                            <span className="material-symbols-outlined text-8xl">verified</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-4 relative z-10">
                                        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${selectedRoom === room.roomCode ? 'bg-white/20' : 'bg-indigo-500/10 text-indigo-500'
                                            }`}>
                                            #{room.roomCode}
                                        </div>
                                        <div className="text-[10px] font-bold opacity-50 italic">
                                            {new Date(room.createdAt).toLocaleDateString()}
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(room.roomCode); }}
                                            className={`p-1.5 rounded-lg transition-all ${selectedRoom === room.roomCode
                                                    ? 'hover:bg-red-500/20 text-white/50 hover:text-white'
                                                    : 'hover:bg-red-500/10 text-slate-400 hover:text-red-500'
                                                }`}
                                            title="Xóa phòng thi này"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                                        </button>
                                    </div>

                                    <div className="text-lg font-black mb-6 truncate relative z-10 leading-tight">
                                        {room.examId.replace(/_/g, ' ')}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 relative z-10">
                                        <div className={`p-3 rounded-2xl flex flex-col items-center text-center transition-colors ${selectedRoom === room.roomCode ? 'bg-white/10' : 'bg-slate-50 dark:bg-white/5 group-hover:bg-indigo-500/5'
                                            }`}>
                                            <div className="text-[9px] uppercase tracking-widest opacity-60 font-black mb-1">Thí sinh</div>
                                            <div className="text-lg font-black">{room.participantCount} <span className="text-[10px] opacity-50 not-italic">em</span></div>
                                        </div>
                                        <div className={`p-3 rounded-2xl flex flex-col items-center text-center transition-colors ${selectedRoom === room.roomCode ? 'bg-white/10' : 'bg-slate-50 dark:bg-white/5 group-hover:bg-indigo-500/5'
                                            }`}>
                                            <div className="text-[9px] uppercase tracking-widest opacity-60 font-black mb-1">Điểm TB</div>
                                            <div className="text-lg font-black">{room.avgScore}<span className="text-[10px] opacity-50 not-italic">đ</span></div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: Ranking Details */}
                <div className="lg:col-span-8 bg-white dark:bg-[#131315] rounded-[32px] border border-black/5 dark:border-white/10 overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                    {!selectedRoom ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
                            <div className="w-24 h-24 rounded-full border-4 border-dashed border-indigo-500/30 mb-8 flex items-center justify-center animate-pulse">
                                <span className="material-symbols-outlined text-5xl text-indigo-500">ads_click</span>
                            </div>
                            <h3 className="text-2xl font-black mb-3 italic tracking-tight">Vui lòng chọn một phòng thi</h3>
                            <p className="max-w-[280px] text-sm font-medium leading-relaxed opacity-70">Nhấn vào danh sách bên trái để xem bảng xếp hạng chi tiết và quản lý phòng thi này.</p>
                        </div>
                    ) : (
                        loadingRanking ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-20 gap-6">
                                <div className="relative">
                                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-indigo-500 animate-pulse">leaderboard</span>
                                    </div>
                                </div>
                                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-40 italic">Đang phân tích thứ hạng...</p>
                            </div>
                        ) : (
                            <>
                                <div className="p-8 bg-slate-50/50 dark:bg-white/5 border-b border-black/5 dark:border-white/10">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg text-xs font-black font-mono">#{selectedRoom}</span>
                                                <h3 className="text-xl font-black text-slate-800 dark:text-white truncate uppercase tracking-tight italic">
                                                    {rooms.find(r => r.roomCode === selectedRoom)?.examId.replace(/_/g, ' ')}
                                                </h3>
                                            </div>
                                            <div className="flex flex-wrap gap-4">
                                                <div className="flex items-center gap-1.5 text-xs font-bold opacity-60">
                                                    <span className="material-symbols-outlined text-sm">groups</span>
                                                    {rankingData.length} thí sinh nộp bài
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs font-bold opacity-60">
                                                    <span className="material-symbols-outlined text-sm">event</span>
                                                    Đã tạo {new Date(rooms.find(r => r.roomCode === selectedRoom)?.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => copyLink(selectedRoom)}
                                            className="flex-shrink-0 flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">ios_share</span>
                                            Chia sẻ link
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                                    {rankingData.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-24 text-slate-400 opacity-60">
                                            <div className="p-6 bg-slate-100 dark:bg-white/5 rounded-full mb-4">
                                                <span className="material-symbols-outlined text-5xl italic opacity-30">pending_actions</span>
                                            </div>
                                            <p className="text-[13px] font-black uppercase tracking-widest italic">Chưa có ai nộp bài trong phòng này.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                                <div className="col-span-2">Thứ hạng</div>
                                                <div className="col-span-6">Thí sinh</div>
                                                <div className="col-span-4 text-right">Điểm số</div>
                                            </div>
                                            {rankingData.map((rk, idx) => (
                                                <div key={idx} className="grid grid-cols-12 items-center p-5 bg-slate-50 dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/5 hover:border-indigo-500/30 transition-all group hover:scale-[1.01] hover:shadow-lg">
                                                    <div className="col-span-2">
                                                        <div className={`w-9 h-9 flex items-center justify-center rounded-xl font-black italic shadow-sm ${idx === 0 ? 'bg-gradient-to-tr from-yellow-400 to-orange-500 text-white shadow-yellow-500/20' :
                                                                idx === 1 ? 'bg-slate-300 text-slate-700' :
                                                                    idx === 2 ? 'bg-orange-400 text-white shadow-orange-500/10' : 'bg-black/5 dark:bg-white/10 opacity-70'
                                                            }`}>
                                                            {idx + 1}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-6 min-w-0">
                                                        <div className="font-black text-sm group-hover:text-indigo-500 transition-colors uppercase truncate">{rk.name}</div>
                                                        <div className="text-[10px] opacity-40 font-bold flex items-center gap-1.5 mt-0.5">
                                                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                                                            {new Date(rk.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                            <span className="opacity-30">•</span>
                                                            {rk.email || 'Học sinh'}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-4 text-right">
                                                        <span className={`text-2xl font-black italic tracking-tighter ${rk.score >= 8 ? 'text-emerald-500' :
                                                                rk.score >= 5 ? 'text-indigo-500' : 'text-red-500'
                                                            }`}>
                                                            {rk.score}
                                                        </span>
                                                        <span className="text-[11px] font-bold not-italic opacity-30 ml-1">/10</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.1); border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.3); }
            `}} />
        </div>
    );
}
