/**
 * Simple authentication store for identifying Student vs Teacher.
 * Key: 'van_auth_user'
 */

import localforage from 'localforage'

const AUTH_KEY = 'van_auth_user';

export function getAuthUser() {
    try {
        const raw = localStorage.getItem(AUTH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function saveAuthUser(user) {
    try {
        // user: { name, email, role: 'student'|'teacher', grade, studentId, school, isVerified }
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
        window.dispatchEvent(new Event('van_auth_update'));
        window.dispatchEvent(new Event('van_eval_update'));
    } catch (e) {
        console.error("Auth save failed", e);
    }
}

export async function logout() {
    try {
        // 1. CHỈ xóa session-specific data (trạng thái chat tạm thời)
        sessionStorage.clear();
        
        // 2. Xóa thông tin đăng nhập hiện tại
        localStorage.removeItem(AUTH_KEY);
        
        // 3. Thông báo cho App cập nhật UI (để reset các component dùng hook useAuth)
        window.dispatchEvent(new Event('van_auth_update'));
        
        // 4. Phát sự kiện update eval store để các component đang hiển thị điểm số/lịch sử tự động reset về DEFAULT_STORE của user mới (null)
        window.dispatchEvent(new Event('van_eval_update'));
        
        // 5. Chuyển hướng về trang chủ để reset state hoàn toàn nhưng KHÔNG xóa sạch DB
        window.location.href = '/home';
    } catch (e) {
        console.error("Logout error:", e);
        localStorage.removeItem(AUTH_KEY);
        window.location.reload();
    }
}
