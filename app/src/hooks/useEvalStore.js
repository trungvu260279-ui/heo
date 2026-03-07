/**
 * Persistent evaluation store via localStorage.
 * Key: 'van_eval_store'
 * Shape: { skills: [{label,value}], suggestions: [{type,title,body}], history: [{...}] }
 */

import localforage from 'localforage'

const LS_KEY = 'van_eval_store'

// Initialize localforage for large exam data history
localforage.config({
    name: 'VanPlatform',
    storeName: 'exam_history'
})

export async function saveExamHistoryDetail(examId, data) {
    try {
        await localforage.setItem(`exam_${Date.now()}_${examId}`, data)
    } catch (e) {
        console.error("Failed to save exam history to localforage", e)
    }
}

export async function getAllExamHistoryDetails() {
    try {
        const keys = await localforage.keys()
        const examKeys = keys.filter(k => k.startsWith('exam_'))
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
        const raw = localStorage.getItem(LS_KEY)
        if (!raw) return { ...DEFAULT_STORE }
        return { ...DEFAULT_STORE, ...JSON.parse(raw) }
    } catch {
        return { ...DEFAULT_STORE }
    }
}

export function writeStore(data) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify({ ...data, hasData: true }))
        window.dispatchEvent(new Event('van_eval_update'))
    } catch {
        // ignore quota errors
    }
}

export function useEvalStore() {
    // Simple hook – just reads once (components listen to storage event themselves)
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
    }

    writeStore({
        skills: mergedSkills,
        suggestions: result.suggestions, // Keep the latest suggestions
        history: [historyEntry, ...store.history].slice(0, 10), // Keep last 10 attempts
        totalAttempts: newAttempts
    })
}
