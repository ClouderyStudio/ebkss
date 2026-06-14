import { z } from 'zod';
import { config } from '../config.js';
import { extractJson } from '../utils/json.js';

const QUESTION_TYPES = ['collocation', 'translation', 'synonym', 'analogy', 'morphology', 'phrase'];

const generatedQuestionSchema = z.object({
  question_type: z.enum(QUESTION_TYPES),
  question_text: z.string().min(1),
  acceptable_answers: z.array(z.string()).min(1),
  template: z.string().optional().nullable(),
  match_rule: z.enum(['exact', 'case_insensitive', 'trim']).default('exact'),
  difficulty: z.number().int().min(1).max(5).optional()
});

const graphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).transform(String),
        name: z.string().min(1),
        description: z.string().optional().default('')
      })
    )
    .min(1),
  edges: z
    .array(
      z.object({
        source: z.union([z.string(), z.number()]).transform(String),
        target: z.union([z.string(), z.number()]).transform(String),
        label: z.string().optional().default('')
      })
    )
    .default([])
});

const classroomGraphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).transform(String),
        name: z.string().min(1),
        type: z.string().optional().default('phrase'),
        meaning: z.string().optional().default(''),
        description: z.string().optional().default('')
      })
    )
    .min(1),
  edges: z
    .array(
      z.object({
        source: z.union([z.string(), z.number()]).transform(String),
        target: z.union([z.string(), z.number()]).transform(String),
        label: z.string().optional().default('')
      })
    )
    .default([])
});

const gradingSchema = z.object({
  is_correct: z.boolean(),
  feedback: z.string().default('已评分'),
  score: z.number().min(0).max(100)
});

async function chatJson(messages, options = {}) {
  if (!config.ai.apiKey) {
    throw new Error('Missing AI_API_KEY');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);

  try {
    const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1600
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AI request failed (${response.status}): ${detail.slice(0, 240)}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    return extractJson(content);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateQuestions({ grammarPoint, notesContent, count }) {
  const data = await chatJson(
    [
      {
        role: 'system',
        content: '你是严谨的初中英语老师。只输出合法 JSON，不输出解释。'
      },
      {
        role: 'user',
        content: `你是英语老师。基于以下语法点和笔记内容，生成${count}道题目。

语法点：${grammarPoint}
笔记内容：${notesContent}

要求：
1. 题型从以下六种中随机选择：collocation, translation, synonym, analogy, morphology, phrase
2. 不要选择题，不要选择题，不要选择题
3. 输出 JSON 数组，每道题格式：
{
  "question_type": "collocation",
  "question_text": "add A ___ B",
  "acceptable_answers": ["to"],
  "match_rule": "exact",
  "difficulty": 1
}
4. 对于 analogy 类型，额外提供 template 字段
5. 对于 translation/synonym 类型，acceptable_answers 可以是多个同义词
6. 难度适合初中生`
      }
    ],
    { temperature: 0.45, maxTokens: 2200 }
  );

  const questions = Array.isArray(data) ? data : data.questions;
  return z.array(generatedQuestionSchema).parse(questions).map((question) => ({
    questionType: question.question_type,
    questionText: question.question_text,
    acceptableAnswers: question.acceptable_answers,
    template: question.template || null,
    matchRule: question.match_rule,
    difficulty: question.difficulty ?? 1,
    requiresAi: question.question_type === 'analogy'
  }));
}

export async function gradeAnalogy({ questionText, template, userAnswer }) {
  const data = await chatJson(
    [
      {
        role: 'system',
        content: '你是宽容但准确的英语老师。只输出合法 JSON。'
      },
      {
        role: 'user',
        content: `判断学生的造句是否正确。

题目要求：${questionText}
标准模板参考：${template || ''}
学生答案：${userAnswer}

输出JSON：
{
  "is_correct": true,
  "feedback": "结构正确",
  "score": 100
}

评判标准：结构相似、语法正确、意思通顺即可给正确。不要过于严格。`
      }
    ],
    { temperature: 0.1, maxTokens: 500 }
  );

  const result = gradingSchema.parse(data);
  return {
    isCorrect: result.is_correct,
    feedback: result.feedback.slice(0, 40),
    score: Math.round(result.score)
  };
}

export async function generateKnowledgeGraph({ grammarPointName, notesContent }) {
  const data = await chatJson(
    [
      {
        role: 'system',
        content: '你是英语知识图谱设计助手。只输出合法 JSON。'
      },
      {
        role: 'user',
        content: `基于语法点“${grammarPointName}”和以下笔记内容，生成知识图谱。

笔记内容：${notesContent}

输出JSON格式：
{
  "nodes": [
    {"id": "1", "name": "节点名", "description": "简短说明"}
  ],
  "edges": [
    {"source": "1", "target": "2", "label": "关系类型（前置/后置/易混淆）"}
  ]
}

要求：
1. 包含前置知识（需要先掌握什么）
2. 包含后续拓展（学完可以学什么）
3. 包含2个易混淆的相关语法点
4. 共5-7个节点`
      }
    ],
    { temperature: 0.35, maxTokens: 1500 }
  );

  return graphSchema.parse(data);
}

export async function generateClassroomKnowledgeGraph({ groupName, corpus }) {
  const corpusLines = corpus
    .map((item) => `${item.english} | ${item.chinese} | ${item.englishExplain} | ${item.phonetic}`)
    .join('\n');

  const data = await chatJson(
    [
      {
        role: 'system',
        content: '你是英语课堂知识图谱设计助手。只输出合法 JSON，不输出解释。'
      },
      {
        role: 'user',
        content: `基于词组组“${groupName}”和以下课堂语料，生成知识图谱。

语料：
${corpusLines}

输出 JSON：
{
  "nodes": [
    {"id": "give", "name": "give", "type": "root", "meaning": "给"}
  ],
  "edges": [
    {"source": "give", "target": "give_up", "label": "词组"}
  ]
}

要求：
1. 节点 id 使用英文小写，空格替换为下划线。
2. 节点 type 从 root、inflection、phrase 中选择。
3. 包含所有语料节点。
4. 边体现词形变化、词组、易混淆关系。`
      }
    ],
    { temperature: 0.2, maxTokens: 1400 }
  );

  return classroomGraphSchema.parse(data);
}
