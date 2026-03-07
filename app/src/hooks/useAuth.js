/**
 * Simple authentication store for identifying Student vs Teacher.
 * Key: 'van_auth_user'
 */

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
        // user: { name, email, role: 'student' | 'teacher' }
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
        window.dispatchEvent(new Event('van_auth_update'));
    } catch (e) {
        console.error("Auth save failed", e);
    }
}

export function logout() {
    localStorage.removeItem(AUTH_KEY);
    window.dispatchEvent(new Event('van_auth_update'));
}
