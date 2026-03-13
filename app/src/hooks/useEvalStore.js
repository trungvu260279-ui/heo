import localforage from 'localforage'
import { getAuthUser } from './useAuth'

const BASE_LS_KEY = 'van_eval_store'

// Initialize localforage for large exam data history
localforage.config({
    name: 'VanPlatform',
    storeName: 'exam_history'
})

function getStoreKey() {
    const user = getAuthUser()
    const emailSuffix = user?.email ? `_${user.email}` : ''
    return `${BASE_LS_KEY}${emailSuffix}`
}

export async function saveExamHistoryDetail(examId, data) {
    const user = getAuthUser()
    if (!user?.email) return
    try {
        const key = `${user.email}_exam_${Date.now()}_${examId}`
        await localforage.setItem(key, data)
    } catch (e) {
        console.error("Failed to save exam history to localforage", e)
    }
}

export async function getAllExamHistoryDetails() {
    const user = getAuthUser()
    if (!user?.email) return []
    try {
        const keys = await localforage.keys()
        const userPrefix = `${user.email}_exam_`
        const examKeys = keys.filter(k => k.startsWith(userPrefix))
        const results = await Promise.all(examKeys.map(k => localforage.getItem(k)))
        return results.sort((a, b) => b.timestamp - a.timestamp)
    } catch (e) {
        console.error("Failed to fetch exam history", e)
        return []
    }
}

const DEFAULT_STORE = {
    skills: [
        { label: 'Ngôn ngữ', value: 0 },
        { label: 'Tư duy PB', value: 0 },
        { label: 'Cấu trúc', value: 0 },
        { label: 'Diễn đạt', value: 0 },
    ],
    suggestions: [],
    history: [],
    hasData: false,
    totalAttempts: 0,
}

export function readStore() {
    try {
        const key = getStoreKey()
        const raw = localStorage.getItem(key)
        if (!raw) return { ...DEFAULT_STORE }
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_STORE, ...parsed }
    } catch {
        return { ...DEFAULT_STORE }
    }
}

export function writeStore(data) {
    try {
        const key = getStoreKey()
        localStorage.setItem(key, JSON.stringify({ ...data, hasData: true }))
        window.dispatchEvent(new Event('van_eval_update'))
    } catch {
        // ignore quota errors
    }
}

export function useEvalStore() {
    return readStore()
}

export function addEvaluation(result, exerciseInfo) {
    const store = readStore()
    const attempts = store.totalAttempts || (store.hasData ? store.history.length : 0)
    const newAttempts = attempts + 1

    const oldSkills = store.skills
    const newSkills = result.skills

    const mergedSkills = newSkills.map((ns, i) => {
        const oldVal = Number(oldSkills[i]?.value || 5)
        const newVal = Number(ns.value)
        const avg = store.hasData 
            ? ((oldVal * attempts) + newVal) / newAttempts 
            : newVal
            
        return {
            ...ns,
            value: Number(avg.toFixed(1))
        }
    })

    const historyEntry = {
        icon: exerciseInfo.icon || 'quiz',
        title: exerciseInfo.title || 'Luyện tập',
        date: new Date().toLocaleDateString('vi-VN'),
        type: exerciseInfo.type || 'Luyện tập',
        score: result.overall,
        change: store.hasData && store.history.length > 0
            ? (result.overall - store.history[0].score >= 0 ? '+' : '') + (result.overall - store.history[0].score).toFixed(1)
            : '—',
        positive: store.history.length > 0 ? (result.overall >= store.history[0].score) : null,
        timestamp: Date.now()
    }

    writeStore({
        skills: mergedSkills,
        suggestions: result.suggestions, 
        history: [historyEntry, ...store.history].slice(0, 10), 
        totalAttempts: newAttempts
    })
}
