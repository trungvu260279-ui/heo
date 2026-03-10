import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import teacherData from '../data/teacher_data_v2.json'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthUser } from '../hooks/useAuth'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mammoth from 'mammoth'
import * as pdfjs from 'pdfjs-dist'

// Set PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

// Constants
const LOCAL_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const LOCAL_MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

// System Prompt Tối ưu (Condensed Prompt)
const SYSTEM_PROMPT = `Bạn là Chuyên gia đổi mới dạy học Ngữ văn. Nhiệm vụ: Tích hợp Phụ lục III (Năng lực số - NLS & Phòng chống tham nhũng - PCTN) vào KHBD THPT.
Quy định phản hồi:
1. Phân tích KHBD: Xác định vị trí tích hợp NLS/PCTN.
2. Thiết kế hoạt động: Ưu tiên Bước 1 (Giao nhiệm vụ) & Bước 3 (Thực hiện).
3. Công cụ NLS: Gợi ý Canva, Padlet, Kahoot, AI, Sơ đồ tư duy số.
4. Tích hợp PCTN: Lồng ghép qua phân tích nhân vật, đạo đức, lý tưởng sống về sự liêm chính.
5. Định dạng: Tuân thủ PL4. Phải sửa đổi Mục tiêu & Các bước thực hiện chi tiết để GV có thể copy-paste.
6. Tông giọng: Chuyên nghiệp, sư phạm, hỗ trợ giảm tải cho GV.
7. Ngắn gọn trọng tâm, không lan man.
8. Nếu có tệp đính kèm (Ảnh, PDF, Word), hãy sử dụng nội dung từ tệp đó để trả lời chính xác.`

// Extract Text Functions
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

// Thuật toán BM25 rút gọn
function findContextBM25(query) {
    const qTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (qTokens.length === 0) return '';

    const grade = query.match(/10|11|12/)?.[0];
    const docs = [
        ...teacherData.ke_hoach_day_học.map(i => ({ ...i, type: 'plan', text: `${i.grade} ${i.bai_hoc} ${i.tich_hop_nls} ${i.bo_sung}` })),
        ...teacherData.nang_luc_so_chi_tiet.map(i => ({ ...i, type: 'nls', text: `${i.grade} ${i.bai_hoc} ${i.chi_bao} ${i.yeu_cau} ${i.minh_chung}` }))
    ];

    const scoredDocs = docs.map(doc => {
        let score = 0;
        const docText = doc.text.toLowerCase();
        if (grade && doc.grade === grade) score += 5;
        qTokens.forEach(token => {
            if (docText.includes(token)) score += (token.length > 4 ? 2 : 1);
        });
        return { ...doc, score };
    });

    const best = scoredDocs.sort((a, b) => b.score - a.score)[0];
    if (!best || best.score < 2) return '';

    if (best.type === 'plan') {
        return `\n[REF|L${best.grade}|${best.bai_hoc}|NLS:${best.tich_hop_nls || 'None'}|Note:${best.bo_sung || 'None'}]`;
    }
    return `\n[REF|NLS_L${best.grade}|YêuCầu:${best.yeu_cau || best.chi_bao}|MinhChứng:${best.minh_chung}]`;
}

async function callStreamGeminiAPI(instruction, history = [], attachments = [], onChunk) {
    const context = findContextBM25(instruction);
    const finalInstruction = instruction + context;
    const trimmedHistory = history.slice(-4);

    // Build parts for multimodal
    const parts = [{ text: finalInstruction }]
    for (const file of attachments) {
        if (file.type.startsWith('image/')) {
            const base64Data = file.preview.split(',')[1]
            parts.push({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            })
        } else if (file.extractedText) {
            parts.push({
                text: `\n[Nội dung từ tệp ${file.name}]:\n${file.extractedText}`
            })
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
        });

        if (!res.ok) throw new Error("Backend API failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6).trim();
                    if (dataStr === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.text) {
                            fullText += data.text;
                            onChunk(fullText);
                        }
                    } catch (e) { }
                }
            }
        }
        return fullText;
    } catch (err) {
        console.warn("Backend stream failed, trying local...", err);

        if (import.meta.env.DEV && LOCAL_API_KEY) {
            const genAI = new GoogleGenerativeAI(LOCAL_API_KEY)
            const model = genAI.getGenerativeModel({ model: LOCAL_MODEL_NAME })
            const chat = model.startChat({ history: chatHistory })
            const result = await chat.sendMessageStream(parts)
            let fullText = ''
            for await (const chunk of result.stream) {
                const chunkText = chunk.text()
                fullText += chunkText
                onChunk(fullText)
            }
            return fullText
        }
        throw err;
    }
}

const MarkdownContent = ({ content, role }) => {
    return (
        <div className={`markdown-body ${role === 'model' ? 'ai-markdown' : 'user-markdown'}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h3: ({ node, ...props }) => <h3 className="text-lg font-black text-primary border-l-4 border-primary pl-3 my-4 tracking-tight" {...props} />,
                    h2: ({ node, ...props }) => <h2 className="text-xl font-black text-slate-800 dark:text-white my-6 border-b border-slate-200 dark:border-slate-800 pb-2" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-3 last:mb-0 leading-snug" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-none space-y-2 mb-4" {...props} />,
                    li: ({ node, ...props }) => (
                        <li className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                            <span className="text-primary mt-1.5 text-[8px] flex-shrink-0">●</span>
                            <span>{props.children}</span>
                        </li>
                    ),
                    strong: ({ node, ...props }) => <strong className="text-primary font-bold" {...props} />,
                    hr: () => <hr className="my-6 border-slate-200 dark:border-slate-800" />,
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-6 rounded-xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full border-collapse text-sm" {...props} />
                        </div>
                    ),
                    thead: ({ node, ...props }) => <thead className="bg-slate-50 dark:bg-slate-800/50" {...props} />,
                    th: ({ node, ...props }) => <th className="p-3 text-left font-black text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800" {...props} />,
                    td: ({ node, ...props }) => <td className="p-3 text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800/50" {...props} />,
                    code: ({ node, inline, ...props }) => (
                        inline
                            ? <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md text-primary font-mono text-xs" {...props} />
                            : <pre className="bg-slate-900 text-slate-100 p-4 rounded-2xl my-4 overflow-x-auto font-mono text-xs shadow-inner" {...props} />
                    )
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

export default function TeacherAssistant() {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [attachedFiles, setAttachedFiles] = useState([])
    const [isShowMenu, setIsShowMenu] = useState(false)
    const [aiStatus, setAiStatus] = useState(null)

    const chatEndRef = useRef(null)
    const chatTopRef = useRef(null)
    const fileInputRef = useRef(null)

    const onFileSelect = async (e) => {
        const files = Array.from(e.target.files)
        if (!files.length) return

        setAiStatus("Đang đọc file...")
        setIsLoading(true)
        try {
            for (const file of files) {
                const fileData = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    file: file,
                    preview: null,
                    extractedText: null
                }

                if (file.type.startsWith('image/')) {
                    fileData.preview = await new Promise((resolve) => {
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
            console.error("File processing error:", err)
            alert("Lỗi khi xử lý tệp. Vui lòng thử lại.")
        } finally {
            setAiStatus(null)
            setIsLoading(false)
            setIsShowMenu(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const removeFile = (index) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const scrollToTop = () => chatTopRef.current?.scrollIntoView({ behavior: 'smooth' })
    const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })

    const handleSend = async (text = input) => {
        if (!text.trim() && attachedFiles.length === 0) return

        const currentAttachments = [...attachedFiles]
        const userMsg = {
            role: 'user',
            parts: [{ text: text }],
            attachments: currentAttachments.map(f => ({ name: f.name, type: f.type, preview: f.preview }))
        }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setAttachedFiles([])
        setAiStatus("Đang phân tích dữ liệu...")
        setIsLoading(true)

        try {
            const history = messages.slice(-4).map(m => ({ role: m.role, parts: m.parts }))
            let aiMsg = { role: 'model', parts: [{ text: '' }] }
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
                newMsgs[newMsgs.length - 1] = {
                    role: 'model',
                    parts: [{ text: '❌ Có lỗi kết nối. Hãy thử lại.' }]
                }
                return newMsgs
            })
        } finally {
            setAiStatus(null)
            setIsLoading(false)
        }
    }

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
            <div className="flex-1 flex relative">
                <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 relative min-w-0 w-full overflow-hidden">
                    <header className="shrink-0 h-20 border-b border-slate-200 dark:border-slate-800 flex items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-10 w-full shadow-sm px-4 md:px-8">
                        <div className="w-full flex items-center gap-5">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0 cursor-pointer" onClick={scrollToTop}>
                                <span className="material-symbols-outlined text-white text-xl md:text-2xl">school</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white leading-none tracking-tight truncate">AI Education</h3>
                                <p className="text-[10px] md:text-[11px] text-primary mt-1.5 uppercase tracking-widest font-black opacity-80 truncate">Chào mừng bạn, {getAuthUser()?.name || 'Giáo viên'}</p>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 relative group/chat min-h-0">
                        <div className="absolute inset-0 overflow-y-auto scroll-smooth bg-slate-50/50 dark:bg-slate-950/50">
                            <div ref={chatTopRef} />

                            <div className="px-4 md:px-8 py-10 space-y-10 max-w-4xl mx-auto w-full">
                                {messages.length === 0 && (
                                    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center py-10">
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="w-24 h-24 md:w-32 md:h-32 rounded-[2.5rem] bg-gradient-to-tr from-primary to-primary-light flex items-center justify-center mb-8 shadow-2xl"
                                        >
                                            <span className="material-symbols-outlined text-5xl md:text-6xl text-white">magic_button</span>
                                        </motion.div>
                                        <h4 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter italic whitespace-pre-line leading-none text-center">
                                            AI Education
                                        </h4>
                                        <p className="mt-8 text-slate-500 font-medium max-w-md mx-auto text-sm leading-relaxed text-center">Tải lên tài liệu (Word, PDF, Ảnh) để AI phân tích, hỗ trợ tích hợp Phụ lục III và đổi mới dạy học.</p>
                                    </div>
                                )}

                                {messages.map((msg, i) => (
                                    <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                                        <div className={`flex gap-3 md:gap-5 w-full ${msg.role === 'user' ? 'flex-row-reverse max-w-[85%]' : 'flex-row max-w-[95%] w-full'}`}>
                                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex-shrink-0 flex items-center justify-center text-[9px] font-black shadow-md ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-primary text-white'}`}>
                                                {msg.role === 'user' ? 'GV' : 'AI'}
                                            </div>
                                            <div className={`flex flex-col gap-3 ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}>
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {msg.attachments.map((file, idx) => (
                                                            <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 shadow-sm">
                                                                {file.preview ? (
                                                                    <img src={file.preview} alt="preview" className="w-8 h-8 rounded-md object-cover" />
                                                                ) : (
                                                                    <span className="material-symbols-outlined text-primary">description</span>
                                                                )}
                                                                <span className="text-[10px] font-medium text-slate-500 truncate max-w-[100px]">{file.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className={`p-4 md:p-6 rounded-[1.5rem] shadow-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-tl-none w-full'}`}>
                                                    <MarkdownContent content={msg.parts[0].text} role={msg.role} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div ref={chatEndRef} />
                        </div>
                    </div>

                    <div className="shrink-0 p-4 md:p-8 border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 backdrop-blur-3xl">
                        <div className="max-w-4xl w-full mx-auto relative flex flex-col gap-3">

                            {/* File Previews */}
                            {attachedFiles.length > 0 && (
                                <div className="flex flex-wrap gap-3 pb-2">
                                    {attachedFiles.map((file, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="group relative w-16 h-16 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg overflow-hidden"
                                        >
                                            {file.preview ? (
                                                <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="material-symbols-outlined text-primary text-xl">description</span>
                                                    <span className="text-[8px] font-bold text-slate-400 truncate w-12 text-center uppercase">{file.name.split('.').pop()}</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removeFile(i)}
                                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                            >
                                                <span className="material-symbols-outlined text-[10px] font-bold">close</span>
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}

                            <div className="relative group">
                                <div className="absolute left-2 bottom-3 md:left-4 md:bottom-5 z-10 flex items-center gap-2">
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsShowMenu(!isShowMenu)}
                                            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl transition-all shadow-lg flex items-center justify-center ${isShowMenu ? 'bg-slate-800 text-white rotate-45' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary hover:bg-primary/10'}`}
                                        >
                                            <span className="material-symbols-outlined font-bold">add</span>
                                        </button>

                                        <AnimatePresence>
                                            {isShowMenu && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                                    animate={{ opacity: 1, y: -10, scale: 1 }}
                                                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                                    className="absolute bottom-full left-0 mb-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2 min-w-[180px] z-50 overflow-hidden"
                                                >
                                                    <button
                                                        onClick={() => fileInputRef.current.click()}
                                                        className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-sm">upload_file</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Tải tệp lên</span>
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        multiple
                                        onChange={onFileSelect}
                                        accept="image/*,.pdf,.docx,.doc,.txt"
                                    />
                                </div>

                                <textarea
                                    rows="1"
                                    placeholder="Hỏi AI bất cứ điều gì..."
                                    className="w-full bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] px-14 md:px-20 py-4 md:py-6 text-sm md:text-lg focus:ring-2 focus:ring-primary/20 shadow-xl resize-none outline-none border border-slate-200 dark:border-slate-800 pr-20 md:pr-28 transition-all"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                                />

                                <button
                                    onClick={() => handleSend()}
                                    disabled={isLoading || (!input.trim() && attachedFiles.length === 0)}
                                    className="absolute right-3 bottom-3 md:right-5 md:bottom-5 w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-primary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/30 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                                >
                                    {isLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <span className="material-symbols-outlined font-bold">send</span>
                                    )}
                                </button>
                            </div>

                            {/* AI Status Message */}
                            <AnimatePresence>
                                {aiStatus && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="flex items-center gap-3 px-6 py-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-primary/20 shadow-lg w-fit mx-auto"
                                    >
                                        <div className="flex gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1s_infinite_0ms]"></span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1s_infinite_200ms]"></span>
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-[bounce_1s_infinite_400ms]"></span>
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest text-primary italic">{aiStatus}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <footer className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl mx-auto px-4 opacity-40 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Multimodal Engine: {LOCAL_MODEL_NAME}</p>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Hệ thống hỗ trợ giáo viên v3.0 Multimodal</p>
                        </footer>
                    </div>
                </main>
            </div>
        </div>
    )
}
