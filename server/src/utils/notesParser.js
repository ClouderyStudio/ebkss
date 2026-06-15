/**
 * 基于规则的英语笔记文本解析器。
 * 从英语笔记行文本中提取结构化语料条目。
 * 不依赖 AI，快速且可靠。
 */

// 常见语法/句型标记
const GRAMMAR_KEYWORDS = [
  '语法', '时态', '语态', '句型', '结构', '用法', '辨析',
  '搭配', '拓展', '时态', '语态', '从句', '定语', '状语',
  'grammar', 'tense', 'voice', 'pattern', 'structure'
];

// 常见词性标记
const POS_PATTERNS = [
  /^(\w[\w-]+)\s+(n\.|v\.|adj\.|adv\.|prep\.|conj\.|pron\.|num\.|art\.|int\.)/i,
  /^(\w[\w-]+)\s+(n|v|adj|adv|prep|conj|pron|num|art|int)\.\s+/i
];

// 提取音标（/.../ 或 [...]）
const PHONETIC_RE = /[\/\[][^\s\/\[\]]+[\/\]]/;

// 英文单词/短语正则
const ENGLISH_WORD_RE = /^([A-Za-z][A-Za-z\s\-'′,]+?)(?:\s+|=)/;

// 中文提取正则
const CHINESE_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]+/;

const TAGS_BY_TYPE = {
  n: 'vocabulary',
  v: 'vocabulary',
  adj: 'vocabulary',
  adv: 'vocabulary',
  prep: 'vocabulary',
  pron: 'vocabulary',
  conj: 'vocabulary',
  num: 'vocabulary'
};

function detectLineType(line) {
  if (GRAMMAR_KEYWORDS.some(kw => line.includes(kw))) return 'grammar';
  if (/^[A-Za-z]/.test(line)) return 'vocab';
  return 'other';
}

function extractPhonetic(line) {
  const match = line.match(PHONETIC_RE);
  return match ? match[0] : '';
}

function extractTags(line, english) {
  const tags = ['vocabulary'];
  if (GRAMMAR_KEYWORDS.some(kw => line.includes(kw))) {
    tags.push('grammar');
  }
  if (/\s+/.test(english.trim())) {
    tags.push('phrase');
  }
  if (line.includes('例句') || line.includes('example') || line.startsWith('例：')) {
    tags.push('sentence');
  }
  return tags;
}

/**
 * 解析一行英语笔记文本，提取结构化条目。
 * @param {string} line - 单行文本
 * @returns {object|null} - { english, chinese, englishExplain, phonetic, tags } 或 null
 */
function parseLine(line) {
  line = line.trim();
  if (!line || line.length < 2) return null;

  // 跳过标题行、注释行
  if (/^\d+\s*[|)\]]/.test(line) || /^[|▶•●]/.test(line) || line.startsWith('注：')) {
    return null;
  }

  const type = detectLineType(line);
  if (type === 'other') return null;

  const phonetic = extractPhonetic(line);
  const cleaned = line.replace(PHONETIC_RE, '').trim();

  // 尝试匹配 "English = Chinese Explanation" 或 "English Chinese"
  let english = '';
  let chinese = '';
  let englishExplain = '';

  // 模式1: "TCM 中药 = Traditional Chinese Medicine"
  const eqMatch = cleaned.match(/^([A-Za-z][A-Za-z\s\-'′,]*?)\s*=\s*(.+)/);
  if (eqMatch) {
    english = eqMatch[1].trim();
    const rest = eqMatch[2].trim();
    const cnMatch = rest.match(CHINESE_RE);
    if (cnMatch) {
      chinese = cnMatch[0];
      englishExplain = rest.replace(CHINESE_RE, '').replace(/^[=\s]+|[=\s]+$/g, '').trim();
    } else {
      englishExplain = rest;
    }
  } else {
    // 模式2: "english 中文" / "english n. 中文"
    const posMatch = cleaned.match(/^([A-Za-z][A-Za-z\s\-'′,]*?)\s+(n\.|v\.|adj\.|adv\.|prep\.)/i);
    if (posMatch) {
      english = posMatch[1].trim();
      const afterPos = cleaned.slice(posMatch[0].length).trim();
      const cnMatch = afterPos.match(CHINESE_RE);
      if (cnMatch) {
        chinese = cnMatch[0];
        englishExplain = afterPos.replace(CHINESE_RE, '').replace(/^[;\s,，]+/, '').trim();
      } else {
        englishExplain = afterPos;
      }
    } else {
      // 通用英文→中文匹配
      const enMatch = cleaned.match(ENGLISH_WORD_RE);
      const cnMatch = cleaned.match(CHINESE_RE);

      if (enMatch) {
        english = enMatch[1].trim();
        if (cnMatch) {
          chinese = cnMatch[0];
          // 中文之后的内容作为英文解释
          const cnIdx = cleaned.indexOf(chinese);
          englishExplain = cleaned.slice(cnIdx + chinese.length).replace(/^[;\s,，]+/, '').trim();
        }
      } else if (cnMatch) {
        // 纯中文行，跳过
        return null;
      }
    }
  }

  if (!english) return null;

  // 清理
  english = english.replace(/[=]/g, '').trim();
  if (english.length > 80) {
    // 太长的可能是句子描述而非条目
    const words = english.split(/\s+/);
    if (words.length > 12) return null;
  }

  const tags = extractTags(cleaned, english);

  return {
    english,
    chinese: chinese || '',
    englishExplain: englishExplain || '',
    phonetic,
    tags
  };
}

/**
 * 解析英语笔记文本行数组，返回结构化条目。
 * @param {string[]} lines - 文本行数组
 * @returns {Array<{english, chinese, englishExplain, phonetic, tags}>}
 */
export function parseNotesLines(lines) {
  const results = [];
  const seen = new Set();

  for (const line of lines) {
    const entry = parseLine(line);
    if (entry && !seen.has(entry.english.toLowerCase())) {
      seen.add(entry.english.toLowerCase());
      results.push(entry);
    }
  }

  return results;
}
