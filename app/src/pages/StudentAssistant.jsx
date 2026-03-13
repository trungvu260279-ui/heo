import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getAuthUser } from '../hooks/useAuth'
import mammoth from 'mammoth'
import * as pdfjs from 'pdfjs-dist'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Set PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

// Constants
const LOCAL_API_KEYS_TEXT = import.meta.env.VITE_GEMINI_API_KEYS || import.meta.env.GEMINI_API_KEYS || import.meta.env.VITE_GEMINI_API_KEY || ''
const LOCAL_API_KEYS = LOCAL_API_KEYS_TEXT.split(',').map(k => k.trim()).filter(Boolean)
const LOCAL_MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

const SYSTEM_PROMPT = `Bạn là chatbot hỗ trợ ôn thi tốt nghiệp THPT (TN K12) môn Ngữ văn. 
Nhiệm vụ: Hướng dẫn tư duy, hỗ trợ viết văn, chấm bài và giải thích đáp án dựa trên tài liệu ôn thi hệ thống.

QUY TẮC PHẢN HỒI (Tối ưu Token):
1. Hướng dẫn tư duy: Không chỉ đưa đáp án. Phân tích yêu cầu -> Gợi ý ý chính -> Giải thích cách đạt điểm cao.
2. Viết văn: Luôn đưa dàn ý rõ ràng (Mở - Thân - Kết). Nêu các ý bắt buộc để đạt điểm tối đa.
3. Chấm bài: 
   - Điểm (X/Y): Nội dung, Diễn đạt, Lập luận. 
   - Nhận xét: Điểm mạnh, Lỗi cần sửa, Ý thiếu.
   - Gợi ý cải thiện: Cách viết lại hoặc bổ sung ý.
4. Giải thích: Phân tích câu hỏi -> Giải thích từng bước -> Chỉ ra đáp án đúng.

PHONG CÁCH: Ngôn ngữ học sinh lớp 12, dễ hiểu, trình bày có mục (bullet points), ví dụ ngắn gọn. Luôn bám sát tài liệu hệ thống. Nếu học sinh sai, hãy chỉ lỗi và hướng dẫn sửa ngay.`

// Mock data based on the provided aesthetic
const WELCOME_MESSAGE = {
    role: 'assistant',
    content: `Chào mừng cậu tới không gian học thuật chuyên sâu. Tớ là **Gia sư AI**, người sẽ cùng cậu khám phá vẻ đẹp của ca từ, sự sắc sảo của lập luận và chiều sâu của tư duy văn học.

Hôm nay cậu muốn chúng mình cùng phân tích tác phẩm nào? Hay cậu cần tớ hỗ trợ rèn luyện kĩ năng viết bài?`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

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

export default function StudentAssistant() {
    const [messages, setMessages] = useState([WELCOME_MESSAGE])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [retryStatus, setRetryStatus] = useState('')
    const [attachedFiles, setAttachedFiles] = useState([])
    const location = useLocation()
    const navigate = useNavigate()
    const chatEndRef = useRef(null)
    const hasTriggeredAnalysisRef = useRef(false)
    const fileInputRef = useRef(null)
    const inputRef = useRef(null)

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isLoading])

    // Handle incoming Exam Analysis data
    useEffect(() => {
        if (location.state?.type === 'EXAM_ANALYSIS' && location.state.data && !hasTriggeredAnalysisRef.current) {
            hasTriggeredAnalysisRef.current = true;
            const { title, result, answers } = location.state.data;
            
            // Format answers for better readability in prompt
            let formattedAnswers = "";
            if (answers) {
                Object.entries(answers).forEach(([key, value]) => {
                    const label = key === 'nlxh' ? 'Nghị luận xã hội' : key === 'nlvh' ? 'Nghị luận văn học' : key.replace('q_', 'Câu ');
                    formattedAnswers += `\n[${label}]: ${value}\n`;
                });
            }

            const analysisPrompt = `Tớ vừa hoàn thành đề đề: **"${title}"** (Điểm: ${result.overall}/10).
[Hệ thống: Phân tích trọng tâm, ngắn gọn, tránh lan man]

Dưới đây là chi tiết bài làm:
${formattedAnswers}

Cậu hãy "mổ xẻ" nhanh bài làm này theo 3 ý chính:
1. **Lỗi chí mạng**: Vấn đề cụ thể nhất về tư duy/diễn đạt đang kéo điểm của tớ xuống.
2. **Upgrade nhanh**: Cách nâng cấp luận điểm để bứt phá lên mức Giỏi.
3. **Chốt hạ**: Một lời khuyên ngắn gọn để định hình phong cách cá nhân.

Yêu cầu: Trả lời đi thẳng vào vấn đề, dùng gạch đầu dòng, không mở bài/kết bài dài dòng.`;

            // Clear location state immediately to prevent re-triggering on refresh
            const stateData = location.state.data;
            navigate(location.pathname, { replace: true, state: {} });

            // Small delay to ensure component is fully ready and initial message is shown
            setTimeout(() => {
                handleSend(analysisPrompt);
            }, 500);
        }
    }, [location.state]);

    const handleFileClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        const newFiles = await Promise.all(files.map(async file => {
            const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
            let extractedText = null
            if (file.name.endsWith('.docx')) extractedText = await extractDocxText(file)
            else if (file.name.endsWith('.pdf')) extractedText = await extractPdfText(file)
            
            return {
                file,
                name: file.name,
                type: file.type,
                preview,
                extractedText
            }
        }))

        setAttachedFiles(prev => [...prev, ...newFiles])
        e.target.value = ''
    }

    const handleQuickAction = (label) => {
        let actionPrompt = ""
        switch (label) {
            case 'Phân tích phong cách':
                actionPrompt = "Hãy phân tích chi tiết phong cách nghệ thuật và đặc điểm ngôn ngữ của tác phẩm này."
                break
            case 'Tìm dẫn chứng':
                actionPrompt = "Hãy gợi ý cho tớ các dẫn chứng đắt giá trong tác phẩm để làm sáng tỏ chủ đề."
                break
            case 'Trích dẫn':
                actionPrompt = "Hãy cung cấp các nhận định lí luận văn học hoặc câu nói của các nhà văn nổi tiếng liên quan đến tác phẩm này."
                break
            default:
                return
        }

        if (input.trim() || attachedFiles.length > 0) {
            const combinedInput = input.trim() 
                ? `${input.trim()}\n\n[Hệ thống: Thực hiện ${label}]\n${actionPrompt}`
                : `[Hệ thống: Thực hiện ${label}]\n${actionPrompt}`
            handleSend(combinedInput)
        } else {
            setInput(actionPrompt)
            inputRef.current?.focus()
        }
    }

    const handleSend = async (overrideInput) => {
        const finalInput = typeof overrideInput === 'string' ? overrideInput : input
        if (!finalInput.trim() && attachedFiles.length === 0) return
        if (isLoading) return

        const userMsg = {
            role: 'user',
            content: finalInput,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            attachments: attachedFiles
        }

        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        // Prepare context for API
        const parts = [{ text: finalInput }]
        for (const file of attachedFiles) {
            if (file.type.startsWith('image/')) {
                const base64Data = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(file.file);
                });
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

        // Add system prompt to history logic
        const chatHistory = [
            { role: 'user', parts: [{ text: `HỆ THỐNG CHỈ THỊ: ${SYSTEM_PROMPT}` }] },
            { role: 'model', parts: [{ text: 'Đã sẵn sàng. Tôi là trợ lý ôn thi TN K12. Tôi sẽ hướng dẫn bạn tư duy, chấm bài và tối ưu điểm số môn Văn.' }] },
            ...messages.slice(-8).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }))
        ]

        setAttachedFiles([])

        const performRequest = async () => {
            let aiMsgAdded = false;
            let aiText = '';
            let currentAiMsg = null;

            const updateAiMessage = (newText) => {
                aiText = newText;
                setMessages(prev => {
                    const next = [...prev];
                    if (!aiMsgAdded) {
                        currentAiMsg = {
                            role: 'assistant',
                            content: aiText,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        };
                        aiMsgAdded = true;
                        return [...next, currentAiMsg];
                    } else {
                        next[next.length - 1] = { ...next[next.length - 1], content: aiText };
                        return next;
                    }
                });
            };

            try {
                setRetryStatus('Đang kết nối...');
                const res = await fetch('/api/gemini-stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: parts, history: chatHistory })
                });

                if (!res.ok) throw new Error("Backend API failed");

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep partial line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.substring(6).trim();
                            if (dataStr === '[DONE]') continue;
                            try {
                                const data = JSON.parse(dataStr);
                                if (data.text) {
                                    setRetryStatus(''); // Hide status once we have real data
                                    updateAiMessage(aiText + data.text);
                                }
                            } catch (e) { }
                        }
                    }
                }
            } catch (err) {
                console.warn("Backend stream failed, rolling local...", err);
                
                if (LOCAL_API_KEYS.length > 0) {
                    let success = false;
                    for (let i = 0; i < LOCAL_API_KEYS.length; i++) {
                        try {
                            setRetryStatus('Đang phân tích...');
                            const genAI = new GoogleGenerativeAI(LOCAL_API_KEYS[i])
                            const model = genAI.getGenerativeModel({ model: LOCAL_MODEL_NAME })
                            const chat = model.startChat({
                                history: chatHistory.map(h => ({
                                    role: h.role,
                                    parts: h.parts.map(p => {
                                        if (p.text) return { text: p.text };
                                        if (p.inlineData) return { inlineData: p.inlineData };
                                        return p;
                                    })
                                }))
                            })

                            const result = await chat.sendMessageStream(parts)
                            
                            for await (const chunk of result.stream) {
                                const text = chunk.text()
                                if (text) {
                                    setRetryStatus('');
                                    updateAiMessage(aiText + text);
                                }
                            }
                            success = true;
                            break;
                        } catch (localErr) {
                            console.error(`Local Key ${i} failed`); // Log quietly
                        }
                    }

                    if (!success) {
                        setRetryStatus('');
                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: 'Tất cả API Keys đều đã hết hạn mức (Quota). Cậu vui lòng đợi một chút hoặc quay lại sau nhé!',
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }])
                    }
                } else {
                    setRetryStatus('');
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'Hệ thống đang bận một chút. Cậu vui lòng thử lại sau giây lát nhé!',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }])
                }
            }
        };

        setRetryStatus('');
        await performRequest();
        setIsLoading(false)
        setRetryStatus('');
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#F9F7F2] dark:bg-[#1a1614] font-serif text-slate-900 dark:text-slate-100 selection:bg-[#634a3a]/20">
            {/* Custom Styles for Student AI Aesthetic */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap');
                
                .scholar-font { font-family: 'Merriweather', serif; }
                .display-font { font-family: 'Playfair Display', serif; }
                
                .markdown-body h3 { font-family: 'Playfair Display', serif; font-size: 1.25rem; font-weight: 700; color: #634a3a; margin-bottom: 1rem; border-left: 3px solid #634a3a; padding-left: 0.75rem; }
                .markdown-body blockquote { font-style: italic; background-color: #f3f0e8; border-left: 3px solid #634a3a; padding: 1rem; margin: 1.5rem 0; color: #4a372d; }
                .markdown-body p { margin-bottom: 0.75rem; line-height: 1.7; }
                .markdown-body b, .markdown-body strong { color: #634a3a; font-weight: 700; }
                
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

                /* Custom Scrollbar for Chat Area */
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #634a3a30; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #634a3a50; }

                .paper-shadow { box-shadow: 0 4px 20px -2px rgba(99, 74, 58, 0.1); }
            `}</style>

            <main className="flex flex-1 flex-col scholar-font">
                {/* Header */}
                <header className="flex h-16 items-center justify-between border-b border-[#634a3a]/10 bg-white/80 dark:bg-slate-900/80 px-8 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 rounded-full border border-[#634a3a]/20 bg-[#634a3a]/5 px-4 py-1.5 transition-all hover:bg-[#634a3a]/10">
                            <span className="material-symbols-outlined text-[#634a3a] text-sm">auto_stories</span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#634a3a] display-font">Literary Mode</span>
                        </div>
                        <h2 className="display-font text-lg font-bold text-slate-800 dark:text-white hidden md:block">Student AI <span className="text-[#634a3a]/50 text-sm font-normal">— Advanced Research</span></h2>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button className="material-symbols-outlined text-slate-500 hover:text-[#634a3a] transition-colors">settings</button>
                        <button className="material-symbols-outlined text-slate-500 hover:text-[#634a3a] transition-colors">notifications</button>
                    </div>
                </header>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar scroll-smooth">
                    <div className="mx-auto max-w-4xl space-y-10">
                        {/* Date Separator */}
                        <div className="flex justify-center opacity-50">
                            <span className="display-font text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>

                        <AnimatePresence>
                            {messages.map((msg, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-[#634a3a] text-[#F9F7F2] shrink-0 scholar-shadow">
                                            <span className="material-symbols-outlined text-xl">smart_toy</span>
                                        </div>
                                    )}

                                    <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`rounded-2xl p-6 transition-all duration-300 relative group ${
                                            msg.role === 'user'
                                                ? 'bg-[#634a3a] text-white shadow-xl rounded-tr-none'
                                                : 'bg-white dark:bg-slate-900 border border-[#634a3a]/10 shadow-sm paper-shadow rounded-tl-none'
                                        }`}>
                                            <div className={`text-[14px] md:text-base leading-relaxed ${msg.role === 'assistant' ? 'markdown-body' : ''}`}>
                                                {msg.role === 'assistant' ? (
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                                ) : (
                                                    <p>{msg.content}</p>
                                                )}
                                            </div>
                                            {msg.role === 'assistant' && (
                                                <button 
                                                    onClick={() => navigator.clipboard.writeText(msg.content)}
                                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#634a3a]"
                                                    title="Copy response"
                                                >
                                                    <span className="material-symbols-outlined text-sm">content_copy</span>
                                                </button>
                                            )}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {msg.attachments.map((file, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-black/10 rounded-lg text-xs">
                                                            <span className="material-symbols-outlined text-sm">attachment</span>
                                                            <span className="truncate max-w-[120px]">{file.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-2">{msg.timestamp}</span>
                                    </div>

                                    {msg.role === 'user' && (
                                        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0 overflow-hidden border border-[#634a3a]/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-slate-500">person</span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {isLoading && (
                            <div className="flex items-center gap-3 px-4 py-2 text-slate-400 text-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#634a3a] animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-[#634a3a] animate-bounce" style={{ animationDelay: '200ms' }} />
                                <span className="w-1.5 h-1.5 rounded-full bg-[#634a3a] animate-bounce" style={{ animationDelay: '400ms' }} />
                                <span className="text-[10px] font-bold uppercase tracking-widest ml-2">
                                    {retryStatus || 'Đang nghiên cứu...'}
                                </span>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <footer className="p-4 md:p-8 bg-paper dark:bg-background-dark">
                    <div className="mx-auto max-w-4xl">
                        {/* Hidden File Input */}
                        <input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            multiple
                            onChange={handleFileChange}
                        />

                        {/* File Previews */}
                        {attachedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2">
                                {attachedFiles.map((file, idx) => (
                                    <div key={idx} className="relative group flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-[#634a3a]/20 rounded-xl shadow-sm">
                                        {file.preview ? (
                                            <img src={file.preview} alt="preview" className="w-8 h-8 rounded-md object-cover" />
                                        ) : (
                                            <span className="material-symbols-outlined text-[#634a3a] text-lg">description</span>
                                        )}
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{file.name}</span>
                                        <button 
                                            onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                        >
                                            <span className="material-symbols-outlined text-[10px]">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="relative flex flex-col rounded-2xl border border-[#634a3a]/20 bg-white dark:bg-slate-900 shadow-2xl focus-within:ring-4 focus-within:ring-[#634a3a]/5 transition-all">
                            {/* Toolbar */}
                            <div className="flex items-center gap-1.5 md:gap-4 px-4 py-3 border-b border-[#634a3a]/5">
                                <button 
                                    onClick={handleFileClick}
                                    className="material-symbols-outlined text-slate-400 hover:text-[#634a3a] transition-colors text-xl"
                                >
                                    attach_file
                                </button>
                                <button 
                                    onClick={handleFileClick}
                                    className="material-symbols-outlined text-slate-400 hover:text-[#634a3a] transition-colors text-xl"
                                >
                                    image
                                </button>
                                <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1"></div>
                                
                                <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                                    {[
                                        { icon: 'analytics', label: 'Phân tích phong cách' },
                                        { icon: 'search_check', label: 'Tìm dẫn chứng' },
                                        { icon: 'format_quote', label: 'Trích dẫn' }
                                    ].map(tool => (
                                        <button 
                                            key={tool.label} 
                                            onClick={() => handleQuickAction(tool.label)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-[#634a3a]/10 text-slate-500 hover:text-[#634a3a] transition-all shrink-0"
                                        >
                                            <span className="material-symbols-outlined text-lg">{tool.icon}</span>
                                            <span className="text-[11px] font-bold display-font uppercase tracking-wider">{tool.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-end gap-3 p-5">
                                <textarea
                                    ref={inputRef}
                                    className="flex-1 border-0 bg-transparent p-0 text-base focus:ring-0 focus:outline-none outline-none placeholder:text-slate-300 resize-none min-h-[60px] scholar-font"
                                    placeholder="Nhập một đoạn văn, bài thơ hoặc tác phẩm cần phân tích..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim()}
                                    className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#634a3a] text-[#F9F7F2] shadow-xl shadow-[#634a3a]/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:shadow-none"
                                >
                                    <span className="material-symbols-outlined">send</span>
                                </button>
                            </div>

                            <div className="px-5 pb-4 flex justify-between items-center opacity-60">
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="rounded text-[#634a3a] focus:ring-[#634a3a] border-slate-300 dark:border-slate-700 bg-transparent" defaultChecked />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-[#634a3a] transition-colors">Academic DB</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" className="rounded text-[#634a3a] focus:ring-[#634a3a] border-slate-300 dark:border-slate-700 bg-transparent" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-[#634a3a] transition-colors">OCR Analysis</span>
                                    </label>
                                </div>
                                <p className="text-[10px] font-bold display-font text-[#634a3a] uppercase tracking-[0.2em]">Student AI Engine v3.0</p>
                            </div>
                        </div>
                        <p className="mt-4 text-center text-[10px] text-slate-400 font-medium scholar-font">Hệ thống hỗ trợ học tập chuyên sâu được tối ưu hóa cho học sinh ôn thi tốt nghiệp.</p>
                    </div>
                </footer>
            </main>
        </div>
    )
}
