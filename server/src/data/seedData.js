export const seedUnits = [
  {
    name: 'Unit 1 - 现在完成时',
    gradeLevel: '初中',
    grammarPoints: [
      {
        name: '现在完成时',
        description: 'have/has done 表示过去动作对现在的影响，常与 yet、before、over the past few years 连用。',
        notesContent:
          '现在完成时结构：have/has + 过去分词。常见时间状语：yet, already, before, over the past few years, up to now。注意过去式和过去分词变化。'
      }
    ]
  },
  {
    name: 'Unit 2 - strike用法',
    gradeLevel: '初中',
    grammarPoints: [
      {
        name: 'strike用法',
        description: 'strike 可表示“击打”，也可用于 It struck sb that ... 表示“某人突然想到”。',
        notesContent:
          'strike 的过去式和过去分词都是 struck。固定句型：It struck me that ...，近义表达：It occurred to me that ...。'
      }
    ]
  },
  {
    name: 'Unit 3 - 连词+分词',
    gradeLevel: '初中',
    grammarPoints: [
      {
        name: '连词+分词',
        description: 'When/While + 分词可简化状语从句，主动用现在分词，被动用过去分词。',
        notesContent:
          'When asked about his plan, he kept silent. while identifying me as an introvert. 连词后分词结构要判断主动/被动关系。'
      }
    ]
  },
  {
    name: 'Unit 4 - make相关短语',
    gradeLevel: '初中',
    grammarPoints: [
      {
        name: 'make相关短语',
        description: '掌握 make out、make up for，以及 give off、give away 等易混短语。',
        notesContent:
          'make out 表示辨认出；make up for 表示弥补；give off 表示散发出气味或光；give away 表示赠送或泄露。'
      }
    ]
  }
];

export const seedCorpus = [
  {
    sourceKey: 'u1-collocation-yet',
    unitName: 'Unit 1 - 现在完成时',
    grammarPointName: '现在完成时',
    questionType: 'collocation',
    questionText: 'I have not seen him ___ (截止到现在).',
    acceptableAnswers: ['yet', 'up to now'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u1-translation-years',
    unitName: 'Unit 1 - 现在完成时',
    grammarPointName: '现在完成时',
    questionType: 'translation',
    questionText: '在过去的几年里',
    acceptableAnswers: ['over the past few years', 'over the last few years'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u1-phrase-before',
    unitName: 'Unit 1 - 现在完成时',
    grammarPointName: '现在完成时',
    questionType: 'phrase',
    questionText: '用 before 造一个现在完成时的句子',
    acceptableAnswers: ['I have met him before.', 'I have seen it before.'],
    matchRule: 'case_insensitive',
    difficulty: 2
  },
  {
    sourceKey: 'u1-morphology-struck-pp',
    unitName: 'Unit 1 - 现在完成时',
    grammarPointName: '现在完成时',
    questionType: 'morphology',
    questionText: 'strike 的过去分词',
    acceptableAnswers: ['struck'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u1-synonym-before',
    unitName: 'Unit 1 - 现在完成时',
    grammarPointName: '现在完成时',
    questionType: 'synonym',
    questionText: 'before 表示“以前”时的同义表达是？',
    acceptableAnswers: ['previously', 'earlier'],
    matchRule: 'case_insensitive',
    difficulty: 2
  },
  {
    sourceKey: 'u2-collocation-struck',
    unitName: 'Unit 2 - strike用法',
    grammarPointName: 'strike用法',
    questionType: 'collocation',
    questionText: 'It ___ sb that + 句子',
    acceptableAnswers: ['struck'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u2-translation-occurred',
    unitName: 'Unit 2 - strike用法',
    grammarPointName: 'strike用法',
    questionType: 'translation',
    questionText: '我突然想到',
    acceptableAnswers: ['It struck me that', 'It occurred to me that'],
    matchRule: 'case_insensitive',
    difficulty: 2
  },
  {
    sourceKey: 'u2-morphology-struck-past',
    unitName: 'Unit 2 - strike用法',
    grammarPointName: 'strike用法',
    questionType: 'morphology',
    questionText: 'strike 的过去式',
    acceptableAnswers: ['struck'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u2-analogy-struck-me',
    unitName: 'Unit 2 - strike用法',
    grammarPointName: 'strike用法',
    questionType: 'analogy',
    questionText: '模仿 It struck me that I had left my book at home 结构，用 forget 造句',
    acceptableAnswers: ['It struck me that I forgot the meeting.'],
    template: 'It struck me that I had left my book at home.',
    matchRule: 'case_insensitive',
    requiresAi: true,
    difficulty: 3
  },
  {
    sourceKey: 'u3-analogy-when-invited',
    unitName: 'Unit 3 - 连词+分词',
    grammarPointName: '连词+分词',
    questionType: 'analogy',
    questionText: '模仿 When asked about his plan, he kept silent 结构，用 invite 造句',
    acceptableAnswers: ['When invited to the party, she was very happy.'],
    template: 'When asked about his plan, he kept silent.',
    matchRule: 'case_insensitive',
    requiresAi: true,
    difficulty: 3
  },
  {
    sourceKey: 'u3-collocation-identifying',
    unitName: 'Unit 3 - 连词+分词',
    grammarPointName: '连词+分词',
    questionType: 'collocation',
    questionText: 'while ___ (identify) me as an introvert',
    acceptableAnswers: ['identifying'],
    matchRule: 'case_insensitive',
    difficulty: 2
  },
  {
    sourceKey: 'u3-morphology-identifying',
    unitName: 'Unit 3 - 连词+分词',
    grammarPointName: '连词+分词',
    questionType: 'morphology',
    questionText: 'identify 的现在分词',
    acceptableAnswers: ['identifying'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u3-translation-when-asked',
    unitName: 'Unit 3 - 连词+分词',
    grammarPointName: '连词+分词',
    questionType: 'translation',
    questionText: '当被问到他的计划时',
    acceptableAnswers: ['When asked about his plan', 'When he was asked about his plan'],
    matchRule: 'case_insensitive',
    difficulty: 2
  },
  {
    sourceKey: 'u4-phrase-make-out',
    unitName: 'Unit 4 - make相关短语',
    grammarPointName: 'make相关短语',
    questionType: 'phrase',
    questionText: '辨认出',
    acceptableAnswers: ['make out'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u4-collocation-give-off',
    unitName: 'Unit 4 - make相关短语',
    grammarPointName: 'make相关短语',
    questionType: 'collocation',
    questionText: '散发出（气味/光）',
    acceptableAnswers: ['give off'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u4-synonym-give-away',
    unitName: 'Unit 4 - make相关短语',
    grammarPointName: 'make相关短语',
    questionType: 'synonym',
    questionText: 'give away 的含义（两个）',
    acceptableAnswers: ['赠送, 泄露', '赠送；泄露', '泄露, 赠送', 'give as a gift and reveal'],
    matchRule: 'case_insensitive',
    difficulty: 2
  },
  {
    sourceKey: 'u4-phrase-make-up-for',
    unitName: 'Unit 4 - make相关短语',
    grammarPointName: 'make相关短语',
    questionType: 'phrase',
    questionText: '弥补',
    acceptableAnswers: ['make up for'],
    matchRule: 'case_insensitive',
    difficulty: 1
  },
  {
    sourceKey: 'u4-morphology-made',
    unitName: 'Unit 4 - make相关短语',
    grammarPointName: 'make相关短语',
    questionType: 'morphology',
    questionText: 'make 的过去式',
    acceptableAnswers: ['made'],
    matchRule: 'case_insensitive',
    difficulty: 1
  }
];

