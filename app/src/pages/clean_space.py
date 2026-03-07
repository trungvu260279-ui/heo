import json
import os
import re
import unicodedata
import sys
import io

# Đảm bảo in được tiếng Việt/Emoji ra Console Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Thiết lập đường dẫn tương đối
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(CURRENT_DIR, "..", "data", "exams.json")
OUTPUT_FILE = os.path.join(CURRENT_DIR, "..", "data", "exams_cleaned.json")

def fix_vietnamese_ocr_offline(text):
    if not text: return ""
    
    # --- PHẦN 1: Dọn dẹp OCR & Dấu (NFD) ---
    text = unicodedata.normalize('NFD', text)
    
    # Chuẩn hóa các dấu rời rạc
    text = text.replace('\u00B4', '\u0301').replace('´', '\u0301')
    text = text.replace('\u0060', '\u0300').replace('`', '\u0300')
    text = text.replace('\u02BC', '\u0309').replace('ʼ', '\u0309')
    text = text.replace('\u007E', '\u0303')
    
    # Kéo dấu sát vào chữ
    text = re.sub(r'[ \t\u00A0]+([\u0300-\u036f])', r'\1', text)
    
    # Ép chữ rớt phụ âm
    pattern = r'([\u0300-\u036f])[ \t\u00A0]+(c|p|t|m|n|ng|nh|ch|u|i|o|y)(?=[ \t\u00A0\n.,;?!“"\'()\[\]]|$)'
    prev_text = ""
    while text != prev_text:
        prev_text = text
        text = re.sub(pattern, r'\1\2', text, flags=re.IGNORECASE)

    # Đưa về NFC trước khi check Footer để khớp dấu chuẩn
    text = unicodedata.normalize('NFC', text)

    # --- PHẦN 2: Chặt Footer (NFC) ---
    # Ưu tiên chặt từ "Nhóm biên soạn" vì nó là dấu hiệu rõ nhất
    # Sau đó mới chặt đến các dấu chấm "Hết"
    clean_patterns = [
        r'(?is)\n\s*Nhóm biên soạn\s*:.*$',
        r'(?is)Nhóm biên soạn\s*:.*$',
        r'(?is)[\s\.]*Hết[\s\.]{2,}.*$',
        r'(?is)[\s\.]*HẾT[\s\.]{2,}.*$'
    ]
    
    for cp in clean_patterns:
        match = re.search(cp, text)
        if match:
            text = text[:match.start()].strip()
            break

    # Dọn dẹp khoảng trắng thừa, giữ lại ngắt dòng
    text = re.sub(r'[ \t]{2,}', ' ', text)
    
    return text.strip()

# Chạy tự động
try:
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("🚀 Đang chạy máy cày Regex v3 - Quyết tâm diệt sạch Footer...")
    cleaned_count = 0

    for exam in data:
        if 'sections' in exam:
            for section_key in ['doc_hieu', 'nlxh', 'nlvh', 'full_text']:
                if section_key in exam['sections'] and exam['sections'][section_key]:
                    exam['sections'][section_key] = fix_vietnamese_ocr_offline(exam['sections'][section_key])
            cleaned_count += 1
            print(f" Đã quét xong đề: {exam.get('title', 'No Title')}")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    print(f"\n✅ Tuyệt vời! Đã dọn dẹp {cleaned_count} đề.")

except Exception as e:
    print(f"❌ Lỗi: {e}")