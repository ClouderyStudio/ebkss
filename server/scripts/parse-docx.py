"""从 Word (.docx) 文件中提取文本"""
import json
import sys
from docx import Document


def extract_text(filepath):
    doc = Document(filepath)
    lines = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if text:
            lines.append(text)
    return lines


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: parse-docx.py <filepath>'}))
        sys.exit(1)

    filepath = sys.argv[1]
    try:
        lines = extract_text(filepath)
        print(json.dumps({'lines': lines, 'count': len(lines)}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)
