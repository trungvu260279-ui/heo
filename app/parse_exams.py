import docx
import json
import os
import re
import sys
import unicodedata

# Fix Windows console encoding issues for Vietnamese characters
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except:
        pass

def fix_vietnamese_diacritics(text):
    # Step 1: Remove spurious standalone accent characters that OCR or Word export can inject
    # These look like tone marks but are rendered as separate visible characters
    text = text.replace('\u00B4', '')   # ACUTE ACCENT ´
    text = text.replace('\u0060', '')   # GRAVE ACCENT `
    text = text.replace('\u02B9', '')   # MODIFIER LETTER PRIME
    text = text.replace('\u02BC', '')   # MODIFIER LETTER APOSTROPHE
    text = text.replace('\u02CA', '')   # MODIFIER LETTER ACUTE ACCENT
    text = text.replace('\u02CB', '')   # MODIFIER LETTER GRAVE ACCENT
    
    # Step 2: Fix separated combining characters (combining mark preceded by space/ZWSP)
    text = re.sub(r'[\s\u200B\u200C\u200D]+([\u0300-\u036f])', r'\1', text)
    
    vowels = r'[aAàÀảẢãÃáÁạẠăĂằẰẳẲẵẴắẮặẶâÂầẦẩẨẫẪấẤậẬeEèÈẻẺẽẼéÉẹẸêÊềỀểỂễỄếẾệỆiIìÌỉỈĩĨíÍịỊoOòÒỏỎõÕóÓọỌôÔồỒổỔỗỖốỐộỘơƠờỜởỞỡỠớỚợỢuUùÙủỦũŨúÚụỤưƯừỪửỬữỮứỨựỰyYỳỲỷỶỹỸýÝỵỴ]'
    vn_chars = 'a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸưăạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ'
    
    # Step 3: Join separated terminal consonants
    pattern1 = r'(?<=[' + vn_chars + r'])(?<=[' + vowels + r'])\s+(c|m|n|p|t|ng|nh|ch)(?![' + vn_chars + r'])'
    old_text = ""
    while old_text != text:
        old_text = text
        text = re.sub(pattern1, r'\1', text)
        
    # Step 4: Join separated terminal vowels
    pattern2 = r'(?<=[' + vn_chars + r'])(?<=[' + vowels + r'])\s+(u|i|o|y|a|e)(?![' + vn_chars + r'])'
    old_text = ""
    while old_text != text:
        old_text = text
        text = re.sub(pattern2, r'\1', text)

    # Step 5: Remove zero-width characters that can cause rendering issues
    text = re.sub(r'[\u200B\u200C\u200D\uFEFF]', '', text)

    # Step 6: Normalize to NFC to ensure all Vietnamese chars are properly composed
    text = unicodedata.normalize('NFC', text)

    return text


def clean_exam_text(text):
    patterns = [
        r'-+\s*HẾT\s*-+',
        r'\*\s*Nhóm\s*biên\s*soạn',
        r'HƯỚNG\s*DẪN\s*CHẤM',
        r'PHẦN\s*CHẤM\s*ĐIỂM'
    ]
    
    first_occurrence = len(text)
    for p in patterns:
        match = re.search(p, text, re.IGNORECASE)
        if match and match.start() < first_occurrence:
            first_occurrence = match.start()
            
    text = text[:first_occurrence].strip()
    # If the text still ends with HẾT without dashes, remove it safely
    text = re.sub(r'(\n|\s)*HẾT(\n|\s)*$', '', text, flags=re.IGNORECASE).strip()
    return fix_vietnamese_diacritics(text)

def get_docx_text(path):
    try:
        doc = docx.Document(path)
        fullText = []
        for para in doc.paragraphs:
            fullText.append(para.text)
        text = '\n'.join(fullText)
        return clean_exam_text(text)
    except Exception as e:
        print(f"Error reading {path}: {e}")
        return ""

def parse_exam_content(text):
    # Regex patterns for sections
    doc_hieu_pattern = r'(?i)I\.\s*ĐỌC\s*HIỂU'
    # Try multiple variations for the writing section
    viet_pattern = r'(?i)(II\.\s*VIẾT|II\.\s*LÀM\s*VĂN)'
    
    doc_hieu_match = re.search(doc_hieu_pattern, text)
    viet_match = re.search(viet_pattern, text)
    
    doc_hieu_content = ""
    doc_hieu_questions = []
    nlxh_content = ""
    nlvh_content = ""
    
    if doc_hieu_match:
        end_pos = viet_match.start() if viet_match else len(text)
        doc_hieu_full = text[doc_hieu_match.start():end_pos].strip()
        doc_hieu_content = doc_hieu_full
        
        q_split = re.split(r'(?i)(Câu\s*\d+[\.\:\s])', doc_hieu_full)
        if len(q_split) > 1:
            for i in range(1, len(q_split), 2):
                q_label = q_split[i]
                q_text = q_split[i+1] if i+1 < len(q_split) else ""
                doc_hieu_questions.append({
                    "id": q_label.strip().replace(" ", "_").replace(".", "").replace(":", ""),
                    "label": q_label.strip(),
                    "text": q_text.strip()
                })
        
    if viet_match:
        writing_section = text[viet_match.start():].strip()
        
        cau_1_pattern = r'(?i)Câu\s*1[\.\s\:]'
        cau_2_pattern = r'(?i)Câu\s*2[\.\s\:]'
        
        c1_match = re.search(cau_1_pattern, writing_section)
        c2_match = re.search(cau_2_pattern, writing_section)
        
        if c1_match:
            end_c1 = c2_match.start() if c2_match else len(writing_section)
            nlxh_content = writing_section[c1_match.start():end_c1].strip()
        
        if c2_match:
            nlvh_content = writing_section[c2_match.start():].strip()

    return {
        "full_text": text, # Include 100% of the original text
        "doc_hieu": doc_hieu_content,
        "doc_hieu_questions": doc_hieu_questions,
        "nlxh": nlxh_content,
        "nlvh": nlvh_content
    }

def main():
    directory = r'd:\stitch (1)_1\app\file_word'
    output_path = r'd:\stitch (1)_1\app\src\data\exams.json'
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    files = os.listdir(directory)
    patterns = ['Đề', 'DE ', '30 ĐỀ', 'Thơ', 'Truyện', 'Kí', 'NLXH', 'NLVH', 'Kịch', 'VBNL', 'VBTT']
    exam_files = [f for f in files if f.endswith('.docx') and any(p in f for p in patterns)]
    
    parsed_exams = []
    
    for filename in exam_files:
        print(f"Parsing: {filename}")
        path = os.path.join(directory, filename)
        text = get_docx_text(path)
        
        if not text:
            continue
            
        sections = parse_exam_content(text)
        
        # Include if we have text
        if len(text) > 100:
            parsed_exams.append({
                "id": re.sub(r'[^a-zA-Z0-9]', '_', filename.split('.')[0]),
                "title": filename.replace('.docx', ''),
                "filename": filename,
                "sections": sections
            })

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(parsed_exams, f, ensure_ascii=False, indent=2)

    print(f"Successfully exported {len(parsed_exams)} exams to {output_path}")

if __name__ == "__main__":
    main()
