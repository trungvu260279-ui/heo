import { useState, useEffect } from 'react';

/**
 * Custom hook to fetch and manage Teacher Dashboard data.
 * Follows Project Rule #3: No manual fetch in components.
 */
export function useTeacherDashboard(email) {
    const [data, setData] = useState(null);
    const [isLoading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchDashboard = async () => {
        if (!email) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/teacher/dashboard/${encodeURIComponent(email)}`);
            if (!res.ok) throw new Error(`Lỗi server: ${res.status}`);
            const result = await res.json();
            setData(result);
        } catch (err) {
            console.error("Dashboard Fetch Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, [email]);

    return { 
        data, 
        rooms: data?.roomHistory || [],
        isLoading, 
        error, 
        refresh: fetchDashboard,
        fetchRanking: async (roomCode) => {
            try {
                const res = await fetch(`/api/room/${roomCode}/ranking`);
                if (!res.ok) return [];
                return await res.json();
            } catch (err) { return []; }
        },
        deleteRoom: async (roomCode) => {
            try {
                const res = await fetch(`/api/room/${roomCode}`, { method: 'DELETE' });
                if (!res.ok) throw new Error("Không thể xóa phòng");
                await fetchDashboard();
                return true;
            } catch (err) {
                console.error("Delete Room Error:", err);
                return false;
            }
        }
    };
}
