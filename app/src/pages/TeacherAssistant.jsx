import { useState, useRef, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import teacherData from '../data/teacher_data_v2.json'
import { getAuthUser } from '../hooks/useAuth'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mammoth from 'mammoth'
import * as pdfjs from 'pdfjs-dist'
import TeacherDashboard from '../components/TeacherDashboard'
import TeacherRoomHistory from '../components/TeacherRoomHistory'

// Set PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Bạn là Chuyên gia đổi mới dạy học Ngữ văn. Nhiệm vụ: Tích hợp Phụ lục III (Năng lực số - NLS & Phòng chống tham nhũng - PCTN) vào KHBD THPT.
Quy định phản hồi:
1. Phân tích KHBD: Xác định vị trí tích hợp NLS/PCTN.
2. Thiết kế hoạt động: Ưu tiên Bước 1 (Giao nhiệm vụ) & Bước 3 (Thực hiện).
3. Công cụ NLS: Gợi ý Canva, Padlet, Kahoot, AI, Sơ đồ tư duy số.
4. Tích hợp PCTN: Lồng ghép qua phân tích nhân vật, đạo đức, lý tưởng sống về sự liêm chính.
5. Định dạng: Tuân thủ PL4. Phải sửa đổi Mục tiêu & Các bước thực hiện chi tiết để GV có thể copy-paste. Các đề mục như "a. Mục tiêu", "b. Nội dung", "c. Sản phẩm", "d. Tổ chức thực hiện" PHẢI nằm trên dòng riêng biệt, in đậm.
6. Tông giọng: Chuyên nghiệp, sư phạm, hỗ trợ giảm tải cho GV.
7. Ngắn gọn trọng tâm, không lan man.
8. Nếu có tệp đính kèm (Ảnh, PDF, Word), hãy sử dụng nội dung từ tệp đó để trả lời chính xác.
9. QUAN TRỌNG: Luôn sử dụng tối thiểu 2 dấu xuống dòng để phân tách các đoạn văn, mục tiêu, và các bước thực hiện. Mỗi nội dung chính phải nằm trên một dòng riêng biệt, dễ đọc, dễ sao chép. Tuyệt đối không viết dính chùm các đề mục vào cùng một đoạn.
10. Nếu user trả lời vu vơ không hỏi gì thì trả lời bình thường vui vui`

// ─── File Extraction ──────────────────────────────────────────────────────────
async function extractDocxText(file) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
}

async function extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        fullText += content.items.map(item => item.str).join(' ') + '\n'
    }
    return fullText
}

// ─── BM25 Context Retrieval ───────────────────────────────────────────────────
function findContextBM25(query) {
    const qTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    if (qTokens.length === 0) return ''

    const grade = query.match(/10|11|12/)?.[0]
    const docs = [
        ...teacherData.ke_hoach_day_học.map(i => ({ ...i, type: 'plan', text: `${i.grade} ${i.bai_hoc} ${i.tich_hop_nls} ${i.bo_sung}` })),
        ...teacherData.nang_luc_so_chi_tiet.map(i => ({ ...i, type: 'nls', text: `${i.grade} ${i.bai_hoc} ${i.chi_bao} ${i.yeu_cau} ${i.minh_chung}` }))
    ]

    const scoredDocs = docs.map(doc => {
        let score = 0
        const docText = doc.text.toLowerCase()
        if (grade && doc.grade === grade) score += 5
        qTokens.forEach(token => {
            if (docText.includes(token)) score += (token.length > 4 ? 2 : 1)
        })
        return { ...doc, score }
    })

    const best = scoredDocs.sort((a, b) => b.score - a.score)[0]
    if (!best || best.score < 2) return ''

    if (best.type === 'plan') {
        return `\n[REF|L${best.grade}|${best.bai_hoc}|NLS:${best.tich_hop_nls || 'None'}|Note:${best.bo_sung || 'None'}]`
    }
    return `\n[REF|NLS_L${best.grade}|YêuCầu:${best.yeu_cau || best.chi_bao}|MinhChứng:${best.minh_chung}]`
}

// ─── Streaming API ────────────────────────────────────────────────────────────
async function callStreamGeminiAPI(instruction, history = [], attachments = [], onChunk) {
    const context = findContextBM25(instruction)
    const finalInstruction = instruction + context
    const trimmedHistory = history.slice(-4)

    const parts = [{ text: finalInstruction }]
    for (const file of attachments) {
        if (file.type.startsWith('image/')) {
            const base64Data = file.preview.split(',')[1]
            parts.push({ inlineData: { data: base64Data, mimeType: file.type } })
        } else if (file.extractedText) {
            parts.push({ text: `\n[Nội dung từ tệp ${file.name}]:\n${file.extractedText}` })
        }
    }

    const chatHistory = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'Đã sẵn sàng. Tôi đã nhận được chỉ thị và sẽ phân tích các tệp đính kèm nếu có.' }] },
        ...trimmedHistory
    ]

    try {
        const res = await fetch('/api/gemini-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: parts, history: chatHistory })
        })

        if (!res.ok) throw new Error('Backend API failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''
        let buffer = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop()

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim()
                    if (dataStr === '[DONE]') continue
                    try {
                        const data = JSON.parse(dataStr)
                        if (data.text) {
                            fullText += data.text
                            onChunk(fullText)
                        }
                    } catch (e) { }
                }
            }
        }
        return fullText
    } catch (err) {
        console.error('Chat request failed:', err)
        throw err
    }
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────
const MarkdownContent = memo(({ content, role }) => (
    <div className={`markdown-body ${role === 'model' ? 'ai-markdown' : 'user-markdown'}`}>
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                h3: ({ node, ...props }) => <h3 style={{ fontSize: '12px', fontWeight: 700, color: '#c6c4df', textTransform: 'uppercase', letterSpacing: '0.05em', borderLeft: '3px solid #c6c4df', paddingLeft: '10px', margin: '16px 0 8px' }} {...props} />,
                h2: ({ node, ...props }) => <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#e2e0fc', margin: '20px 0 10px', borderBottom: '0.5px solid #47464c', paddingBottom: '6px' }} {...props} />,
                p: ({ node, ...props }) => <p style={{ marginBottom: '10px', lineHeight: '1.65', fontSize: '13px', whiteSpace: 'pre-wrap' }} {...props} />,
                ul: ({ node, ...props }) => <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: '6px' }} {...props} />,
                li: ({ node, ...props }) => (
                    <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#c8c5cd', fontSize: '13px' }}>
                        <span style={{ color: '#c6c4df', marginTop: '6px', fontSize: '6px', flexShrink: 0 }}>●</span>
                        <span>{props.children}</span>
                    </li>
                ),
                strong: ({ node, ...props }) => <strong style={{ color: '#e2e0fc', fontWeight: 700 }} {...props} />,
                hr: () => <hr style={{ margin: '16px 0', border: 'none', borderTop: '0.5px solid #47464c' }} />,
                table: ({ node, ...props }) => (
                    <div style={{ overflowX: 'auto', margin: '16px 0', borderRadius: '6px', border: '0.5px solid #47464c' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }} {...props} />
                    </div>
                ),
                thead: ({ node, ...props }) => <thead style={{ background: '#2a2a2c' }} {...props} />,
                th: ({ node, ...props }) => <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#c8c5cd', borderBottom: '0.5px solid #47464c' }} {...props} />,
                td: ({ node, ...props }) => <td style={{ padding: '8px 12px', color: '#929097', borderBottom: '0.5px solid #2a2a2c' }} {...props} />,
                code: ({ node, inline, ...props }) => (
                    inline
                        ? <code style={{ background: '#201f21', padding: '2px 6px', borderRadius: '4px', color: '#c6c4df', fontFamily: 'monospace', fontSize: '11px' }} {...props} />
                        : <pre style={{ background: '#0e0e10', color: '#c8c5cd', padding: '14px', borderRadius: '8px', margin: '12px 0', overflowX: 'auto', fontFamily: 'monospace', fontSize: '11px' }} {...props} />
                )
            }}
        >
            {content}
        </ReactMarkdown>
    </div>
))

// ─── Suggestion Prompts ───────────────────────────────────────────────────────
const SUGGESTIONS = [
    'Tích hợp NLS vào bài Chí Phèo lớp 11',
    'Gợi ý 5 công cụ AI hỗ trợ dạy học Ngữ Văn',
    'Thiết kế ma trận đề kiểm tra giữa kỳ II',
    'Tạo rubric chấm điểm bài nghị luận văn học',
]

// ─── Inline Styles (Design Tokens) ───────────────────────────────────────────
const DarkC = {
    bg: '#0d0d0f',
    surface: '#131315',
    surfaceContainerLow: '#1b1b1d',
    surfaceContainer: '#201f21',
    surfaceContainerHigh: '#2a2a2c',
    surfaceContainerLowest: '#0e0e10',
    outlineVariant: '#47464c',
    outline: '#929097',
    primary: '#c6c4df',
    primaryFixed: '#e2e0fc',
    primaryContainer: '#1a1a2e',
    onSurfaceVariant: '#c8c5cd',
}

const LightC = {
    bg: '#f8f9fa',
    surface: '#ffffff',
    surfaceContainerLow: '#f1f3f5',
    surfaceContainer: '#e9ecef',
    surfaceContainerHigh: '#dee2e6',
    surfaceContainerLowest: '#ffffff',
    outlineVariant: '#cfd4da',
    outline: '#adb5bd',
    primary: '#4c6ef5',
    primaryFixed: '#1c1c1c',
    primaryContainer: '#edf2ff',
    onSurfaceVariant: '#495057',
}

const ThemeToggle = ({ isDark, onToggle }) => (
    <div style={{ transform: 'scale(0.55)', transformOrigin: 'right center', display: 'flex', alignItems: 'center' }}>
        <style dangerouslySetInnerHTML={{
            __html: `
            .theme-toggle { position:relative; width:96px; height:52px; border-radius:999px; border:none; cursor:pointer; padding:0; overflow:hidden; background:none; outline:none; transition: all 0.5s; }
            .theme-track { position:absolute; inset:0; border-radius:999px; transition:background 0.6s cubic-bezier(.4,0,.2,1); background:#7ec8e3; }
            .theme-toggle.dark .theme-track { background:#141428; }
            .theme-horizon { position:absolute; inset:0; border-radius:999px; background:linear-gradient(to bottom, transparent 40%, rgba(255,200,120,0.35) 100%); transition:opacity 0.5s; }
            .theme-toggle.dark .theme-horizon { background:linear-gradient(to bottom,transparent 40%,rgba(60,0,120,0.3) 100%); opacity:0.7; }
            .theme-stars { position:absolute; inset:0; border-radius:999px; overflow:hidden; }
            .theme-star { position:absolute; border-radius:50%; background:#fff; opacity:0; transform:scale(0); transition:opacity 0.5s, transform 0.5s; }
            .theme-toggle.dark .theme-star { opacity:1; transform:scale(1); }
            .theme-clouds { position:absolute; inset:0; border-radius:999px; overflow:hidden; pointer-events:none; }
            .theme-cloud { position:absolute; transition:transform 0.7s cubic-bezier(.4,0,.2,1), opacity 0.5s; }
            .theme-cloud-a { top:10px; left:calc(100% - 20px); opacity:1; }
            .theme-toggle.dark .theme-cloud-a { transform:translateX(40px); opacity:0; }
            .theme-cloud-b { top:18px; left:calc(100% - 52px); opacity:0.7; transform:scale(0.7); }
            .theme-toggle.dark .theme-cloud-b { transform:scale(0.7) translateX(50px); opacity:0; }
            .theme-knob-shell { position:absolute; top:6px; left:6px; width:40px; height:40px; border-radius:50%; transition:transform 0.55s cubic-bezier(.4,0,.2,1); }
            .theme-toggle.dark .theme-knob-shell { transform:translateX(44px); }
            .theme-sun { position:absolute; inset:0; border-radius:50%; transition:opacity 0.4s, transform 0.4s; }
            .theme-toggle.dark .theme-sun { opacity:0; transform:scale(0.5) rotate(90deg); }
            .theme-sun-disc { position:absolute; inset:0; border-radius:50%; background:radial-gradient(circle at 38% 38%, #ffe566, #f5a623); }
            .theme-ray { position:absolute; background:#ffd03a; border-radius:3px; transform-origin:center; transition:opacity 0.3s, transform 0.35s; }
            .theme-moon { position:absolute; inset:0; border-radius:50%; opacity:0; transform:scale(0.5) rotate(-90deg); transition:opacity 0.4s 0.05s, transform 0.4s 0.05s; overflow:hidden; }
            .theme-toggle.dark .theme-moon { opacity:1; transform:scale(1) rotate(0deg); }
            .theme-moon-body { position:absolute; inset:0; border-radius:50%; background:radial-gradient(circle at 35% 35%, #f5f0e0, #d4c9a8); }
            .theme-moon-bite { position:absolute; width:30px; height:30px; border-radius:50%; top:-4px; right:-4px; background:#141428; transition:background 0.6s cubic-bezier(.4,0,.2,1); }
            .theme-toggle:not(.dark) .theme-moon-bite { background: #7ec8e3; }
            .theme-moon-crater { position:absolute; border-radius:50%; background:rgba(0,0,0,0.12); }
            .theme-glow { position:absolute; inset:-8px; border-radius:50%; pointer-events:none; opacity:0; transition:opacity 0.5s; }
            .theme-sun-glow { background:radial-gradient(circle, rgba(255,210,60,0.45) 0%, transparent 70%); opacity:1; }
            .theme-moon-glow { background:radial-gradient(circle, rgba(200,210,255,0.3) 0%, transparent 70%); }
            .theme-toggle.dark .theme-moon-glow { opacity:1; }
            .theme-toggle.dark .theme-sun-glow { opacity:0; }
        ` }} />
        <button className={`theme-toggle ${isDark ? 'dark' : ''}`} onClick={onToggle}>
            <div className="theme-track" />
            <div className="theme-horizon" />
            <div className="theme-stars">
                {[
                    { t: 9, l: 22, d: 0.05, w: 2.5 }, { t: 15, l: 36, d: 0.1, w: 1.5 }, { t: 7, l: 50, d: 0.07, w: 2 },
                    { t: 22, l: 62, d: 0.13, w: 1.5 }, { t: 12, l: 74, d: 0.04, w: 2 }, { t: 30, l: 44, d: 0.15, w: 1 },
                    { t: 34, l: 68, d: 0.09, w: 1.5 }, { t: 38, l: 26, d: 0.12, w: 2 }
                ].map((s, i) => (
                    <div key={i} className="theme-star" style={{ width: s.w, height: s.w, top: s.t, left: s.l, transitionDelay: `${s.d}s` }} />
                ))}
            </div>
            <div className="theme-clouds">
                <div className="theme-cloud theme-cloud-a">
                    <svg width="52" height="26" viewBox="0 0 52 26" fill="none">
                        <ellipse cx="26" cy="20" rx="18" ry="9" fill="white" fillOpacity="0.97" />
                        <ellipse cx="36" cy="20" rx="13" ry="7" fill="white" fillOpacity="0.93" />
                        <ellipse cx="16" cy="20" rx="10" ry="6" fill="white" fillOpacity="0.9" />
                        <ellipse cx="28" cy="13" rx="12" ry="9" fill="white" fillOpacity="0.97" />
                        <ellipse cx="18" cy="16" rx="9" ry="7" fill="white" fillOpacity="0.92" />
                    </svg>
                </div>
                <div className="theme-cloud theme-cloud-b">
                    <svg width="36" height="18" viewBox="0 0 36 18" fill="none">
                        <ellipse cx="18" cy="14" rx="12" ry="6" fill="white" fillOpacity="0.88" />
                        <ellipse cx="26" cy="14" rx="9" ry="5" fill="white" fillOpacity="0.82" />
                        <ellipse cx="20" cy="9" rx="8" ry="6" fill="white" fillOpacity="0.9" />
                    </svg>
                </div>
            </div>
            <div className="theme-knob-shell">
                <div className="theme-glow theme-sun-glow" />
                <div className="theme-glow theme-moon-glow" />
                <div className="theme-sun">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map(r => (
                        <div key={r} className="theme-ray" style={{
                            width: 4, height: 8, top: 16, left: 18,
                            transform: `rotate(${r}deg) translateY(-20px)`,
                            opacity: isDark ? 0 : 1
                        }} />
                    ))}
                    <div className="theme-sun-disc" />
                </div>
                <div className="theme-moon">
                    <div className="theme-moon-body" />
                    <div className="theme-moon-bite" />
                    <div className="theme-moon-crater" style={{ width: 6, height: 6, top: 22, left: 9 }} />
                    <div className="theme-moon-crater" style={{ width: 4, height: 4, top: 12, left: 20, opacity: 0.15 }} />
                    <div className="theme-moon-crater" style={{ width: 3, height: 3, top: 28, left: 22, opacity: 0.1 }} />
                </div>
            </div>
        </button>
    </div>
)

// ─── History Helpers ──────────────────────────────────────────────────────────
const LS_KEY = 'teacher_chat_history'

function loadAllConversations() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

function saveAllConversations(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
}

function groupByDate(list) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
    const groups = { 'HÔM NAY': [], 'HÔM QUA': [], 'TRƯỚC ĐÓ': [] }
    list.forEach(c => {
        const d = new Date(c.updatedAt); d.setHours(0, 0, 0, 0)
        if (d >= today) groups['HÔM NAY'].push(c)
        else if (d >= yesterday) groups['HÔM QUA'].push(c)
        else groups['TRƯỚC ĐÓ'].push(c)
    })
    return groups
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TeacherAssistant() {
    const [messages, setMessages] = useState([])
    const [currentId, setCurrentId] = useState(null)          // active conversation id
    const [conversations, setConversations] = useState(loadAllConversations)
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [attachedFiles, setAttachedFiles] = useState([])
    const [isShowMenu, setIsShowMenu] = useState(false)
    const [aiStatus, setAiStatus] = useState(null)
    const [hoveredId, setHoveredId] = useState(null)
    const [editingId, setEditingId] = useState(null)
    const [editingTitle, setEditingTitle] = useState('')
    const [isDark, setIsDark] = useState(true)
    const [activeTab, setActiveTab] = useState('chat')
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const C = isDark ? DarkC : LightC

    const chatEndRef = useRef(null)
    const chatTopRef = useRef(null)
    const fileInputRef = useRef(null)
    const textareaRef = useRef(null)

    useEffect(() => {
        if (!chatEndRef.current) return
        const behavior = (isLoading && messages.length > 0) ? 'auto' : 'smooth'
                chatEndRef.current.scrollIntoView({ behavior })
    }, [messages, isLoading])

    // Toggle effect is now scoped to the component's root div instead of global document.

    // ── Persist conversation whenever messages change (after AI replies) ──
    useEffect(() => {
        if (messages.length === 0) return
        const lastMsg = messages[messages.length - 1]
        // Only save after AI finishes (non-empty model message)
        if (lastMsg.role === 'model' && lastMsg.parts[0].text === '') return

        setConversations(prev => {
            const title = messages[0]?.parts[0]?.text?.slice(0, 40) || 'Cuộc trò chuyện mới'
            const now = new Date().toISOString()
            let updated
            if (currentId) {
                updated = prev.map(c => c.id === currentId ? { ...c, title, messages, updatedAt: now } : c)
            } else {
                const newId = 'chat_' + Date.now()
                setCurrentId(newId)
                updated = [{ id: newId, title, messages, updatedAt: now }, ...prev]
            }
            saveAllConversations(updated)
            return updated
        })
    }, [messages])

    // ── Auto-resize textarea ──
    const handleTextareaInput = (e) => {
        setInput(e.target.value)
        e.target.style.height = 'auto'
        e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
    }

    // ── File Handling ──
    const onFileSelect = async (e) => {
        const files = Array.from(e.target.files)
        if (!files.length) return

        setAiStatus('Đang đọc file...')
        setIsLoading(true)
        try {
            for (const file of files) {
                const fileData = { name: file.name, type: file.type, size: file.size, file, preview: null, extractedText: null }
                if (file.type.startsWith('image/')) {
                    fileData.preview = await new Promise(resolve => {
                        const reader = new FileReader()
                        reader.onload = (e) => resolve(e.target.result)
                        reader.readAsDataURL(file)
                    })
                } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                    fileData.extractedText = await extractDocxText(file)
                } else if (file.type === 'application/pdf') {
                    fileData.extractedText = await extractPdfText(file)
                } else if (file.type === 'text/plain') {
                    fileData.extractedText = await file.text()
                }
                setAttachedFiles(prev => [...prev, fileData])
            }
        } catch (err) {
            console.error('File processing error:', err)
            alert('Lỗi khi xử lý tệp. Vui lòng thử lại.')
        } finally {
            setAiStatus(null)
            setIsLoading(false)
            setIsShowMenu(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const removeFile = (index) => setAttachedFiles(prev => prev.filter((_, i) => i !== index))

    // ── Send Message ──
    const handleSend = async (text = input) => {
        if (!text.trim() && attachedFiles.length === 0) return

        const currentAttachments = [...attachedFiles]
        const userMsg = {
            role: 'user',
            parts: [{ text }],
            attachments: currentAttachments.map(f => ({ name: f.name, type: f.type, preview: f.preview }))
        }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        setAttachedFiles([])
        setAiStatus('Đang phân tích dữ liệu...')
        setIsLoading(true)

        try {
            const history = messages.slice(-4).map(m => ({ role: m.role, parts: m.parts }))
            const aiMsg = { role: 'model', parts: [{ text: '' }] }
            setMessages(prev => [...prev, aiMsg])

            await callStreamGeminiAPI(text, history, currentAttachments, (fullText) => {
                setAiStatus(null)
                setMessages(prev => {
                    const newMsgs = [...prev]
                    newMsgs[newMsgs.length - 1] = { role: 'model', parts: [{ text: fullText }] }
                    return newMsgs
                })
            })
        } catch (err) {
            console.error(err)
            setMessages(prev => {
                const newMsgs = [...prev]
                newMsgs[newMsgs.length - 1] = { role: 'model', parts: [{ text: '❌ Có lỗi kết nối. Hãy thử lại.' }] }
                return newMsgs
            })
        } finally {
            setAiStatus(null)
            setIsLoading(false)
        }
    }

    // ── Load a past conversation ──
    const loadConversation = (conv) => {
        setCurrentId(conv.id)
        setMessages(conv.messages)
        setInput('')
        setAttachedFiles([])
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }

    // ── Delete a conversation ──
    const deleteConversation = (id, e) => {
        e.stopPropagation()
        const updated = conversations.filter(c => c.id !== id)
        saveAllConversations(updated)
        setConversations(updated)
        if (currentId === id) {
            setCurrentId(null)
            setMessages([])
        }
    }
    // ── Rename a conversation ──
    const renameConversation = (id, newTitle) => {
        const updated = conversations.map(c => c.id === id ? { ...c, title: newTitle } : c)
        saveAllConversations(updated)
        setConversations(updated)
        setEditingId(null)
    }

    // ── New chat ──
    const startNewChat = () => {
        setCurrentId(null)
        setMessages([])
        setInput('')
        setAttachedFiles([])
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }

    const user = getAuthUser()
    const userInitials = user?.name ? user.name.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() : 'GV'
    const grouped = groupByDate(conversations)

    return (
        <div className={isDark ? 'dark' : ''} style={{ display: 'flex', height: '100%', background: C.bg, overflow: 'hidden', fontFamily: "'DM Sans', 'Inter', sans-serif", color: C.onSurfaceVariant }}>

            {/* ── MOBILE SIDEBAR BACKDROP ── */}
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                        zIndex: 29, backdropFilter: 'blur(2px)'
                    }}
                />
            )}

            {/* ── LEFT SIDEBAR ── */}
            <aside style={{
                width: '220px', flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column',
                background: C.bg, borderRight: `0.5px solid ${C.outlineVariant}`, padding: '16px',
                // Mobile: fixed drawer; Desktop: static
                position: window.innerWidth < 768 ? 'fixed' : 'relative',
                top: 0, left: 0, bottom: 0,
                zIndex: 30,
                transform: window.innerWidth < 768 ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
                transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
            }}>
                {/* Brand */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ width: 22, height: 22, background: C.primaryContainer, borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg fill="none" height="14" viewBox="0 0 24 24" width="14"><path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" fill={C.primaryFixed} /></svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: C.primaryFixed, lineHeight: 1.2 }}>AI Education</div>
                        <div style={{ fontSize: '10px', color: C.onSurfaceVariant, lineHeight: 1.2 }}>Trợ lý Giáo viên</div>
                    </div>
                </div>

                {/* New Chat CTA */}
                <button
                    onClick={startNewChat}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '8px', marginBottom: '20px', background: isDark ? '#fff' : '#1a1a1c', color: isDark ? '#000' : '#fff',
                        border: `0.5px solid ${C.outlineVariant}`, borderRadius: '6px', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer', transition: 'opacity 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                    Cuộc hội thoại mới
                </button>

                {/* History */}
                <nav className="overflow-y-auto" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {conversations.length === 0 && (
                        <div style={{ fontSize: '12px', color: `${C.onSurfaceVariant}66`, textAlign: 'center', marginTop: '12px' }}>Chưa có lịch sử</div>
                    )}
                    {Object.entries(grouped).map(([label, items]) => items.length === 0 ? null : (
                        <div key={label}>
                            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', color: `${C.onSurfaceVariant}77`, textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'monospace' }}>{label}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                {items.map(conv => (
                                    <div
                                        key={conv.id}
                                        onClick={() => loadConversation(conv)}
                                        onMouseEnter={() => setHoveredId(conv.id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px',
                                            borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: 'background 0.15s',
                                            background: currentId === conv.id ? C.primaryContainer : hoveredId === conv.id ? '#141416' : 'transparent',
                                            color: currentId === conv.id ? C.primaryFixed : C.onSurfaceVariant,
                                        }}
                                    >
                                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: currentId === conv.id ? C.primary : '#47464c', flexShrink: 0 }} />
                                        {editingId === conv.id ? (
                                            <input
                                                autoFocus
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onBlur={() => renameConversation(conv.id, editingTitle)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') renameConversation(conv.id, editingTitle)
                                                    if (e.key === 'Escape') setEditingId(null)
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    flex: 1, background: C.surface, border: `0.5px solid ${C.primary}`,
                                                    color: C.primaryFixed, fontSize: '12.5px', padding: '2px 4px', borderRadius: '4px', outline: 'none'
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                                                    {conv.title}
                                                </span>
                                                {hoveredId === conv.id && (
                                                    <div style={{ display: 'flex', gap: '2px' }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditingTitle(conv.title) }}
                                                            title="Đổi tên"
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '2px', display: 'flex', borderRadius: '4px', flexShrink: 0 }}
                                                            onMouseEnter={e => e.currentTarget.style.color = C.primary}
                                                            onMouseLeave={e => e.currentTarget.style.color = '#666'}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => deleteConversation(conv.id, e)}
                                                            title="Xóa"
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: '2px', display: 'flex', borderRadius: '4px', flexShrink: 0 }}
                                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                            onMouseLeave={e => e.currentTarget.style.color = '#666'}
                                                        >
                                                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>


            </aside>

            {/* ── MAIN AREA ── */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0, overflow: 'hidden' }}>

                {/* ── TOPBAR ── */}
                <header style={{
                    height: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 16px', background: `${C.bg}cc`, backdropFilter: 'blur(12px)',
                    borderBottom: `0.5px solid ${C.outlineVariant}`, position: 'sticky', top: 0, zIndex: 40
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        {/* Hamburger — mobile only */}
                        <button
                            onClick={() => setSidebarOpen(v => !v)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: '6px', border: `0.5px solid ${C.outlineVariant}`,
                                background: 'transparent', cursor: 'pointer', color: C.onSurfaceVariant,
                                flexShrink: 0,
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>menu</span>
                        </button>

                        <h1 style={{ fontSize: '13px', fontWeight: 500, color: C.primaryFixed, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 1 }}>
                            {messages.length > 0 && activeTab === 'chat' ? (messages[0]?.parts[0]?.text?.slice(0, 40) || 'Trợ lý GV') : 'Trợ lý Giáo viên'}
                        </h1>

                        {/* Tab switcher — scrollable on small screens */}
                        <div style={{ display: 'flex', background: C.surfaceContainer, borderRadius: '6px', padding: '2px', marginLeft: '4px', overflowX: 'auto', flexShrink: 0 }}>
                            <button 
                                onClick={() => setActiveTab('chat')}
                                style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', background: activeTab === 'chat' ? C.primary : 'transparent', color: activeTab === 'chat' ? C.bg : C.onSurfaceVariant, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                            >
                                AI Chat
                            </button>
                            <button 
                                onClick={() => setActiveTab('rooms')}
                                style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', background: activeTab === 'rooms' ? C.primary : 'transparent', color: activeTab === 'rooms' ? C.bg : C.onSurfaceVariant, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                            >
                                Phòng thi
                            </button>
                            <button 
                                onClick={() => setActiveTab('dashboard')}
                                style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, border: 'none', cursor: 'pointer', background: activeTab === 'dashboard' ? C.primary : 'transparent', color: activeTab === 'dashboard' ? C.bg : C.onSurfaceVariant, transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                            >
                                Thống kê
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
                    </div>
                </header>



                {activeTab === 'dashboard' ? (
                    <div style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
                        <TeacherDashboard user={user} onAskAI={(prompt) => { setActiveTab('chat'); handleSend(prompt); }} />
                    </div>
                ) : activeTab === 'rooms' ? (
                    <div style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
                        <TeacherRoomHistory user={user} />
                    </div>
                ) : (
                    <>
                        {/* ── CHAT AREA ── */}
                        <section className="overflow-y-auto" style={{
                            flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '28px',
                            scrollBehavior: 'auto', overflowAnchor: 'auto'
                        }}>
                    <div ref={chatTopRef} />
                    <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>

                        {/* Empty State */}
                        {messages.length === 0 && (
                            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <h2 style={{ fontSize: '18px', fontWeight: 500, color: C.primaryFixed, marginBottom: '4px' }}>Bắt đầu bằng cách đặt câu hỏi</h2>
                                    <p style={{ fontSize: '13px', color: C.onSurfaceVariant }}>Tải lên tài liệu KHBD hoặc chọn một gợi ý bên dưới để AI hỗ trợ bạn.</p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {SUGGESTIONS.map((s, i) => (
                                        <button key={i} onClick={() => handleSend(s)} style={{
                                            padding: '12px', textAlign: 'left', border: `0.5px solid ${C.outlineVariant}`, borderRadius: '10px',
                                            background: 'transparent', cursor: 'pointer', transition: 'background 0.15s', color: C.onSurfaceVariant, fontSize: '13px'
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.background = C.surfaceContainerLow; e.currentTarget.style.color = C.primary }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.onSurfaceVariant }}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Messages */}
                        {messages.map((msg, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                                {msg.role === 'user' ? (
                                    /* USER BUBBLE */
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                                        {msg.attachments?.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
                                                {msg.attachments.map((file, idx) => (
                                                    <div key={idx} style={{ padding: '6px 10px', background: C.surfaceContainer, borderRadius: '8px', border: `0.5px solid ${C.outlineVariant}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {file.preview
                                                            ? <img src={file.preview} alt="preview" style={{ width: 28, height: 28, borderRadius: '4px', objectFit: 'cover' }} />
                                                            : <span className="material-symbols-outlined" style={{ fontSize: '16px', color: C.primary }}>description</span>}
                                                        <span style={{ fontSize: '11px', color: C.onSurfaceVariant, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{
                                            background: C.primaryContainer, color: C.primaryFixed, padding: '10px 16px',
                                            borderRadius: '10px', borderTopRightRadius: '2px', maxWidth: '85%', fontSize: '14px', lineHeight: 1.6
                                        }}>
                                            {msg.parts[0].text}
                                        </div>
                                    </div>
                                ) : (
                                    /* AI RESPONSE CARD */
                                    <div style={{ border: `0.5px solid ${C.outlineVariant}`, borderRadius: '10px', overflow: 'hidden', background: C.surfaceContainerLowest }}>
                                        {/* Card Header */}
                                        <div style={{ background: C.surfaceContainerLow, padding: '8px 16px', borderBottom: `0.5px solid ${C.outlineVariant}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: C.onSurfaceVariant }}>auto_awesome</span>
                                                <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 600, color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                    Phản hồi AI
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => navigator.clipboard.writeText(msg.parts[0].text)}
                                                title="Sao chép"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.onSurfaceVariant, display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', transition: 'background 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = C.surfaceContainer}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>content_copy</span>
                                                Sao chép
                                            </button>
                                        </div>
                                        {/* Card Body */}
                                        <div style={{ padding: '20px' }}>
                                            {msg.parts[0].text === '' ? (
                                                <div style={{ display: 'flex', gap: '4px', padding: '8px 0' }}>
                                                    {[0, 200, 400].map(delay => (
                                                        <span key={delay} style={{ width: 6, height: 6, borderRadius: '50%', background: C.primary, display: 'inline-block', animation: `bounce 1s ${delay}ms infinite` }} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <MarkdownContent content={msg.parts[0].text} role="model" />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}

                    </div>
                    <div ref={chatEndRef} />
                </section>

                {/* ── INPUT BAR ── */}
                <footer style={{ flexShrink: 0, background: `${C.bg}cc`, backdropFilter: 'blur(12px)', padding: '16px', borderTop: `0.5px solid ${C.outlineVariant}` }}>
                    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>

                        {/* Attached File Previews */}
                        {attachedFiles.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '8px' }}>
                                {attachedFiles.map((file, i) => (
                                    <motion.div key={i} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                                        style={{ position: 'relative', width: 60, height: 60, borderRadius: '8px', border: `0.5px solid ${C.outlineVariant}`, background: C.surfaceContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                        {file.preview
                                            ? <img src={file.preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: C.primary }}>description</span>
                                                <span style={{ fontSize: '8px', fontWeight: 700, color: C.outline, textTransform: 'uppercase' }}>{file.name.split('.').pop()}</span>
                                            </div>}
                                        <button onClick={() => removeFile(i)} style={{
                                            position: 'absolute', top: -3, right: -3, width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px'
                                        }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>close</span>
                                        </button>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Input Box */}
                        <div style={{ background: C.surfaceContainerLow, border: `0.5px solid ${C.outlineVariant}`, borderRadius: '10px', padding: '8px', position: 'relative' }}>
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                placeholder="Nhập yêu cầu của bạn tại đây..."
                                style={{
                                    width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontSize: '14px',
                                    color: C.onSurfaceVariant, lineHeight: 1.6, padding: '8px 12px', fontFamily: 'inherit', maxHeight: '160px', overflow: 'auto'
                                }}
                                value={input}
                                onChange={handleTextareaInput}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', padding: '0 4px' }}>
                                {/* Left: Attach */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                                    <button
                                        onClick={() => setIsShowMenu(!isShowMenu)}
                                        style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', color: C.onSurfaceVariant, cursor: 'pointer', display: 'flex', transition: 'background 0.15s', transform: isShowMenu ? 'rotate(45deg)' : 'none' }}
                                        onMouseEnter={e => e.currentTarget.style.background = C.surfaceContainer}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>attach_file</span>
                                    </button>
                                    <AnimatePresence>
                                        {isShowMenu && (
                                            <motion.div initial={{ opacity: 0, y: 8, scale: 0.92 }} animate={{ opacity: 1, y: -8, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.92 }}
                                                style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '12px', background: C.surface, borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: `0.5px solid ${C.outlineVariant}`, padding: '8px', minWidth: '180px', zIndex: 50 }}>
                                                <button onClick={() => fileInputRef.current.click()} style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = C.surfaceContainer}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#60a5fa' }}>upload_file</span>
                                                    </div>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: C.onSurfaceVariant }}>Tải tệp lên</span>
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={onFileSelect} accept="image/*,.pdf,.docx,.doc,.txt" style={{ display: 'none' }} />
                                </div>

                                {/* Right: Send */}
                                <button
                                    onClick={() => handleSend()}
                                    disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                                    style={{
                                        padding: '7px', borderRadius: '6px', background: C.primary, border: 'none', color: C.bg, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s, transform 0.15s',
                                        opacity: (isLoading || (!input.trim() && attachedFiles.length === 0)) ? 0.4 : 1
                                    }}
                                    onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'scale(1.06)' }}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {isLoading
                                        ? <div style={{ width: 16, height: 16, border: `2px solid ${C.bg}44`, borderTop: `2px solid ${C.bg}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                        : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>}
                                </button>
                            </div>
                        </div>

                        {/* Footer Label */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: `${C.onSurfaceVariant}66` }}>NHẤN ENTER ĐỂ GỬI • SHIFT + ENTER ĐỂ XUỐNG DÒNG</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: `${C.onSurfaceVariant}66` }}>v3.0 MULTIMODAL</span>
                        </div>
                    </div>
                </footer>
                </>
                )}
            </main>

            {/* Keyframe animations */}
            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-5px); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                textarea::placeholder { color: rgba(200,197,205,0.35); }
                ::-webkit-scrollbar { width: 3px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #47464c; border-radius: 10px; }
            `}</style>
        </div>
    )
}
