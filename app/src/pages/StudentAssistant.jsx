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

const LOCAL_GPT_KEYS_TEXT = import.meta.env.VITE_OPENAI_API_KEYS || ''
const LOCAL_GPT_KEYS = LOCAL_GPT_KEYS_TEXT.split(',').map(k => k.trim()).filter(Boolean)
const LOCAL_GPT_MODEL = import.meta.env.VITE_OPENAI_MODEL || 'gpt-4o'

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

// Constants
const WELCOME_MESSAGE = {
    id: 'welcome',
    role: 'assistant',
    content: `Chào cậu nhé! Tớ là **Gia sư AI** đây. Tớ rất vui được đồng hành cùng cậu chinh phục môn Ngữ văn.

Hôm nay cậu muốn chúng mình cùng "giải thích" tác phẩm nào? Hay cậu cần tớ hỗ trợ rèn luyện kĩ năng viết bài để bứt phá điểm số?`,
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
    const [showQuickActions, setShowQuickActions] = useState(false)
    const [kbData, setKbData] = useState(null)
    const [attachedFiles, setAttachedFiles] = useState([])
    const location = useLocation()
    const navigate = useNavigate()
    const chatEndRef = useRef(null)
    const hasTriggeredAnalysisRef = useRef(false)
    const hasTriggeredAnalysisEffectRef = useRef(false) // Using a clearer name for the ref
    const fileInputRef = useRef(null)
    const inputRef = useRef(null)
    const lastSendTimeRef = useRef(0)

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages, isLoading])

    // Load Knowledge Base
    useEffect(() => {
        const loadKB = async () => {
            try {
                const res = await fetch('/ngu_van_parsed.json')
                if (res.ok) {
                    const data = await res.json()
                    setKbData(data)
                    console.log("[StudentAssistant] Knowledge Base loaded:", data.length, "files");
                }
            } catch (e) {
                console.error("Failed to load knowledge base:", e)
            }
        }
        loadKB()
    }, [])

    const searchKnowledge = (query) => {
        if (!kbData) return null
        const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3)
        let bestMatch = null
        let maxScore = 0

        for (const item of kbData) {
            for (const section of item.sections) {
                let score = 0
                const contentStr = section.content.join(' ').toLowerCase()
                const headingStr = (section.heading || "").toLowerCase()

                keywords.forEach(kw => {
                    if (headingStr.includes(kw)) score += 10
                    if (contentStr.includes(kw)) score += 2
                })

                if (score > maxScore) {
                    maxScore = score
                    bestMatch = {
                        title: item.metadata?.title || section.heading,
                        content: section.content.slice(0, 10).join('\n'), // Limit to avoid token blast
                        subsections: section.subsections?.map(s => s.heading).join(', ')
                    }
                }
            }
        }
        return maxScore > 5 ? bestMatch : null
    }

    // Handle incoming Exam Analysis data
    useEffect(() => {
        if (location.state?.type === 'EXAM_ANALYSIS' && location.state.data && !hasTriggeredAnalysisEffectRef.current) {
            hasTriggeredAnalysisEffectRef.current = true;
            const { title, result, answers, examData, archiveId } = location.state.data;

            if (archiveId) {
                const analysisPrompt = `Tớ vừa làm xong đề: **${title}** (Mã: **${archiveId}**). Cậu phân tích giúp tớ nhé!`;
                navigate(location.pathname, { replace: true, state: {} });
                setTimeout(() => {
                    handleSend(analysisPrompt);
                }, 500);
                return;
            } else {
                const passage = examData?.sections?.doc_hieu || "";
                let formattedContext = `**PHẦN ĐỌC HIỂU (Văn bản):**\n${passage}\n\n**CHI TIẾT BÀI LÀM:**\n`;
                if (examData?.sections?.doc_hieu_questions) {
                    examData.sections.doc_hieu_questions.forEach((q, idx) => {
                        const answer = answers?.[`q_${idx}`] || "(Học sinh không trả lời)";
                        formattedContext += `Câu ${idx + 1} [${q.label}]: ${q.text}\n-> Trả lời: ${answer}\n\n`;
                    });
                }
                if (examData?.sections?.nlxh) {
                    const answer = answers?.nlxh || "(Học sinh không trả lời)";
                    formattedContext += `Câu NLXH: ${examData.sections.nlxh}\n-> Trả lời: ${answer}\n\n`;
                }
                if (examData?.sections?.nlvh) {
                    const answer = answers?.nlvh || "(Học sinh không trả lời)";
                    formattedContext += `Câu NLVH: ${examData.sections.nlvh}\n-> Trả lời: ${answer}\n\n`;
                }

                const analysisPrompt = `Tớ vừa làm xong đề: **${title}**. Cậu phân tích giúp tớ nhé!`;
                navigate(location.pathname, { replace: true, state: {} });
                setTimeout(() => {
                    handleSend(analysisPrompt);
                }, 500);
            }
        }
    }, [location.state]);

    const handleFileClick = () => {
        fileInputRef.current?.click()
    }

    const quickActions = attachedFiles.length > 0 ? [
        { id: 'summary', label: 'Tóm tắt nội dung toàn bộ tài liệu', icon: 'summarize', prompt: 'Hãy tóm tắt ngắn gọn những ý chính quan trọng nhất trong tài liệu này.' },
        { id: 'explain_exam', label: 'Giải thích hoặc hướng dẫn dạng đề cụ thể', icon: 'quiz', prompt: 'Dựa trên tài liệu này, hãy hướng dẫn tớ phương pháp làm các dạng câu hỏi thường gặp.' },
        { id: 'sample_writing', label: 'Viết đoạn văn mẫu theo yêu cầu', icon: 'edit_note', prompt: 'Hãy dựa vào ngữ liệu này để viết cho tớ một đoạn văn mẫu đạt điểm cao (khoảng 200 chữ).' },
        { id: 'export', label: 'Chỉnh sửa hoặc xuất lại file', icon: 'ios_share', prompt: 'Hãy giúp tớ rà soát lỗi diễn đạt và trình bày lại nội dung này chuyên nghiệp hơn.' },
    ] : [
        { id: 'char_analysis', label: 'Kĩ năng: Phân tích nhân vật', icon: 'person_search', prompt: 'Hãy hướng dẫn tớ phương pháp phân tích/cảm nhận một đặc điểm của nhân vật truyện.' },
        { id: 'narrator', label: 'Kĩ năng: Phân tích người kể chuyện', icon: 'record_voice_over', prompt: 'Hãy giúp tớ phân tích vai trò và đặc điểm của người kể chuyện trong văn bản.' },
        { id: 'event_analysis', label: 'Kĩ năng: Phân tích tình tiết tiêu biểu', icon: 'auto_awesome_motion', prompt: 'Hãy hướng dẫn tớ cách phân tích sự kiện, tình tiết hoặc chi tiết tiêu biểu trong truyện.' },
        { id: 'skill', label: 'Giải thích kĩ năng / Lí luận văn học', icon: 'menu_book', prompt: 'Hãy giải thích cho tớ kĩ năng viết bài hoặc một khái niệm lí luận văn học quan trọng.' },
        { id: 'idea', label: 'Gợi ý ý tưởng & Luận điểm', icon: 'lightbulb', prompt: 'Cậu hãy gợi ý cho tớ những ý tưởng và luận điểm đắt giá cho một đề văn cụ thể nhé.' },
    ]

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        const newFiles = await Promise.all(
            files
                .filter(file => !file.type.startsWith('image/')) // Filter out images
                .map(async file => {
                    let extractedText = null
                    if (file.name.endsWith('.docx')) extractedText = await extractDocxText(file)
                    else if (file.name.endsWith('.pdf')) extractedText = await extractPdfText(file)

                    return {
                        file,
                        name: file.name,
                        type: file.type,
                        extractedText
                    }
                })
        )

        const filteredFiles = newFiles.filter(Boolean);
        setAttachedFiles(prev => [...prev, ...filteredFiles])
        if (filteredFiles.length > 0) setShowQuickActions(true) // Show menu after file upload
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
        const finalInput = typeof overrideInput === 'string' ? overrideInput : input;
        console.log("[handleSend] Called with:", { overrideInput, input, finalInput });
        if (!finalInput.trim() && attachedFiles.length === 0) return;
        const now = Date.now();
        if (now - lastSendTimeRef.current < 5000) {
            setRetryStatus(`Vui lòng đợi ${Math.ceil((5000 - (now - lastSendTimeRef.current)) / 1000)} giây để tránh spam.`);
            setTimeout(() => setRetryStatus(''), 2000);
            return;
        }
        if (isLoading) return;

        lastSendTimeRef.current = now;

        const userMsg = {
            id: Date.now() + Math.random(),
            role: 'user',
            content: finalInput,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            attachments: attachedFiles
        }
        console.log("[handleSend] Adding user message:", userMsg);

        setMessages(prev => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        // Prepare context for API
        const parts = [{ text: finalInput }]

        // Inject Knowledge Base context if relevant
        const kbMatch = searchKnowledge(finalInput)
        if (kbMatch) {
            parts.push({
                text: `\n[KIẾN THỨC HỆ THỐNG - ${kbMatch.title}]:\n${kbMatch.content}\n\n(Lưu ý: Hãy ưu tiên sử dụng kiến thức này để trả lời sinh viên nếu phù hợp).`
            })
        }

        for (const file of attachedFiles) {
            if (file.extractedText) {
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
            const aiMsgId = Date.now() + Math.random();
            let aiText = '';

            // Detect Archive ID in prompt and inject context
            let finalParts = [...parts];
            const archiveMatch = finalInput.match(/VANS-[A-Z0-9]{4}/);
            if (archiveMatch) {
                try {
                    const archiveId = archiveMatch[0];
                    // Retrieve from sessionStorage instead of backend
                    const rawData = sessionStorage.getItem(archiveId);
                    if (rawData) {
                        const data = JSON.parse(rawData);
                        let context = `\n[HỆ THỐNG: DỮ LIỆU ĐỐI CHIẾU (${archiveId})]\n`;
                        context += `Tiêu đề: ${data.title}\n`;
                        context += `Ngữ liệu: ${data.examData?.sections?.doc_hieu}\n\n`;
                        context += `Bài giải cụ thể:\n`;
                        if (data.answers) {
                            Object.entries(data.answers).forEach(([k, v]) => {
                                const qLabel = k.replace('q_', 'Câu ');
                                context += `- ${qLabel}: ${v}\n`;
                            });
                        }
                        context += `\n[CHỈ THỊ CỰC KỲ QUAN TRỌNG]: Hãy phản hồi cực kỳ ngắn gọn. 
Bắt đầu bằng 1 nhận xét Tổng quan (Điểm & Ấn tượng chung). 
Sau đó liệt kê danh sách các phần (Đọc hiểu, NLXH, NLVH) hoặc các câu hỏi để học sinh chọn 'mổ xẻ' sâu từng mục một. 
TUYỆT ĐỐI KHÔNG phân tích tất cả cùng lúc để tiết kiệm token và tránh làm loãng thông tin. 
Hãy hỏi: "Cậu muốn chúng mình bắt đầu 'mổ xẻ' từ câu/phần nào trước?"`;
                        context += `\n[KẾT THÚC DỮ LIỆU]`;
                        finalParts.push({ text: context });
                    } else {
                        console.warn("[StudentAssistant] Archive ID not found in session storage:", archiveId);
                    }
                } catch (e) {
                    console.error("Failed to inject archive context from session", e);
                }
            }

            const updateAiMessage = (newText) => {
                aiText = newText;
                console.log("[updateAiMessage] Updating AI message:", { aiMsgId, text: aiText.substring(0, 50) + "..." });
                setMessages(prev => {
                    const aiMsgIndex = prev.findIndex(m => m.id === aiMsgId);
                    if (aiMsgIndex === -1) {
                        return [...prev, {
                            id: aiMsgId,
                            role: 'assistant',
                            content: aiText,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }];
                    } else {
                        const next = [...prev];
                        next[aiMsgIndex] = { ...next[aiMsgIndex], content: aiText };
                        return next;
                    }
                });
            };

            try {
                setRetryStatus('Đang kết nối...');
                const res = await fetch('/api/gemini-stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: finalParts, history: chatHistory })
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
                        // NEW FALLBACK: GPT (OpenAI) for better file analysis/grading
                        if (LOCAL_GPT_KEYS.length > 0) {
                            for (let i = 0; i < LOCAL_GPT_KEYS.length; i++) {
                                try {
                                    setRetryStatus('Đang gọi GPT phân tích chuyên sâu...');
                                    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${LOCAL_GPT_KEYS[i]}`
                                        },
                                        body: JSON.stringify({
                                            model: LOCAL_GPT_MODEL,
                                            messages: [
                                                { role: 'system', content: SYSTEM_PROMPT },
                                                ...chatHistory.map(h => ({
                                                    role: h.role === 'model' ? 'assistant' : 'user',
                                                    content: h.parts[0].text
                                                })),
                                                { role: 'user', content: finalInput }
                                            ],
                                            stream: true
                                        })
                                    });

                                    if (!gptRes.ok) throw new Error("GPT API failed");

                                    const reader = gptRes.body.getReader();
                                    const decoder = new TextDecoder();
                                    let gptBuffer = '';

                                    while (true) {
                                        const { done, value } = await reader.read();
                                        if (done) break;

                                        gptBuffer += decoder.decode(value, { stream: true });
                                        const lines = gptBuffer.split('\n');
                                        gptBuffer = lines.pop();

                                        for (const line of lines) {
                                            if (line.trim().startsWith('data: ')) {
                                                const dataStr = line.trim().substring(6);
                                                if (dataStr === '[DONE]') continue;
                                                try {
                                                    const data = JSON.parse(dataStr);
                                                    const content = data.choices[0]?.delta?.content;
                                                    if (content) {
                                                        setRetryStatus('');
                                                        aiText += content;
                                                        updateAiMessage(aiText);
                                                    }
                                                } catch (e) { }
                                            }
                                        }
                                    }
                                    success = true;
                                    break;
                                } catch (gptErr) {
                                    console.error(`GPT Key ${i} failed:`, gptErr);
                                }
                            }
                        }
                    }

                    if (!success) {
                        // FINAL FALLBACK: Pollinations AI with Retry logic
                        let pollinationsSuccess = false;
                        const maxRetries = 3;

                        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                            try {
                                setRetryStatus(`Đang kết nối dự phòng (Lần ${attempt})...`);
                                const pollinationsRes = await fetch('https://text.pollinations.ai/', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        messages: [
                                            { role: 'system', content: SYSTEM_PROMPT },
                                            { role: 'user', content: finalInput }
                                        ],
                                        seed: Math.floor(Math.random() * 1000000)
                                    })
                                });

                                if (!pollinationsRes.ok) throw new Error("Pollinations failed");

                                const pollinationsText = await pollinationsRes.text();
                                if (pollinationsText) {
                                    setRetryStatus('');
                                    updateAiMessage(pollinationsText);
                                    pollinationsSuccess = true;
                                    break;
                                }
                            } catch (pErr) {
                                console.warn(`Pollinations Attempt ${attempt} failed:`, pErr);
                                if (attempt === maxRetries) {
                                    setRetryStatus('');
                                    setMessages(prev => [...prev, {
                                        role: 'assistant',
                                        content: 'Hệ thống đang bận một chút do lượt truy cập cao. Cậu vui lòng thử lại sau giây lát nhé!',
                                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    }]);
                                }
                            }
                        }
                    }
                } else {
                    // Same Pollinations logic if no LOCAL_API_KEYS
                    let pollinationsSuccess = false;
                    const maxRetries = 3;
                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            setRetryStatus(`Đang kết nối dự phòng (Lần ${attempt})...`);
                            const pollinationsRes = await fetch('https://text.pollinations.ai/', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    messages: [
                                        { role: 'system', content: SYSTEM_PROMPT },
                                        { role: 'user', content: finalInput }
                                    ],
                                    seed: Math.floor(Math.random() * 1000000)
                                })
                            });

                            if (!pollinationsRes.ok) throw new Error("Pollinations failed");

                            const pollinationsText = await pollinationsRes.text();
                            if (pollinationsText) {
                                setRetryStatus('');
                                updateAiMessage(pollinationsText);
                                pollinationsSuccess = true;
                                break;
                            }
                        } catch (pErr) {
                            console.warn(`Pollinations Attempt ${attempt} failed:`, pErr);
                            if (attempt === maxRetries) {
                                setRetryStatus('');
                                setMessages(prev => [...prev, {
                                    role: 'assistant',
                                    content: 'Hệ thống đang bận. Cậu vui lòng thử lại sau giây lát nhé!',
                                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                }]);
                            }
                        }
                    }
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
                
                .markdown-body h3 { font-family: 'Playfair Display', serif; font-size: 1.15rem; font-weight: 700; color: #634a3a; margin: 1.5rem 0 0.75rem 0; border-left: 3px solid #634a3a; padding-left: 0.75rem; }
                .markdown-body blockquote { font-style: italic; background-color: #f3f0e8; border-left: 3px solid #634a3a; padding: 0.75rem 1rem; margin: 1rem 0; color: #4a372d; border-radius: 0 8px 8px 0; }
                .markdown-body p { margin-bottom: 0.5rem; line-height: 1.6; }
                .markdown-body b, .markdown-body strong { color: #634a3a; font-weight: 700; }
                .markdown-body ul, .markdown-body ol { margin-bottom: 1rem; padding-left: 1.25rem; }
                .markdown-body li { margin-bottom: 0.25rem; }
                
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #634a3a20; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #634a3a40; }

                .paper-shadow { box-shadow: 0 2px 15px -3px rgba(99, 74, 58, 0.08); }
                .ai-bubble { background: white; border: 1px solid rgba(99, 74, 58, 0.15); border-radius: 4px 24px 24px 24px; }
                .user-bubble { background: #634a3a; color: white; border-radius: 24px 4px 24px 24px; box-shadow: 0 4px 15px -2px rgba(99, 74, 58, 0.2); }
                
                .quick-action-card { 
                    background: white; 
                    border: 1px solid rgba(99, 74, 58, 0.1); 
                    transition: all 0.2s ease;
                }
                .quick-action-card:hover { 
                    background: #fdfcf9; 
                    border-color: #634a3a; 
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px -2px rgba(99, 74, 58, 0.1);
                }
            `}</style>

            <main className="flex flex-1 flex-col scholar-font relative">
                {/* Quick Actions Overlay */}
                <AnimatePresence>
                    {showQuickActions && (
                        <div className="absolute inset-0 z-50 flex items-end justify-center px-4 pb-32 md:pb-40 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                className="w-full max-w-2xl bg-white/95 backdrop-blur-md rounded-3xl p-6 paper-shadow border border-[#634a3a]/20 pointer-events-auto"
                            >
                                <div className="flex items-center justify-between mb-6 px-2">
                                    <h3 className="display-font text-lg font-bold text-slate-800">
                                        {attachedFiles.length > 0 ? "Bạn cần hỗ trợ gì với tài liệu này?" : "Hôm nay tớ có thể giúp gì cho cậu?"}
                                    </h3>
                                    <button
                                        onClick={() => setShowQuickActions(false)}
                                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {quickActions.map((action, idx) => (
                                        <button
                                            key={action.id}
                                            onClick={() => {
                                                setShowQuickActions(false);
                                                handleSend(action.prompt);
                                            }}
                                            className="w-full flex items-center gap-4 p-4 rounded-2xl quick-action-card text-left group"
                                        >
                                            <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-[#634a3a]/5 text-[#634a3a] group-hover:bg-[#634a3a] group-hover:text-white transition-all">
                                                <span className="material-symbols-outlined">{action.icon}</span>
                                            </div>
                                            <span className="flex-1 text-[15px] font-medium text-slate-700 group-hover:text-[#634a3a] transition-colors">
                                                {action.label}
                                            </span>
                                            <span className="material-symbols-outlined text-slate-300 group-hover:text-[#634a3a] transition-colors text-sm">keyboard_return</span>
                                        </button>
                                    ))}

                                    <button
                                        onClick={() => setShowQuickActions(false)}
                                        className="w-full py-3 mt-2 text-center text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Bỏ qua để chat tự do
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
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
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                                >
                                    <div className={`h-10 w-10 flex items-center justify-center rounded-full shrink-0 ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-800' : 'bg-[#634a3a] text-[#F9F7F2]'
                                        }`}>
                                        <span className="material-symbols-outlined text-xl">
                                            {msg.role === 'user' ? 'person' : 'smart_toy'}
                                        </span>
                                    </div>

                                    <div className={`flex flex-col gap-1.5 max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`p-5 transition-all duration-300 relative group ${msg.role === 'user' ? 'user-bubble' : 'ai-bubble'
                                            }`}>
                                            <div className={`text-[15px] leading-relaxed ${msg.role === 'assistant' ? 'markdown-body text-slate-800 dark:text-slate-200' : 'text-white'}`}>
                                                {msg.role === 'assistant' ? (
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                                ) : (
                                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                                )}
                                            </div>
                                            {msg.role === 'assistant' && (
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(msg.content)}
                                                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#634a3a]"
                                                    title="Copy response"
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                                                </button>
                                            )}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white/70">
                                                    {msg.attachments.map((file, idx) => (
                                                        <div key={idx} className="flex items-center gap-1 bg-black/10 px-2 py-1 rounded">
                                                            <span className="material-symbols-outlined text-[11px]">attachment</span>
                                                            <span className="truncate max-w-[100px]">{file.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest px-1">{msg.timestamp}</span>
                                    </div>
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
                                        <span className="material-symbols-outlined text-[#634a3a] text-lg">description</span>
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
                                    title="Tải tệp lên (.docx, .pdf)"
                                >
                                    attach_file
                                </button>
                                <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1"></div>

                                <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                                    <button
                                        onClick={() => setShowQuickActions(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#634a3a]/5 hover:bg-[#634a3a]/10 text-[#634a3a] transition-all shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-lg">magic_button</span>
                                        <span className="text-[11px] font-bold display-font uppercase tracking-wider">Gợi ý nhanh</span>
                                    </button>
                                    <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1"></div>

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

                            <div className="px-5 pb-4 flex justify-end items-center opacity-60">
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
