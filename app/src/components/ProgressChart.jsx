import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function ProgressChart({ history }) {
    if (!history || history.length === 0) return null;

    // Reverse history to show from oldest to newest
    const data = [...history].reverse().map((h, i) => ({
        index: i + 1,
        date: h.date,
        score: typeof h.score === 'number' ? h.score : parseFloat(h.score) || 0,
        label: h.title
    }));

    return (
        <div className="w-full h-[200px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                        dataKey="index"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        stroke="#94a3b8"
                        label={{ value: 'Bài làm', position: 'insideBottom', offset: -5, fontSize: 10 }}
                    />
                    <YAxis
                        domain={[0, 10]}
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        stroke="#94a3b8"
                        tickCount={6}
                    />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-white dark:bg-slate-800 p-2 border border-slate-100 dark:border-slate-700 shadow-xl rounded-lg text-xs">
                                        <p className="font-bold text-slate-900 dark:text-white mb-1">{d.label}</p>
                                        <p className="text-slate-500">{d.date}</p>
                                        <p className="text-primary font-bold mt-1">Điểm: {d.score.toFixed(1)}</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#0D9488"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorScore)"
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
