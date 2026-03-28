import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTeacherDashboard } from '../hooks/useTeacherDashboard';

export default function TeacherDashboard({ user, onAskAI }) {
    const { data, isLoading: loading, error, refresh } = useTeacherDashboard(user?.email || user?.name);

    if (loading) return <div className="p-8 text-center opacity-70 tracking-widest font-monospace uppercase text-sm">Đang phân tích dữ liệu lớp học...</div>;
    
    if (error) return (
        <div className="p-12 text-center text-slate-100">
            <p className="text-red-500 font-bold mb-4">Lỗi: {error}</p>
            <button onClick={refresh} className="px-4 py-2 bg-indigo-600 text-white rounded-xl">Thử lại</button>
        </div>
    );

    if (!data || !data.overview) return (
        <div className="p-20 text-center opacity-40 animate-pulse text-slate-100">
            <span className="material-symbols-outlined text-4xl mb-4">hourglass_empty</span>
            <p className="font-mono text-xs tracking-widest uppercase">Đang chờ dữ liệu từ hệ thống...</p>
        </div>
    );

    const handleAskAI = () => {
        const prompt = `Dạ thưa AI, đây là số liệu lớp tôi qua các bài kiểm tra gần nhất:
- Điểm trung bình: ${data.overview.avgScore}
- Tổng lượt thi: ${data.overview.totalStudents}
- Danh sách phổ điểm (Giỏi, Khá, TB, Yếu): ${JSON.stringify(data.scoreDistribution)}
- Các em xuất sắc nhất: ${data.topStudents.map(s => `${s.name} (${s.avg}đ)`).join(', ')}
- Các em đang yếu hoặc tụt dốc: ${data.strugglingStudents.map(s => `${s.name} (${s.avg}đ)`).join(', ')}

Dựa vào dữ liệu trên, hãy phân tích chuyên sâu xu hướng học lực của lớp, chỉ ra điểm yếu và tư vấn cho tôi cách kèm cặp 3 em học sinh yếu nhất (kèm theo bài tập rèn luyện cụ thể để tôi giao).`;
        onAskAI(prompt);
    };

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8 max-w-5xl mx-auto w-full text-slate-800 dark:text-slate-100 animate-in fade-in duration-700">
            <div className="flex flex-wrap justify-between items-center bg-white dark:bg-[#131315] p-6 md:p-8 rounded-[32px] border border-black/5 dark:border-white/10 shadow-sm backdrop-blur-md">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black mb-1 tracking-tight italic">Thống kê lớp học</h2>
                    <p className="text-xs md:text-sm opacity-60 font-medium">Theo dõi tiến độ và phổ điểm của tất cả kỳ thi.</p>
                </div>
                <button 
                    onClick={handleAskAI}
                    className="flex items-center gap-2 bg-[#4c6ef5] text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#3b5bdb] transition-all hover:scale-105 active:scale-95 shadow-xl shadow-[#4c6ef5]/30 mt-4 md:mt-0"
                >
                    <span className="material-symbols-outlined text-lg">smart_toy</span>
                    AI Phân tích dữ liệu
                </button>
            </div>

            <div className="grid grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#131315] p-8 rounded-[32px] border border-black/5 dark:border-white/10 text-center shadow-sm hover:border-[#4c6ef5]/50 transition-all hover:scale-[1.02]">
                    <div className="text-[10px] md:text-xs opacity-50 uppercase tracking-[0.2em] font-black">Phòng thi</div>
                    <div className="text-4xl md:text-5xl font-black mt-3 text-[#4c6ef5] italic">{data.overview.totalRooms}</div>
                </div>
                <div className="bg-white dark:bg-[#131315] p-8 rounded-[32px] border border-black/5 dark:border-white/10 text-center shadow-sm hover:border-[#4c6ef5]/50 transition-all hover:scale-[1.02]">
                    <div className="text-[10px] md:text-xs opacity-50 uppercase tracking-[0.2em] font-black">Lượt thi</div>
                    <div className="text-4xl md:text-5xl font-black mt-3 text-[#4c6ef5] italic">{data.overview.totalStudents}</div>
                </div>
                <div className="bg-white dark:bg-[#131315] p-8 rounded-[32px] border border-black/5 dark:border-white/10 text-center shadow-sm hover:border-[#4c6ef5]/50 transition-all hover:scale-[1.02]">
                    <div className="text-[10px] md:text-xs opacity-50 uppercase tracking-[0.2em] font-black">Điểm TB Lớp</div>
                    <div className="text-4xl md:text-5xl font-black mt-3 text-[#4c6ef5] italic">{data.overview.avgScore} <span className="text-[10px] not-italic opacity-30">đ</span></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="col-span-1 md:col-span-3 bg-white dark:bg-[#131315] p-6 md:p-8 rounded-[32px] border border-black/5 dark:border-white/10 shadow-sm">
                    <h3 className="text-[11px] font-black opacity-40 uppercase tracking-[0.2em] mb-8">Tiến bộ qua thời gian (Điểm TB)</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.examTrends} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <Line type="monotone" dataKey="avgScore" name="Điểm TB" stroke="#4c6ef5" strokeWidth={4} dot={{ r: 5, strokeWidth: 3, fill: '#fff' }} activeDot={{ r: 8 }} />
                                <CartesianGrid stroke="#888" strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" stroke="#888" fontSize={10} tickMargin={15} axisLine={false} tickLine={false} />
                                <YAxis stroke="#888" domain={[0, 10]} fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: 'rgba(26, 26, 46, 0.95)', border: 'none', borderRadius: '16px', fontSize: '13px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="col-span-1 bg-white dark:bg-[#131315] p-6 md:p-8 rounded-[32px] border border-black/5 dark:border-white/10 flex flex-col gap-8 shadow-sm">
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 text-rose-500 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">error</span> CẦN LƯU Ý
                        </h3>
                        <div className="flex flex-col gap-3">
                            {data.strugglingStudents.length === 0 ? <p className="opacity-30 text-[11px] italic">Chưa có dữ liệu</p> : null}
                            {data.strugglingStudents.map(s => (
                                <div key={s.name} className="flex justify-between items-center p-3 bg-rose-500/5 rounded-2xl border border-rose-500/10 transition-transform hover:scale-[1.05]">
                                    <span className="text-sm font-bold truncate pr-2">{s.name}</span>
                                    <span className="font-black text-rose-500 italic shrink-0">{s.avg.toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 text-emerald-500 flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">verified</span> XUẤT SẮC
                        </h3>
                        <div className="flex flex-col gap-3">
                            {data.topStudents.length === 0 ? <p className="opacity-30 text-[11px] italic">Chưa có dữ liệu</p> : null}
                            {data.topStudents.map(s => (
                                <div key={s.name} className="flex justify-between items-center p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 transition-transform hover:scale-[1.05]">
                                    <span className="text-sm font-bold truncate pr-2">{s.name}</span>
                                    <span className="font-black text-emerald-500 italic shrink-0">{s.avg.toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="col-span-1 md:col-span-4 bg-white dark:bg-[#131315] p-6 md:p-8 rounded-[32px] border border-black/5 dark:border-white/10 shadow-sm">
                    <h3 className="text-[11px] font-black opacity-40 uppercase tracking-[0.2em] mb-8">Phổ điểm học lực</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.scoreDistribution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                                <XAxis dataKey="name" stroke="#888" fontSize={10} tickMargin={15} axisLine={false} tickLine={false} />
                                <YAxis stroke="#888" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: 'rgba(26, 26, 46, 0.95)', border: 'none', borderRadius: '16px', fontSize: '13px', color: '#fff' }} />
                                <Bar dataKey="value" name="Số lượng" fill="#4c6ef5" radius={[10, 10, 0, 0]} maxBarSize={60} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
